<p align="center">
  <img src="https://img.icons8.com/fluency/96/000000/stream-deck.png" alt="StreamDeck Logo" width="96" height="96">
</p>

<h1 align="center">🎛️ StreamDeck</h1>

<p align="center">
  <strong>A powerful, open-source custom Stream Deck system for Linux</strong>
</p>

<p align="center">
  Transform any device into a customizable macro pad with real-time system monitoring
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#api">API</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.21+-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go Version">
  <img src="https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React Version">
  <img src="https://img.shields.io/badge/Tauri-2.0-FFC131?style=for-the-badge&logo=tauri&logoColor=black" alt="Tauri Version">
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript Version">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Linux-FCC624?style=flat-square&logo=linux&logoColor=black" alt="Platform">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
</p>

---

## ✨ Features

<table>
  <tr>
    <td width="50%">
      <h3>🎮 Customizable Buttons</h3>
      <ul>
        <li>Create unlimited custom buttons</li>
        <li>Drag-and-drop reordering</li>
        <li>Custom icons and colors</li>
        <li>Multiple action types</li>
      </ul>
    </td>
    <td width="50%">
      <h3>📊 Real-time Metrics</h3>
      <ul>
        <li>CPU & RAM usage monitoring</li>
        <li>Network upload/download speeds</li>
        <li>Battery level & charging status</li>
        <li>CPU temperature tracking</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🔊 Audio Control</h3>
      <ul>
        <li>Volume up/down/mute</li>
        <li>Microphone mute toggle</li>
        <li>Visual volume indicator</li>
        <li>PulseAudio integration</li>
      </ul>
    </td>
    <td width="50%">
      <h3>🚀 App Launcher</h3>
      <ul>
        <li>Auto-discover installed apps</li>
        <li>Launch any application</li>
        <li>Open URLs in browser</li>
        <li>Run custom scripts</li>
      </ul>
    </td>
  </tr>
</table>

### 🎯 Supported Actions

| Action | Description |
|--------|-------------|
| 🎤 **Mute Mic** | Toggle microphone mute/unmute |
| 🔊 **Volume Control** | Increase, decrease, or set volume |
| 🔇 **Volume Mute** | Toggle system volume mute |
| 🖥️ **Launch App** | Start any installed application |
| 📜 **Run Script** | Execute custom shell scripts |
| 🌐 **Open URL** | Open links in default browser |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        StreamDeck System                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     WebSocket/REST      ┌──────────────────┐  │
│  │              │◄──────────────────────►│                  │  │
│  │   Frontend   │                         │     Backend      │  │
│  │   (Tauri)    │     Real-time Metrics   │      (Go)        │  │
│  │              │◄────────────────────────│                  │  │
│  └──────────────┘                         └──────────────────┘  │
│        │                                          │             │
│        │                                          │             │
│        ▼                                          ▼             │
│  ┌──────────────┐                         ┌──────────────────┐  │
│  │    React     │                         │  System Actions  │  │
│  │      +       │                         │  • PulseAudio    │  │
│  │  TypeScript  │                         │  • DBus          │  │
│  └──────────────┘                         │  • Shell         │  │
│                                           └──────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
streamdeck/
├── 📁 backend/                 # Go REST API Server
│   ├── cmd/server/            # Entry point
│   ├── internal/
│   │   ├── api/               # HTTP handlers & routes
│   │   ├── config/            # Configuration management
│   │   ├── core/actions/      # Action implementations
│   │   ├── models/            # Data structures
│   │   └── services/          # System metrics & app discovery
│   └── go.mod
│
├── 📁 frontend/               # Desktop Client (Tauri + React)
│   ├── src/                   # React application
│   │   ├── components/        # UI components
│   │   └── pages/             # Page views
│   └── src-tauri/             # Tauri configuration
│
└── 📁 streamdeck/             # Mobile/Tablet Client
    ├── src/                   # React application
    └── src-tauri/             # Tauri configuration
```

---

## 📦 Installation

### Prerequisites

- **Go** 1.21 or higher
- **Node.js** 18 or higher
- **Rust** (for Tauri)
- **PulseAudio** (for audio controls)

### Quick Start

#### 1. Clone the Repository

```bash
git clone https://github.com/Ahmed-Debbiche007/streamdeck.git
cd streamdeck
```

#### 2. Start the Backend Server

```bash
cd backend
go mod tidy
go run ./cmd/server/

# Or build and run
go build -o streamdeck-server ./cmd/server/
./streamdeck-server
```

The server will start on `http://localhost:8080`

#### 3. Start the Frontend

```bash
cd frontend
npm install
npm run tauri dev
```

#### 4. (Optional) Start the StreamDeck Client

```bash
cd streamdeck
npm install
npm run tauri dev
```

### 🐧 Linux Dependencies

```bash
# Ubuntu/Debian
sudo apt install pulseaudio-utils xdg-utils libwebkit2gtk-4.1-dev \
  build-essential curl wget file libssl-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev

# Fedora
sudo dnf install pulseaudio-utils xdg-utils webkit2gtk4.1-devel \
  openssl-devel gtk3-devel libappindicator-gtk3-devel librsvg2-devel

# Arch Linux
sudo pacman -S pulseaudio xdg-utils webkit2gtk-4.1 base-devel \
  curl wget file openssl gtk3 libappindicator-gtk3 librsvg
```

---

## 🚀 Usage

### Running the Server

```bash
# Default settings
./streamdeck-server

# Custom port
./streamdeck-server -port 3001

# Custom config directory
./streamdeck-server -config /path/to/config

# Serve frontend static files
./streamdeck-server -static ./dist
```

### Configuration

Configuration files are stored in `~/.streamdeck/`:

| File | Description |
|------|-------------|
| `buttons.json` | Button configurations |
| `scripts.json` | Custom script definitions |
| `widgets.json` | Widget configurations |

---

## 📡 API

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/buttons` | Get all buttons |
| `POST` | `/api/buttons` | Create/update button |
| `DELETE` | `/api/buttons/{id}` | Delete button |
| `POST` | `/api/action/{id}` | Execute button action |
| `GET` | `/api/apps` | Get installed apps |
| `GET` | `/api/system/metrics` | Get system metrics |

### WebSocket

Connect to `ws://localhost:8080/ws/system` for real-time metrics:

```javascript
const ws = new WebSocket('ws://localhost:8080/ws/system');

ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  if (type === 'metrics') {
    console.log(`CPU: ${data.cpu_usage}%`);
    console.log(`RAM: ${data.ram_usage}%`);
  }
};
```

> 📖 For complete API documentation, see [backend/README.md](backend/README.md)

---

## 🛠️ Development

### Backend Development

```bash
cd backend

# Run with hot reload (using air)
air

# Run tests
go test ./...

# Build for production
go build -ldflags="-s -w" -o streamdeck-server ./cmd/server/
```

### Frontend Development

```bash
cd frontend

# Development mode
npm run dev          # Web only
npm run tauri dev    # Desktop app

# Build for production
npm run build
npm run tauri build
```

### Environment Variables

Copy the example environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) - Build smaller, faster, and more secure desktop applications
- [React](https://reactjs.org/) - A JavaScript library for building user interfaces
- [Go](https://golang.org/) - An open source programming language
- [Lucide Icons](https://lucide.dev/) - Beautiful & consistent icons

---

<p align="center">
  Made with ❤️ for the Linux community
</p>

<p align="center">
  <a href="#top">⬆️ Back to Top</a>
</p>
