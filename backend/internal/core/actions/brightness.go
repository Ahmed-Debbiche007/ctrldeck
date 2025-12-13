package actions

import (
	"os"
	"path/filepath"
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
	bc.initPlatform()
	return bc
}

// readMaxBrightness reads the maximum brightness value (used by Linux)
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
	return bc.getBrightnessPlatform()
}

// SetBrightness sets the brightness to a percentage (0-100)
func (bc *BrightnessController) SetBrightness(percent int) error {
	if percent < 0 {
		percent = 0
	}
	if percent > 100 {
		percent = 100
	}
	return bc.setBrightnessPlatform(percent)
}

// IsAvailable checks if brightness control is available on this system
func (bc *BrightnessController) IsAvailable() bool {
	_, err := bc.GetBrightness()
	return err == nil
}
