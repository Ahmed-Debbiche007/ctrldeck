package media

import (
	"fmt"
	"runtime"
)

// MediaState represents the current media status and metadata.
// This is the structure that will be sent to your Electron/mobile clients.
type MediaState struct {
	Title     string `json:"title"`
	Artist    string `json:"artist"`
	Status    string `json:"status"`    // "Playing", "Paused", or "Stopped"
	Thumbnail string `json:"thumbnail"` // Base64 encoded image string (JPEG/PNG)
}

// OnUpdate is the callback function called by the platform-specific listener
// whenever the media state changes. You should define this in your main application
// to push updates to your frontend clients (e.g., via WebSocket).
var OnUpdate func(MediaState)

// Controller is the public interface for the media control daemon functions.
type Controller interface {
	// StartListener initiates the background process to listen for media state changes.
	StartListener() error
	// GetState safely retrieves the last known media state.
	GetState() MediaState
	// PlayPause toggles the media playback state.
	PlayPause() error
	// NextTrack skips to the next track.
	NextTrack() error
	// PrevTrack skips to the previous track.
	PrevTrack() error
}

// Global instance of the platform-specific controller.
// It is initialized by the corresponding media_control_*.go file using an init() function.
var Current Controller

func init() {
	// Simple check to ensure a controller was initialized.
	if Current == nil {
		fmt.Printf("Warning: No media controller initialized for platform: %s/%s\n", runtime.GOOS, runtime.GOARCH)
	}
}
