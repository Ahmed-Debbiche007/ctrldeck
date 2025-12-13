package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"

	"ctrldeck-server/internal/models"
	"ctrldeck-server/internal/services"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// WebSocketHandler handles WebSocket connections for real-time metrics
type WebSocketHandler struct {
	metricsService *services.SystemMetricsService
	clients        map[*websocket.Conn]bool
	clientsMu      sync.RWMutex
	broadcast      chan models.SystemMetrics
}

// NewWebSocketHandler creates a new WebSocketHandler
func NewWebSocketHandler(metricsService *services.SystemMetricsService) *WebSocketHandler {
	handler := &WebSocketHandler{
		metricsService: metricsService,
		clients:        make(map[*websocket.Conn]bool),
		broadcast:      make(chan models.SystemMetrics, 10),
	}

	// Start broadcasting to clients
	go handler.handleBroadcast()

	return handler
}

// HandleConnection handles new WebSocket connections
func (h *WebSocketHandler) HandleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Register client
	h.clientsMu.Lock()
	h.clients[conn] = true
	h.clientsMu.Unlock()

	log.Printf("New WebSocket client connected. Total clients: %d", len(h.clients))

	// Send initial metrics
	metrics := h.metricsService.GetCurrentMetrics()
	h.sendToClient(conn, metrics)

	// Subscribe to metrics updates
	metricsChan := h.metricsService.Subscribe()

	// Handle incoming messages and forward metrics
	go func() {
		defer func() {
			h.metricsService.Unsubscribe(metricsChan)
			h.removeClient(conn)
			conn.Close()
		}()

		// Forward metrics to this client
		for metrics := range metricsChan {
			if err := h.sendToClient(conn, metrics); err != nil {
				log.Printf("Error sending metrics to client: %v", err)
				return
			}
		}
	}()

	// Read messages from client (for ping/pong or commands)
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Handle incoming messages (e.g., commands)
		h.handleMessage(conn, message)
	}
}

// handleMessage processes incoming WebSocket messages
func (h *WebSocketHandler) handleMessage(conn *websocket.Conn, message []byte) {
	var msg map[string]interface{}
	if err := json.Unmarshal(message, &msg); err != nil {
		return
	}

	// Handle different message types
	msgType, ok := msg["type"].(string)
	if !ok {
		return
	}

	switch msgType {
	case "ping":
		h.sendJSON(conn, map[string]string{"type": "pong"})
	case "get_metrics":
		metrics := h.metricsService.GetCurrentMetrics()
		h.sendToClient(conn, metrics)
	}
}

// sendToClient sends metrics to a specific client
func (h *WebSocketHandler) sendToClient(conn *websocket.Conn, metrics models.SystemMetrics) error {
	return h.sendJSON(conn, map[string]interface{}{
		"type": "metrics",
		"data": metrics,
	})
}

// sendJSON sends a JSON message to a client
func (h *WebSocketHandler) sendJSON(conn *websocket.Conn, data interface{}) error {
	h.clientsMu.RLock()
	defer h.clientsMu.RUnlock()

	if !h.clients[conn] {
		return nil
	}

	return conn.WriteJSON(data)
}

// removeClient removes a client from the clients map
func (h *WebSocketHandler) removeClient(conn *websocket.Conn) {
	h.clientsMu.Lock()
	defer h.clientsMu.Unlock()

	delete(h.clients, conn)
	log.Printf("WebSocket client disconnected. Total clients: %d", len(h.clients))
}

// handleBroadcast handles broadcasting messages to all clients
func (h *WebSocketHandler) handleBroadcast() {
	for metrics := range h.broadcast {
		h.clientsMu.RLock()
		for conn := range h.clients {
			go func(c *websocket.Conn) {
				if err := h.sendToClient(c, metrics); err != nil {
					h.removeClient(c)
					c.Close()
				}
			}(conn)
		}
		h.clientsMu.RUnlock()
	}
}

// BroadcastMetrics sends metrics to all connected clients
func (h *WebSocketHandler) BroadcastMetrics(metrics models.SystemMetrics) {
	select {
	case h.broadcast <- metrics:
	default:
		// Channel full, skip this broadcast
	}
}

// GetClientCount returns the number of connected clients
func (h *WebSocketHandler) GetClientCount() int {
	h.clientsMu.RLock()
	defer h.clientsMu.RUnlock()
	return len(h.clients)
}

// BroadcastConfigChange sends a config change notification to all connected clients
func (h *WebSocketHandler) BroadcastConfigChange(changedType string) {
	h.clientsMu.RLock()
	defer h.clientsMu.RUnlock()

	message := map[string]interface{}{
		"type": "config_changed",
		"data": map[string]string{
			"changed": changedType,
		},
	}

	for conn := range h.clients {
		go func(c *websocket.Conn) {
			if err := c.WriteJSON(message); err != nil {
				log.Printf("Error sending config change to client: %v", err)
			}
		}(conn)
	}

	log.Printf("Broadcasted config change: %s to %d clients", changedType, len(h.clients))
}
