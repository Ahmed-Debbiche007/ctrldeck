package handlers

import (
	"encoding/json"
	"net/http"

	"ctrldeck-server/internal/config"
	"ctrldeck-server/internal/models"
)

// WidgetsHandler handles widget-related HTTP requests
type WidgetsHandler struct {
	store     *config.Store
	wsHandler *WebSocketHandler
}

// NewWidgetsHandler creates a new WidgetsHandler
func NewWidgetsHandler(store *config.Store, wsHandler *WebSocketHandler) *WidgetsHandler {
	return &WidgetsHandler{store: store, wsHandler: wsHandler}
}

// GetWidgets returns all widgets
func (h *WidgetsHandler) GetWidgets(w http.ResponseWriter, r *http.Request) {
	widgets, err := h.store.GetWidgets()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(widgets)
}

// CreateOrUpdateWidget creates a new widget or updates an existing one
func (h *WidgetsHandler) CreateOrUpdateWidget(w http.ResponseWriter, r *http.Request) {
	var widget models.Widget
	if err := json.NewDecoder(r.Body).Decode(&widget); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if widget.Type == "" {
		http.Error(w, "Widget type is required", http.StatusBadRequest)
		return
	}

	// Generate ID if not provided
	if widget.ID == "" {
		widget.ID = "widget-" + generateID()
	}

	if err := h.store.UpdateWidget(widget); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Broadcast config change to all clients
	if h.wsHandler != nil {
		h.wsHandler.BroadcastConfigChange("widgets")
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(widget)
}

// UpdateWidgets updates multiple widgets at once
func (h *WidgetsHandler) UpdateWidgets(w http.ResponseWriter, r *http.Request) {
	var widgets []models.Widget
	if err := json.NewDecoder(r.Body).Decode(&widgets); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.store.SaveWidgets(widgets); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Broadcast config change to all clients
	if h.wsHandler != nil {
		h.wsHandler.BroadcastConfigChange("widgets")
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(widgets)
}
