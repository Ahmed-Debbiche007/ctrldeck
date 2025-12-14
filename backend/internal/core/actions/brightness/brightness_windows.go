package brightness

import (
	"errors"
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Win32 API structures
type rect struct {
	Left   int32
	Top    int32
	Right  int32
	Bottom int32
}

type physicalMonitor struct {
	Handle      windows.Handle
	Description [128]uint16
}

// DLL and procedure definitions
var (
	dxva2  = windows.NewLazySystemDLL("dxva2.dll")
	user32 = windows.NewLazySystemDLL("user32.dll")

	pEnumDisplayMonitors                     = user32.NewProc("EnumDisplayMonitors")
	pGetNumberOfPhysicalMonitorsFromHMONITOR = dxva2.NewProc("GetNumberOfPhysicalMonitorsFromHMONITOR")
	pGetPhysicalMonitorsFromHMONITOR         = dxva2.NewProc("GetPhysicalMonitorsFromHMONITOR")
	pDestroyPhysicalMonitors                 = dxva2.NewProc("DestroyPhysicalMonitors")
	pGetMonitorBrightness                    = dxva2.NewProc("GetMonitorBrightness")
	pSetMonitorBrightness                    = dxva2.NewProc("SetMonitorBrightness")
)

// Monitor operation types
type monitorOp func(handle windows.Handle) error
type monitorGetOp func(handle windows.Handle) (int, error)

// Global variables for callback communication
var (
	currentOp      monitorOp
	currentGetOp   monitorGetOp
	lastBrightness int
	lastError      error
	opMutex        sync.Mutex
)

// monitorEnumProc is the callback for EnumDisplayMonitors
func monitorEnumProc(hMonitor windows.Handle, hdcMonitor windows.Handle, lprcMonitor *rect, data uintptr) uintptr {
	// Get number of physical monitors
	var count uint32
	ret, _, _ := pGetNumberOfPhysicalMonitorsFromHMONITOR.Call(
		uintptr(hMonitor),
		uintptr(unsafe.Pointer(&count)),
	)

	if ret == 0 || count == 0 {
		return 1 // Continue enumeration
	}

	// Allocate space for physical monitors
	physicalMonitors := make([]physicalMonitor, count)

	// Get physical monitors array
	ret, _, _ = pGetPhysicalMonitorsFromHMONITOR.Call(
		uintptr(hMonitor),
		uintptr(count),
		uintptr(unsafe.Pointer(&physicalMonitors[0])),
	)

	if ret == 0 {
		return 1 // Continue enumeration
	}

	// Apply operation to first monitor and stop
	for i := range physicalMonitors {
		pm := &physicalMonitors[i]

		if currentOp != nil {
			lastError = currentOp(pm.Handle)
		} else if currentGetOp != nil {
			lastBrightness, lastError = currentGetOp(pm.Handle)
		}

		// Cleanup
		pDestroyPhysicalMonitors.Call(
			uintptr(count),
			uintptr(unsafe.Pointer(&physicalMonitors[0])),
		)

		// Return 0 to stop enumeration after first monitor
		return 0
	}

	// Cleanup
	pDestroyPhysicalMonitors.Call(
		uintptr(count),
		uintptr(unsafe.Pointer(&physicalMonitors[0])),
	)

	return 1
}

// applyToMonitor applies an operation to the first available monitor
func applyToMonitor(op monitorOp) error {
	opMutex.Lock()
	defer opMutex.Unlock()

	currentOp = op
	currentGetOp = nil
	lastError = nil

	callback := windows.NewCallback(monitorEnumProc)

	pEnumDisplayMonitors.Call(
		uintptr(0),
		uintptr(0),
		callback,
		uintptr(0),
	)

	currentOp = nil
	return lastError
}

// getFromMonitor gets a value from the first available monitor
func getFromMonitor(op monitorGetOp) (int, error) {
	opMutex.Lock()
	defer opMutex.Unlock()

	currentOp = nil
	currentGetOp = op
	lastError = nil
	lastBrightness = 0

	callback := windows.NewCallback(monitorEnumProc)

	pEnumDisplayMonitors.Call(
		uintptr(0),
		uintptr(0),
		callback,
		uintptr(0),
	)

	currentGetOp = nil
	return lastBrightness, lastError
}

// Platform-specific implementations
func (bc *BrightnessController) initPlatform() {
	// No initialization needed for Windows
}

func (bc *BrightnessController) getBrightnessPlatform() (int, error) {
	return getFromMonitor(func(handle windows.Handle) (int, error) {
		var min, current, max uint32

		ret, _, err := pGetMonitorBrightness.Call(
			uintptr(handle),
			uintptr(unsafe.Pointer(&min)),
			uintptr(unsafe.Pointer(&current)),
			uintptr(unsafe.Pointer(&max)),
		)

		if ret == 0 {
			return 0, errors.New("failed to get monitor brightness: " + err.Error())
		}

		// Return current brightness as percentage
		if max == min {
			return int(current), nil
		}

		percent := int((current - min) * 100 / (max - min))
		return percent, nil
	})
}

func (bc *BrightnessController) setBrightnessPlatform(percent int) error {
	if percent < 0 {
		percent = 0
	}
	if percent > 100 {
		percent = 100
	}

	return applyToMonitor(func(handle windows.Handle) error {
		var min, current, max uint32

		// Get min/max to convert percentage
		ret, _, err := pGetMonitorBrightness.Call(
			uintptr(handle),
			uintptr(unsafe.Pointer(&min)),
			uintptr(unsafe.Pointer(&current)),
			uintptr(unsafe.Pointer(&max)),
		)

		if ret == 0 {
			return errors.New("failed to get monitor brightness range: " + err.Error())
		}

		// Convert percentage to brightness value
		brightnessValue := min + uint32(percent)*(max-min)/100

		ret, _, err = pSetMonitorBrightness.Call(
			uintptr(handle),
			uintptr(brightnessValue),
		)

		if ret == 0 {
			return errors.New("failed to set monitor brightness: " + err.Error())
		}

		return nil
	})
}
