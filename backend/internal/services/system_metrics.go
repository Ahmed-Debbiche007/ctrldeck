package services

import (
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"

	"ctrldeck-server/internal/core/actions/brightness"
	"ctrldeck-server/internal/core/actions/mic"
	"ctrldeck-server/internal/core/actions/volume"
	"ctrldeck-server/internal/models"
)

// SystemMetricsService collects and broadcasts system metrics
type SystemMetricsService struct {
	mu                   sync.RWMutex
	currentMetrics       models.SystemMetrics
	currentMediaState    models.MediaState
	subscribers          map[chan models.SystemMetrics]bool
	subscribersMu        sync.RWMutex
	stopChan             chan struct{}
	micController        *mic.MicController
	volController        *volume.VolumeController
	brightnessController *brightness.BrightnessController
	prevNetStats         []net.IOCountersStat
	prevNetTime          time.Time
}

// NewSystemMetricsService creates a new SystemMetricsService
func NewSystemMetricsService() *SystemMetricsService {
	return &SystemMetricsService{
		subscribers:          make(map[chan models.SystemMetrics]bool),
		stopChan:             make(chan struct{}),
		micController:        mic.NewMicController(),
		volController:        volume.NewVolumeController(),
		brightnessController: brightness.NewBrightnessController(),
	}
}

// Start begins collecting metrics at regular intervals
func (s *SystemMetricsService) Start(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		// Collect initial metrics
		s.collectMetrics()

		for {
			select {
			case <-ticker.C:
				s.collectMetrics()
				s.broadcast()
			case <-s.stopChan:
				return
			}
		}
	}()
}

// Stop stops the metrics collection
func (s *SystemMetricsService) Stop() {
	close(s.stopChan)
}

// Subscribe returns a channel that receives metric updates
func (s *SystemMetricsService) Subscribe() chan models.SystemMetrics {
	ch := make(chan models.SystemMetrics, 10)
	s.subscribersMu.Lock()
	s.subscribers[ch] = true
	s.subscribersMu.Unlock()
	return ch
}

// Unsubscribe removes a subscriber
func (s *SystemMetricsService) Unsubscribe(ch chan models.SystemMetrics) {
	s.subscribersMu.Lock()
	delete(s.subscribers, ch)
	close(ch)
	s.subscribersMu.Unlock()
}

// GetCurrentMetrics returns the current metrics
func (s *SystemMetricsService) GetCurrentMetrics() models.SystemMetrics {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.currentMetrics
}

// collectMetrics gathers all system metrics
func (s *SystemMetricsService) collectMetrics() {
	metrics := models.SystemMetrics{
		Timestamp: time.Now().Unix(),
	}

	// CPU Usage
	cpuPercent, err := cpu.Percent(0, false)
	if err == nil && len(cpuPercent) > 0 {
		metrics.CPUUsage = cpuPercent[0]
	}

	// Memory Usage
	memInfo, err := mem.VirtualMemory()
	if err == nil {
		metrics.RAMUsage = memInfo.UsedPercent
		metrics.RAMTotal = memInfo.Total
		metrics.RAMUsed = memInfo.Used
	}

	// Battery (if available)
	metrics.BatteryLevel, metrics.IsCharging = s.getBatteryInfoPlatform()

	// CPU Temperature (platform-specific)
	metrics.CPUTemp = s.getCPUTemperaturePlatform()

	// Mic muted state
	muted, err := s.micController.IsMuted()
	if err == nil {
		metrics.MicMuted = muted
	}

	// Volume level
	vol, err := s.volController.GetVolume()
	if err == nil {
		metrics.VolumeLevel = vol
	}

	// Volume muted state
	volMuted, err := s.volController.IsMuted()
	if err == nil {
		metrics.VolumeMuted = volMuted
	}

	// Brightness level
	brightness, err := s.brightnessController.GetBrightness()
	if err == nil {
		metrics.BrightnessLevel = brightness
	}

	// Network speed
	metrics.NetworkUpload, metrics.NetworkDown = s.getNetworkSpeed()

	// Media state (updated via callback, just copy current state)
	metrics.Media = s.currentMediaState

	s.mu.Lock()
	s.currentMetrics = metrics
	s.mu.Unlock()
}

// UpdateMediaState updates the current media state (called from media controller callback)
func (s *SystemMetricsService) UpdateMediaState(state models.MediaState) {
	s.mu.Lock()
	s.currentMediaState = state
	s.currentMetrics.Media = state
	s.mu.Unlock()

	// Broadcast immediately when media state changes
	s.broadcast()
}

// broadcast sends metrics to all subscribers
func (s *SystemMetricsService) broadcast() {
	s.subscribersMu.RLock()
	defer s.subscribersMu.RUnlock()

	metrics := s.GetCurrentMetrics()
	for ch := range s.subscribers {
		select {
		case ch <- metrics:
		default:
			// Skip if channel is full
		}
	}
}

// getNetworkSpeed calculates network upload/download speeds
func (s *SystemMetricsService) getNetworkSpeed() (float64, float64) {
	netStats, err := net.IOCounters(false)
	if err != nil || len(netStats) == 0 {
		return 0, 0
	}

	currentTime := time.Now()
	currentStats := netStats[0]

	if s.prevNetStats == nil {
		s.prevNetStats = netStats
		s.prevNetTime = currentTime
		return 0, 0
	}

	elapsed := currentTime.Sub(s.prevNetTime).Seconds()
	if elapsed <= 0 {
		return 0, 0
	}

	prevStats := s.prevNetStats[0]

	uploadSpeed := float64(currentStats.BytesSent-prevStats.BytesSent) / elapsed
	downloadSpeed := float64(currentStats.BytesRecv-prevStats.BytesRecv) / elapsed

	s.prevNetStats = netStats
	s.prevNetTime = currentTime

	return uploadSpeed, downloadSpeed
}
