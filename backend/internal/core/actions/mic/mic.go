package mic

// MicController handles microphone mute/unmute operations
type MicController struct{}

// NewMicController creates a new MicController
func NewMicController() *MicController {
	return &MicController{}
}

// ToggleMute toggles the microphone mute state
func (m *MicController) ToggleMute() error {
	return m.toggleMutePlatform()
}

// Mute mutes the microphone
func (m *MicController) Mute() error {
	return m.mutePlatform()
}

// Unmute unmutes the microphone
func (m *MicController) Unmute() error {
	return m.unmutePlatform()
}

// IsMuted returns whether the microphone is muted
func (m *MicController) IsMuted() (bool, error) {
	return m.isMutedPlatform()
}
