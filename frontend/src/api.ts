import { Button, Widget, Script, InstalledApp, SystemMetrics } from './types';

// Use environment variables with fallback to defaults
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';
const WS_BASE = import.meta.env.VITE_WS_BASE || 'ws://localhost:8080';

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
