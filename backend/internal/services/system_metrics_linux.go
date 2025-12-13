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
