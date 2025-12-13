package actions

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

// BrightnessController handles screen brightness operations
type BrightnessController struct {
	backlightPath     string // Path to the backlight device on Linux
	maxBrightness     int    // Maximum brightness value
	brightnessctlPath string // Full path to brightnessctl binary
}

// NewBrightnessController creates a new BrightnessController
func NewBrightnessController() *BrightnessController {
	bc := &BrightnessController{}
	bc.init()
	return bc
}

// init finds the backlight device on Linux
func (bc *BrightnessController) init() {
	if runtime.GOOS != "linux" {
		return
	}

	// Find brightnessctl binary - check common paths
	brightnessctlPaths := []string{
		"/usr/bin/brightnessctl",
		"/usr/local/bin/brightnessctl",
		"/bin/brightnessctl",
	}

	// First try exec.LookPath
	if path, err := exec.LookPath("brightnessctl"); err == nil {
		bc.brightnessctlPath = path
	} else {
		// Check common paths manually
		for _, p := range brightnessctlPaths {
			if _, err := os.Stat(p); err == nil {
				bc.brightnessctlPath = p
				break
			}
		}
	}

	// Find backlight device
	backlightBase := "/sys/class/backlight"
	entries, err := os.ReadDir(backlightBase)
	if err != nil {
		return
	}

	// Prefer intel_backlight, then amdgpu_bl, then any available
	preferred := []string{"intel_backlight", "amdgpu_bl0", "amdgpu_bl1", "acpi_video0"}

	for _, pref := range preferred {
		for _, entry := range entries {
			if entry.Name() == pref {
				bc.backlightPath = filepath.Join(backlightBase, entry.Name())
				bc.readMaxBrightness()
				return
			}
		}
	}

	// Use first available if no preferred found
	if len(entries) > 0 {
		bc.backlightPath = filepath.Join(backlightBase, entries[0].Name())
		bc.readMaxBrightness()
	}
}

// readMaxBrightness reads the maximum brightness value
func (bc *BrightnessController) readMaxBrightness() {
	if bc.backlightPath == "" {
		return
	}

	maxPath := filepath.Join(bc.backlightPath, "max_brightness")
	data, err := os.ReadFile(maxPath)
	if err != nil {
		bc.maxBrightness = 100
		return
	}

	val, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		bc.maxBrightness = 100
		return
	}
	bc.maxBrightness = val
}

// GetBrightness returns the current brightness percentage (0-100)
func (bc *BrightnessController) GetBrightness() (int, error) {
	switch runtime.GOOS {
	case "linux":
		return bc.getLinuxBrightness()
	case "windows":
		return bc.getWindowsBrightness()
	default:
		return 0, errors.New("brightness control not supported on this platform")
	}
}

// SetBrightness sets the brightness to a percentage (0-100)
func (bc *BrightnessController) SetBrightness(percent int) error {
	if percent < 0 {
		percent = 0
	}
	if percent > 100 {
		percent = 100
	}

	switch runtime.GOOS {
	case "linux":
		return bc.setLinuxBrightness(percent)
	case "windows":
		return bc.setWindowsBrightness(percent)
	default:
		return errors.New("brightness control not supported on this platform")
	}
}

// Linux implementation
func (bc *BrightnessController) getLinuxBrightness() (int, error) {
	// Try direct sysfs access first
	if bc.backlightPath != "" {
		brightnessPath := filepath.Join(bc.backlightPath, "brightness")
		data, err := os.ReadFile(brightnessPath)
		if err == nil {
			current, err := strconv.Atoi(strings.TrimSpace(string(data)))
			if err == nil && bc.maxBrightness > 0 {
				return (current * 100) / bc.maxBrightness, nil
			}
		}
	}

	// Fallback to brightnessctl (use full path if available)
	brightnessctl := "brightnessctl"
	if bc.brightnessctlPath != "" {
		brightnessctl = bc.brightnessctlPath
	}

	cmd := exec.Command(brightnessctl, "get")
	output, err := cmd.Output()
	if err != nil {
		if bc.brightnessctlPath == "" {
			return 0, errors.New("cannot read brightness: no backlight device found and brightnessctl not found in PATH")
		}
		return 0, fmt.Errorf("cannot read brightness: brightnessctl error: %v", err)
	}

	current, err := strconv.Atoi(strings.TrimSpace(string(output)))
	if err != nil {
		return 0, fmt.Errorf("cannot parse brightness value: %v", err)
	}

	// Get max brightness from brightnessctl
	cmd = exec.Command(brightnessctl, "max")
	output, err = cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("cannot get max brightness: %v", err)
	}

	max, err := strconv.Atoi(strings.TrimSpace(string(output)))
	if err != nil || max == 0 {
		return 0, errors.New("cannot determine max brightness")
	}

	return (current * 100) / max, nil
}

func (bc *BrightnessController) setLinuxBrightness(percent int) error {
	// Determine brightnessctl path
	brightnessctl := "brightnessctl"
	if bc.brightnessctlPath != "" {
		brightnessctl = bc.brightnessctlPath
	}

	// Try brightnessctl first (more reliable for writing)
	cmd := exec.Command(brightnessctl, "set", fmt.Sprintf("%d%%", percent))
	if err := cmd.Run(); err == nil {
		return nil
	}

	// Fallback to direct sysfs write (requires permissions)
	if bc.backlightPath != "" && bc.maxBrightness > 0 {
		brightnessPath := filepath.Join(bc.backlightPath, "brightness")
		value := (percent * bc.maxBrightness) / 100
		if value < 1 && percent > 0 {
			value = 1 // Minimum brightness to avoid black screen
		}
		err := os.WriteFile(brightnessPath, []byte(strconv.Itoa(value)), 0644)
		if err == nil {
			return nil
		}
		// If direct write fails, provide helpful error
		return fmt.Errorf("cannot set brightness: permission denied. Try: sudo usermod -a -G video $USER (then re-login)")
	}

	if bc.brightnessctlPath == "" {
		return errors.New("cannot set brightness: brightnessctl not found. Install with: sudo apt install brightnessctl")
	}
	return errors.New("no backlight device found")
}

// Windows implementation
func (bc *BrightnessController) getWindowsBrightness() (int, error) {
	// Use PowerShell to get brightness via WMI
	cmd := exec.Command("powershell", "-Command",
		"(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness).CurrentBrightness")
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

func (bc *BrightnessController) setWindowsBrightness(percent int) error {
	// Use PowerShell to set brightness via WMI
	cmd := exec.Command("powershell", "-Command",
		fmt.Sprintf("(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, %d)", percent))
	if err := cmd.Run(); err != nil {
		return errors.New("cannot set brightness: WMI brightness not available (only works on laptops)")
	}
	return nil
}

// IsAvailable checks if brightness control is available on this system
func (bc *BrightnessController) IsAvailable() bool {
	_, err := bc.GetBrightness()
	return err == nil
}
