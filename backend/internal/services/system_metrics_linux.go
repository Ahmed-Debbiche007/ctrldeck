//go:build linux
// +build linux

package services

import (
	"os"
	"strconv"
	"strings"
)

// getBatteryInfoPlatform returns battery level and charging status for Linux
func (s *SystemMetricsService) getBatteryInfoPlatform() (int, bool) {
	// Try common battery paths
	paths := []string{
		"/sys/class/power_supply/BAT0",
		"/sys/class/power_supply/BAT1",
	}

	for _, basePath := range paths {
		capacity, err := readBatteryFileAsInt(basePath + "/capacity")
		if err != nil {
			continue
		}

		status, _ := readBatteryFileAsString(basePath + "/status")
		isCharging := strings.TrimSpace(status) == "Charging"

		return capacity, isCharging
	}

	return -1, false
}

// getCPUTemperaturePlatform returns CPU temperature for Linux
func (s *SystemMetricsService) getCPUTemperaturePlatform() float64 {
	// Try various temperature sensor paths
	tempPaths := []string{
		// Intel Core temperature
		"/sys/class/thermal/thermal_zone0/temp",
		"/sys/class/thermal/thermal_zone1/temp",
		"/sys/class/thermal/thermal_zone2/temp",
		// Hwmon sensors (common for desktop systems)
		"/sys/class/hwmon/hwmon0/temp1_input",
		"/sys/class/hwmon/hwmon1/temp1_input",
		"/sys/class/hwmon/hwmon2/temp1_input",
		// AMD k10temp
		"/sys/class/hwmon/hwmon0/temp2_input",
		"/sys/class/hwmon/hwmon1/temp2_input",
	}

	for _, path := range tempPaths {
		temp, err := readTempFile(path)
		if err != nil {
			continue
		}

		// Validate temperature is reasonable (between 0 and 150°C)
		if temp > 0 && temp < 150 {
			return temp
		}
	}

	// Try coretemp module (Intel CPUs)
	coreTempPath := findCoreTempPath()
	if coreTempPath != "" {
		temp, err := readTempFile(coreTempPath)
		if err == nil && temp > 0 && temp < 150 {
			return temp
		}
	}

	// No temperature sensor found
	return 0
}

// findCoreTempPath finds the coretemp sensor path dynamically
func findCoreTempPath() string {
	hwmonDir := "/sys/class/hwmon"
	entries, err := os.ReadDir(hwmonDir)
	if err != nil {
		return ""
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		// Check if this is a coretemp sensor
		nameFile := hwmonDir + "/" + entry.Name() + "/name"
		name, err := readBatteryFileAsString(nameFile)
		if err != nil {
			continue
		}

		if strings.TrimSpace(name) == "coretemp" {
			// Return the first temperature input
			tempPath := hwmonDir + "/" + entry.Name() + "/temp1_input"
			if _, err := os.Stat(tempPath); err == nil {
				return tempPath
			}
		}
	}

	return ""
}

// readTempFile reads temperature from a file and converts it to Celsius
func readTempFile(path string) (float64, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}

	// Temperature is usually in millidegrees Celsius
	s := strings.TrimSpace(string(data))
	milliTemp, err := strconv.Atoi(s)
	if err != nil {
		return 0, err
	}

	// Convert from millidegrees to degrees
	temp := float64(milliTemp) / 1000.0
	return temp, nil
}

// Helper functions for reading battery files
func readBatteryFileAsInt(path string) (int, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}
	s := strings.TrimSpace(string(data))
	return strconv.Atoi(s)
}

func readBatteryFileAsString(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}
