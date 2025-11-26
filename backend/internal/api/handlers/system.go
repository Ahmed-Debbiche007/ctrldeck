package handlers

import (
	"encoding/json"
	"net"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"streamdeck-server/internal/config"
	"streamdeck-server/internal/core/actions"
	"streamdeck-server/internal/models"
	"streamdeck-server/internal/services"
)

// SystemHandler handles system-related HTTP requests including action execution
type SystemHandler struct {
	store          *config.Store
	micController  *actions.MicController
	volController  *actions.VolumeController
	appLauncher    *actions.AppLauncher
	scriptExecutor *actions.ScriptExecutor
	metricsService *services.SystemMetricsService
}

// NewSystemHandler creates a new SystemHandler
func NewSystemHandler(
	store *config.Store,
	metricsService *services.SystemMetricsService,
) *SystemHandler {
	return &SystemHandler{
		store:          store,
		micController:  actions.NewMicController(),
		volController:  actions.NewVolumeController(),
		appLauncher:    actions.NewAppLauncher(),
		scriptExecutor: actions.NewScriptExecutor(nil),
		metricsService: metricsService,
	}
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
	case "set_volume":
		level := h.getIntParam(button.ActionData, "level", 50)
		return h.setVolume(level)
	case "volume_mute":
		return h.toggleVolumeMute()
	case "launch_app":
		appPath := button.ActionData["app_path"]
		return h.launchApp(appPath)
	case "run_script":
		scriptID := button.ActionData["script_id"]
		return h.runScript(scriptID)
	case "open_url":
		url := button.ActionData["url"]
		return h.openURL(url)
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

// setVolume sets the volume to a specific level
func (h *SystemHandler) setVolume(level int) models.ActionResponse {
	err := h.volController.SetVolume(level)
	if err != nil {
		return models.ActionResponse{Success: false, Error: err.Error()}
	}

	return models.ActionResponse{
		Success: true,
		Message: "Volume set to " + strconv.Itoa(level) + "%",
	}
}

// toggleVolumeMute toggles the volume mute state
func (h *SystemHandler) toggleVolumeMute() models.ActionResponse {
	err := h.volController.ToggleMute()
	if err != nil {
		return models.ActionResponse{Success: false, Error: err.Error()}
	}

	return models.ActionResponse{Success: true, Message: "Volume mute toggled"}
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

// GetSystemMetrics returns current system metrics
func (h *SystemHandler) GetSystemMetrics(w http.ResponseWriter, r *http.Request) {
	metrics := h.metricsService.GetCurrentMetrics()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
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
