//go:build linux
// +build linux

package mic

import (
	"os/exec"
	"strings"
)

// Linux implementations using pactl (PulseAudio)
func (m *MicController) toggleMutePlatform() error {
	cmd := exec.Command("pactl", "set-source-mute", "@DEFAULT_SOURCE@", "toggle")
	return cmd.Run()
}

func (m *MicController) mutePlatform() error {
	cmd := exec.Command("pactl", "set-source-mute", "@DEFAULT_SOURCE@", "1")
	return cmd.Run()
}

func (m *MicController) unmutePlatform() error {
	cmd := exec.Command("pactl", "set-source-mute", "@DEFAULT_SOURCE@", "0")
	return cmd.Run()
}

func (m *MicController) isMutedPlatform() (bool, error) {
	cmd := exec.Command("pactl", "get-source-mute", "@DEFAULT_SOURCE@")
	output, err := cmd.Output()
	if err != nil {
		// Fallback to pacmd if pactl get-source-mute is not available
		return m.isMutedLinuxFallback()
	}
	return strings.Contains(string(output), "yes"), nil
}

func (m *MicController) isMutedLinuxFallback() (bool, error) {
	cmd := exec.Command("pacmd", "list-sources")
	output, err := cmd.Output()
	if err != nil {
		return false, err
	}
	// Look for muted: yes in the default source
	lines := strings.Split(string(output), "\n")
	inDefaultSource := false
	for _, line := range lines {
		if strings.Contains(line, "* index:") {
			inDefaultSource = true
		} else if strings.Contains(line, "index:") && inDefaultSource {
			break
		}
		if inDefaultSource && strings.Contains(line, "muted:") {
			return strings.Contains(line, "yes"), nil
		}
	}
	return false, nil
}
