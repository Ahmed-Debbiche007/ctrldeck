package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"streamdeck-server/internal/models"
)

// Store manages configuration persistence
type Store struct {
	configDir string
	mu        sync.RWMutex
}

// NewStore creates a new configuration store
func NewStore(configDir string) (*Store, error) {
	// Ensure config directory exists
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, err
	}

	store := &Store{
		configDir: configDir,
	}

	// Initialize default config files if they don't exist
	if err := store.initDefaults(); err != nil {
		return nil, err
	}

	return store, nil
}

// initDefaults creates default configuration files if they don't exist
func (s *Store) initDefaults() error {
	// Default buttons
	buttonsFile := filepath.Join(s.configDir, "buttons.json")
	if _, err := os.Stat(buttonsFile); os.IsNotExist(err) {
		defaultButtons := []models.Button{
			{
				ID:         "btn-1",
				Name:       "Mute Mic",
				Icon:       "mic-off",
				ActionType: "mute_mic",
				ActionData: map[string]string{},
				Position:   0,
				Color:      "#ef4444",
			},
			{
				ID:         "btn-2",
				Name:       "Volume Up",
				Icon:       "volume-2",
				ActionType: "volume_up",
				ActionData: map[string]string{"step": "5"},
				Position:   1,
				Color:      "#3b82f6",
			},
			{
				ID:         "btn-3",
				Name:       "Volume Down",
				Icon:       "volume-1",
				ActionType: "volume_down",
				ActionData: map[string]string{"step": "5"},
				Position:   2,
				Color:      "#3b82f6",
			},
		}
		if err := s.saveJSON(buttonsFile, defaultButtons); err != nil {
			return err
		}
	}

	// Default scripts
	scriptsFile := filepath.Join(s.configDir, "scripts.json")
	if _, err := os.Stat(scriptsFile); os.IsNotExist(err) {
		defaultScripts := []models.Script{}
		if err := s.saveJSON(scriptsFile, defaultScripts); err != nil {
			return err
		}
	}

	// Default widgets
	widgetsFile := filepath.Join(s.configDir, "widgets.json")
	if _, err := os.Stat(widgetsFile); os.IsNotExist(err) {
		defaultWidgets := []models.Widget{
			{
				ID:       "widget-cpu",
				Type:     "cpu",
				Position: 0,
				Enabled:  true,
			},
			{
				ID:       "widget-ram",
				Type:     "ram",
				Position: 1,
				Enabled:  true,
			},
			{
				ID:       "widget-battery",
				Type:     "battery",
				Position: 2,
				Enabled:  true,
			},
		}
		if err := s.saveJSON(widgetsFile, defaultWidgets); err != nil {
			return err
		}
	}

	return nil
}

// saveJSON saves data to a JSON file
func (s *Store) saveJSON(filename string, data interface{}) error {
	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(data)
}

// loadJSON loads data from a JSON file
func (s *Store) loadJSON(filename string, data interface{}) error {
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	return json.NewDecoder(file).Decode(data)
}

// GetButtons returns all buttons
func (s *Store) GetButtons() ([]models.Button, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var buttons []models.Button
	err := s.loadJSON(filepath.Join(s.configDir, "buttons.json"), &buttons)
	return buttons, err
}

// SaveButtons saves all buttons
func (s *Store) SaveButtons(buttons []models.Button) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.saveJSON(filepath.Join(s.configDir, "buttons.json"), buttons)
}

// GetButton returns a button by ID
func (s *Store) GetButton(id string) (*models.Button, error) {
	buttons, err := s.GetButtons()
	if err != nil {
		return nil, err
	}

	for _, btn := range buttons {
		if btn.ID == id {
			return &btn, nil
		}
	}
	return nil, nil
}

// AddButton adds a new button
func (s *Store) AddButton(button models.Button) error {
	buttons, err := s.GetButtons()
	if err != nil {
		return err
	}

	buttons = append(buttons, button)
	return s.SaveButtons(buttons)
}

// UpdateButton updates an existing button
func (s *Store) UpdateButton(button models.Button) error {
	buttons, err := s.GetButtons()
	if err != nil {
		return err
	}

	for i, btn := range buttons {
		if btn.ID == button.ID {
			buttons[i] = button
			return s.SaveButtons(buttons)
		}
	}
	return nil
}

// DeleteButton deletes a button by ID
func (s *Store) DeleteButton(id string) error {
	buttons, err := s.GetButtons()
	if err != nil {
		return err
	}

	var filtered []models.Button
	for _, btn := range buttons {
		if btn.ID != id {
			filtered = append(filtered, btn)
		}
	}

	return s.SaveButtons(filtered)
}

// ReorderButtons reorders buttons based on the provided IDs
func (s *Store) ReorderButtons(ids []string) error {
	buttons, err := s.GetButtons()
	if err != nil {
		return err
	}

	// Create a map for quick lookup
	buttonMap := make(map[string]models.Button)
	for _, btn := range buttons {
		buttonMap[btn.ID] = btn
	}

	// Reorder based on provided IDs
	var reordered []models.Button
	for i, id := range ids {
		if btn, ok := buttonMap[id]; ok {
			btn.Position = i
			reordered = append(reordered, btn)
		}
	}

	return s.SaveButtons(reordered)
}

// GetScripts returns all scripts
func (s *Store) GetScripts() ([]models.Script, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var scripts []models.Script
	err := s.loadJSON(filepath.Join(s.configDir, "scripts.json"), &scripts)
	return scripts, err
}

// SaveScripts saves all scripts
func (s *Store) SaveScripts(scripts []models.Script) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.saveJSON(filepath.Join(s.configDir, "scripts.json"), scripts)
}

// GetScript returns a script by ID
func (s *Store) GetScript(id string) (*models.Script, error) {
	scripts, err := s.GetScripts()
	if err != nil {
		return nil, err
	}

	for _, script := range scripts {
		if script.ID == id {
			return &script, nil
		}
	}
	return nil, nil
}

// AddScript adds a new script
func (s *Store) AddScript(script models.Script) error {
	scripts, err := s.GetScripts()
	if err != nil {
		return err
	}

	scripts = append(scripts, script)
	return s.SaveScripts(scripts)
}

// DeleteScript deletes a script by ID
func (s *Store) DeleteScript(id string) error {
	scripts, err := s.GetScripts()
	if err != nil {
		return err
	}

	var filtered []models.Script
	for _, script := range scripts {
		if script.ID != id {
			filtered = append(filtered, script)
		}
	}

	return s.SaveScripts(filtered)
}

// GetWidgets returns all widgets
func (s *Store) GetWidgets() ([]models.Widget, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var widgets []models.Widget
	err := s.loadJSON(filepath.Join(s.configDir, "widgets.json"), &widgets)
	return widgets, err
}

// SaveWidgets saves all widgets
func (s *Store) SaveWidgets(widgets []models.Widget) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.saveJSON(filepath.Join(s.configDir, "widgets.json"), widgets)
}

// AddWidget adds a new widget
func (s *Store) AddWidget(widget models.Widget) error {
	widgets, err := s.GetWidgets()
	if err != nil {
		return err
	}

	widgets = append(widgets, widget)
	return s.SaveWidgets(widgets)
}

// UpdateWidget updates an existing widget
func (s *Store) UpdateWidget(widget models.Widget) error {
	widgets, err := s.GetWidgets()
	if err != nil {
		return err
	}

	for i, w := range widgets {
		if w.ID == widget.ID {
			widgets[i] = widget
			return s.SaveWidgets(widgets)
		}
	}

	// If widget not found, add it
	widgets = append(widgets, widget)
	return s.SaveWidgets(widgets)
}
