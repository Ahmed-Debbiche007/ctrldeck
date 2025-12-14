package volume

// VolumeController handles volume control operations
type VolumeController struct{}

// NewVolumeController creates a new VolumeController
func NewVolumeController() *VolumeController {
	return &VolumeController{}
}

// VolumeUp increases volume by the specified percentage
func (v *VolumeController) VolumeUp(step int) error {
	return v.volumeUpPlatform(step)
}

// VolumeDown decreases volume by the specified percentage
func (v *VolumeController) VolumeDown(step int) error {
	return v.volumeDownPlatform(step)
}

// SetVolume sets the volume to a specific percentage
func (v *VolumeController) SetVolume(level int) error {
	if level < 0 {
		level = 0
	}
	if level > 100 {
		level = 100
	}
	return v.setVolumePlatform(level)
}

// GetVolume returns the current volume level (0-100)
func (v *VolumeController) GetVolume() (int, error) {
	return v.getVolumePlatform()
}

// ToggleMute toggles the volume mute state
func (v *VolumeController) ToggleMute() error {
	return v.toggleMutePlatform()
}

// IsMuted returns whether the volume is currently muted
func (v *VolumeController) IsMuted() (bool, error) {
	return v.isMutedPlatform()
}
