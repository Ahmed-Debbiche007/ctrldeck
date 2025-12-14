package brightness

import (
	"errors"
	"fmt"
	"sync"
	"unsafe"

	"github.com/go-ole/go-ole"
	"github.com/go-ole/go-ole/oleutil"
	"golang.org/x/sys/windows"
)

// Win32 API structures for DDC/CI
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
	lastError = errors.New("no monitor found")

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
	lastError = errors.New("no monitor found")
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

// WMI Brightness Control (for laptops) - Using COM/OLE
func getBrightnessWMI() (int, error) {
	// Initialize COM
	err := ole.CoInitializeEx(0, ole.COINIT_MULTITHREADED)
	if err != nil {
		oleErr, ok := err.(*ole.OleError)
		if !ok || (oleErr.Code() != 0x00000001 && oleErr.Code() != 0x80010106) {
			return 0, fmt.Errorf("COM initialization failed: %v", err)
		}
	}
	defer ole.CoUninitialize()

	// Get WMI service
	unknown, err := oleutil.CreateObject("WbemScripting.SWbemLocator")
	if err != nil {
		return 0, errors.New("WMI not available")
	}
	defer unknown.Release()

	wmi, err := unknown.QueryInterface(ole.IID_IDispatch)
	if err != nil {
		return 0, errors.New("WMI query interface failed")
	}
	defer wmi.Release()

	// Connect to WMI namespace
	serviceRaw, err := oleutil.CallMethod(wmi, "ConnectServer", nil, "root/WMI")
	if err != nil {
		return 0, errors.New("WMI connect failed")
	}
	service := serviceRaw.ToIDispatch()
	defer service.Release()

	// Query brightness
	resultRaw, err := oleutil.CallMethod(service, "ExecQuery", "SELECT CurrentBrightness FROM WmiMonitorBrightness")
	if err != nil {
		return 0, errors.New("WMI brightness query failed")
	}
	result := resultRaw.ToIDispatch()
	defer result.Release()

	// Get count
	countVar, err := oleutil.GetProperty(result, "Count")
	if err != nil || countVar.Val == 0 {
		return 0, errors.New("no brightness data")
	}

	// Get first item
	itemRaw, err := oleutil.CallMethod(result, "ItemIndex", 0)
	if err != nil {
		return 0, errors.New("failed to get brightness item")
	}
	item := itemRaw.ToIDispatch()
	defer item.Release()

	// Get brightness value
	brightnessVar, err := oleutil.GetProperty(item, "CurrentBrightness")
	if err != nil {
		return 0, errors.New("failed to read brightness value")
	}

	brightness := int(brightnessVar.Val)
	return brightness, nil
}

func setBrightnessWMI(percent int) error {
	// Initialize COM
	err := ole.CoInitializeEx(0, ole.COINIT_MULTITHREADED)
	if err != nil {
		oleErr, ok := err.(*ole.OleError)
		if !ok || (oleErr.Code() != 0x00000001 && oleErr.Code() != 0x80010106) {
			return fmt.Errorf("COM initialization failed: %v", err)
		}
	}
	defer ole.CoUninitialize()

	// Get WMI service
	unknown, err := oleutil.CreateObject("WbemScripting.SWbemLocator")
	if err != nil {
		return errors.New("WMI not available")
	}
	defer unknown.Release()

	wmi, err := unknown.QueryInterface(ole.IID_IDispatch)
	if err != nil {
		return errors.New("WMI query interface failed")
	}
	defer wmi.Release()

	// Connect to WMI namespace
	serviceRaw, err := oleutil.CallMethod(wmi, "ConnectServer", nil, "root/WMI")
	if err != nil {
		return errors.New("WMI connect failed")
	}
	service := serviceRaw.ToIDispatch()
	defer service.Release()

	// Query brightness methods
	resultRaw, err := oleutil.CallMethod(service, "ExecQuery", "SELECT * FROM WmiMonitorBrightnessMethods")
	if err != nil {
		return errors.New("WMI brightness methods query failed")
	}
	result := resultRaw.ToIDispatch()
	defer result.Release()

	// Get count
	countVar, err := oleutil.GetProperty(result, "Count")
	if err != nil || countVar.Val == 0 {
		return errors.New("no brightness control available")
	}

	// Get first item
	itemRaw, err := oleutil.CallMethod(result, "ItemIndex", 0)
	if err != nil {
		return errors.New("failed to get brightness control")
	}
	item := itemRaw.ToIDispatch()
	defer item.Release()

	// Call WmiSetBrightness(Timeout, Brightness)
	// Timeout: 1 second, Brightness: 0-100
	_, err = oleutil.CallMethod(item, "WmiSetBrightness", 1, percent)
	if err != nil {
		return fmt.Errorf("failed to set brightness: %v", err)
	}

	return nil
}

// DDC/CI Brightness Control (for external monitors)
func getBrightnessDDC() (int, error) {
	return getFromMonitor(func(handle windows.Handle) (int, error) {
		var min, current, max uint32

		ret, _, err := pGetMonitorBrightness.Call(
			uintptr(handle),
			uintptr(unsafe.Pointer(&min)),
			uintptr(unsafe.Pointer(&current)),
			uintptr(unsafe.Pointer(&max)),
		)

		if ret == 0 {
			return 0, fmt.Errorf("DDC/CI not supported: %v", err)
		}

		// Return current brightness as percentage
		if max == min {
			return int(current), nil
		}

		percent := int((current - min) * 100 / (max - min))
		return percent, nil
	})
}

func setBrightnessDDC(percent int) error {
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
			return fmt.Errorf("DDC/CI not supported: %v", err)
		}

		// Convert percentage to brightness value
		brightnessValue := min + uint32(percent)*(max-min)/100

		ret, _, err = pSetMonitorBrightness.Call(
			uintptr(handle),
			uintptr(brightnessValue),
		)

		if ret == 0 {
			return fmt.Errorf("failed to set brightness: %v", err)
		}

		return nil
	})
}

// Platform-specific implementations
func (bc *BrightnessController) initPlatform() {
	// No initialization needed for Windows
}

func (bc *BrightnessController) getBrightnessPlatform() (int, error) {
	// Try WMI first (for laptops) - fast native COM calls
	brightness, err := getBrightnessWMI()
	if err == nil {
		return brightness, nil
	}

	// Fallback to DDC/CI (for external monitors)
	brightness, err = getBrightnessDDC()
	if err == nil {
		return brightness, nil
	}

	// If both fail, return a helpful error
	return 0, errors.New("brightness control not supported on this system")
}

func (bc *BrightnessController) setBrightnessPlatform(percent int) error {
	if percent < 0 {
		percent = 0
	}
	if percent > 100 {
		percent = 100
	}

	// Try WMI first (for laptops) - fast native COM calls
	err := setBrightnessWMI(percent)
	if err == nil {
		return nil
	}

	// Fallback to DDC/CI (for external monitors)
	err = setBrightnessDDC(percent)
	if err == nil {
		return nil
	}

	// If both fail, return a helpful error
	return errors.New("brightness control not supported on this system")
}
