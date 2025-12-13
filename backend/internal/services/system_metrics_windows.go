//go:build windows
// +build windows

package services

import (
	"syscall"
	"unsafe"
)

// SystemPowerStatus represents the Windows SYSTEM_POWER_STATUS structure
type SystemPowerStatus struct {
	ACLineStatus        byte   // 0 = offline, 1 = online, 255 = unknown
	BatteryFlag         byte   // Battery charge status flags
	BatteryLifePercent  byte   // 0–100, 255 = unknown
	SystemStatusFlag    byte   // Reserved, must be zero
	BatteryLifeTime     uint32 // Seconds of battery life remaining, or -1 if unknown
	BatteryFullLifeTime uint32 // Seconds of full battery life, or -1 if unknown
}

var (
	kernel32                 = syscall.NewLazyDLL("kernel32.dll")
	procGetSystemPowerStatus = kernel32.NewProc("GetSystemPowerStatus")
)

// getBatteryInfoPlatform returns battery level and charging status for Windows
func (s *SystemMetricsService) getBatteryInfoPlatform() (int, bool) {
	var status SystemPowerStatus

	ret, _, _ := procGetSystemPowerStatus.Call(
		uintptr(unsafe.Pointer(&status)),
	)
	if ret == 0 {
		// Failed to get power status
		return -1, false
	}

	// Check if battery is present
	// BatteryFlag bit 7 (128) = no system battery
	if status.BatteryFlag&128 != 0 {
		return -1, false
	}

	// Battery level
	batteryLevel := -1
	if status.BatteryLifePercent != 255 {
		batteryLevel = int(status.BatteryLifePercent)
	}

	// Charging status
	// ACLineStatus: 0 = offline (battery), 1 = online (charging/plugged in)
	// BatteryFlag bit 3 (8) = charging
	isCharging := status.ACLineStatus == 1 || (status.BatteryFlag&8 != 0)

	return batteryLevel, isCharging
}
