# Stream Deck Server - Usage Guide

A Go-based backend for a custom Stream Deck system that runs on your PC. It provides REST APIs for button management, script execution, app launching, and WebSocket streaming for real-time system metrics.

## Quick Start

### Running the Server

```bash
# Navigate to the backend directory
cd backend

# Run directly with Go
go run ./cmd/server/

# Or use the compiled binary
./streamdeck-server
```

The server will start on `http://localhost:8080` by default.

### Building from Source

```bash
cd backend
go mod tidy
go build -o streamdeck-server ./cmd/server/
```

## Command Line Options

| Flag | Default | Description |
|------|---------|-------------|
| `-port` | `8080` | Server port |
| `-config` | `~/.streamdeck` | Configuration directory |
| `-static` | (empty) | Static files directory for serving frontend |

### Examples

```bash
# Run on a different port
./streamdeck-server -port 3001

# Use custom config directory
./streamdeck-server -config /path/to/config

# Serve React frontend build
./streamdeck-server -static ./dist
```

## Configuration

Configuration files are stored in `~/.streamdeck/` by default:

- `buttons.json` - Button configurations
- `scripts.json` - Custom script definitions
- `widgets.json` - Widget configurations

Default buttons are created on first run.

---

## API Reference

### Health Check

```bash
GET /health
```

Response:
```json
{"status": "ok"}
```

---

### Buttons API

#### Get All Buttons

```bash
GET /api/buttons
```

Response:
```json
[
  {
    "id": "btn-1",
    "name": "Mute Mic",
    "icon": "mic-off",
    "action_type": "mute_mic",
    "action_data": {},
    "position": 0,
    "color": "#ef4444"
  }
]
```

#### Create/Update Button

```bash
POST /api/buttons
Content-Type: application/json

{
  "name": "Volume Up",
  "icon": "volume-2",
  "action_type": "volume_up",
  "action_data": {"step": "10"},
  "position": 1,
  "color": "#3b82f6"
}
```

#### Delete Button

```bash
DELETE /api/buttons/{id}
```

#### Reorder Buttons

```bash
POST /api/buttons/reorder
Content-Type: application/json

{
  "button_ids": ["btn-2", "btn-1", "btn-3"]
}
```

---

### Execute Action

Trigger a button's action:

```bash
POST /api/action/{buttonId}
```

Response:
```json
{
  "success": true,
  "message": "Microphone muted"
}
```

---

### Scripts API

#### Get All Scripts

```bash
GET /api/scripts
```

#### Create Script

```bash
POST /api/scripts
Content-Type: application/json

{
  "name": "My Script",
  "path": "/home/user/scripts/my-script.sh",
  "description": "Does something useful"
}
```

#### Get Single Script

```bash
GET /api/scripts/{id}
```

#### Delete Script

```bash
DELETE /api/scripts/{id}
```

---

### Widgets API

#### Get All Widgets

```bash
GET /api/widgets
```

Response:
```json
[
  {
    "id": "widget-cpu",
    "type": "cpu",
    "position": 0,
    "enabled": true
  },
  {
    "id": "widget-ram",
    "type": "ram",
    "position": 1,
    "enabled": true
  }
]
```

#### Create/Update Widget

```bash
POST /api/widgets
Content-Type: application/json

{
  "type": "battery",
  "position": 2,
  "enabled": true
}
```

#### Update All Widgets

```bash
PUT /api/widgets
Content-Type: application/json

[
  {"id": "widget-cpu", "type": "cpu", "position": 0, "enabled": true},
  {"id": "widget-ram", "type": "ram", "position": 1, "enabled": false}
]
```

---

### Installed Apps API

#### Get All Installed Apps

```bash
GET /api/apps
```

Response:
```json
[
  {
    "name": "Firefox",
    "path": "firefox",
    "icon": "firefox",
    "category": "Network"
  },
  {
    "name": "Visual Studio Code",
    "path": "code",
    "icon": "visual-studio-code",
    "category": "Development"
  }
]
```

#### Search Apps

```bash
GET /api/apps/search?q=firefox
```

#### Refresh App List

```bash
POST /api/apps/refresh
```

---

### System Metrics (HTTP)

Get current system metrics via REST:

```bash
GET /api/system/metrics
```

Response:
```json
{
  "cpu_usage": 25.5,
  "ram_usage": 68.2,
  "ram_total": 16777216000,
  "ram_used": 11453251584,
  "battery_level": 85,
  "is_charging": false,
  "cpu_temp": 55.0,
  "mic_muted": false,
  "volume_level": 75,
  "network_upload": 1024.5,
  "network_download": 5120.8,
  "timestamp": 1700000000
}
```

---

## WebSocket API

### Real-time System Metrics

Connect to receive system metrics every second:

```
ws://localhost:8080/ws/system
```

#### Message Format

The server sends metrics in this format:

```json
{
  "type": "metrics",
  "data": {
    "cpu_usage": 25.5,
    "ram_usage": 68.2,
    "ram_total": 16777216000,
    "ram_used": 11453251584,
    "battery_level": 85,
    "is_charging": false,
    "cpu_temp": 55.0,
    "mic_muted": false,
    "volume_level": 75,
    "network_upload": 1024.5,
    "network_download": 5120.8,
    "timestamp": 1700000000
  }
}
```

#### Client Commands

Send commands to the server:

```json
// Ping
{"type": "ping"}

// Response
{"type": "pong"}

// Request current metrics
{"type": "get_metrics"}
```

#### JavaScript Example

```javascript
const ws = new WebSocket('ws://localhost:8080/ws/system');

ws.onopen = () => {
  console.log('Connected to Stream Deck server');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'metrics') {
    console.log('CPU:', message.data.cpu_usage + '%');
    console.log('RAM:', message.data.ram_usage + '%');
    console.log('Volume:', message.data.volume_level + '%');
  }
};

ws.onclose = () => {
  console.log('Disconnected');
};
```

---

## Action Types

### Available Actions

| Action Type | Description | Action Data |
|-------------|-------------|-------------|
| `mute_mic` | Toggle microphone mute | - |
| `volume_up` | Increase volume | `{"step": "5"}` |
| `volume_down` | Decrease volume | `{"step": "5"}` |
| `set_volume` | Set volume level | `{"level": "50"}` |
| `volume_mute` | Toggle volume mute | - |
| `launch_app` | Launch application | `{"app_path": "/usr/bin/firefox"}` |
| `run_script` | Run a saved script | `{"script_id": "script-abc123"}` |
| `open_url` | Open URL in browser | `{"url": "https://example.com"}` |

### Button Configuration Examples

#### Mute Microphone
```json
{
  "name": "Mute Mic",
  "icon": "mic-off",
  "action_type": "mute_mic",
  "action_data": {},
  "color": "#ef4444"
}
```

#### Volume Control
```json
{
  "name": "Volume Up",
  "icon": "volume-2",
  "action_type": "volume_up",
  "action_data": {"step": "10"},
  "color": "#3b82f6"
}
```

#### Launch Application
```json
{
  "name": "Firefox",
  "icon": "globe",
  "action_type": "launch_app",
  "action_data": {"app_path": "firefox"},
  "color": "#f97316"
}
```

#### Run Script
```json
{
  "name": "Backup",
  "icon": "hard-drive",
  "action_type": "run_script",
  "action_data": {"script_id": "script-backup"},
  "color": "#10b981"
}
```

#### Open URL
```json
{
  "name": "GitHub",
  "icon": "github",
  "action_type": "open_url",
  "action_data": {"url": "https://github.com"},
  "color": "#6366f1"
}
```

---

## Example curl Commands

### Start the server and test with curl

```bash
# Health check
curl http://localhost:8080/health

# Get all buttons
curl http://localhost:8080/api/buttons

# Create a new button
curl -X POST http://localhost:8080/api/buttons \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Launch Chrome",
    "icon": "chrome",
    "action_type": "launch_app",
    "action_data": {"app_path": "google-chrome"},
    "position": 5,
    "color": "#4285f4"
  }'

# Execute button action
curl -X POST http://localhost:8080/api/action/btn-1

# Get installed apps
curl http://localhost:8080/api/apps

# Search for apps
curl "http://localhost:8080/api/apps/search?q=code"

# Get system metrics
curl http://localhost:8080/api/system/metrics

# Create a script
curl -X POST http://localhost:8080/api/scripts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Clean Temp",
    "path": "/home/user/scripts/clean-temp.sh",
    "description": "Cleans temporary files"
  }'

# Get all widgets
curl http://localhost:8080/api/widgets
```

---

## Linux Requirements

For full functionality on Linux, ensure these tools are available:

- **PulseAudio** (`pactl`) - For volume and mic control
- **xdg-open** - For opening URLs and files
- **gtk-launch** - For launching applications

Install on Ubuntu/Debian:
```bash
sudo apt install pulseaudio-utils xdg-utils
```

---

## Troubleshooting

### Volume/Mic controls not working

Ensure PulseAudio is running:
```bash
pulseaudio --check
pactl info
```

### Apps not discovered

The server scans these locations:
- `/usr/share/applications`
- `/usr/local/share/applications`
- `~/.local/share/applications`
- Snap and Flatpak application directories

Refresh the app list:
```bash
curl -X POST http://localhost:8080/api/apps/refresh
```

### WebSocket connection issues

- Ensure CORS is not blocking (server allows all origins by default)
- Check if the port is accessible
- Verify WebSocket URL format: `ws://` not `http://`

---

## Architecture

```
backend/
├── cmd/server/main.go          # Entry point
├── internal/
│   ├── api/
│   │   ├── router.go           # Route definitions
│   │   └── handlers/           # HTTP handlers
│   ├── config/
│   │   └── config.go           # JSON storage
│   ├── core/actions/           # Action implementations
│   │   ├── mic.go              # Microphone control
│   │   ├── volume.go           # Volume control
│   │   ├── apps.go             # App launcher
│   │   └── exec_scripts.go     # Script executor
│   ├── models/
│   │   └── models.go           # Data structures
│   └── services/
│       ├── system_metrics.go   # Metrics collection
│       └── app_discovery.go    # App scanning
└── go.mod
```

---

## License

MIT
