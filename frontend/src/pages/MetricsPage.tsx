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
  Plus,
  Eye,
  EyeOff,
  GripVertical,
} from 'lucide-react';
import { Widget, SystemMetrics, WidgetType } from '../types';
import { getWidgets, createWidget, updateWidgets, connectWebSocket, getSystemMetrics } from '../api';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  progress?: number;
  secondary?: React.ReactNode;
  enabled?: boolean;
}

function MetricCard({ title, value, unit, icon, color, progress, secondary, enabled = true }: MetricCardProps) {
  if (!enabled) return null;

  return (
    <div
      className="relative p-5 rounded-2xl overflow-hidden transition-all hover:scale-[1.02]"
      style={{
        background: `linear-gradient(135deg, ${color}15, ${color}05)`,
        border: `1px solid ${color}30`,
      }}
    >
      {/* Background Glow */}
      <div
        className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20"
        style={{ background: color }}
      />

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div
            className="p-2.5 rounded-xl"
            style={{ background: `${color}20` }}
          >
            {icon}
          </div>
          {secondary && (
            <span className="text-xs text-gray-400">{secondary}</span>
          )}
        </div>

        <div className="mb-1">
          <span className="text-3xl font-bold text-white">{value}</span>
          {unit && <span className="text-lg text-gray-400 ml-1">{unit}</span>}
        </div>

        <div className="text-sm text-gray-400">{title}</div>

        {progress !== undefined && (
          <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, progress))}%`,
                background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                boxShadow: `0 0 10px ${color}66`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function NetworkCard({ upload, download, enabled = true }: { upload: number; download: number; enabled?: boolean }) {
  if (!enabled) return null;

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
  };

  return (
    <div
      className="relative p-5 rounded-2xl overflow-hidden transition-all hover:scale-[1.02]"
      style={{
        background: 'linear-gradient(135deg, #8b5cf615, #8b5cf605)',
        border: '1px solid #8b5cf630',
      }}
    >
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 bg-purple-500" />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20">
            <Wifi size={24} className="text-purple-400" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUp size={16} className="text-green-400" />
              <span className="text-sm text-gray-400">Upload</span>
            </div>
            <span className="text-lg font-semibold text-white">{formatSpeed(upload)}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDown size={16} className="text-blue-400" />
              <span className="text-sm text-gray-400">Download</span>
            </div>
            <span className="text-lg font-semibold text-white">{formatSpeed(download)}</span>
          </div>
        </div>

        <div className="text-sm text-gray-400 mt-3">Network Activity</div>
      </div>
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

export function MetricsPage() {
  const [widgets, setWidgets] = useState<Widget[]>(defaultWidgets);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [connected, setConnected] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
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
        // Reconnect after 3 seconds
        setTimeout(connectToWebSocket, 3000);
      }
    );

    wsRef.current.onopen = () => setConnected(true);
    wsRef.current.onclose = () => setConnected(false);
  };

  const toggleWidget = async (widgetId: string) => {
    const updatedWidgets = widgets.map((w) =>
      w.id === widgetId ? { ...w, enabled: !w.enabled } : w
    );
    setWidgets(updatedWidgets);
    try {
      await updateWidgets(updatedWidgets);
    } catch (e) {
      console.error('Failed to update widgets:', e);
    }
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">System Metrics</h1>
          <p className="text-gray-400 mt-1">Real-time system monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              connected
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
              }`}
            />
            {connected ? 'Live' : 'Disconnected'}
          </div>

          {/* Config Button */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`p-2 rounded-lg transition-colors ${
              showConfig ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Eye size={20} />
          </button>
        </div>
      </div>

      {/* Widget Configuration Panel */}
      {showConfig && (
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-3">Toggle Widgets</h3>
          <div className="flex flex-wrap gap-2">
            {widgets.map((widget) => (
              <button
                key={widget.id}
                onClick={() => toggleWidget(widget.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  widget.enabled
                    ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50'
                    : 'bg-gray-700/50 text-gray-400'
                }`}
              >
                {widget.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                {widget.type.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      {metrics ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* CPU Usage */}
          <MetricCard
            title="CPU Usage"
            value={metrics.cpu_usage.toFixed(1)}
            unit="%"
            icon={<Cpu size={24} className="text-blue-400" />}
            color="#3b82f6"
            progress={metrics.cpu_usage}
            enabled={getWidgetEnabled('cpu')}
          />

          {/* RAM Usage */}
          <MetricCard
            title="Memory Usage"
            value={metrics.ram_usage.toFixed(1)}
            unit="%"
            icon={<MemoryStick size={24} className="text-purple-400" />}
            color="#a855f7"
            progress={metrics.ram_usage}
            secondary={`${formatBytes(metrics.ram_used)} / ${formatBytes(metrics.ram_total)} GB`}
            enabled={getWidgetEnabled('ram')}
          />

          {/* Battery */}
          <MetricCard
            title="Battery"
            value={metrics.battery_level}
            unit="%"
            icon={
              metrics.is_charging ? (
                <BatteryCharging size={24} className="text-green-400" />
              ) : (
                <Battery size={24} className="text-yellow-400" />
              )
            }
            color={metrics.is_charging ? '#22c55e' : '#eab308'}
            progress={metrics.battery_level}
            secondary={metrics.is_charging ? 'Charging' : 'On Battery'}
            enabled={getWidgetEnabled('battery')}
          />

          {/* Volume */}
          <MetricCard
            title="System Volume"
            value={metrics.volume_level}
            unit="%"
            icon={
              metrics.volume_level === 0 ? (
                <VolumeX size={24} className="text-red-400" />
              ) : (
                <Volume2 size={24} className="text-cyan-400" />
              )
            }
            color={metrics.volume_level === 0 ? '#ef4444' : '#06b6d4'}
            progress={metrics.volume_level}
            secondary={
              metrics.mic_muted ? (
                <span className="flex items-center gap-1 text-red-400">
                  <MicOff size={12} /> Mic Muted
                </span>
              ) : (
                <span className="flex items-center gap-1 text-green-400">
                  <Mic size={12} /> Mic Active
                </span>
              )
            }
            enabled={getWidgetEnabled('volume')}
          />

          {/* Network */}
          <NetworkCard
            upload={metrics.network_upload}
            download={metrics.network_download}
            enabled={getWidgetEnabled('network')}
          />

          {/* CPU Temperature */}
          <MetricCard
            title="CPU Temperature"
            value={metrics.cpu_temp.toFixed(0)}
            unit="°C"
            icon={<Thermometer size={24} className={metrics.cpu_temp > 80 ? 'text-red-400' : 'text-orange-400'} />}
            color={metrics.cpu_temp > 80 ? '#ef4444' : '#f97316'}
            progress={(metrics.cpu_temp / 100) * 100}
            secondary={
              metrics.cpu_temp > 80
                ? 'High Temperature!'
                : metrics.cpu_temp > 60
                ? 'Warm'
                : 'Normal'
            }
            enabled={getWidgetEnabled('temperature')}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-400">Loading system metrics...</p>
        </div>
      )}

      {/* Quick Stats Bar */}
      {metrics && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 border-t border-gray-800 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center justify-between gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Cpu size={16} className="text-blue-400" />
                <span className="text-gray-400">CPU</span>
                <span className="font-medium text-white">{metrics.cpu_usage.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2">
                <MemoryStick size={16} className="text-purple-400" />
                <span className="text-gray-400">RAM</span>
                <span className="font-medium text-white">{metrics.ram_usage.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-2">
                {metrics.is_charging ? (
                  <BatteryCharging size={16} className="text-green-400" />
                ) : (
                  <Battery size={16} className="text-yellow-400" />
                )}
                <span className="text-gray-400">Battery</span>
                <span className="font-medium text-white">{metrics.battery_level}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Volume2 size={16} className="text-cyan-400" />
                <span className="text-gray-400">Volume</span>
                <span className="font-medium text-white">{metrics.volume_level}%</span>
              </div>
              <div className="flex items-center gap-2">
                <Thermometer size={16} className="text-orange-400" />
                <span className="text-gray-400">Temp</span>
                <span className="font-medium text-white">{metrics.cpu_temp.toFixed(0)}°C</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
