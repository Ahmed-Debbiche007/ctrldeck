//go:build linux
// +build linux

package brightness

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// Platform-specific implementations for Linux
func (bc *BrightnessController) initPlatform() {
	// Find brightnessctl binary
	if path, err := exec.LookPath("brightnessctl"); err == nil {
		bc.brightnessctlPath = path
	}

	// Find backlight device
	backlightBase := "/sys/class/backlight"
	entries, err := os.ReadDir(backlightBase)
	if err == nil && len(entries) > 0 {
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
		bc.backlightPath = filepath.Join(backlightBase, entries[0].Name())
		bc.readMaxBrightness()
	}
}

func (bc *BrightnessController) getBrightnessPlatform() (int, error) {
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

	// Fallback to brightnessctl
	if bc.brightnessctlPath != "" {
		cmd := exec.Command(bc.brightnessctlPath, "get")
		output, err := cmd.Output()
		if err == nil {
			current, parseErr := strconv.Atoi(strings.TrimSpace(string(output)))
			if parseErr == nil {
				maxCmd := exec.Command(bc.brightnessctlPath, "max")
				maxOutput, maxErr := maxCmd.Output()
				if maxErr == nil {
					max, _ := strconv.Atoi(strings.TrimSpace(string(maxOutput)))
					if max > 0 {
						return (current * 100) / max, nil
					}
				}
			}
		}
	}

	return 0, errors.New("cannot read brightness: no backlight device or brightnessctl available")
}

func (bc *BrightnessController) setBrightnessPlatform(percent int) error {
	// Try brightnessctl first (more reliable for writing)
	if bc.brightnessctlPath != "" {
		cmd := exec.Command(bc.brightnessctlPath, "set", fmt.Sprintf("%d%%", percent))
		if err := cmd.Run(); err == nil {
			return nil
		}
	}

	// Fallback to direct sysfs write
	if bc.backlightPath != "" && bc.maxBrightness > 0 {
		brightnessPath := filepath.Join(bc.backlightPath, "brightness")
		value := (percent * bc.maxBrightness) / 100
		if value < 1 && percent > 0 {
			value = 1
		}
		err := os.WriteFile(brightnessPath, []byte(strconv.Itoa(value)), 0644)
		if err == nil {
			return nil
		}
	}

	return errors.New("cannot set brightness: no working method available")
}
