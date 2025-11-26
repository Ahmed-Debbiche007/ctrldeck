package models

import "time"

// Button represents a configurable button on the stream deck
type Button struct {
	ID         string            `json:"id"`
	Name       string            `json:"name"`
	Icon       string            `json:"icon"`
	ActionType string            `json:"action_type"` // mute_mic, volume_up, volume_down, set_volume, launch_app, run_script
	ActionData map[string]string `json:"action_data"` // Additional data for the action (e.g., script_id, app_path, volume_level)
	Position   int               `json:"position"`
	Color      string            `json:"color,omitempty"`
}

// Script represents a user-defined script
type Script struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Widget represents a widget on the stream deck display
type Widget struct {
	ID       string            `json:"id"`
	Type     string            `json:"type"` // cpu, ram, battery, clock, weather, network
	Position int               `json:"position"`
	Settings map[string]string `json:"settings,omitempty"`
	Enabled  bool              `json:"enabled"`
}

// InstalledApp represents an installed application on the system
type InstalledApp struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	Icon     string `json:"icon,omitempty"`
	Category string `json:"category,omitempty"`
}

// SystemMetrics represents real-time system metrics
type SystemMetrics struct {
	CPUUsage      float64 `json:"cpu_usage"`
	RAMUsage      float64 `json:"ram_usage"`
	RAMTotal      uint64  `json:"ram_total"`
	RAMUsed       uint64  `json:"ram_used"`
	BatteryLevel  int     `json:"battery_level"`
	IsCharging    bool    `json:"is_charging"`
	CPUTemp       float64 `json:"cpu_temp"`
	MicMuted      bool    `json:"mic_muted"`
	VolumeLevel   int     `json:"volume_level"`
	NetworkUpload float64 `json:"network_upload"`   // bytes per second
	NetworkDown   float64 `json:"network_download"` // bytes per second
	Timestamp     int64   `json:"timestamp"`
}

// ActionRequest represents a request to execute an action
type ActionRequest struct {
	ButtonID string `json:"button_id"`
}

// ActionResponse represents the response from an action execution
type ActionResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

// ReorderRequest represents a request to reorder buttons
type ReorderRequest struct {
	ButtonIDs []string `json:"button_ids"`
}

// Config holds all configuration data
type Config struct {
	Buttons []Button `json:"buttons"`
	Scripts []Script `json:"scripts"`
	Widgets []Widget `json:"widgets"`
}
