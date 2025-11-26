import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu,
  MemoryStick,
  Battery,
  BatteryCharging,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Thermometer,
  ArrowUp,
  ArrowDown,
  Wifi,
  Settings
} from 'lucide-react';
import { Widget, SystemMetrics, WidgetType } from '../types';
import { getWidgets, connectWebSocket, getSystemMetrics } from '../api';

interface MetricsPageProps {
  onSettingsClick?: () => void;
}

interface MetricButtonProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  progress?: number;
  secondary?: string;
  enabled?: boolean;
}

function MetricButton({ title, value, unit, icon, color, progress, secondary, enabled = true }: MetricButtonProps) {
  if (!enabled) return null;

  return (
    <div
      className="aspect-square rounded-xl flex flex-col items-center justify-center p-1.5 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${color}25, ${color}10)`,
        border: `1.5px solid ${color}`,
        boxShadow: `0 0 10px ${color}15`,
      }}
    >
      {/* Progress bar at bottom */}
      {progress !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800/50">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              background: color,
            }}
          />
        </div>
      )}
      
      {/* Icon */}
      <div className="mb-0.5">
        {React.cloneElement(icon as React.ReactElement, {
          size: 18,
          className: 'w-4 h-4 sm:w-5 sm:h-5'
        })}
      </div>
      
      {/* Value */}
      <div className="flex items-baseline gap-0.5">
        <span className="text-base sm:text-lg font-bold text-white">{value}</span>
        {unit && <span className="text-[10px] text-gray-400">{unit}</span>}
      </div>
      
      {/* Title */}
      <span className="text-[8px] sm:text-[9px] text-gray-400 truncate w-full text-center">{title}</span>
      
      {/* Secondary info */}
      {secondary && (
        <span className="text-[7px] text-gray-500 truncate w-full text-center">{secondary}</span>
      )}
    </div>
  );
}

function NetworkButton({ upload, download, enabled = true }: { upload: number; download: number; enabled?: boolean }) {
  if (!enabled) return null;

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)}B`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(0)}K`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)}M`;
  };

  return (
    <div
      className="aspect-square rounded-xl flex flex-col items-center justify-center p-1.5"
      style={{
        background: 'linear-gradient(135deg, #8b5cf625, #8b5cf610)',
        border: '1.5px solid #8b5cf6',
        boxShadow: '0 0 10px #8b5cf615',
      }}
    >
      <Wifi className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 mb-0.5" />
      
      <div className="flex items-center gap-1 text-[10px]">
        <ArrowUp size={8} className="text-green-400" />
        <span className="text-white font-medium">{formatSpeed(upload)}</span>
      </div>
      
      <div className="flex items-center gap-1 text-[10px]">
        <ArrowDown size={8} className="text-blue-400" />
        <span className="text-white font-medium">{formatSpeed(download)}</span>
      </div>
      
      <span className="text-[8px] text-gray-400">Network</span>
    </div>
  );
}

const defaultWidgets: Widget[] = [
  { id: 'widget-cpu', type: 'cpu', position: 0, enabled: true },
  { id: 'widget-ram', type: 'ram', position: 1, enabled: true },
  { id: 'widget-battery', type: 'battery', position: 2, enabled: true },
  { id: 'widget-volume', type: 'volume', position: 3, enabled: true },
  { id: 'widget-network', type: 'network', position: 4, enabled: true },
  { id: 'widget-temperature', type: 'temperature', position: 5, enabled: true },
];

export function MetricsPage({ onSettingsClick }: MetricsPageProps) {
  const [widgets, setWidgets] = useState<Widget[]>(defaultWidgets);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    loadWidgets();
    loadInitialMetrics();
    connectToWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const loadWidgets = async () => {
    try {
      const data = await getWidgets();
      if (data && data.length > 0) {
        setWidgets(data);
      }
    } catch (e) {
      console.error('Failed to load widgets:', e);
    }
  };

  const loadInitialMetrics = async () => {
    try {
      const data = await getSystemMetrics();
      setMetrics(data);
    } catch (e) {
      console.error('Failed to load initial metrics:', e);
    }
  };

  const connectToWebSocket = () => {
    wsRef.current = connectWebSocket(
      (newMetrics) => {
        setMetrics(newMetrics);
        setConnected(true);
      },
      () => {
        setConnected(false);
        setTimeout(connectToWebSocket, 3000);
      }
    );

    wsRef.current.onopen = () => setConnected(true);
    wsRef.current.onclose = () => setConnected(false);
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(1);
  };

  const getWidgetEnabled = (type: WidgetType) => {
    const widget = widgets.find((w) => w.type === type);
    return widget?.enabled ?? true;
  };

  return (
    <div className="h-full p-2 pb-8">
      {/* Metrics Grid - Button-like compact display */}
      {metrics ? (
        <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-1.5 sm:gap-2">
          {/* CPU */}
          <MetricButton
            title="CPU"
            value={metrics.cpu_usage.toFixed(0)}
            unit="%"
            icon={<Cpu className="text-blue-400" />}
            color="#3b82f6"
            progress={metrics.cpu_usage}
            enabled={getWidgetEnabled('cpu')}
          />

          {/* RAM */}
          <MetricButton
            title="RAM"
            value={metrics.ram_usage.toFixed(0)}
            unit="%"
            icon={<MemoryStick className="text-purple-400" />}
            color="#a855f7"
            progress={metrics.ram_usage}
            secondary={`${formatBytes(metrics.ram_used)}G`}
            enabled={getWidgetEnabled('ram')}
          />

          {/* Battery */}
          <MetricButton
            title="Battery"
            value={metrics.battery_level}
            unit="%"
            icon={
              metrics.is_charging ? (
                <BatteryCharging className="text-green-400" />
              ) : (
                <Battery className="text-yellow-400" />
              )
            }
            color={metrics.is_charging ? '#22c55e' : '#eab308'}
            progress={metrics.battery_level}
            secondary={metrics.is_charging ? '⚡' : ''}
            enabled={getWidgetEnabled('battery')}
          />

          {/* Volume */}
          <MetricButton
            title="Vol"
            value={metrics.volume_level}
            unit="%"
            icon={
              metrics.volume_level === 0 ? (
                <VolumeX className="text-red-400" />
              ) : (
                <Volume2 className="text-cyan-400" />
              )
            }
            color={metrics.volume_level === 0 ? '#ef4444' : '#06b6d4'}
            progress={metrics.volume_level}
            secondary={metrics.mic_muted ? '🔇' : '🎤'}
            enabled={getWidgetEnabled('volume')}
          />

          {/* Network */}
          <NetworkButton
            upload={metrics.network_upload}
            download={metrics.network_download}
            enabled={getWidgetEnabled('network')}
          />

          {/* Temperature */}
          <MetricButton
            title="Temp"
            value={metrics.cpu_temp.toFixed(0)}
            unit="°"
            icon={<Thermometer className={metrics.cpu_temp > 80 ? 'text-red-400' : 'text-orange-400'} />}
            color={metrics.cpu_temp > 80 ? '#ef4444' : '#f97316'}
            progress={(metrics.cpu_temp / 100) * 100}
            secondary={metrics.cpu_temp > 80 ? '🔥' : ''}
            enabled={getWidgetEnabled('temperature')}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Connection indicator */}
      <div className="absolute top-2 left-2">
        <div
          className={`w-2 h-2 rounded-full ${
            connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
          }`}
        />
      </div>

      {/* Settings button */}
      {onSettingsClick && (
        <button
          onClick={onSettingsClick}
          className="absolute top-2 right-2 p-2 rounded-full bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white transition-colors"
        >
          <Settings size={16} />
        </button>
      )}
    </div>
  );
}
