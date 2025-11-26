package actions

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

// AppLauncher handles launching applications
type AppLauncher struct{}

// NewAppLauncher creates a new AppLauncher
func NewAppLauncher() *AppLauncher {
	return &AppLauncher{}
}

// Launch launches an application by its path or name
func (a *AppLauncher) Launch(appPath string) error {
	if appPath == "" {
		return fmt.Errorf("app path cannot be empty")
	}

	if runtime.GOOS == "linux" {
		return a.launchLinux(appPath)
	}
	return a.launchWindows(appPath)
}

// LaunchWithArgs launches an application with arguments
func (a *AppLauncher) LaunchWithArgs(appPath string, args []string) error {
	if appPath == "" {
		return fmt.Errorf("app path cannot be empty")
	}

	if runtime.GOOS == "linux" {
		return a.launchLinuxWithArgs(appPath, args)
	}
	return a.launchWindowsWithArgs(appPath, args)
}

// Linux implementations
func (a *AppLauncher) launchLinux(appPath string) error {
	// Check if it's a .desktop file
	if strings.HasSuffix(appPath, ".desktop") {
		return a.launchDesktopFile(appPath)
	}

	// Try to launch directly
	cmd := exec.Command("nohup", appPath)
	cmd.Stdout = nil
	cmd.Stderr = nil
	return cmd.Start()
}

func (a *AppLauncher) launchLinuxWithArgs(appPath string, args []string) error {
	cmdArgs := append([]string{appPath}, args...)
	cmd := exec.Command("nohup", cmdArgs...)
	cmd.Stdout = nil
	cmd.Stderr = nil
	return cmd.Start()
}

func (a *AppLauncher) launchDesktopFile(desktopFile string) error {
	// Use gtk-launch or gio to launch .desktop files
	cmd := exec.Command("gtk-launch", strings.TrimSuffix(desktopFile, ".desktop"))
	err := cmd.Start()
	if err != nil {
		// Fallback to gio
		cmd = exec.Command("gio", "launch", desktopFile)
		return cmd.Start()
	}
	return nil
}

// Windows implementations
func (a *AppLauncher) launchWindows(appPath string) error {
	cmd := exec.Command("cmd", "/c", "start", "", appPath)
	return cmd.Start()
}

func (a *AppLauncher) launchWindowsWithArgs(appPath string, args []string) error {
	cmdArgs := append([]string{"/c", "start", "", appPath}, args...)
	cmd := exec.Command("cmd", cmdArgs...)
	return cmd.Start()
}

// LaunchByName launches an application by its name (searches in common locations)
func (a *AppLauncher) LaunchByName(appName string) error {
	if runtime.GOOS == "linux" {
		// Try gtk-launch first (works with application names from .desktop files)
		cmd := exec.Command("gtk-launch", appName)
		err := cmd.Start()
		if err == nil {
			return nil
		}

		// Fallback to which + launch
		whichCmd := exec.Command("which", appName)
		output, err := whichCmd.Output()
		if err == nil {
			path := strings.TrimSpace(string(output))
			return a.launchLinux(path)
		}

		return fmt.Errorf("application not found: %s", appName)
	}

	// Windows: try to launch by name
	cmd := exec.Command("cmd", "/c", "start", "", appName)
	return cmd.Start()
}

// OpenURL opens a URL in the default browser
func (a *AppLauncher) OpenURL(url string) error {
	if runtime.GOOS == "linux" {
		cmd := exec.Command("xdg-open", url)
		return cmd.Start()
	}
	cmd := exec.Command("cmd", "/c", "start", "", url)
	return cmd.Start()
}

// OpenFile opens a file with its default application
func (a *AppLauncher) OpenFile(filePath string) error {
	if runtime.GOOS == "linux" {
		cmd := exec.Command("xdg-open", filePath)
		return cmd.Start()
	}
	cmd := exec.Command("cmd", "/c", "start", "", filePath)
	return cmd.Start()
}
