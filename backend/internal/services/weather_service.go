package services

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// LocationSource represents how the location was obtained
type LocationSource string

const (
	LocationSourceManual  LocationSource = "manual"  // User set manually via map
	LocationSourceBrowser LocationSource = "browser" // Browser geolocation
	LocationSourceIP      LocationSource = "ip"      // IP-based geolocation (fallback)
)

// SavedLocation represents a user-saved location
type SavedLocation struct {
	Latitude  float64        `json:"latitude"`
	Longitude float64        `json:"longitude"`
	City      string         `json:"city"`
	Source    LocationSource `json:"source"`
	UpdatedAt int64          `json:"updated_at"`
}

// WeatherData represents the weather information
type WeatherData struct {
	Temperature    float64        `json:"temperature"`
	WeatherCode    int            `json:"weather_code"`
	Humidity       int            `json:"humidity"`
	Location       string         `json:"location"`
	Latitude       float64        `json:"latitude"`
	Longitude      float64        `json:"longitude"`
	LastUpdated    int64          `json:"last_updated"`
	Description    string         `json:"description"`
	LocationSource LocationSource `json:"location_source"`
}

// WeatherService handles weather data fetching and caching
type WeatherService struct {
	mu              sync.RWMutex
	cachedWeather   *WeatherData
	lastFetch       time.Time
	cacheDuration   time.Duration
	httpClient      *http.Client
	configDir       string
	savedLocation   *SavedLocation
	locationMu      sync.RWMutex
	locationRefresh *time.Ticker
}

// NewWeatherService creates a new WeatherService
func NewWeatherService(configDir string) *WeatherService {
	ws := &WeatherService{
		cacheDuration: 1 * time.Hour,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		configDir: configDir,
	}

	// Load saved location from disk
	ws.loadSavedLocation()

	// Start background refresh
	go ws.backgroundRefresh()

	// Start hourly location refresh for browser-sourced locations
	go ws.startLocationRefresh()

	return ws
}

// GetWeather returns the current weather data
func (ws *WeatherService) GetWeather() (*WeatherData, error) {
	ws.mu.RLock()
	if ws.cachedWeather != nil && time.Since(ws.lastFetch) < ws.cacheDuration {
		weather := ws.cachedWeather
		ws.mu.RUnlock()
		return weather, nil
	}
	ws.mu.RUnlock()

	// Fetch new weather data
	return ws.fetchAndCacheWeather()
}

// GetSavedLocation returns the currently saved location
func (ws *WeatherService) GetSavedLocation() *SavedLocation {
	ws.locationMu.RLock()
	defer ws.locationMu.RUnlock()
	return ws.savedLocation
}

// SetLocation saves a new location
func (ws *WeatherService) SetLocation(lat, lng float64, city string, source LocationSource) error {
	ws.locationMu.Lock()
	ws.savedLocation = &SavedLocation{
		Latitude:  lat,
		Longitude: lng,
		City:      city,
		Source:    source,
		UpdatedAt: time.Now().Unix(),
	}
	ws.locationMu.Unlock()

	// Save to disk
	if err := ws.saveSavedLocation(); err != nil {
		return err
	}

	// Clear weather cache to fetch with new location
	ws.mu.Lock()
	ws.cachedWeather = nil
	ws.mu.Unlock()

	// Fetch new weather immediately
	go ws.fetchAndCacheWeather()

	return nil
}

// ClearLocation removes the saved location (reverts to IP-based)
func (ws *WeatherService) ClearLocation() error {
	ws.locationMu.Lock()
	ws.savedLocation = nil
	ws.locationMu.Unlock()

	// Remove the file
	locationFile := filepath.Join(ws.configDir, "location.json")
	os.Remove(locationFile)

	// Clear weather cache
	ws.mu.Lock()
	ws.cachedWeather = nil
	ws.mu.Unlock()

	// Fetch new weather immediately
	go ws.fetchAndCacheWeather()

	return nil
}

// loadSavedLocation loads the saved location from disk
func (ws *WeatherService) loadSavedLocation() {
	locationFile := filepath.Join(ws.configDir, "location.json")
	file, err := os.Open(locationFile)
	if err != nil {
		return // No saved location
	}
	defer file.Close()

	var location SavedLocation
	if err := json.NewDecoder(file).Decode(&location); err != nil {
		return
	}

	ws.locationMu.Lock()
	ws.savedLocation = &location
	ws.locationMu.Unlock()
}

// saveSavedLocation saves the current location to disk
func (ws *WeatherService) saveSavedLocation() error {
	ws.locationMu.RLock()
	location := ws.savedLocation
	ws.locationMu.RUnlock()

	if location == nil {
		return nil
	}

	locationFile := filepath.Join(ws.configDir, "location.json")
	file, err := os.Create(locationFile)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(location)
}

// startLocationRefresh starts hourly refresh of browser-sourced locations
func (ws *WeatherService) startLocationRefresh() {
	ws.locationRefresh = time.NewTicker(1 * time.Hour)
	defer ws.locationRefresh.Stop()

	for range ws.locationRefresh.C {
		// Browser location refresh is triggered from client-side
		// This ticker is for weather cache refresh
		ws.fetchAndCacheWeather()
	}
}

// fetchAndCacheWeather fetches weather data and caches it
func (ws *WeatherService) fetchAndCacheWeather() (*WeatherData, error) {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	// Double-check cache after acquiring lock
	if ws.cachedWeather != nil && time.Since(ws.lastFetch) < ws.cacheDuration {
		return ws.cachedWeather, nil
	}

	// Get location based on priority: saved > IP-based
	location, source, err := ws.getLocation()
	if err != nil {
		// Return cached data if available, even if stale
		if ws.cachedWeather != nil {
			return ws.cachedWeather, nil
		}
		return nil, fmt.Errorf("failed to get location: %w", err)
	}

	// Fetch weather
	weather, err := ws.fetchWeather(location, source)
	if err != nil {
		// Return cached data if available, even if stale
		if ws.cachedWeather != nil {
			return ws.cachedWeather, nil
		}
		return nil, fmt.Errorf("failed to fetch weather: %w", err)
	}

	ws.cachedWeather = weather
	ws.lastFetch = time.Now()

	return weather, nil
}

// getLocation returns the best available location based on priority
func (ws *WeatherService) getLocation() (*IPLocation, LocationSource, error) {
	// Check for saved location first (manual or browser)
	ws.locationMu.RLock()
	saved := ws.savedLocation
	ws.locationMu.RUnlock()

	if saved != nil {
		return &IPLocation{
			Latitude:  saved.Latitude,
			Longitude: saved.Longitude,
			City:      saved.City,
		}, saved.Source, nil
	}

	// Fallback to IP-based location
	location, err := ws.getLocationFromIP()
	if err != nil {
		return nil, LocationSourceIP, err
	}

	return location, LocationSourceIP, nil
}

// IPLocation represents the location data from IP geolocation
type IPLocation struct {
	Latitude  float64 `json:"lat"`
	Longitude float64 `json:"lon"`
	City      string  `json:"city"`
	Status    string  `json:"status"`
}

// IPAPILocation represents the fallback location data
type IPAPILocation struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	City      string  `json:"city"`
}

// getLocationFromIP gets location using IP-based geolocation
func (ws *WeatherService) getLocationFromIP() (*IPLocation, error) {
	// Try ip-api.com first
	resp, err := ws.httpClient.Get("http://ip-api.com/json/?fields=lat,lon,city,status")
	if err == nil {
		defer resp.Body.Close()

		var location IPLocation
		if err := json.NewDecoder(resp.Body).Decode(&location); err == nil {
			if location.Status == "success" {
				return &location, nil
			}
		}
	}

	// Fallback to ipapi.co
	resp, err = ws.httpClient.Get("https://ipapi.co/json/")
	if err != nil {
		return nil, fmt.Errorf("failed to get IP location: %w", err)
	}
	defer resp.Body.Close()

	var fallbackLocation IPAPILocation
	if err := json.NewDecoder(resp.Body).Decode(&fallbackLocation); err != nil {
		return nil, fmt.Errorf("failed to parse IP location: %w", err)
	}

	return &IPLocation{
		Latitude:  fallbackLocation.Latitude,
		Longitude: fallbackLocation.Longitude,
		City:      fallbackLocation.City,
	}, nil
}

// OpenMeteoResponse represents the response from Open-Meteo API
type OpenMeteoResponse struct {
	Current struct {
		Temperature2m      float64 `json:"temperature_2m"`
		RelativeHumidity2m int     `json:"relative_humidity_2m"`
		WeatherCode        int     `json:"weather_code"`
	} `json:"current"`
}

// fetchWeather fetches weather from Open-Meteo API
func (ws *WeatherService) fetchWeather(location *IPLocation, source LocationSource) (*WeatherData, error) {
	url := fmt.Sprintf(
		"https://api.open-meteo.com/v1/forecast?latitude=%f&longitude=%f&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto",
		location.Latitude,
		location.Longitude,
	)

	resp, err := ws.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch weather: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("weather API returned status: %d", resp.StatusCode)
	}

	var openMeteoResp OpenMeteoResponse
	if err := json.NewDecoder(resp.Body).Decode(&openMeteoResp); err != nil {
		return nil, fmt.Errorf("failed to parse weather response: %w", err)
	}

	cityName := location.City
	if cityName == "" {
		cityName = "Your Location"
	}

	return &WeatherData{
		Temperature:    openMeteoResp.Current.Temperature2m,
		WeatherCode:    openMeteoResp.Current.WeatherCode,
		Humidity:       openMeteoResp.Current.RelativeHumidity2m,
		Location:       cityName,
		Latitude:       location.Latitude,
		Longitude:      location.Longitude,
		LastUpdated:    time.Now().Unix(),
		Description:    getWeatherDescription(openMeteoResp.Current.WeatherCode),
		LocationSource: source,
	}, nil
}

// backgroundRefresh refreshes weather data periodically
func (ws *WeatherService) backgroundRefresh() {
	// Initial fetch
	ws.fetchAndCacheWeather()

	// Refresh every hour
	ticker := time.NewTicker(ws.cacheDuration)
	defer ticker.Stop()

	for range ticker.C {
		ws.fetchAndCacheWeather()
	}
}

// getWeatherDescription returns a human-readable description for weather code
func getWeatherDescription(code int) string {
	switch {
	case code == 0:
		return "Clear sky"
	case code <= 3:
		return "Partly cloudy"
	case code <= 49:
		return "Foggy"
	case code <= 59:
		return "Drizzle"
	case code <= 69:
		return "Rain"
	case code <= 79:
		return "Snow"
	case code <= 99:
		return "Thunderstorm"
	default:
		return "Unknown"
	}
}
