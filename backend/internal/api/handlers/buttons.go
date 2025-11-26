package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"streamdeck-server/internal/config"
	"streamdeck-server/internal/models"
)

// ButtonsHandler handles button-related HTTP requests
type ButtonsHandler struct {
	store *config.Store
}

// NewButtonsHandler creates a new ButtonsHandler
func NewButtonsHandler(store *config.Store) *ButtonsHandler {
	return &ButtonsHandler{store: store}
}

// GetButtons returns all buttons
func (h *ButtonsHandler) GetButtons(w http.ResponseWriter, r *http.Request) {
	buttons, err := h.store.GetButtons()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(buttons)
}

// CreateButton creates a new button or updates an existing one
func (h *ButtonsHandler) CreateButton(w http.ResponseWriter, r *http.Request) {
	var button models.Button
	if err := json.NewDecoder(r.Body).Decode(&button); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Generate ID if not provided
	if button.ID == "" {
		button.ID = "btn-" + generateID()
	}

	// Check if button exists (update) or new (create)
	existing, _ := h.store.GetButton(button.ID)
	if existing != nil {
		if err := h.store.UpdateButton(button); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		if err := h.store.AddButton(button); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(button)
}

// DeleteButton deletes a button by ID
func (h *ButtonsHandler) DeleteButton(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		http.Error(w, "Button ID required", http.StatusBadRequest)
		return
	}

	if err := h.store.DeleteButton(id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ReorderButtons reorders buttons based on provided IDs
func (h *ButtonsHandler) ReorderButtons(w http.ResponseWriter, r *http.Request) {
	var req models.ReorderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.store.ReorderButtons(req.ButtonIDs); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// generateID generates a unique ID
func generateID() string {
	return uuid.New().String()[:8]
}

// Helper to get current timestamp
func now() time.Time {
	return time.Now()
}
