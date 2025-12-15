package handlers

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"ctrldeck-server/internal/config"
	"ctrldeck-server/internal/core/actions"
	"ctrldeck-server/internal/core/actions/brightness"
	"ctrldeck-server/internal/core/actions/media"
	"ctrldeck-server/internal/core/actions/mic"
	"ctrldeck-server/internal/core/actions/volume"
	"ctrldeck-server/internal/models"
	"ctrldeck-server/internal/services"
)

// SystemHandler handles system-related HTTP requests including action execution
type SystemHandler struct {
	store                *config.Store
	micController        *mic.MicController
	volController        *volume.VolumeController
	brightnessController *brightness.BrightnessController
	appLauncher          *actions.AppLauncher
	scriptExecutor       *actions.ScriptExecutor
	metricsService       *services.SystemMetricsService
	weatherService       *services.WeatherService
	wsHandler            *WebSocketHandler
}

// NewSystemHandler creates a new SystemHandler
func NewSystemHandler(
	store *config.Store,
	metricsService *services.SystemMetricsService,
	weatherService *services.WeatherService,
) *SystemHandler {
	return &SystemHandler{
		store:                store,
		micController:        mic.NewMicController(),
		volController:        volume.NewVolumeController(),
		brightnessController: brightness.NewBrightnessController(),
		appLauncher:          actions.NewAppLauncher(),
		scriptExecutor:       actions.NewScriptExecutor(nil),
		metricsService:       metricsService,
		weatherService:       weatherService,
	}
}

// SetWebSocketHandler sets the WebSocket handler for broadcasting config changes
func (h *SystemHandler) SetWebSocketHandler(wsHandler *WebSocketHandler) {
	h.wsHandler = wsHandler
}

// ExecuteAction executes an action for a button
func (h *SystemHandler) ExecuteAction(w http.ResponseWriter, r *http.Request) {
	buttonID := chi.URLParam(r, "buttonId")
	if buttonID == "" {
		h.sendError(w, "Button ID required", http.StatusBadRequest)
		return
	}

	// Get button configuration
	button, err := h.store.GetButton(buttonID)
	if err != nil {
		h.sendError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if button == nil {
		h.sendError(w, "Button not found", http.StatusNotFound)
		return
	}

	// Execute the action based on type
	response := h.executeButtonAction(button)

	w.Header().Set("Content-Type", "application/json")
	if !response.Success {
		w.WriteHeader(http.StatusInternalServerError)
	}
	json.NewEncoder(w).Encode(response)
}

// executeButtonAction executes the action associated with a button
func (h *SystemHandler) executeButtonAction(button *models.Button) models.ActionResponse {
	switch button.ActionType {
	case "mute_mic":
		return h.toggleMic()
	case "volume_up":
		step := h.getIntParam(button.ActionData, "step", 5)
		return h.volumeUp(step)
	case "volume_down":
		step := h.getIntParam(button.ActionData, "step", 5)
		return h.volumeDown(step)
	case "volume_mute":
		return h.toggleVolumeMute()
	case "volume_knob":
		// Volume knob is handled via the /api/system/volume endpoint directly
		return models.ActionResponse{
			Success: true,
			Message: "Volume knob is interactive - use direct volume control",
		}
	case "brightness_knob":
		// Brightness knob is handled via the /api/system/brightness endpoint directly
		return models.ActionResponse{
			Success: true,
			Message: "Brightness knob is interactive - use direct brightness control",
		}
	case "launch_app":
		appPath := button.ActionData["app_path"]
		return h.launchApp(appPath)
	case "run_script":
		scriptID := button.ActionData["script_id"]
		return h.runScript(scriptID)
	case "open_url":
		url := button.ActionData["url"]
		return h.openURL(url)
	case "media_play_pause":
		return h.mediaPlayPause()
	case "media_next":
		return h.mediaNext()
	case "media_prev":
		return h.mediaPrev()
	default:
		return models.ActionResponse{
			Success: false,
			Error:   "Unknown action type: " + button.ActionType,
		}
	}
}

// toggleMic toggles the microphone mute state
func (h *SystemHandler) toggleMic() models.ActionResponse {
	err := h.micController.ToggleMute()
	if err != nil {
		return models.ActionResponse{Success: false, Error: err.Error()}
	}

	muted, _ := h.micController.IsMuted()
	msg := "Microphone unmuted"
	if muted {
		msg = "Microphone muted"
	}

	return models.ActionResponse{Success: true, Message: msg}
}

// volumeUp increases the volume
func (h *SystemHandler) volumeUp(step int) models.ActionResponse {
	err := h.volController.VolumeUp(step)
	if err != nil {
		return models.ActionResponse{Success: false, Error: err.Error()}
	}

	vol, _ := h.volController.GetVolume()
	return models.ActionResponse{
		Success: true,
		Message: "Volume: " + strconv.Itoa(vol) + "%",
	}
}

// volumeDown decreases the volume
func (h *SystemHandler) volumeDown(step int) models.ActionResponse {
	err := h.volController.VolumeDown(step)
	if err != nil {
		return models.ActionResponse{Success: false, Error: err.Error()}
	}

	vol, _ := h.volController.GetVolume()
	return models.ActionResponse{
		Success: true,
		Message: "Volume: " + strconv.Itoa(vol) + "%",
	}
}

// toggleVolumeMute toggles the volume mute state
func (h *SystemHandler) toggleVolumeMute() models.ActionResponse {
	err := h.volController.ToggleMute()
	if err != nil {
		return models.ActionResponse{Success: false, Error: err.Error()}
	}

	muted, _ := h.volController.IsMuted()
	msg := "Volume unmuted"
	if muted {
		msg = "Volume muted"
	}

	return models.ActionResponse{Success: true, Message: msg}
}

// launchApp launches an application
func (h *SystemHandler) launchApp(appPath string) models.ActionResponse {
	if appPath == "" {
		return models.ActionResponse{Success: false, Error: "App path is required"}
	}

	err := h.appLauncher.Launch(appPath)
	if err != nil {
		return models.ActionResponse{Success: false, Error: err.Error()}
	}

	return models.ActionResponse{Success: true, Message: "Application launched"}
}

// runScript executes a script
func (h *SystemHandler) runScript(scriptID string) models.ActionResponse {
	if scriptID == "" {
		return models.ActionResponse{Success: false, Error: "Script ID is required"}
	}

	// Handle inline scripts (prefixed with "inline:")
	if strings.HasPrefix(scriptID, "inline:") {
		script := strings.TrimPrefix(scriptID, "inline:")
		result, err := h.scriptExecutor.ExecuteInline(script, "")
		if err != nil {
			return models.ActionResponse{Success: false, Error: err.Error()}
		}
		return models.ActionResponse{
			Success: result.IsSuccess(),
			Message: result.Stdout,
			Error:   result.Error,
		}
	}

	// Get script from config
	script, err := h.store.GetScript(scriptID)
	if err != nil {
		return models.ActionResponse{Success: false, Error: err.Error()}
	}

	if script == nil {
		return models.ActionResponse{Success: false, Error: "Script not found"}
	}

	result, err := h.scriptExecutor.Execute(script.Path)
	if err != nil {
		return models.ActionResponse{Success: false, Error: err.Error()}
	}

	return models.ActionResponse{
		Success: result.IsSuccess(),
		Message: result.Stdout,
		Error:   result.Error,
	}
}

// openURL opens a URL in the default browser
func (h *SystemHandler) openURL(url string) models.ActionResponse {
	if url == "" {
		return models.ActionResponse{Success: false, Error: "URL is required"}
	}

	err := h.appLauncher.OpenURL(url)
	if err != nil {
		return models.ActionResponse{Success: false, Error: err.Error()}
	}

	return models.ActionResponse{Success: true, Message: "URL opened"}
}

// mediaPlayPause toggles media playback
func (h *SystemHandler) mediaPlayPause() models.ActionResponse {
	if media.Current == nil {
		return models.ActionResponse{Success: false, Error: "Media controller not available"}
	}

	err := media.Current.PlayPause()
	if err != nil {
		return models.ActionResponse{Success: false, Error: err.Error()}
	}

	return models.ActionResponse{Success: true, Message: "Media play/pause toggled"}
}

// mediaNext skips to the next track
func (h *SystemHandler) mediaNext() models.ActionResponse {
	if media.Current == nil {
		return models.ActionResponse{Success: false, Error: "Media controller not available"}
	}

	err := media.Current.NextTrack()
	if err != nil {
		return models.ActionResponse{Success: false, Error: err.Error()}
	}

	return models.ActionResponse{Success: true, Message: "Skipped to next track"}
}

// mediaPrev skips to the previous track
func (h *SystemHandler) mediaPrev() models.ActionResponse {
	if media.Current == nil {
		return models.ActionResponse{Success: false, Error: "Media controller not available"}
	}

	err := media.Current.PrevTrack()
	if err != nil {
		return models.ActionResponse{Success: false, Error: err.Error()}
	}

	return models.ActionResponse{Success: true, Message: "Skipped to previous track"}
}

// MediaControl handles direct media control requests
func (h *SystemHandler) MediaControl(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Action string `json:"action"` // "play_pause", "next", "prev"
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.sendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var response models.ActionResponse
	switch req.Action {
	case "play_pause":
		response = h.mediaPlayPause()
	case "next":
		response = h.mediaNext()
	case "prev":
		response = h.mediaPrev()
	default:
		h.sendError(w, "Invalid action: "+req.Action, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if !response.Success {
		w.WriteHeader(http.StatusInternalServerError)
	}
	json.NewEncoder(w).Encode(response)
}

// GetSystemMetrics returns current system metrics
func (h *SystemHandler) GetSystemMetrics(w http.ResponseWriter, r *http.Request) {
	metrics := h.metricsService.GetCurrentMetrics()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

// SetVolumeLevel sets the system volume to a specific level
func (h *SystemHandler) SetVolumeLevel(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Level int `json:"level"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.sendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Clamp level between 0 and 100
	if req.Level < 0 {
		req.Level = 0
	}
	if req.Level > 100 {
		req.Level = 100
	}

	err := h.volController.SetVolume(req.Level)
	if err != nil {
		h.sendError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.ActionResponse{
		Success: true,
		Message: "Volume set to " + strconv.Itoa(req.Level) + "%",
	})
}

// SetBrightnessLevel sets the screen brightness to a specific level
func (h *SystemHandler) SetBrightnessLevel(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Level int `json:"level"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Println("Error decoding brightness request:", err)
		h.sendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Clamp level between 0 and 100
	if req.Level < 0 {
		req.Level = 0
	}
	if req.Level > 100 {
		req.Level = 100
	}

	err := h.brightnessController.SetBrightness(req.Level)
	if err != nil {
		fmt.Println("Error setting brightness:", err)
		h.sendError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.ActionResponse{
		Success: true,
		Message: "Brightness set to " + strconv.Itoa(req.Level) + "%",
	})
}

// Helper functions
func (h *SystemHandler) getIntParam(data map[string]string, key string, defaultVal int) int {
	if val, ok := data[key]; ok {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}

func (h *SystemHandler) sendError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(models.ActionResponse{
		Success: false,
		Error:   message,
	})
}

// ServerInfoResponse represents the server connection info
type ServerInfoResponse struct {
	IPAddresses []string `json:"ip_addresses"`
	Port        string   `json:"port"`
	Hostname    string   `json:"hostname,omitempty"`
}

// GetServerInfo returns the server's IP addresses and connection info
func (h *SystemHandler) GetServerInfo(w http.ResponseWriter, r *http.Request) {
	var ips []string

	// Get all network interfaces
	interfaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range interfaces {
			// Skip loopback and down interfaces
			if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
				continue
			}

			addrs, err := iface.Addrs()
			if err != nil {
				continue
			}

			for _, addr := range addrs {
				var ip net.IP
				switch v := addr.(type) {
				case *net.IPNet:
					ip = v.IP
				case *net.IPAddr:
					ip = v.IP
				}

				// Only include IPv4 addresses, skip loopback
				if ip != nil && ip.To4() != nil && !ip.IsLoopback() {
					ips = append(ips, ip.String())
				}
			}
		}
	}

	// Fallback to localhost if no IPs found
	if len(ips) == 0 {
		ips = []string{"127.0.0.1"}
	}

	response := ServerInfoResponse{
		IPAddresses: ips,
		Port:        "8080",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetWeather returns cached weather data
func (h *SystemHandler) GetWeather(w http.ResponseWriter, r *http.Request) {
	if h.weatherService == nil {
		h.sendError(w, "Weather service not available", http.StatusServiceUnavailable)
		return
	}

	weather, err := h.weatherService.GetWeather()
	if err != nil {
		h.sendError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(weather)
}

// LocationResponse represents the location settings response
type LocationResponse struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	City      string  `json:"city"`
	Source    string  `json:"source"`
	UpdatedAt int64   `json:"updated_at"`
}

// GetLocation returns the current saved location settings
func (h *SystemHandler) GetLocation(w http.ResponseWriter, r *http.Request) {
	if h.weatherService == nil {
		h.sendError(w, "Weather service not available", http.StatusServiceUnavailable)
		return
	}

	location := h.weatherService.GetSavedLocation()
	if location == nil {
		// No saved location - return empty response indicating IP-based fallback
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"source":  "ip",
			"message": "No saved location, using IP-based geolocation",
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(LocationResponse{
		Latitude:  location.Latitude,
		Longitude: location.Longitude,
		City:      location.City,
		Source:    string(location.Source),
		UpdatedAt: location.UpdatedAt,
	})
}

// SetLocationRequest represents the request to set location
type SetLocationRequest struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	City      string  `json:"city"`
	Source    string  `json:"source"` // "manual" or "browser"
}

// SetLocation saves a new location
func (h *SystemHandler) SetLocation(w http.ResponseWriter, r *http.Request) {
	if h.weatherService == nil {
		h.sendError(w, "Weather service not available", http.StatusServiceUnavailable)
		return
	}

	var req SetLocationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.sendError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate source
	source := services.LocationSourceBrowser
	if req.Source == "manual" {
		source = services.LocationSourceManual
	}

	// Save the location
	if err := h.weatherService.SetLocation(req.Latitude, req.Longitude, req.City, source); err != nil {
		h.sendError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Broadcast location change to all clients
	if h.wsHandler != nil {
		h.wsHandler.BroadcastConfigChange("location")
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.ActionResponse{
		Success: true,
		Message: "Location saved successfully",
	})
}

// ClearLocation removes the saved location (reverts to IP-based)
func (h *SystemHandler) ClearLocation(w http.ResponseWriter, r *http.Request) {
	if h.weatherService == nil {
		h.sendError(w, "Weather service not available", http.StatusServiceUnavailable)
		return
	}

	if err := h.weatherService.ClearLocation(); err != nil {
		h.sendError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Broadcast location change to all clients
	if h.wsHandler != nil {
		h.wsHandler.BroadcastConfigChange("location")
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models.ActionResponse{
		Success: true,
		Message: "Location cleared, reverted to IP-based geolocation",
	})
}
