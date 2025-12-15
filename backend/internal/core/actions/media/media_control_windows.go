//go:build windows

package media

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"sync"
	"syscall"

	"github.com/micmonay/keybd_event"
)

// WindowsController implements the Controller interface for Windows.
type WindowsController struct {
	stateLock    sync.RWMutex
	currentState MediaState
}

func init() {
	// Initialize the global controller instance for Windows
	Current = &WindowsController{}
}

// StartListener launches the persistent PowerShell worker to stream state updates.
func (w *WindowsController) StartListener() error {
	// PowerShell script to listen to WinRT events, format as JSON, and print to stdout.
	const psScript = `
	[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
	[Windows.Storage.Streams.DataReader,Windows.Storage.Streams,ContentType=WindowsRuntime] | Out-Null

	function Get-MediaInfo {
		try {
			$manager = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync().GetAwaiter().GetResult()
			$session = $manager.GetCurrentSession()

			if (-not $session) {
				return @{ Status = "Stopped"; Title = ""; Artist = ""; Thumbnail = "" } | ConvertTo-Json -Compress
			}

			$info = $session.GetPlaybackInfo()
			$props = $session.TryGetMediaPropertiesAsync().GetAwaiter().GetResult()

			$statusEnum = $info.PlaybackStatus # 3=Playing, 4=Paused, 2=Stopped
			$statusStr = if ($statusEnum -eq 3) { "Playing" } elseif ($statusEnum -eq 4) { "Paused" } else { "Stopped" }

			$b64 = ""
			if ($props.Thumbnail) {
				try {
					$streamRef = $props.Thumbnail
					$stream = $streamRef.OpenReadAsync().GetAwaiter().GetResult()
					$reader = [Windows.Storage.Streams.DataReader]::new($stream)
					$loaded = $reader.LoadAsync($stream.Size).GetAwaiter().GetResult()
					$bytes = New-Object byte[] $stream.Size
					$reader.ReadBytes($bytes)
					$b64 = [Convert]::ToBase64String($bytes)
				} catch {}
			}

			$data = @{ Title = $props.Title; Artist = $props.Artist; Status = $statusStr; Thumbnail = $b64 }
			return $data | ConvertTo-Json -Compress
		} catch {
			return @{ Status = "Stopped"; Title = ""; Artist = ""; Thumbnail = "" } | ConvertTo-Json -Compress
		}
	}

	# Main Loop: Poll frequently enough to capture changes quickly (500ms is safe)
	$lastJson = ""
	while ($true) {
		$currentJson = Get-MediaInfo
		if ($currentJson -ne $lastJson) {
			Write-Output $currentJson
			$lastJson = $currentJson
		}
		Start-Sleep -Milliseconds 500
	}
	`

	cmd := exec.Command("powershell", "-NoProfile", "-Command", psScript)

	// Hide the PowerShell window popup
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start PowerShell worker: %w", err)
	}

	// Start reading the JSON stream in a background goroutine
	go w.processStream(stdout)
	return nil
}

func (w *WindowsController) processStream(stdout *os.File) {
	scanner := bufio.NewScanner(stdout)
	// Buffer must be large enough to handle Base64 images (up to 4MB)
	const maxCapacity = 4 * 1024 * 1024
	buf := make([]byte, maxCapacity)
	scanner.Buffer(buf, maxCapacity)

	for scanner.Scan() {
		line := scanner.Text()
		var newState MediaState
		if err := json.Unmarshal([]byte(line), &newState); err == nil {
			w.stateLock.Lock()
			w.currentState = newState
			w.stateLock.Unlock()

			// Notify the main application
			if OnUpdate != nil {
				OnUpdate(newState)
			}
		}
	}
	log.Println("Windows media listener stopped.")
}

// GetState safely retrieves the current cached state.
func (w *WindowsController) GetState() MediaState {
	w.stateLock.RLock()
	defer w.stateLock.RUnlock()
	return w.currentState
}

// PlayPause simulates the media play/pause key press.
func (w *WindowsController) PlayPause() error {
	return simulateKey(keybd_event.VK_MEDIA_PLAY_PAUSE)
}

// NextTrack simulates the media next track key press.
func (w *WindowsController) NextTrack() error {
	return simulateKey(keybd_event.VK_MEDIA_NEXT_TRACK)
}

// PrevTrack simulates the media previous track key press.
func (w *WindowsController) PrevTrack() error {
	return simulateKey(keybd_event.VK_MEDIA_PREV_TRACK)
}

// simulateKey is a helper function to simulate a key press using the external library.
func simulateKey(key int) error {
	kb, err := keybd_event.NewKeyBonding()
	if err != nil {
		return fmt.Errorf("failed to initialize key bonding: %w", err)
	}
	// The library handles the low-level Windows key simulation
	kb.SetKeys(key)
	return kb.Launching()
}
