package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"ctrldeck-server/internal/config"
	"ctrldeck-server/internal/models"
)

// ScriptsHandler handles script-related HTTP requests
type ScriptsHandler struct {
	store *config.Store
}

// NewScriptsHandler creates a new ScriptsHandler
func NewScriptsHandler(store *config.Store) *ScriptsHandler {
	return &ScriptsHandler{store: store}
}

// GetScripts returns all scripts
func (h *ScriptsHandler) GetScripts(w http.ResponseWriter, r *http.Request) {
	scripts, err := h.store.GetScripts()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(scripts)
}

// CreateScript creates a new script
func (h *ScriptsHandler) CreateScript(w http.ResponseWriter, r *http.Request) {
	var script models.Script
	if err := json.NewDecoder(r.Body).Decode(&script); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if script.Name == "" || script.Path == "" {
		http.Error(w, "Name and path are required", http.StatusBadRequest)
		return
	}

	// Generate ID if not provided
	if script.ID == "" {
		script.ID = "script-" + generateID()
	}

	// Set timestamps
	now := time.Now()
	script.CreatedAt = now
	script.UpdatedAt = now

	if err := h.store.AddScript(script); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(script)
}

// DeleteScript deletes a script by ID
func (h *ScriptsHandler) DeleteScript(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "Script ID required", http.StatusBadRequest)
		return
	}

	if err := h.store.DeleteScript(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetScript returns a single script by ID
func (h *ScriptsHandler) GetScript(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "Script ID required", http.StatusBadRequest)
		return
	}

	script, err := h.store.GetScript(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if script == nil {
		http.Error(w, "Script not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(script)
}
