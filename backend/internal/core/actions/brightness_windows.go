//go:build windows
// +build windows

package actions

import (
	"errors"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
	"unsafe"
)

var (
	modDxva2                                    = syscall.NewLazyDLL("dxva2.dll")
	modUser32                                   = syscall.NewLazyDLL("user32.dll")
	procGetNumberOfPhysicalMonitorsFromHMONITOR = modDxva2.NewProc("GetNumberOfPhysicalMonitorsFromHMONITOR")
	procGetPhysicalMonitorsFromHMONITOR         = modDxva2.NewProc("GetPhysicalMonitorsFromHMONITOR")
	procDestroyPhysicalMonitors                 = modDxva2.NewProc("DestroyPhysicalMonitors")
	procGetMonitorBrightness                    = modDxva2.NewProc("GetMonitorBrightness")
	procSetMonitorBrightness                    = modDxva2.NewProc("SetMonitorBrightness")
	procMonitorFromWindow                       = modUser32.NewProc("MonitorFromWindow")
	procGetDesktopWindow                        = modUser32.NewProc("GetDesktopWindow")
)

const (
	MONITOR_DEFAULTTOPRIMARY = 0x00000001
)

// PHYSICAL_MONITOR structure
type PHYSICAL_MONITOR struct {
	hPhysicalMonitor             syscall.Handle
	szPhysicalMonitorDescription [128]uint16
}

// getPhysicalMonitorHandle gets the physical monitor handle for brightness control
func getPhysicalMonitorHandle() (syscall.Handle, error) {
	// Get the desktop window
	hwnd, _, _ := procGetDesktopWindow.Call()
	if hwnd == 0 {
		return 0, errors.New("failed to get desktop window")
	}

	// Get monitor from window
	hMonitor, _, _ := procMonitorFromWindow.Call(hwnd, MONITOR_DEFAULTTOPRIMARY)
	if hMonitor == 0 {
		return 0, errors.New("failed to get monitor handle")
	}

	// Get number of physical monitors
	var numMonitors uint32
	ret, _, _ := procGetNumberOfPhysicalMonitorsFromHMONITOR.Call(
		hMonitor,
		uintptr(unsafe.Pointer(&numMonitors)),
	)
	if ret == 0 || numMonitors == 0 {
		return 0, errors.New("failed to get number of physical monitors")
	}

	// Get physical monitors
	physicalMonitors := make([]PHYSICAL_MONITOR, numMonitors)
	ret, _, _ = procGetPhysicalMonitorsFromHMONITOR.Call(
		hMonitor,
		uintptr(numMonitors),
		uintptr(unsafe.Pointer(&physicalMonitors[0])),
	)
	if ret == 0 {
		return 0, errors.New("failed to get physical monitors")
	}

	return physicalMonitors[0].hPhysicalMonitor, nil
}

// Platform-specific implementations
func (bc *BrightnessController) initPlatform() {
	// No initialization needed for Windows
}

func (bc *BrightnessController) getBrightnessPlatform() (int, error) {
	hMonitor, err := getPhysicalMonitorHandle()
	if err != nil {
		// Fallback to WMI-based approach (optimized)
		return bc.getWindowsBrightnessWMI()
	}
	defer procDestroyPhysicalMonitors.Call(1, uintptr(unsafe.Pointer(&PHYSICAL_MONITOR{hPhysicalMonitor: hMonitor})))

	var minBrightness, currentBrightness, maxBrightness uint32
	ret, _, _ := procGetMonitorBrightness.Call(
		uintptr(hMonitor),
		uintptr(unsafe.Pointer(&minBrightness)),
		uintptr(unsafe.Pointer(&currentBrightness)),
		uintptr(unsafe.Pointer(&maxBrightness)),
	)
	if ret == 0 {
		// Fallback to WMI-based approach
		return bc.getWindowsBrightnessWMI()
	}

	if maxBrightness == minBrightness {
		return int(currentBrightness), nil
	}

	// Convert to percentage
	percent := int((currentBrightness - minBrightness) * 100 / (maxBrightness - minBrightness))
	return percent, nil
}

func (bc *BrightnessController) setBrightnessPlatform(percent int) error {
	hMonitor, err := getPhysicalMonitorHandle()
	if err != nil {
		// Fallback to WMI-based approach
		return bc.setWindowsBrightnessWMI(percent)
	}
	defer procDestroyPhysicalMonitors.Call(1, uintptr(unsafe.Pointer(&PHYSICAL_MONITOR{hPhysicalMonitor: hMonitor})))

	// Get min/max brightness to convert percentage
	var minBrightness, currentBrightness, maxBrightness uint32
	ret, _, _ := procGetMonitorBrightness.Call(
		uintptr(hMonitor),
		uintptr(unsafe.Pointer(&minBrightness)),
		uintptr(unsafe.Pointer(&currentBrightness)),
		uintptr(unsafe.Pointer(&maxBrightness)),
	)
	if ret == 0 {
		// Fallback to WMI
		return bc.setWindowsBrightnessWMI(percent)
	}

	// Convert percentage to brightness value
	brightnessValue := minBrightness + uint32(percent)*(maxBrightness-minBrightness)/100

	ret, _, _ = procSetMonitorBrightness.Call(
		uintptr(hMonitor),
		uintptr(brightnessValue),
	)
	if ret == 0 {
		// Fallback to WMI
		return bc.setWindowsBrightnessWMI(percent)
	}

	return nil
}

// WMI fallback implementations (optimized with -NoProfile for faster startup)
func (bc *BrightnessController) getWindowsBrightnessWMI() (int, error) {
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command",
		"(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness).CurrentBrightness")
	output, err := cmd.Output()
	if err != nil {
		return 0, errors.New("cannot read brightness: WMI brightness not available (only works on laptops)")
	}

	brightness, err := strconv.Atoi(strings.TrimSpace(string(output)))
	if err != nil {
		return 0, err
	}

	return brightness, nil
}

func (bc *BrightnessController) setWindowsBrightnessWMI(percent int) error {
	script := "(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods).WmiSetBrightness(1, " + strconv.Itoa(percent) + ")"
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", script)
	if err := cmd.Run(); err != nil {
		return errors.New("cannot set brightness: WMI brightness not available (only works on laptops)")
	}
	return nil
}
