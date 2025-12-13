import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Button, SystemMetrics, Widget } from '@/types';

const STORAGE_KEY = 'ctrldeck_api_url';
const DEFAULT_API_BASE = 'http://localhost:8080';

// Cache for API base URL
let cachedApiBase: string | null = null;

// Get API base URL from AsyncStorage or default
export async function getApiBase(): Promise<string> {
  if (cachedApiBase !== null) {
    return cachedApiBase;
  }
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    cachedApiBase = stored || DEFAULT_API_BASE;
    return cachedApiBase;
  } catch {
    return DEFAULT_API_BASE;
  }
}

// Get API base URL synchronously (uses cache)
export function getApiBaseSync(): string {
  return cachedApiBase || DEFAULT_API_BASE;
}

// Set API base URL
export async function setApiBase(url: string): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, url);
    cachedApiBase = url;
  } catch (error) {
    console.error('Failed to save API URL:', error);
  }
}

// Check if API is configured (not default)
export async function isConfigured(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored !== null;
  } catch {
    return false;
  }
}

// Clear API configuration
export async function clearConfig(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    cachedApiBase = null;
  } catch (error) {
    console.error('Failed to clear config:', error);
  }
}

// Initialize the cache on app start
export async function initializeApi(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    cachedApiBase = stored || DEFAULT_API_BASE;
  } catch {
    cachedApiBase = DEFAULT_API_BASE;
  }
}

// Get WebSocket base URL from API base
function getWsBase(apiBase: string): string {
  return apiBase.replace(/^http/, 'ws');
}

// Button APIs (read-only)
export async function getButtons(): Promise<Button[]> {
  const apiBase = await getApiBase();
  const res = await fetch(`${apiBase}/api/buttons`);
  return res.json();
}

export async function getWidgets(): Promise<Widget[]> {
  const apiBase = await getApiBase();
  const res = await fetch(`${apiBase}/api/widgets`);
  return res.json();
}

export async function executeAction(buttonId: string): Promise<{ success: boolean; message: string }> {
  const apiBase = await getApiBase();
  const res = await fetch(`${apiBase}/api/action/${buttonId}`, { method: 'POST' });
  return res.json();
}

// System Metrics (HTTP)
export async function getSystemMetrics(): Promise<SystemMetrics> {
  const apiBase = await getApiBase();
  const res = await fetch(`${apiBase}/api/system/metrics`);
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
}

export async function getWeatherData(): Promise<WeatherData> {
  const apiBase = await getApiBase();
  const res = await fetch(`${apiBase}/api/system/weather`);
  return res.json();
}

// Volume Control
export async function setVolume(level: number): Promise<{ success: boolean; message: string }> {
  const apiBase = await getApiBase();
  const res = await fetch(`${apiBase}/api/system/volume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }),
  });
  return res.json();
}

// Brightness Control
export async function setBrightness(level: number): Promise<{ success: boolean; message: string }> {
  const apiBase = await getApiBase();
  const res = await fetch(`${apiBase}/api/system/brightness`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level }),
  });
  return res.json();
}

// WebSocket Connection
export async function connectWebSocket(
  onMetrics: (metrics: SystemMetrics) => void,
  onError?: (error: Event) => void,
  onConfigChange?: (changedType: string) => void
): Promise<WebSocket> {
  const apiBase = await getApiBase();
  const wsBase = getWsBase(apiBase);
  const ws = new WebSocket(`${wsBase}/ws/system`);

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === 'metrics' && message.data) {
        onMetrics(message.data);
      } else if (message.type === 'config_changed' && message.data) {
        onConfigChange?.(message.data.changed);
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

// Test connection to API
export async function testConnection(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const res = await fetch(`${url}/api/buttons`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}
