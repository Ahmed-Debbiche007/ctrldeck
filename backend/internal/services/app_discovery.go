package services

import (
	"bufio"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"

	"ctrldeck-server/internal/models"
)

// AppDiscoveryService discovers installed applications on the system
type AppDiscoveryService struct {
	mu          sync.RWMutex
	cachedApps  []models.InstalledApp
	lastRefresh int64
}

// NewAppDiscoveryService creates a new AppDiscoveryService
func NewAppDiscoveryService() *AppDiscoveryService {
	return &AppDiscoveryService{}
}

// GetInstalledApps returns a list of installed applications
func (a *AppDiscoveryService) GetInstalledApps() ([]models.InstalledApp, error) {
	a.mu.RLock()
	if len(a.cachedApps) > 0 {
		apps := a.cachedApps
		a.mu.RUnlock()
		return apps, nil
	}
	a.mu.RUnlock()

	return a.RefreshApps()
}

// RefreshApps rescans for installed applications
func (a *AppDiscoveryService) RefreshApps() ([]models.InstalledApp, error) {
	var apps []models.InstalledApp
	var err error

	if runtime.GOOS == "linux" {
		apps, err = a.discoverLinuxApps()
	} else {
		apps, err = a.discoverWindowsApps()
	}

	if err != nil {
		return nil, err
	}

	// Sort apps by name
	sort.Slice(apps, func(i, j int) bool {
		return strings.ToLower(apps[i].Name) < strings.ToLower(apps[j].Name)
	})

	// Remove duplicates
	apps = a.removeDuplicates(apps)

	a.mu.Lock()
	a.cachedApps = apps
	a.mu.Unlock()

	return apps, nil
}

// discoverLinuxApps scans for .desktop files on Linux
func (a *AppDiscoveryService) discoverLinuxApps() ([]models.InstalledApp, error) {
	var apps []models.InstalledApp

	// Common locations for .desktop files
	homeDir, _ := os.UserHomeDir()
	locations := []string{
		"/usr/share/applications",
		"/usr/local/share/applications",
		filepath.Join(homeDir, ".local/share/applications"),
		"/var/lib/snapd/desktop/applications",
		"/var/lib/flatpak/exports/share/applications",
		filepath.Join(homeDir, ".local/share/flatpak/exports/share/applications"),
	}

	for _, location := range locations {
		files, err := filepath.Glob(filepath.Join(location, "*.desktop"))
		if err != nil {
			continue
		}

		for _, file := range files {
			app, err := a.parseDesktopFile(file)
			if err != nil || app == nil {
				continue
			}
			apps = append(apps, *app)
		}
	}

	return apps, nil
}

// parseDesktopFile parses a .desktop file and returns an InstalledApp
func (a *AppDiscoveryService) parseDesktopFile(path string) (*models.InstalledApp, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	app := &models.InstalledApp{
		Path: path,
	}

	scanner := bufio.NewScanner(file)
	inDesktopEntry := false
	noDisplay := false
	hidden := false

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		if line == "[Desktop Entry]" {
			inDesktopEntry = true
			continue
		}

		if strings.HasPrefix(line, "[") && line != "[Desktop Entry]" {
			inDesktopEntry = false
			continue
		}

		if !inDesktopEntry {
			continue
		}

		if strings.HasPrefix(line, "Name=") && app.Name == "" {
			app.Name = strings.TrimPrefix(line, "Name=")
		}

		if strings.HasPrefix(line, "Exec=") {
			exec := strings.TrimPrefix(line, "Exec=")
			// Remove field codes like %u, %U, %f, %F
			exec = strings.ReplaceAll(exec, " %u", "")
			exec = strings.ReplaceAll(exec, " %U", "")
			exec = strings.ReplaceAll(exec, " %f", "")
			exec = strings.ReplaceAll(exec, " %F", "")
			exec = strings.TrimSpace(exec)
			app.Path = exec
		}

		if strings.HasPrefix(line, "Icon=") {
			app.Icon = strings.TrimPrefix(line, "Icon=")
		}

		if strings.HasPrefix(line, "Categories=") {
			categories := strings.TrimPrefix(line, "Categories=")
			cats := strings.Split(categories, ";")
			if len(cats) > 0 && cats[0] != "" {
				app.Category = cats[0]
			}
		}

		if strings.HasPrefix(line, "NoDisplay=") {
			noDisplay = strings.TrimPrefix(line, "NoDisplay=") == "true"
		}

		if strings.HasPrefix(line, "Hidden=") {
			hidden = strings.TrimPrefix(line, "Hidden=") == "true"
		}
	}

	// Skip apps that shouldn't be displayed
	if noDisplay || hidden || app.Name == "" {
		return nil, nil
	}

	return app, nil
}

// discoverWindowsApps scans for applications on Windows
func (a *AppDiscoveryService) discoverWindowsApps() ([]models.InstalledApp, error) {
	var apps []models.InstalledApp

	// Scan Start Menu
	startMenuPaths := []string{
		os.Getenv("PROGRAMDATA") + "\\Microsoft\\Windows\\Start Menu\\Programs",
		os.Getenv("APPDATA") + "\\Microsoft\\Windows\\Start Menu\\Programs",
	}

	for _, startMenuPath := range startMenuPaths {
		filepath.Walk(startMenuPath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}

			if strings.HasSuffix(strings.ToLower(path), ".lnk") {
				name := strings.TrimSuffix(info.Name(), ".lnk")
				apps = append(apps, models.InstalledApp{
					Name: name,
					Path: path,
				})
			}

			return nil
		})
	}

	// Add common executable paths
	commonApps := []struct {
		name string
		path string
	}{
		{"Notepad", "notepad.exe"},
		{"Calculator", "calc.exe"},
		{"Paint", "mspaint.exe"},
		{"Command Prompt", "cmd.exe"},
		{"PowerShell", "powershell.exe"},
		{"File Explorer", "explorer.exe"},
		{"Task Manager", "taskmgr.exe"},
	}

	for _, app := range commonApps {
		apps = append(apps, models.InstalledApp{
			Name:     app.name,
			Path:     app.path,
			Category: "System",
		})
	}

	return apps, nil
}

// removeDuplicates removes duplicate apps based on name
func (a *AppDiscoveryService) removeDuplicates(apps []models.InstalledApp) []models.InstalledApp {
	seen := make(map[string]bool)
	var result []models.InstalledApp

	for _, app := range apps {
		key := strings.ToLower(app.Name)
		if !seen[key] {
			seen[key] = true
			result = append(result, app)
		}
	}

	return result
}

// SearchApps searches for apps by name
func (a *AppDiscoveryService) SearchApps(query string) ([]models.InstalledApp, error) {
	apps, err := a.GetInstalledApps()
	if err != nil {
		return nil, err
	}

	query = strings.ToLower(query)
	var results []models.InstalledApp

	for _, app := range apps {
		if strings.Contains(strings.ToLower(app.Name), query) {
			results = append(results, app)
		}
	}

	return results, nil
}
