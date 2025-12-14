//go:build windows
// +build windows

package services

import (
	"syscall"
	"unsafe"

	"github.com/go-ole/go-ole"
	"github.com/go-ole/go-ole/oleutil"
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

// getCPUTemperaturePlatform returns CPU temperature for Windows using WMI
func (s *SystemMetricsService) getCPUTemperaturePlatform() float64 {
	// Try to get temperature from WMI
	temp, err := getCPUTempWMI()
	if err == nil && temp > 0 {
		return temp
	}

	// If WMI fails, return 0 (no temperature available)
	return 0
}

// getCPUTempWMI gets CPU temperature via WMI using COM
func getCPUTempWMI() (float64, error) {
	// Initialize COM
	err := ole.CoInitializeEx(0, ole.COINIT_MULTITHREADED)
	if err != nil {
		oleErr, ok := err.(*ole.OleError)
		if !ok || (oleErr.Code() != 0x00000001 && oleErr.Code() != 0x80010106) {
			return 0, err
		}
	}
	defer ole.CoUninitialize()

	// Get WMI service
	unknown, err := oleutil.CreateObject("WbemScripting.SWbemLocator")
	if err != nil {
		return 0, err
	}
	defer unknown.Release()

	wmi, err := unknown.QueryInterface(ole.IID_IDispatch)
	if err != nil {
		return 0, err
	}
	defer wmi.Release()

	// Connect to WMI namespace
	serviceRaw, err := oleutil.CallMethod(wmi, "ConnectServer", nil, "root/WMI")
	if err != nil {
		return 0, err
	}
	service := serviceRaw.ToIDispatch()
	defer service.Release()

	// Try MSAcpi_ThermalZoneTemperature (most common for laptops)
	resultRaw, err := oleutil.CallMethod(service, "ExecQuery", "SELECT CurrentTemperature FROM MSAcpi_ThermalZoneTemperature")
	if err == nil {
		result := resultRaw.ToIDispatch()
		defer result.Release()

		countVar, err := oleutil.GetProperty(result, "Count")
		if err == nil && countVar.Val > 0 {
			itemRaw, err := oleutil.CallMethod(result, "ItemIndex", 0)
			if err == nil {
				item := itemRaw.ToIDispatch()
				defer item.Release()

				tempVar, err := oleutil.GetProperty(item, "CurrentTemperature")
				if err == nil {
					// Temperature is in tenths of Kelvin, convert to Celsius
					tempKelvin := float64(tempVar.Val) / 10.0
					tempCelsius := tempKelvin - 273.15
					if tempCelsius > 0 && tempCelsius < 150 {
						return tempCelsius, nil
					}
				}
			}
		}
	}

	// If MSAcpi_ThermalZoneTemperature fails, try OpenHardwareMonitor/LibreHardwareMonitor
	// These require the monitoring software to be running
	serviceRaw2, err := oleutil.CallMethod(wmi, "ConnectServer", nil, "root/OpenHardwareMonitor")
	if err == nil {
		service2 := serviceRaw2.ToIDispatch()
		defer service2.Release()

		resultRaw, err := oleutil.CallMethod(service2, "ExecQuery", "SELECT Value FROM Sensor WHERE SensorType='Temperature' AND Name LIKE '%CPU%'")
		if err == nil {
			result := resultRaw.ToIDispatch()
			defer result.Release()

			countVar, err := oleutil.GetProperty(result, "Count")
			if err == nil && countVar.Val > 0 {
				itemRaw, err := oleutil.CallMethod(result, "ItemIndex", 0)
				if err == nil {
					item := itemRaw.ToIDispatch()
					defer item.Release()

					tempVar, err := oleutil.GetProperty(item, "Value")
					if err == nil {
						temp := float64(tempVar.Val)
						if temp > 0 && temp < 150 {
							return temp, nil
						}
					}
				}
			}
		}
	}

	// If all methods fail, return error
	return 0, ole.NewError(0x80004005) // E_FAIL
}
