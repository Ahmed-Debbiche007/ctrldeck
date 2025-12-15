// Button Types
export interface Button {
  id: string;
  name: string;
  icon: string;
  action_type: ActionType;
  action_data: Record<string, string>;
  position: number;
  color: string;
}

export type ActionType =
  | 'mute_mic'
  | 'volume_up'
  | 'volume_down'
  | 'volume_mute'
  | 'volume_knob'
  | 'brightness_knob'
  | 'launch_app'
  | 'run_script'
  | 'open_url'
  | 'media_play_pause'
  | 'media_next'
  | 'media_prev';

// Widget Types
export interface Widget {
  id: string;
  type: WidgetType;
  position: number;
  enabled: boolean;
}

export type WidgetType = 'cpu' | 'ram' | 'battery' | 'network' | 'volume' | 'temperature' | 'clock' | 'weather';

// Script Types
export interface Script {
  id: string;
  name: string;
  path: string;
  description: string;
}

// App Types
export interface InstalledApp {
  name: string;
  path: string;
  icon: string;
  category: string;
}

// Media State
export interface MediaState {
  title: string;
  artist: string;
  status: 'Playing' | 'Paused' | 'Stopped' | '';
  thumbnail: string; // Base64 encoded image
}

// System Metrics
export interface SystemMetrics {
  cpu_usage: number;
  ram_usage: number;
  ram_total: number;
  ram_used: number;
  battery_level: number;
  is_charging: boolean;
  cpu_temp: number;
  mic_muted: boolean;
  volume_muted: boolean;
  volume_level: number;
  brightness_level: number;
  network_upload: number;
  network_download: number;
  media: MediaState;
  timestamp: number;
}

// WebSocket Message
export interface WSMessage {
  type: string;
  data?: SystemMetrics;
}
