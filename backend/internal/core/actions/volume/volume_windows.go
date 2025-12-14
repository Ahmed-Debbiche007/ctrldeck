package volume

import (
	"github.com/go-ole/go-ole"
	"github.com/moutend/go-wca/pkg/wca"
)

// getAudioEndpoint initializes COM and returns the audio endpoint volume interface
func getAudioEndpoint() (*wca.IAudioEndpointVolume, func(), error) {
	// Initialize COM with apartment threading (required for audio APIs)
	if err := ole.CoInitializeEx(0, ole.COINIT_APARTMENTTHREADED); err != nil {
		// Check if already initialized (S_FALSE = 1)
		oleErr, ok := err.(*ole.OleError)
		if !ok || (oleErr.Code() != 0x00000001 && oleErr.Code() != 0x80010106) {
			return nil, nil, err
		}
	}

	cleanup := func() {
		ole.CoUninitialize()
	}

	var enumerator *wca.IMMDeviceEnumerator
	if err := wca.CoCreateInstance(
		wca.CLSID_MMDeviceEnumerator,
		0,
		wca.CLSCTX_ALL,
		wca.IID_IMMDeviceEnumerator,
		&enumerator,
	); err != nil {
		cleanup()
		return nil, nil, err
	}
	defer enumerator.Release()

	var device *wca.IMMDevice
	if err := enumerator.GetDefaultAudioEndpoint(wca.ERender, wca.EConsole, &device); err != nil {
		cleanup()
		return nil, nil, err
	}
	defer device.Release()

	var endpoint *wca.IAudioEndpointVolume
	if err := device.Activate(wca.IID_IAudioEndpointVolume, wca.CLSCTX_ALL, nil, &endpoint); err != nil {
		cleanup()
		return nil, nil, err
	}

	return endpoint, func() {
		endpoint.Release()
		cleanup()
	}, nil
}

// Windows implementations using go-wca
func (v *VolumeController) volumeUpWindows(step int) error {
	current, err := v.getVolumeWindows()
	if err != nil {
		return err
	}
	newLevel := current + step
	if newLevel > 100 {
		newLevel = 100
	}
	return v.setVolumeWindows(newLevel)
}

func (v *VolumeController) volumeDownWindows(step int) error {
	current, err := v.getVolumeWindows()
	if err != nil {
		return err
	}
	newLevel := current - step
	if newLevel < 0 {
		newLevel = 0
	}
	return v.setVolumeWindows(newLevel)
}

func (v *VolumeController) setVolumeWindows(level int) error {
	endpoint, cleanup, err := getAudioEndpoint()
	if err != nil {
		return err
	}
	defer cleanup()

	volumeLevel := float32(level) / 100.0
	if volumeLevel < 0 {
		volumeLevel = 0
	}
	if volumeLevel > 1 {
		volumeLevel = 1
	}

	return endpoint.SetMasterVolumeLevelScalar(volumeLevel, nil)
}

func (v *VolumeController) getVolumeWindows() (int, error) {
	endpoint, cleanup, err := getAudioEndpoint()
	if err != nil {
		return 50, err
	}
	defer cleanup()

	var level float32
	if err := endpoint.GetMasterVolumeLevelScalar(&level); err != nil {
		return 50, err
	}

	return int(level * 100), nil
}

func (v *VolumeController) toggleMuteWindows() error {
	endpoint, cleanup, err := getAudioEndpoint()
	if err != nil {
		return err
	}
	defer cleanup()

	var muted bool
	if err := endpoint.GetMute(&muted); err != nil {
		return err
	}

	// Toggle the mute state
	newMuted := !muted
	if err := endpoint.SetMute(newMuted, nil); err != nil {
		return err
	}

	return nil
}

func (v *VolumeController) isMutedWindows() (bool, error) {
	endpoint, cleanup, err := getAudioEndpoint()
	if err != nil {
		return false, err
	}
	defer cleanup()

	var muted bool
	if err := endpoint.GetMute(&muted); err != nil {
		return false, err
	}

	return muted, nil
}

// Platform-specific dispatch functions for Windows
func (v *VolumeController) volumeUpPlatform(step int) error {
	return v.volumeUpWindows(step)
}

func (v *VolumeController) volumeDownPlatform(step int) error {
	return v.volumeDownWindows(step)
}

func (v *VolumeController) setVolumePlatform(level int) error {
	return v.setVolumeWindows(level)
}

func (v *VolumeController) getVolumePlatform() (int, error) {
	return v.getVolumeWindows()
}

func (v *VolumeController) toggleMutePlatform() error {
	return v.toggleMuteWindows()
}

func (v *VolumeController) isMutedPlatform() (bool, error) {
	return v.isMutedWindows()
}
