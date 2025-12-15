//go:build linux

package media

import (
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/godbus/dbus/v5"
)

// LinuxController implements the Controller interface for Linux.
type LinuxController struct {
	stateLock    sync.RWMutex
	currentState MediaState
	conn         *dbus.Conn
	artCache     map[string]string // Cache artwork URL -> base64
	artCacheLock sync.RWMutex
}

func init() {
	// Initialize the global controller instance for Linux
	Current = &LinuxController{
		artCache: make(map[string]string),
	}
}

// StartListener connects to D-Bus and subscribes to MPRIS events.
func (l *LinuxController) StartListener() error {
	conn, err := dbus.ConnectSessionBus()
	if err != nil {
		return fmt.Errorf("failed to connect to D-Bus: %w", err)
	}
	l.conn = conn

	// Start polling initially to populate the state immediately
	go l.pollInitialState(conn)

	// Start the main loop to handle D-Bus signals for property changes
	go l.handleSignals(conn)

	// Start periodic polling as a fallback for missed signals
	go l.periodicPoll(conn)

	return nil
}

func (l *LinuxController) pollInitialState(conn *dbus.Conn) {
	// Wait a moment for players to register
	time.Sleep(500 * time.Millisecond)
	l.updateStateFromDbus(conn)
}

// periodicPoll polls the media state every few seconds as a fallback
func (l *LinuxController) periodicPoll(conn *dbus.Conn) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		l.updateStateFromDbus(conn)
	}
}

func (l *LinuxController) handleSignals(conn *dbus.Conn) {
	// Match signals for NameOwnerChanged (player start/stop)
	if err := conn.AddMatchSignal(
		dbus.WithMatchInterface("org.freedesktop.DBus"),
		dbus.WithMatchMember("NameOwnerChanged"),
	); err != nil {
		log.Printf("Warning: D-Bus NameOwnerChanged match failed: %v", err)
	}

	// Match signals for PropertiesChanged on MPRIS players
	if err := conn.AddMatchSignal(
		dbus.WithMatchInterface("org.freedesktop.DBus.Properties"),
		dbus.WithMatchMember("PropertiesChanged"),
	); err != nil {
		log.Printf("Warning: D-Bus PropertiesChanged match failed: %v", err)
	}

	c := make(chan *dbus.Signal, 10)
	conn.Signal(c)

	for v := range c {
		switch v.Name {
		case "org.freedesktop.DBus.NameOwnerChanged":
			// A player started or stopped, re-scan all players
			go l.updateStateFromDbus(conn)
		case "org.freedesktop.DBus.Properties.PropertiesChanged":
			// Check if it's from an MPRIS player interface
			if len(v.Body) > 0 {
				if iface, ok := v.Body[0].(string); ok {
					// The interface name will be "org.mpris.MediaPlayer2.Player"
					if strings.Contains(iface, "mpris.MediaPlayer2") {
						go l.updateStateFromDbus(conn)
					}
				}
			}
		}
	}
}

func (l *LinuxController) updateStateFromDbus(conn *dbus.Conn) {
	var names []string
	if err := conn.BusObject().Call("org.freedesktop.DBus.ListNames", 0).Store(&names); err != nil {
		return
	}

	var foundPlayer bool
	for _, name := range names {
		if !strings.HasPrefix(name, "org.mpris.MediaPlayer2") {
			continue
		}

		obj := conn.Object(name, "/org/mpris/MediaPlayer2")

		// Get Playback Status
		playbackStatus, err := obj.GetProperty("org.mpris.MediaPlayer2.Player.PlaybackStatus")
		if err != nil {
			continue
		}

		statusStr, ok := playbackStatus.Value().(string)
		if !ok {
			continue
		}

		// Only care about Playing or Paused players (skip Stopped)
		if statusStr != "Playing" && statusStr != "Paused" {
			continue
		}

		// Get Metadata
		metadataVal, err := obj.GetProperty("org.mpris.MediaPlayer2.Player.Metadata")
		if err != nil {
			continue
		}

		metadata, ok := metadataVal.Value().(map[string]dbus.Variant)
		if !ok {
			continue
		}

		// Get artwork
		artUrl := getDbusString(metadata, "mpris:artUrl")
		thumbnail := l.fetchArtwork(artUrl)

		newState := MediaState{
			Status:    statusStr,
			Title:     getDbusString(metadata, "xesam:title"),
			Artist:    getDbusArtist(metadata, "xesam:artist"),
			Thumbnail: thumbnail,
		}

		// Check if state actually changed before updating
		l.stateLock.RLock()
		stateChanged := l.currentState.Status != newState.Status ||
			l.currentState.Title != newState.Title ||
			l.currentState.Artist != newState.Artist ||
			l.currentState.Thumbnail != newState.Thumbnail
		l.stateLock.RUnlock()

		if stateChanged {
			l.stateLock.Lock()
			l.currentState = newState
			l.stateLock.Unlock()

			if OnUpdate != nil {
				OnUpdate(newState)
			}
		}

		foundPlayer = true
		break // Process only the first active player found
	}

	// If no active player found, clear the state
	if !foundPlayer {
		l.stateLock.RLock()
		wasPlaying := l.currentState.Status != "" && l.currentState.Status != "Stopped"
		l.stateLock.RUnlock()

		if wasPlaying {
			emptyState := MediaState{
				Status:    "Stopped",
				Title:     "",
				Artist:    "",
				Thumbnail: "",
			}

			l.stateLock.Lock()
			l.currentState = emptyState
			l.stateLock.Unlock()

			if OnUpdate != nil {
				OnUpdate(emptyState)
			}
		}
	}
}

// fetchArtwork fetches artwork from URL and returns base64 encoded string
func (l *LinuxController) fetchArtwork(artUrl string) string {
	if artUrl == "" {
		return ""
	}

	// Check cache first
	l.artCacheLock.RLock()
	if cached, ok := l.artCache[artUrl]; ok {
		l.artCacheLock.RUnlock()
		return cached
	}
	l.artCacheLock.RUnlock()

	var data []byte
	var err error

	// Parse the URL to determine the scheme
	parsedUrl, parseErr := url.Parse(artUrl)
	if parseErr != nil {
		return ""
	}

	switch parsedUrl.Scheme {
	case "file":
		// Local file - read directly
		filePath := parsedUrl.Path
		data, err = os.ReadFile(filePath)
		if err != nil {
			log.Printf("Failed to read artwork file %s: %v", filePath, err)
			return ""
		}

	case "http", "https":
		// Remote URL - download
		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Get(artUrl)
		if err != nil {
			log.Printf("Failed to fetch artwork URL %s: %v", artUrl, err)
			return ""
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return ""
		}

		data, err = io.ReadAll(io.LimitReader(resp.Body, 5*1024*1024)) // Max 5MB
		if err != nil {
			log.Printf("Failed to read artwork response: %v", err)
			return ""
		}

	default:
		// Unknown scheme
		return ""
	}

	// Encode to base64
	encoded := base64.StdEncoding.EncodeToString(data)

	// Cache the result (limit cache size)
	l.artCacheLock.Lock()
	if len(l.artCache) > 50 {
		// Clear cache if too large
		l.artCache = make(map[string]string)
	}
	l.artCache[artUrl] = encoded
	l.artCacheLock.Unlock()

	return encoded
}

func getDbusString(metadata map[string]dbus.Variant, key string) string {
	if val, ok := metadata[key]; ok {
		if str, ok := val.Value().(string); ok {
			return str
		}
	}
	return ""
}

func getDbusArtist(metadata map[string]dbus.Variant, key string) string {
	if val, ok := metadata[key]; ok {
		// Artists are typically returned as an array of strings in MPRIS
		if artists, ok := val.Value().([]string); ok && len(artists) > 0 {
			return strings.Join(artists, ", ")
		}
	}
	return ""
}

// GetState safely retrieves the current cached state.
func (l *LinuxController) GetState() MediaState {
	l.stateLock.RLock()
	defer l.stateLock.RUnlock()
	return l.currentState
}

// findActivePlayer finds the first active MPRIS player
func (l *LinuxController) findActivePlayer() string {
	if l.conn == nil {
		return ""
	}

	var names []string
	l.conn.BusObject().Call("org.freedesktop.DBus.ListNames", 0).Store(&names)

	for _, name := range names {
		if strings.HasPrefix(name, "org.mpris.MediaPlayer2") {
			return name
		}
	}
	return ""
}

// PlayPause sends Play/Pause command to the active MPRIS player via D-Bus
func (l *LinuxController) PlayPause() error {
	// Try D-Bus first
	if l.conn != nil {
		player := l.findActivePlayer()
		if player != "" {
			obj := l.conn.Object(player, "/org/mpris/MediaPlayer2")
			call := obj.Call("org.mpris.MediaPlayer2.Player.PlayPause", 0)
			if call.Err == nil {
				// Trigger immediate update
				go l.updateStateFromDbus(l.conn)
				return nil
			}
		}
	}

	// Fallback to playerctl
	cmd := exec.Command("playerctl", "play-pause")
	err := cmd.Run()
	if err == nil {
		// Trigger immediate update
		go func() {
			time.Sleep(100 * time.Millisecond)
			l.updateStateFromDbus(l.conn)
		}()
	}
	return err
}

// NextTrack sends Next command to the active MPRIS player via D-Bus
func (l *LinuxController) NextTrack() error {
	// Try D-Bus first
	if l.conn != nil {
		player := l.findActivePlayer()
		if player != "" {
			obj := l.conn.Object(player, "/org/mpris/MediaPlayer2")
			call := obj.Call("org.mpris.MediaPlayer2.Player.Next", 0)
			if call.Err == nil {
				// Trigger immediate update
				go func() {
					time.Sleep(200 * time.Millisecond)
					l.updateStateFromDbus(l.conn)
				}()
				return nil
			}
		}
	}

	// Fallback to playerctl
	cmd := exec.Command("playerctl", "next")
	err := cmd.Run()
	if err == nil {
		go func() {
			time.Sleep(200 * time.Millisecond)
			l.updateStateFromDbus(l.conn)
		}()
	}
	return err
}

// PrevTrack sends Previous command to the active MPRIS player via D-Bus
func (l *LinuxController) PrevTrack() error {
	// Try D-Bus first
	if l.conn != nil {
		player := l.findActivePlayer()
		if player != "" {
			obj := l.conn.Object(player, "/org/mpris/MediaPlayer2")
			call := obj.Call("org.mpris.MediaPlayer2.Player.Previous", 0)
			if call.Err == nil {
				// Trigger immediate update
				go func() {
					time.Sleep(200 * time.Millisecond)
					l.updateStateFromDbus(l.conn)
				}()
				return nil
			}
		}
	}

	// Fallback to playerctl
	cmd := exec.Command("playerctl", "previous")
	err := cmd.Run()
	if err == nil {
		go func() {
			time.Sleep(200 * time.Millisecond)
			l.updateStateFromDbus(l.conn)
		}()
	}
	return err
}
