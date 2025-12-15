import React, { useState, useEffect, useRef } from "react";
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
  Eye,
  EyeOff,
  Clock,
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  MapPin,
  Settings,
  GripVertical,
  Lock,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Widget, SystemMetrics } from "../types";
import {
  getWidgets,
  updateWidgets,
  connectWebSocket,
  getSystemMetrics,
  getWeatherData,
} from "../api";
import { LocationModal } from "../components/LocationModal";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  progress?: number;
  secondary?: React.ReactNode;
}

function MetricCard({
  title,
  value,
  unit,
  icon,
  color,
  progress,
  secondary,
}: MetricCardProps) {
  return (
    <div
      className="relative p-5 rounded-2xl overflow-hidden transition-all hover:scale-[1.02] h-full"
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

function NetworkCardContent({
  upload,
  download,
}: {
  upload: number;
  download: number;
}) {
  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
    if (bytesPerSec < 1024 * 1024)
      return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
  };

  return (
    <div
      className="relative p-5 rounded-2xl overflow-hidden transition-all hover:scale-[1.02] h-full"
      style={{
        background: "linear-gradient(135deg, #8b5cf615, #8b5cf605)",
        border: "1px solid #8b5cf630",
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
            <span className="text-lg font-semibold text-white">
              {formatSpeed(upload)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDown size={16} className="text-blue-400" />
              <span className="text-sm text-gray-400">Download</span>
            </div>
            <span className="text-lg font-semibold text-white">
              {formatSpeed(download)}
            </span>
          </div>
        </div>

        <div className="text-sm text-gray-400 mt-3">Network Activity</div>
      </div>
    </div>
  );
}

// Clock Card Component
function ClockCardContent() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div
      className="relative p-5 rounded-2xl overflow-hidden transition-all hover:scale-[1.02] h-full"
      style={{
        background: "linear-gradient(135deg, #10b98115, #10b98105)",
        border: "1px solid #10b98130",
      }}
    >
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 bg-emerald-500" />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20">
            <Clock size={24} className="text-emerald-400" />
          </div>
        </div>

        <div className="mb-1">
          <span className="text-3xl font-bold text-white">
            {formatTime(time)}
          </span>
        </div>

        <div className="text-sm text-gray-400">{formatDate(time)}</div>
      </div>
    </div>
  );
}

// Weather Card Component - uses backend API for cached weather data
interface WeatherDisplayData {
  temperature: number;
  weatherCode: number;
  humidity?: number;
  location?: string;
  description?: string;
  locationSource?: string;
}

interface WeatherCardContentProps {
  onOpenLocationSettings?: () => void;
}

function WeatherCardContent({
  onOpenLocationSettings,
}: WeatherCardContentProps) {
  const [weather, setWeather] = useState<WeatherDisplayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWeather();
    // Refresh weather every 10 minutes (backend caches for 1 hour)
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchWeather = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch from backend API (which caches weather data)
      const data = await getWeatherData();

      setWeather({
        temperature: data.temperature,
        weatherCode: data.weather_code,
        humidity: data.humidity,
        location: data.location,
        description: data.description,
        locationSource: data.location_source,
      });
    } catch (err) {
      console.error("Weather fetch error:", err);
      setError("Unable to fetch weather");
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIcon = (code: number) => {
    // WMO Weather interpretation codes
    if (code === 0) return <Sun size={24} className="text-yellow-400" />;
    if (code <= 3) return <Cloud size={24} className="text-gray-400" />;
    if (code <= 49) return <CloudFog size={24} className="text-gray-400" />;
    if (code <= 69) return <CloudRain size={24} className="text-blue-400" />;
    if (code <= 79) return <CloudSnow size={24} className="text-blue-200" />;
    if (code <= 99)
      return <CloudLightning size={24} className="text-yellow-400" />;
    return <Cloud size={24} className="text-gray-400" />;
  };

  const getWeatherDescription = (code: number) => {
    if (code === 0) return "Clear sky";
    if (code <= 3) return "Partly cloudy";
    if (code <= 49) return "Foggy";
    if (code <= 59) return "Drizzle";
    if (code <= 69) return "Rain";
    if (code <= 79) return "Snow";
    if (code <= 99) return "Thunderstorm";
    return "Unknown";
  };

  // Expose refresh function to parent
  (WeatherCardContent as any).refresh = fetchWeather;

  return (
    <div
      className="relative p-5 rounded-2xl overflow-hidden transition-all hover:scale-[1.02] h-full group/weather"
      style={{
        background: "linear-gradient(135deg, #0ea5e915, #0ea5e905)",
        border: "1px solid #0ea5e930",
      }}
    >
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 bg-sky-500" />

      {/* Settings Button */}
      {onOpenLocationSettings && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenLocationSettings();
          }}
          className="absolute bottom-2 right-2 z-20 p-1.5 rounded-lg bg-gray-800/80 opacity-0 group-hover/weather:opacity-100 transition-opacity hover:bg-gray-700"
          title="Location Settings"
        >
          <Settings size={14} className="text-gray-400" />
        </button>
      )}

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div className="p-2.5 rounded-xl bg-sky-500/20">
            {weather ? (
              getWeatherIcon(weather.weatherCode)
            ) : (
              <Cloud size={24} className="text-sky-400" />
            )}
          </div>
          {weather?.location && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <MapPin size={12} />
              {weather.location}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-sky-400"></div>
            <span className="text-sm text-gray-400">Loading...</span>
          </div>
        ) : error ? (
          <div className="text-sm text-red-400">{error}</div>
        ) : weather ? (
          <>
            <div className="mb-1">
              <span className="text-3xl font-bold text-white">
                {weather.temperature.toFixed(1)}
              </span>
              <span className="text-lg text-gray-400 ml-1">°C</span>
            </div>
            <div className="text-sm text-gray-400">
              {getWeatherDescription(weather.weatherCode)}
            </div>
            {weather.humidity !== undefined && (
              <div className="text-xs text-gray-500 mt-1">
                Humidity: {weather.humidity}%
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

const defaultWidgets: Widget[] = [
  { id: "widget-cpu", type: "cpu", position: 0, enabled: true },
  { id: "widget-ram", type: "ram", position: 1, enabled: true },
  { id: "widget-battery", type: "battery", position: 2, enabled: true },
  { id: "widget-volume", type: "volume", position: 3, enabled: true },
  { id: "widget-network", type: "network", position: 4, enabled: true },
  { id: "widget-temperature", type: "temperature", position: 5, enabled: true },
  { id: "widget-clock", type: "clock", position: 6, enabled: true },
  { id: "widget-weather", type: "weather", position: 7, enabled: true },
];

// Toggle Switch Component for drag mode
interface DragToggleSwitchProps {
  enabled: boolean;
  onToggle: () => void;
}

function DragToggleSwitch({ enabled, onToggle }: DragToggleSwitchProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-centerrounded-xl transition-all duration-300 `}
    >
      <div className="relative">
        <div
          className={`w-12 h-6 rounded-full transition-all duration-300 ${
            enabled
              ? "bg-linear-to-r from-violet-500 to-purple-500"
              : "bg-gray-700"
          }`}
        >
          <div
            className={`absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center ${
              enabled ? "left-6 bg-white shadow-lg" : "left-0.5 bg-gray-400"
            }`}
          >
            {enabled ? (
              <GripVertical size={12} className="text-violet-600" />
            ) : (
              <Lock size={12} className="text-gray-600" />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// Sortable Card Wrapper for the metrics grid
interface SortableCardProps {
  id: string;
  children: React.ReactNode;
  isDragEnabled: boolean;
}

function SortableCard({ id, children, isDragEnabled }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isDragEnabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  const dragProps = isDragEnabled ? { ...attributes, ...listeners } : {};
  const cursorClass = isDragEnabled ? "cursor-grab active:cursor-grabbing" : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${cursorClass}`}
      {...dragProps}
    >
      {children}
    </div>
  );
}

// Widget Toggle Item for configuration panel (no drag, just toggle)
interface WidgetToggleItemProps {
  widget: Widget;
  onToggle: (widgetId: string) => void;
}

function WidgetToggleItem({ widget, onToggle }: WidgetToggleItemProps) {
  return (
    <button
      onClick={() => onToggle(widget.id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
        widget.enabled
          ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50"
          : "bg-gray-700/50 text-gray-400"
      }`}
    >
      {widget.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
      {widget.type.toUpperCase()}
    </button>
  );
}

export function MetricsPage() {
  const [widgets, setWidgets] = useState<Widget[]>(defaultWidgets);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [connected, setConnected] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [weatherKey, setWeatherKey] = useState(0);
  const [isDragEnabled, setIsDragEnabled] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      console.error("Failed to load widgets:", e);
    }
  };

  const loadInitialMetrics = async () => {
    try {
      const data = await getSystemMetrics();
      setMetrics(data);
    } catch (e) {
      console.error("Failed to load initial metrics:", e);
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
      console.error("Failed to update widgets:", e);
    }
  };

  const showAllWidgets = async () => {
    const updatedWidgets = widgets.map((w) => ({ ...w, enabled: true }));
    setWidgets(updatedWidgets);
    try {
      await updateWidgets(updatedWidgets);
    } catch (e) {
      console.error("Failed to show all widgets:", e);
    }
  };

  const hideAllWidgets = async () => {
    const updatedWidgets = widgets.map((w) => ({ ...w, enabled: false }));
    setWidgets(updatedWidgets);
    try {
      await updateWidgets(updatedWidgets);
    } catch (e) {
      console.error("Failed to hide all widgets:", e);
    }
  };

  // @dnd-kit drag end handler for cards
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Get the current sorted list (this matches what user sees on screen)
      const currentSorted = [...widgets].sort(
        (a, b) => a.position - b.position
      );

      // Find indices in the sorted array (matches visual order)
      const oldIndex = currentSorted.findIndex((w) => w.id === active.id);
      const newIndex = currentSorted.findIndex((w) => w.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      // Apply arrayMove on the sorted array and recalculate positions
      const reordered = arrayMove(currentSorted, oldIndex, newIndex);
      const newWidgets = reordered.map((w, index) => ({
        ...w,
        position: index,
      }));

      // Optimistically update UI
      setWidgets(newWidgets);

      // Persist to backend
      try {
        await updateWidgets(newWidgets);
      } catch (e) {
        console.error("Failed to reorder widgets:", e);
        // Revert on error
        await loadWidgets();
      }
    }
  };

  const allEnabled = widgets.every((w) => w.enabled);
  const allDisabled = widgets.every((w) => !w.enabled);

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(1);
  };

  // Get sorted and enabled widgets
  const sortedWidgets = [...widgets].sort((a, b) => a.position - b.position);
  const enabledWidgets = sortedWidgets.filter((w) => w.enabled);

  // Render card content based on widget type
  const renderCardContent = (widget: Widget) => {
    if (!metrics) return null;

    switch (widget.type) {
      case "cpu":
        return (
          <MetricCard
            title="CPU Usage"
            value={metrics.cpu_usage.toFixed(1)}
            unit="%"
            icon={<Cpu size={24} className="text-blue-400" />}
            color="#3b82f6"
            progress={metrics.cpu_usage}
          />
        );
      case "ram":
        return (
          <MetricCard
            title="Memory Usage"
            value={metrics.ram_usage.toFixed(1)}
            unit="%"
            icon={<MemoryStick size={24} className="text-purple-400" />}
            color="#a855f7"
            progress={metrics.ram_usage}
            secondary={`${formatBytes(metrics.ram_used)} / ${formatBytes(
              metrics.ram_total
            )} GB`}
          />
        );
      case "battery":
        return (
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
            color={metrics.is_charging ? "#22c55e" : "#eab308"}
            progress={metrics.battery_level}
            secondary={metrics.is_charging ? "Charging" : "On Battery"}
          />
        );
      case "volume":
        return (
          <MetricCard
            title="System Volume"
            value={metrics.volume_level}
            unit="%"
            icon={
              metrics.volume_muted ? (
                <VolumeX size={24} className="text-red-400" />
              ) : (
                <Volume2 size={24} className="text-cyan-400" />
              )
            }
            color={metrics.volume_muted ? "#ef4444" : "#06b6d4"}
            progress={metrics.volume_level}
            secondary={
              <span className="flex items-center gap-2">
                {metrics.volume_muted ? (
                  <span className="flex items-center gap-1 text-red-400">
                    <VolumeX size={12} /> Muted
                  </span>
                ) : null}
                {metrics.mic_muted ? (
                  <span className="flex items-center gap-1 text-red-400">
                    <MicOff size={12} /> Mic
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-green-400">
                    <Mic size={12} /> Mic
                  </span>
                )}
              </span>
            }
          />
        );
      case "network":
        return (
          <NetworkCardContent
            upload={metrics.network_upload}
            download={metrics.network_download}
          />
        );
      case "temperature":
        return (
          <MetricCard
            title="CPU Temperature"
            value={metrics.cpu_temp.toFixed(0)}
            unit="°C"
            icon={
              <Thermometer
                size={24}
                className={
                  metrics.cpu_temp > 80 ? "text-red-400" : "text-orange-400"
                }
              />
            }
            color={metrics.cpu_temp > 80 ? "#ef4444" : "#f97316"}
            progress={(metrics.cpu_temp / 100) * 100}
            secondary={
              metrics.cpu_temp > 80
                ? "High Temperature!"
                : metrics.cpu_temp > 60
                ? "Warm"
                : "Normal"
            }
          />
        );
      case "clock":
        return <ClockCardContent />;
      case "weather":
        return (
          <WeatherCardContent
            key={weatherKey}
            onOpenLocationSettings={() => setShowLocationModal(true)}
          />
        );
      default:
        return null;
    }
  };

  const handleLocationChanged = () => {
    // Force weather widget to refresh by changing its key
    setWeatherKey((prev) => prev + 1);
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
          {/* Drag Toggle */}
          <DragToggleSwitch
            enabled={isDragEnabled}
            onToggle={() => setIsDragEnabled(!isDragEnabled)}
          />

          {/* Connection Status */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
              connected
                ? "bg-green-500/20 text-green-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-green-400 animate-pulse" : "bg-red-400"
              }`}
            />
            {connected ? "Live" : "Disconnected"}
          </div>

          {/* Config Button */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`p-2 rounded-lg transition-colors ${
              showConfig
                ? "bg-blue-500/20 text-blue-400"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            <Eye size={20} />
          </button>
        </div>
      </div>

      {/* Widget Configuration Panel - Visibility Toggles Only */}
      {showConfig && (
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-medium text-gray-300">
                Toggle Widget Visibility
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Click to show/hide widgets. Drag cards in the grid to reorder.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={showAllWidgets}
                disabled={allEnabled}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  allEnabled
                    ? "bg-gray-700/30 text-gray-500 cursor-not-allowed"
                    : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                }`}
              >
                <Eye size={12} />
                Show All
              </button>
              <button
                onClick={hideAllWidgets}
                disabled={allDisabled}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  allDisabled
                    ? "bg-gray-700/30 text-gray-500 cursor-not-allowed"
                    : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                }`}
              >
                <EyeOff size={12} />
                Hide All
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {sortedWidgets.map((widget) => (
              <WidgetToggleItem
                key={widget.id}
                widget={widget}
                onToggle={toggleWidget}
              />
            ))}
          </div>
        </div>
      )}

      {/* Metrics Grid with Drag & Drop */}
      {metrics ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={enabledWidgets.map((w) => w.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {enabledWidgets.map((widget) => (
                <SortableCard
                  key={widget.id}
                  id={widget.id}
                  isDragEnabled={isDragEnabled}
                >
                  {renderCardContent(widget)}
                </SortableCard>
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
                <span className="font-medium text-white">
                  {metrics.cpu_usage.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MemoryStick size={16} className="text-purple-400" />
                <span className="text-gray-400">RAM</span>
                <span className="font-medium text-white">
                  {metrics.ram_usage.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                {metrics.is_charging ? (
                  <BatteryCharging size={16} className="text-green-400" />
                ) : (
                  <Battery size={16} className="text-yellow-400" />
                )}
                <span className="text-gray-400">Battery</span>
                <span className="font-medium text-white">
                  {metrics.battery_level}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Volume2 size={16} className="text-cyan-400" />
                <span className="text-gray-400">Volume</span>
                <span className="font-medium text-white">
                  {metrics.volume_level}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Thermometer size={16} className="text-orange-400" />
                <span className="text-gray-400">Temp</span>
                <span className="font-medium text-white">
                  {metrics.cpu_temp.toFixed(0)}°C
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Settings Modal */}
      <LocationModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationChanged={handleLocationChanged}
      />
    </div>
  );
}
