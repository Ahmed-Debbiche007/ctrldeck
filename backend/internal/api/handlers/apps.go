package handlers

import (
	"encoding/json"
	"net/http"

	"streamdeck-server/internal/services"
)

// AppsHandler handles installed apps HTTP requests
type AppsHandler struct {
	appService *services.AppDiscoveryService
}

// NewAppsHandler creates a new AppsHandler
func NewAppsHandler(appService *services.AppDiscoveryService) *AppsHandler {
	return &AppsHandler{appService: appService}
}

// GetApps returns all installed applications
func (h *AppsHandler) GetApps(w http.ResponseWriter, r *http.Request) {
	apps, err := h.appService.GetInstalledApps()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(apps)
}

// RefreshApps rescans for installed applications
func (h *AppsHandler) RefreshApps(w http.ResponseWriter, r *http.Request) {
	apps, err := h.appService.RefreshApps()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(apps)
}

// SearchApps searches for apps by name
func (h *AppsHandler) SearchApps(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		// Return all apps if no query
		h.GetApps(w, r)
		return
	}

	apps, err := h.appService.SearchApps(query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(apps)
}
