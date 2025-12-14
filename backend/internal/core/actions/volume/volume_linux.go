//go:build linux
// +build linux

package volume

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

// Linux implementations using pactl (PulseAudio)
func (v *VolumeController) volumeUpLinux(step int) error {
	cmd := exec.Command("pactl", "set-sink-volume", "@DEFAULT_SINK@", fmt.Sprintf("+%d%%", step))
	return cmd.Run()
}

func (v *VolumeController) volumeDownLinux(step int) error {
	cmd := exec.Command("pactl", "set-sink-volume", "@DEFAULT_SINK@", fmt.Sprintf("-%d%%", step))
	return cmd.Run()
}

func (v *VolumeController) setVolumeLinux(level int) error {
	cmd := exec.Command("pactl", "set-sink-volume", "@DEFAULT_SINK@", fmt.Sprintf("%d%%", level))
	return cmd.Run()
}

func (v *VolumeController) getVolumeLinux() (int, error) {
	cmd := exec.Command("pactl", "get-sink-volume", "@DEFAULT_SINK@")
	output, err := cmd.Output()
	if err != nil {
		// Fallback to pacmd
		return v.getVolumeLinuxFallback()
	}

	// Parse output like: "Volume: front-left: 65536 / 100% / 0.00 dB,   front-right: 65536 / 100% / 0.00 dB"
	outputStr := string(output)
	parts := strings.Split(outputStr, "/")
	if len(parts) >= 2 {
		percentStr := strings.TrimSpace(parts[1])
		percentStr = strings.TrimSuffix(percentStr, "%")
		if vol, err := strconv.Atoi(percentStr); err == nil {
			return vol, nil
		}
	}

	return 50, nil // Default fallback
}

func (v *VolumeController) getVolumeLinuxFallback() (int, error) {
	cmd := exec.Command("amixer", "get", "Master")
	output, err := cmd.Output()
	if err != nil {
		return 50, err
	}

	// Parse output like: "[50%]"
	outputStr := string(output)
	start := strings.Index(outputStr, "[")
	end := strings.Index(outputStr, "%]")
	if start != -1 && end != -1 && end > start {
		percentStr := outputStr[start+1 : end]
		if vol, err := strconv.Atoi(percentStr); err == nil {
			return vol, nil
		}
	}

	return 50, nil
}

func (v *VolumeController) toggleMuteLinux() error {
	cmd := exec.Command("pactl", "set-sink-mute", "@DEFAULT_SINK@", "toggle")
	return cmd.Run()
}

func (v *VolumeController) isMutedLinux() (bool, error) {
	cmd := exec.Command("pactl", "get-sink-mute", "@DEFAULT_SINK@")
	output, err := cmd.Output()
	if err != nil {
		return false, err
	}

	// Parse output like: "Mute: yes" or "Mute: no"
	outputStr := strings.TrimSpace(string(output))
	return strings.Contains(outputStr, "yes"), nil
}

// Platform-specific dispatch functions for Linux
func (v *VolumeController) volumeUpPlatform(step int) error {
	return v.volumeUpLinux(step)
}

func (v *VolumeController) volumeDownPlatform(step int) error {
	return v.volumeDownLinux(step)
}

func (v *VolumeController) setVolumePlatform(level int) error {
	return v.setVolumeLinux(level)
}

func (v *VolumeController) getVolumePlatform() (int, error) {
	return v.getVolumeLinux()
}

func (v *VolumeController) toggleMutePlatform() error {
	return v.toggleMuteLinux()
}

func (v *VolumeController) isMutedPlatform() (bool, error) {
	return v.isMutedLinux()
}
