package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"ctrldeck-server/internal/api"
	"ctrldeck-server/internal/config"
	"ctrldeck-server/internal/services"
)

func main() {
	// Command line flags
	port := flag.Int("port", 8080, "Server port")
	configDir := flag.String("config", "", "Configuration directory (default: ~/.ctrldeck)")
	staticDir := flag.String("static", "", "Static files directory for frontend")
	flag.Parse()

	// Determine config directory
	cfgDir := *configDir
	if cfgDir == "" {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			log.Fatalf("Failed to get home directory: %v", err)
		}
		cfgDir = filepath.Join(homeDir, ".ctrldeck")
	}

	log.Printf("Starting CtrlDeck Server...")
	log.Printf("Config directory: %s", cfgDir)
	log.Printf("Port: %d", *port)

	// Initialize configuration store
	store, err := config.NewStore(cfgDir)
	if err != nil {
		log.Fatalf("Failed to initialize config store: %v", err)
	}

	// Initialize services
	metricsService := services.NewSystemMetricsService()
	appService := services.NewAppDiscoveryService()
	weatherService := services.NewWeatherService(cfgDir)

	// Start metrics collection (every second)
	metricsService.Start(1 * time.Second)
	defer metricsService.Stop()

	// Pre-populate app cache in background
	go func() {
		log.Printf("Discovering installed applications...")
		apps, err := appService.RefreshApps()
		if err != nil {
			log.Printf("Warning: Failed to discover apps: %v", err)
		} else {
			log.Printf("Discovered %d installed applications", len(apps))
		}
	}()

	// Create router
	router := api.NewRouter(api.RouterConfig{
		Store:          store,
		MetricsService: metricsService,
		AppService:     appService,
		WeatherService: weatherService,
		StaticDir:      *staticDir,
		AllowedOrigins: nil, // Use defaults
	})

	// Create HTTP server
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", *port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Server listening on http://localhost:%d", *port)
		log.Printf("API endpoints:")
		log.Printf("  GET  /api/buttons       - List all buttons")
		log.Printf("  POST /api/buttons       - Create/update button")
		log.Printf("  POST /api/buttons/reorder - Reorder buttons")
		log.Printf("  DELETE /api/buttons/:id - Delete button")
		log.Printf("  POST /api/action/:id    - Execute button action")
		log.Printf("  GET  /api/scripts       - List all scripts")
		log.Printf("  POST /api/scripts       - Create script")
		log.Printf("  DELETE /api/scripts/:id - Delete script")
		log.Printf("  GET  /api/widgets       - List all widgets")
		log.Printf("  POST /api/widgets       - Create/update widget")
		log.Printf("  GET  /api/apps          - List installed apps")
		log.Printf("  GET  /api/apps/search   - Search apps")
		log.Printf("  GET  /api/system/metrics - Get system metrics")
		log.Printf("  GET  /api/system/weather - Get weather data (cached)")
		log.Printf("  WS   /ws/system         - WebSocket for real-time metrics")
		log.Printf("  GET  /health            - Health check")

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Printf("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Printf("Server stopped")
}
