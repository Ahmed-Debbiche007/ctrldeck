//go:build windows
// +build windows

package actions

import (
	"syscall"
	"unsafe"
)

var (
	modOle32           = syscall.NewLazyDLL("ole32.dll")
	procCoInitializeEx = modOle32.NewProc("CoInitializeEx")
	procCoUninitialize = modOle32.NewProc("CoUninitialize")
)

// COM GUIDs
var (
	CLSID_MMDeviceEnumerator = syscall.GUID{
		Data1: 0xBCDE0395,
		Data2: 0xE52F,
		Data3: 0x467C,
		Data4: [8]byte{0x8E, 0x3D, 0xC4, 0x57, 0x92, 0x91, 0x69, 0x2E},
	}
	IID_IMMDeviceEnumerator = syscall.GUID{
		Data1: 0xA95664D2,
		Data2: 0x9614,
		Data3: 0x4F35,
		Data4: [8]byte{0xA7, 0x46, 0xDE, 0x8D, 0xB6, 0x36, 0x17, 0xE6},
	}
	IID_IAudioEndpointVolume = syscall.GUID{
		Data1: 0x5CDF2C82,
		Data2: 0x841E,
		Data3: 0x4546,
		Data4: [8]byte{0x97, 0x22, 0x0C, 0xF7, 0x40, 0x78, 0x22, 0x9A},
	}
)

const (
	eRender              = 0
	eMultimedia          = 1
	COINIT_MULTITHREADED = 0x0
)

// getAudioEndpointVolume initializes COM and returns the audio endpoint volume interface
func getAudioEndpointVolume() (*uintptr, error) {
	// Initialize COM
	hr, _, _ := procCoInitializeEx.Call(0, COINIT_MULTITHREADED)
	// HRESULT S_OK = 0, S_FALSE = 1 (already initialized), RPC_E_CHANGED_MODE = 0x80010106
	if hr != 0 && hr != 1 && hr != 0x80010106 {
		return nil, syscall.Errno(hr)
	}

	// Create MMDeviceEnumerator
	var enumerator *uintptr
	hr, _, _ = syscall.SyscallN(
		procCoCreateInstance(),
		uintptr(unsafe.Pointer(&CLSID_MMDeviceEnumerator)),
		0,
		syscall.CLSCTX_INPROC_SERVER,
		uintptr(unsafe.Pointer(&IID_IMMDeviceEnumerator)),
		uintptr(unsafe.Pointer(&enumerator)),
	)
	if hr != 0 {
		return nil, syscall.Errno(hr)
	}

	// IMMDeviceEnumerator::GetDefaultAudioEndpoint
	var device *uintptr
	vtbl := *(**[8]uintptr)(unsafe.Pointer(enumerator))
	hr, _, _ = syscall.SyscallN(
		vtbl[4], // GetDefaultAudioEndpoint is at index 4
		uintptr(unsafe.Pointer(enumerator)),
		eRender,
		eMultimedia,
		uintptr(unsafe.Pointer(&device)),
	)
	if hr != 0 {
		return nil, syscall.Errno(hr)
	}

	// IMMDevice::Activate
	var endpointVolume *uintptr
	vtblDevice := *(**[8]uintptr)(unsafe.Pointer(device))
	hr, _, _ = syscall.SyscallN(
		vtblDevice[3], // Activate is at index 3
		uintptr(unsafe.Pointer(device)),
		uintptr(unsafe.Pointer(&IID_IAudioEndpointVolume)),
		syscall.CLSCTX_INPROC_SERVER,
		0,
		uintptr(unsafe.Pointer(&endpointVolume)),
	)
	if hr != 0 {
		return nil, syscall.Errno(hr)
	}

	return endpointVolume, nil
}

func procCoCreateInstance() uintptr {
	proc := modOle32.NewProc("CoCreateInstance")
	return proc.Addr()
}

// Windows implementations using native COM
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
	endpointVolume, err := getAudioEndpointVolume()
	if err != nil {
		return err
	}
	defer procCoUninitialize.Call()

	// IAudioEndpointVolume::SetMasterVolumeLevelScalar (index 7)
	vtbl := *(**[16]uintptr)(unsafe.Pointer(endpointVolume))
	volumeLevel := float32(level) / 100.0
	hr, _, _ := syscall.SyscallN(
		vtbl[7],
		uintptr(unsafe.Pointer(endpointVolume)),
		uintptr(*(*uint32)(unsafe.Pointer(&volumeLevel))),
		0, // pguidEventContext = NULL
	)
	if hr != 0 {
		return syscall.Errno(hr)
	}
	return nil
}

func (v *VolumeController) getVolumeWindows() (int, error) {
	endpointVolume, err := getAudioEndpointVolume()
	if err != nil {
		return 50, err
	}
	defer procCoUninitialize.Call()

	// IAudioEndpointVolume::GetMasterVolumeLevelScalar (index 9)
	vtbl := *(**[16]uintptr)(unsafe.Pointer(endpointVolume))
	var volumeLevel float32
	hr, _, _ := syscall.SyscallN(
		vtbl[9],
		uintptr(unsafe.Pointer(endpointVolume)),
		uintptr(unsafe.Pointer(&volumeLevel)),
	)
	if hr != 0 {
		return 50, syscall.Errno(hr)
	}
	return int(volumeLevel * 100), nil
}

func (v *VolumeController) toggleMuteWindows() error {
	muted, err := v.isMutedWindows()
	if err != nil {
		return err
	}
	return v.setMuteWindows(!muted)
}

func (v *VolumeController) setMuteWindows(mute bool) error {
	endpointVolume, err := getAudioEndpointVolume()
	if err != nil {
		return err
	}
	defer procCoUninitialize.Call()

	// IAudioEndpointVolume::SetMute (index 13)
	vtbl := *(**[16]uintptr)(unsafe.Pointer(endpointVolume))
	var muteVal uintptr
	if mute {
		muteVal = 1
	}
	hr, _, _ := syscall.SyscallN(
		vtbl[13],
		uintptr(unsafe.Pointer(endpointVolume)),
		muteVal,
		0, // pguidEventContext = NULL
	)
	if hr != 0 {
		return syscall.Errno(hr)
	}
	return nil
}

func (v *VolumeController) isMutedWindows() (bool, error) {
	endpointVolume, err := getAudioEndpointVolume()
	if err != nil {
		return false, err
	}
	defer procCoUninitialize.Call()

	// IAudioEndpointVolume::GetMute (index 14)
	vtbl := *(**[16]uintptr)(unsafe.Pointer(endpointVolume))
	var muted int32
	hr, _, _ := syscall.SyscallN(
		vtbl[14],
		uintptr(unsafe.Pointer(endpointVolume)),
		uintptr(unsafe.Pointer(&muted)),
	)
	if hr != 0 {
		return false, syscall.Errno(hr)
	}
	return muted != 0, nil
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
