import type { Button, Widget, Script, InstalledApp, SystemMetrics } from './types';

// Declare the window properties that Electron injects
declare global {
  interface Window {
    __BACKEND_URL__?: string;
    __BACKEND_PORT__?: number;
    electronAPI?: {
      getBackendUrl: () => string;
      getBackendPort: () => number;
      platform: string;
      getVersion: () => string;
      // Window controls
      windowMinimize: () => void;
      windowMaximize: () => void;
      windowClose: () => void;
      windowIsMaximized: () => Promise<boolean>;
    };
  }
}

// Get backend URL - prioritize Electron injected URL, then env vars, then defaults
function getApiBase(): string {
  if (typeof window !== 'undefined' && window.__BACKEND_URL__) {
    return window.__BACKEND_URL__;
  }
  return import.meta.env.VITE_API_BASE || 'http://localhost:8080';
}

function getWsBase(): string {
  if (typeof window !== 'undefined' && window.__BACKEND_PORT__) {
    return `ws://127.0.0.1:${window.__BACKEND_PORT__}`;
  }
  return import.meta.env.VITE_WS_BASE || 'ws://localhost:8080';
}

// Use dynamic getters for the base URLs
const API_BASE = getApiBase();
const WS_BASE = getWsBase();

// Button APIs
export async function getButtons(): Promise<Button[]> {
  const res = await fetch(`${API_BASE}/api/buttons`);
  return res.json();
}

export async function createButton(button: Omit<Button, 'id'>): Promise<Button> {
  const res = await fetch(`${API_BASE}/api/buttons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(button),
  });
  return res.json();
}

export async function updateButton(button: Button): Promise<Button> {
  const res = await fetch(`${API_BASE}/api/buttons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(button),
  });
  return res.json();
}

export async function deleteButton(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/buttons/${id}`, { method: 'DELETE' });
}

export async function executeAction(buttonId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/action/${buttonId}`, { method: 'POST' });
  return res.json();
}

export async function reorderButtons(buttonIds: string[]): Promise<void> {
  await fetch(`${API_BASE}/api/buttons/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ button_ids: buttonIds }),
  });
}

// Widget APIs
export async function getWidgets(): Promise<Widget[]> {
  const res = await fetch(`${API_BASE}/api/widgets`);
  return res.json();
}

export async function createWidget(widget: Omit<Widget, 'id'>): Promise<Widget> {
  const res = await fetch(`${API_BASE}/api/widgets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(widget),
  });
  return res.json();
}

export async function updateWidgets(widgets: Widget[]): Promise<void> {
  await fetch(`${API_BASE}/api/widgets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(widgets),
  });
}

// Script APIs
export async function getScripts(): Promise<Script[]> {
  const res = await fetch(`${API_BASE}/api/scripts`);
  return res.json();
}

export async function createScript(script: Omit<Script, 'id'>): Promise<Script> {
  const res = await fetch(`${API_BASE}/api/scripts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(script),
  });
  return res.json();
}

export async function deleteScript(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/scripts/${id}`, { method: 'DELETE' });
}

// App APIs
export async function getApps(): Promise<InstalledApp[]> {
  const res = await fetch(`${API_BASE}/api/apps`);
  return res.json();
}

export async function searchApps(query: string): Promise<InstalledApp[]> {
  const res = await fetch(`${API_BASE}/api/apps/search?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function refreshApps(): Promise<void> {
  await fetch(`${API_BASE}/api/apps/refresh`, { method: 'POST' });
}

// System Metrics (HTTP)
export async function getSystemMetrics(): Promise<SystemMetrics> {
  const res = await fetch(`${API_BASE}/api/system/metrics`);
  return res.json();
}

// Weather Data
export interface WeatherData {
  temperature: number;
  weather_code: number;
  humidity: number;
  location: string;
  latitude: number;
  longitude: number;
  last_updated: number;
  description: string;
  location_source: 'manual' | 'browser' | 'ip';
}

export async function getWeatherData(): Promise<WeatherData> {
  const res = await fetch(`${API_BASE}/api/system/weather`);
  return res.json();
}

// Location Settings
export interface LocationSettings {
  latitude?: number;
  longitude?: number;
  city?: string;
  source: 'manual' | 'browser' | 'ip';
  updated_at?: number;
  message?: string;
}

export async function getLocationSettings(): Promise<LocationSettings> {
  const res = await fetch(`${API_BASE}/api/settings/location`);
  return res.json();
}

export async function setLocation(
  latitude: number,
  longitude: number,
  city: string,
  source: 'manual' | 'browser'
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/settings/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude, longitude, city, source }),
  });
  return res.json();
}

export async function clearLocation(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/settings/location`, {
    method: 'DELETE',
  });
  return res.json();
}

// Browser Geolocation Helper
export function requestBrowserLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Location permission denied'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Location information unavailable'));
            break;
          case error.TIMEOUT:
            reject(new Error('Location request timed out'));
            break;
          default:
            reject(new Error('Unknown location error'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

// Reverse geocoding to get city name from coordinates
export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
      {
        headers: {
          'User-Agent': 'CtrlDeck-App',
        },
      }
    );
    const data = await res.json();
    return data.address?.city || data.address?.town || data.address?.village || data.address?.county || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

// Volume Control
export async function setVolume(level: number): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/system/volume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }),
  });
  return res.json();
}

// Brightness Control
export async function setBrightness(level: number): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/system/brightness`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }),
  });
  return res.json();
}

// Media Control
export async function mediaControl(action: 'play_pause' | 'next' | 'prev'): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/system/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
  return res.json();
}

// Server Info (IP addresses)
export interface ServerInfo {
  ip_addresses: string[];
  port: string;
  hostname?: string;
}

export async function getServerInfo(): Promise<ServerInfo> {
  const res = await fetch(`${API_BASE}/api/system/info`);
  return res.json();
}

// WebSocket Connection
export function connectWebSocket(
  onMetrics: (metrics: SystemMetrics) => void,
  onError?: (error: Event) => void
): WebSocket {
  const ws = new WebSocket(`${WS_BASE}/ws/system`);

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'metrics' && message.data) {
        onMetrics(message.data);
      }
    } catch (e) {
      console.error('Failed to parse WebSocket message:', e);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    onError?.(error);
  };

  return ws;
}
