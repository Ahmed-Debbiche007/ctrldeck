package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/rs/cors"

	"ctrldeck-server/internal/api/handlers"
	"ctrldeck-server/internal/config"
	"ctrldeck-server/internal/services"
)

// RouterConfig holds configuration for the router
type RouterConfig struct {
	Store          *config.Store
	MetricsService *services.SystemMetricsService
	AppService     *services.AppDiscoveryService
	WeatherService *services.WeatherService
	StaticDir      string
	AllowedOrigins []string
}

// NewRouter creates a new chi router with all routes configured
func NewRouter(cfg RouterConfig) http.Handler {
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)

	// CORS configuration
	corsHandler := cors.New(cors.Options{
		AllowedOrigins:   getOrigins(cfg.AllowedOrigins),
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	})
	r.Use(corsHandler.Handler)

	// Initialize handlers
	// WebSocket handler must be created first so it can be passed to other handlers
	wsHandler := handlers.NewWebSocketHandler(cfg.MetricsService)
	buttonsHandler := handlers.NewButtonsHandler(cfg.Store, wsHandler)
	scriptsHandler := handlers.NewScriptsHandler(cfg.Store)
	widgetsHandler := handlers.NewWidgetsHandler(cfg.Store, wsHandler)
	appsHandler := handlers.NewAppsHandler(cfg.AppService)
	systemHandler := handlers.NewSystemHandler(cfg.Store, cfg.MetricsService, cfg.WeatherService)
	systemHandler.SetWebSocketHandler(wsHandler)

	// API routes
	r.Route("/api", func(r chi.Router) {
		// Buttons
		r.Route("/buttons", func(r chi.Router) {
			r.Get("/", buttonsHandler.GetButtons)
			r.Post("/", buttonsHandler.CreateButton)
			r.Post("/reorder", buttonsHandler.ReorderButtons)
			r.Delete("/{id}", buttonsHandler.DeleteButton)
		})

		// Scripts
		r.Route("/scripts", func(r chi.Router) {
			r.Get("/", scriptsHandler.GetScripts)
			r.Post("/", scriptsHandler.CreateScript)
			r.Get("/{id}", scriptsHandler.GetScript)
			r.Delete("/{id}", scriptsHandler.DeleteScript)
		})

		// Widgets
		r.Route("/widgets", func(r chi.Router) {
			r.Get("/", widgetsHandler.GetWidgets)
			r.Post("/", widgetsHandler.CreateOrUpdateWidget)
			r.Put("/", widgetsHandler.UpdateWidgets)
		})

		// Apps
		r.Route("/apps", func(r chi.Router) {
			r.Get("/", appsHandler.GetApps)
			r.Get("/search", appsHandler.SearchApps)
			r.Post("/refresh", appsHandler.RefreshApps)
		})

		// Action execution
		r.Post("/action/{buttonId}", systemHandler.ExecuteAction)

		// System metrics (HTTP endpoint)
		r.Get("/system/metrics", systemHandler.GetSystemMetrics)

		// Volume control (direct volume setting)
		r.Post("/system/volume", systemHandler.SetVolumeLevel)

		// Brightness control (direct brightness setting)
		r.Post("/system/brightness", systemHandler.SetBrightnessLevel)

		// Media control (play/pause, next, prev)
		r.Post("/system/media", systemHandler.MediaControl)

		// Server info (IP addresses)
		r.Get("/system/info", systemHandler.GetServerInfo)

		// Weather (cached, refreshed hourly)
		r.Get("/system/weather", systemHandler.GetWeather)

		// Location settings for weather
		r.Route("/settings/location", func(r chi.Router) {
			r.Get("/", systemHandler.GetLocation)
			r.Post("/", systemHandler.SetLocation)
			r.Delete("/", systemHandler.ClearLocation)
		})
	})

	// WebSocket endpoint for real-time metrics
	r.Get("/ws/system", wsHandler.HandleConnection)

	// Health check endpoint
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Serve static files (React frontend)
	if cfg.StaticDir != "" {
		fileServer := http.FileServer(http.Dir(cfg.StaticDir))
		r.Handle("/*", http.StripPrefix("/", fileServer))
	}

	return r
}

// getOrigins returns allowed origins for CORS
func getOrigins(origins []string) []string {
	if len(origins) == 0 {
		return []string{
			"http://localhost:3000",
			"http://localhost:5173",
			"http://127.0.0.1:3000",
			"http://127.0.0.1:5173",
			"*",
		}
	}
	return origins
}
