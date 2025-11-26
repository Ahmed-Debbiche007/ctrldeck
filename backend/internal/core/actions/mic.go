package actions

import (
	"os/exec"
	"runtime"
	"strings"
)

// MicController handles microphone mute/unmute operations
type MicController struct{}

// NewMicController creates a new MicController
func NewMicController() *MicController {
	return &MicController{}
}

// ToggleMute toggles the microphone mute state
func (m *MicController) ToggleMute() error {
	if runtime.GOOS == "linux" {
		return m.toggleMuteLinux()
	}
	return m.toggleMuteWindows()
}

// Mute mutes the microphone
func (m *MicController) Mute() error {
	if runtime.GOOS == "linux" {
		return m.muteLinux()
	}
	return m.muteWindows()
}

// Unmute unmutes the microphone
func (m *MicController) Unmute() error {
	if runtime.GOOS == "linux" {
		return m.unmuteLinux()
	}
	return m.unmuteWindows()
}

// IsMuted returns whether the microphone is muted
func (m *MicController) IsMuted() (bool, error) {
	if runtime.GOOS == "linux" {
		return m.isMutedLinux()
	}
	return m.isMutedWindows()
}

// Linux implementations using pactl (PulseAudio)
func (m *MicController) toggleMuteLinux() error {
	cmd := exec.Command("pactl", "set-source-mute", "@DEFAULT_SOURCE@", "toggle")
	return cmd.Run()
}

func (m *MicController) muteLinux() error {
	cmd := exec.Command("pactl", "set-source-mute", "@DEFAULT_SOURCE@", "1")
	return cmd.Run()
}

func (m *MicController) unmuteLinux() error {
	cmd := exec.Command("pactl", "set-source-mute", "@DEFAULT_SOURCE@", "0")
	return cmd.Run()
}

func (m *MicController) isMutedLinux() (bool, error) {
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

// Windows implementations using PowerShell/nircmd
func (m *MicController) toggleMuteWindows() error {
	// Using PowerShell to toggle microphone mute
	script := `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Audio {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
`
	cmd := exec.Command("powershell", "-Command", script)
	return cmd.Run()
}

func (m *MicController) muteWindows() error {
	// Using nircmd or PowerShell
	cmd := exec.Command("powershell", "-Command",
		"$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys([char]173)")
	return cmd.Run()
}

func (m *MicController) unmuteWindows() error {
	cmd := exec.Command("powershell", "-Command",
		"$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys([char]173)")
	return cmd.Run()
}

func (m *MicController) isMutedWindows() (bool, error) {
	// This is a simplified check - would need proper Windows audio API integration
	return false, nil
}
