package mic

import (
	"github.com/go-ole/go-ole"
	"github.com/moutend/go-wca/pkg/wca"
)

// getMicrophoneEndpoint initializes COM and returns the microphone audio endpoint volume interface
func getMicrophoneEndpoint() (*wca.IAudioEndpointVolume, func(), error) {
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
	// Use ECapture for microphone (recording device) instead of ERender (playback device)
	if err := enumerator.GetDefaultAudioEndpoint(wca.ECapture, wca.EConsole, &device); err != nil {
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

// Windows implementations using go-wca with ECapture for microphone
func (m *MicController) toggleMutePlatform() error {
	endpoint, cleanup, err := getMicrophoneEndpoint()
	if err != nil {
		return err
	}
	defer cleanup()

	var muted bool
	if err := endpoint.GetMute(&muted); err != nil {
		return err
	}

	return endpoint.SetMute(!muted, nil)
}

func (m *MicController) mutePlatform() error {
	endpoint, cleanup, err := getMicrophoneEndpoint()
	if err != nil {
		return err
	}
	defer cleanup()

	return endpoint.SetMute(true, nil)
}

func (m *MicController) unmutePlatform() error {
	endpoint, cleanup, err := getMicrophoneEndpoint()
	if err != nil {
		return err
	}
	defer cleanup()

	return endpoint.SetMute(false, nil)
}

func (m *MicController) isMutedPlatform() (bool, error) {
	endpoint, cleanup, err := getMicrophoneEndpoint()
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
