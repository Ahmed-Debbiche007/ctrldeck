import { Button, Widget, Script, InstalledApp, SystemMetrics } from './types';

const STORAGE_KEY = 'streamdeck_api_url';
const DEFAULT_API_BASE = 'http://localhost:8080';

// Get API base URL from localStorage or default
export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_API_BASE;
  }
  return DEFAULT_API_BASE;
}

// Set API base URL
export function setApiBase(url: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, url);
  }
}

// Check if API is configured (not default)
export function isConfigured(): boolean {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }
  return false;
}

// Clear API configuration
export function clearConfig(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// Get WebSocket base URL from API base
function getWsBase(): string {
  const apiBase = getApiBase();
  return apiBase.replace(/^http/, 'ws');
}

// Button APIs
export async function getButtons(): Promise<Button[]> {
  const res = await fetch(`${getApiBase()}/api/buttons`);
  return res.json();
}

export async function createButton(button: Omit<Button, 'id'>): Promise<Button> {
  const res = await fetch(`${getApiBase()}/api/buttons`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(button),
  });
  return res.json();
}

export async function deleteButton(id: string): Promise<void> {
  await fetch(`${getApiBase()}/api/buttons/${id}`, { method: 'DELETE' });
}

export async function executeAction(buttonId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${getApiBase()}/api/action/${buttonId}`, { method: 'POST' });
  return res.json();
}

export async function reorderButtons(buttonIds: string[]): Promise<void> {
  await fetch(`${getApiBase()}/api/buttons/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ button_ids: buttonIds }),
  });
}

// Widget APIs
export async function getWidgets(): Promise<Widget[]> {
  const res = await fetch(`${getApiBase()}/api/widgets`);
  return res.json();
}

export async function createWidget(widget: Omit<Widget, 'id'>): Promise<Widget> {
  const res = await fetch(`${getApiBase()}/api/widgets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(widget),
  });
  return res.json();
}

export async function updateWidgets(widgets: Widget[]): Promise<void> {
  await fetch(`${getApiBase()}/api/widgets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(widgets),
  });
}

// Script APIs
export async function getScripts(): Promise<Script[]> {
  const res = await fetch(`${getApiBase()}/api/scripts`);
  return res.json();
}

export async function createScript(script: Omit<Script, 'id'>): Promise<Script> {
  const res = await fetch(`${getApiBase()}/api/scripts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(script),
  });
  return res.json();
}

export async function deleteScript(id: string): Promise<void> {
  await fetch(`${getApiBase()}/api/scripts/${id}`, { method: 'DELETE' });
}

// App APIs
export async function getApps(): Promise<InstalledApp[]> {
  const res = await fetch(`${getApiBase()}/api/apps`);
  return res.json();
}

export async function searchApps(query: string): Promise<InstalledApp[]> {
  const res = await fetch(`${getApiBase()}/api/apps/search?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function refreshApps(): Promise<void> {
  await fetch(`${getApiBase()}/api/apps/refresh`, { method: 'POST' });
}

// System Metrics (HTTP)
export async function getSystemMetrics(): Promise<SystemMetrics> {
  const res = await fetch(`${getApiBase()}/api/system/metrics`);
  return res.json();
}

// WebSocket Connection
export function connectWebSocket(
  onMetrics: (metrics: SystemMetrics) => void,
  onError?: (error: Event) => void
): WebSocket {
  const ws = new WebSocket(`${getWsBase()}/ws/system`);

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

// Test connection to API
export async function testConnection(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/buttons`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
