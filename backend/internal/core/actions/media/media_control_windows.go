//go:build windows

package media

import (
	_ "embed"
	"fmt"
	"log"
	"os/exec"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/go-ole/go-ole"
	"github.com/micmonay/keybd_event"
)

//go:embed media_control.ps1
var mediaControlScript string

// WindowsController implements the Controller interface for Windows using native APIs.
type WindowsController struct {
	stateLock      sync.RWMutex
	currentState   MediaState
	stopChan       chan struct{}
	comInit        bool
	thumbCache     map[string]string // Cache for thumbnails (title+artist -> base64)
	thumbCacheLock sync.RWMutex
}

func init() {
	// Initialize the global controller instance for Windows
	Current = &WindowsController{
		stopChan:   make(chan struct{}),
		thumbCache: make(map[string]string),
	}
}

// StartListener starts the media state monitoring using native Windows APIs.
func (w *WindowsController) StartListener() error {
	// Initialize COM
	if err := ole.CoInitializeEx(0, ole.COINIT_MULTITHREADED); err != nil {
		// If already initialized, that's fine
		errStr := err.Error()
		if !strings.Contains(errStr, "already initialized") {
			return fmt.Errorf("failed to initialize COM: %w", err)
		}
	}
	w.comInit = true

	// Start the monitoring goroutine
	go w.monitorMediaState()

	log.Println("Windows media listener started with native Windows APIs")
	return nil
}

// monitorMediaState continuously monitors the media state
func (w *WindowsController) monitorMediaState() {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-w.stopChan:
			log.Println("Stopping media monitor")
			return
		case <-ticker.C:
			w.updateMediaState()
		}
	}
}

// updateMediaState fetches and updates the current media state
func (w *WindowsController) updateMediaState() {
	// Try multiple methods to get media state
	state := w.getMediaState()
	w.updateStateIfChanged(state)
}

// getMediaState attempts to get media info using multiple methods
func (w *WindowsController) getMediaState() MediaState {
	// Default state
	state := MediaState{
		Status:    "Stopped",
		Title:     "",
		Artist:    "",
		Thumbnail: "",
	}

	// Always try PowerShell first (provides complete data including thumbnails and accurate status)
	mediaInfo := w.getMediaFromPowerShell()

	// Use PowerShell data if we have a valid status (Playing/Paused) or valid media info
	if mediaInfo.Status == "Playing" || mediaInfo.Status == "Paused" {
		state.Title = mediaInfo.Title
		state.Artist = mediaInfo.Artist
		state.Status = mediaInfo.Status

		// Use cached thumbnail if available for the same track
		cacheKey := mediaInfo.Title + "|" + mediaInfo.Artist
		if mediaInfo.Thumbnail == "" && cacheKey != "|" {
			w.thumbCacheLock.RLock()
			if cached, ok := w.thumbCache[cacheKey]; ok {
				state.Thumbnail = cached
			}
			w.thumbCacheLock.RUnlock()
		} else if mediaInfo.Thumbnail != "" {
			state.Thumbnail = mediaInfo.Thumbnail
			// Cache the thumbnail
			if cacheKey != "|" {
				w.thumbCacheLock.Lock()
				if len(w.thumbCache) > 50 {
					// Clear cache if too large
					w.thumbCache = make(map[string]string)
				}
				w.thumbCache[cacheKey] = mediaInfo.Thumbnail
				w.thumbCacheLock.Unlock()
			}
		}
		return state
	}

	// PowerShell returned "Stopped" - no media session is active
	// Don't fallback to window titles as they're unreliable for status
	return state
}

// MediaInfo holds media information
type MediaInfo struct {
	Title     string
	Artist    string
	Status    string
	Thumbnail string
}

// getMediaFromPowerShell uses PowerShell to get media info with thumbnail support
func (w *WindowsController) getMediaFromPowerShell() MediaInfo {
	info := MediaInfo{Status: "Stopped"}

	// Execute PowerShell command using the embedded script
	cmd := exec.Command("powershell", "-NoProfile", "-NoLogo", "-ExecutionPolicy", "Bypass", "-Command", mediaControlScript)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	output, err := cmd.Output()
	if err != nil {
		log.Printf("PowerShell error: %v", err)
		return info
	}

	// Parse the JSON output
	outputStr := strings.TrimSpace(string(output))
	if outputStr != "" && strings.Contains(outputStr, "{") {
		info.Status = extractJSONValue(outputStr, "Status")
		info.Title = extractJSONValue(outputStr, "Title")
		info.Artist = extractJSONValue(outputStr, "Artist")
		info.Thumbnail = extractJSONValue(outputStr, "Thumbnail")

		// Clean up the base64 thumbnail if present
		if info.Thumbnail != "" {
			// Remove any JSON escaping
			info.Thumbnail = strings.ReplaceAll(info.Thumbnail, "\\", "")
		}
	}

	return info
}

// extractJSONValue extracts a value from simple JSON string
func extractJSONValue(json, key string) string {
	searchKey := `"` + key + `":"`
	if idx := strings.Index(json, searchKey); idx >= 0 {
		start := idx + len(searchKey)
		if end := strings.Index(json[start:], `"`); end >= 0 {
			return json[start : start+end]
		}
	}
	return ""
}

// updateStateIfChanged updates the current state and notifies listeners if changed
func (w *WindowsController) updateStateIfChanged(newState MediaState) {
	w.stateLock.Lock()
	defer w.stateLock.Unlock()

	// Check if state changed
	if w.currentState.Status != newState.Status ||
		w.currentState.Title != newState.Title ||
		w.currentState.Artist != newState.Artist ||
		w.currentState.Thumbnail != newState.Thumbnail {

		log.Printf("Media state changed: Status=%s, Title=%s, Artist=%s",
			newState.Status, newState.Title, newState.Artist)

		w.currentState = newState

		// Notify the main application
		if OnUpdate != nil {
			OnUpdate(newState)
		}
	}
}

// GetState safely retrieves the current cached state
func (w *WindowsController) GetState() MediaState {
	w.stateLock.RLock()
	defer w.stateLock.RUnlock()
	return w.currentState
}

// Stop stops the listener
func (w *WindowsController) Stop() {
	close(w.stopChan)
	if w.comInit {
		ole.CoUninitialize()
		w.comInit = false
	}
}

// PlayPause simulates the media play/pause key press
func (w *WindowsController) PlayPause() error {
	return simulateKey(keybd_event.VK_MEDIA_PLAY_PAUSE)
}

// NextTrack simulates the media next track key press
func (w *WindowsController) NextTrack() error {
	return simulateKey(keybd_event.VK_MEDIA_NEXT_TRACK)
}

// PrevTrack simulates the media previous track key press
func (w *WindowsController) PrevTrack() error {
	return simulateKey(keybd_event.VK_MEDIA_PREV_TRACK)
}

// simulateKey is a helper function to simulate a key press
func simulateKey(key int) error {
	kb, err := keybd_event.NewKeyBonding()
	if err != nil {
		return fmt.Errorf("failed to initialize key bonding: %w", err)
	}
	kb.SetKeys(key)
	return kb.Launching()
}
