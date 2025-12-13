import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import type { Widget, SystemMetrics, WidgetType } from "@/types";
import { LoadingScreen, EmptyState } from "@/components/fallback";
import {
  getWidgets,
  connectWebSocket,
  getSystemMetrics,
  getWeatherData,
  type WeatherData,
} from "@/api";

interface MetricsScreenProps {
  onSettingsClick?: () => void;
}

interface BadgeConfig {
  icon: string;
  color: string;
  bgColor: string;
}

interface MetricButtonProps {
  title: string;
  value: string | number;
  unit?: string;
  iconName: string;
  color: string;
  iconColor: string;
  progress?: number;
  secondary?: string;
  enabled?: boolean;
  badge?: BadgeConfig;
  badges?: BadgeConfig[];
}

function MetricButton({
  title,
  value,
  unit,
  iconName,
  color,
  iconColor,
  progress,
  secondary,
  enabled = true,
  badge,
  badges,
}: MetricButtonProps) {
  if (!enabled) return null;

  // Combine single badge and badges array
  const allBadges = badges || (badge ? [badge] : []);

  return (
    <View
      style={[
        styles.metricButton,
        {
          backgroundColor: `${color}15`,
          borderColor: color,
        },
      ]}
    >
      {/* Badges - top right corner, stacked vertically */}
      {allBadges.map((b, index) => (
        <View
          key={index}
          style={[
            styles.badge,
            {
              backgroundColor: b.bgColor,
              top: 4 + index * 20,
            },
          ]}
        >
          <Feather name={b.icon as any} size={10} color={b.color} />
        </View>
      ))}

      {/* Progress bar at bottom */}
      {progress !== undefined && (
        <View style={styles.progressContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${Math.min(100, Math.max(0, progress))}%`,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      )}

      {/* Icon */}
      <View style={styles.metricIconContainer}>
        <Feather name={iconName as any} size={18} color={iconColor} />
      </View>

      {/* Value */}
      <View style={styles.valueContainer}>
        <Text style={styles.valueText}>{value}</Text>
        {unit && <Text style={styles.unitText}>{unit}</Text>}
      </View>

      {/* Title */}
      <Text style={styles.titleText}>{title}</Text>

      {/* Secondary info */}
      {secondary && <Text style={styles.secondaryText}>{secondary}</Text>}
    </View>
  );
}

interface NetworkButtonProps {
  upload: number;
  download: number;
  enabled?: boolean;
}

function NetworkButton({
  upload,
  download,
  enabled = true,
}: NetworkButtonProps) {
  if (!enabled) return null;

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)}B`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(0)}K`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)}M`;
  };

  return (
    <View
      style={[
        styles.metricButton,
        {
          backgroundColor: "rgba(139, 92, 246, 0.15)",
          borderColor: "#8b5cf6",
        },
      ]}
    >
      <View style={styles.metricIconContainer}>
        <Feather name="wifi" size={18} color="#a78bfa" />
      </View>

      <View style={styles.networkRow}>
        <Feather name="arrow-up" size={10} color="#22c55e" />
        <Text style={styles.networkSpeed}>{formatSpeed(upload)}</Text>
      </View>

      <View style={styles.networkRow}>
        <Feather name="arrow-down" size={10} color="#3b82f6" />
        <Text style={styles.networkSpeed}>{formatSpeed(download)}</Text>
      </View>

      <Text style={styles.titleText}>Network</Text>
    </View>
  );
}

// Clock Button Component
interface ClockButtonProps {
  enabled?: boolean;
}

function ClockButton({ enabled = true }: ClockButtonProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!enabled) return null;

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
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <View
      style={[
        styles.metricButton,
        {
          backgroundColor: "rgba(16, 185, 129, 0.15)",
          borderColor: "#10b981",
        },
      ]}
    >
      <View style={styles.metricIconContainer}>
        <Feather name="clock" size={18} color="#34d399" />
      </View>

      <Text style={styles.valueText}>{formatTime(time)}</Text>
      <Text style={styles.titleText}>{formatDate(time)}</Text>
    </View>
  );
}

// Weather Button Component
interface WeatherButtonProps {
  enabled?: boolean;
  refreshKey?: number;
}

function WeatherButton({ enabled = true, refreshKey = 0 }: WeatherButtonProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeather();
    // Refresh weather every 10 minutes
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Refresh weather when refreshKey changes (location changed)
  useEffect(() => {
    if (refreshKey > 0) {
      fetchWeather();
    }
  }, [refreshKey]);

  const fetchWeather = async () => {
    try {
      setLoading(true);
      const data = await getWeatherData();
      setWeather(data);
    } catch (err) {
      console.error("Weather fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!enabled) return null;

  const getWeatherIcon = (code: number): string => {
    // WMO Weather interpretation codes
    if (code === 0) return "sun";
    if (code <= 3) return "cloud";
    if (code <= 49) return "cloud";
    if (code <= 69) return "cloud-rain";
    if (code <= 79) return "cloud-snow";
    if (code <= 99) return "cloud-lightning";
    return "cloud";
  };

  const getWeatherIconColor = (code: number): string => {
    if (code === 0) return "#fbbf24";
    if (code <= 3) return "#9ca3af";
    if (code <= 49) return "#9ca3af";
    if (code <= 69) return "#60a5fa";
    if (code <= 79) return "#93c5fd";
    if (code <= 99) return "#fbbf24";
    return "#9ca3af";
  };

  return (
    <View
      style={[
        styles.metricButton,
        {
          backgroundColor: "rgba(14, 165, 233, 0.15)",
          borderColor: "#0ea5e9",
        },
      ]}
    >
      <View style={styles.metricIconContainer}>
        <Feather
          name={
            weather ? (getWeatherIcon(weather.weather_code) as any) : "cloud"
          }
          size={18}
          color={
            weather ? getWeatherIconColor(weather.weather_code) : "#38bdf8"
          }
        />
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#38bdf8" />
      ) : weather ? (
        <>
          <View style={styles.valueContainer}>
            <Text style={styles.valueText}>
              {weather.temperature.toFixed(0)}
            </Text>
            <Text style={styles.unitText}>°C</Text>
          </View>
          <Text style={styles.titleText} numberOfLines={1}>
            {weather.location || "Weather"}
          </Text>
        </>
      ) : (
        <Text style={styles.titleText}>No data</Text>
      )}
    </View>
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

export function MetricsScreen({ onSettingsClick }: MetricsScreenProps) {
  const [widgets, setWidgets] = useState<Widget[]>(defaultWidgets);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [connected, setConnected] = useState(false);
  const [weatherRefreshKey, setWeatherRefreshKey] = useState(0);
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

  const connectToWebSocket = async () => {
    try {
      wsRef.current = await connectWebSocket(
        (newMetrics) => {
          setMetrics(newMetrics);
          setConnected(true);
        },
        () => {
          setConnected(false);
          setTimeout(connectToWebSocket, 3000);
        },
        (changedType) => {
          // Reload widgets when config changes
          if (changedType === "widgets" || changedType === "all") {
            console.log("Config changed, reloading widgets...");
            loadWidgets();
          }
          // Refresh weather when location changes
          if (changedType === "location" || changedType === "all") {
            console.log("Location changed, refreshing weather...");
            setWeatherRefreshKey((prev) => prev + 1);
          }
        }
      );

      wsRef.current.onopen = () => setConnected(true);
      wsRef.current.onclose = () => setConnected(false);
    } catch (e) {
      console.error("Failed to connect WebSocket:", e);
      setConnected(false);
      setTimeout(connectToWebSocket, 3000);
    }
  };

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(1);
  };

  // Get sorted and enabled widgets
  const sortedWidgets = [...widgets].sort((a, b) => a.position - b.position);
  const enabledWidgets = sortedWidgets.filter((w) => w.enabled);

  // Render widget based on type
  const renderWidget = (widget: Widget) => {
    if (!metrics) return null;

    switch (widget.type) {
      case "cpu":
        return (
          <MetricButton
            title="CPU"
            value={metrics.cpu_usage.toFixed(0)}
            unit="%"
            iconName="cpu"
            color="#3b82f6"
            iconColor="#60a5fa"
            progress={metrics.cpu_usage}
          />
        );
      case "ram":
        return (
          <MetricButton
            title="RAM"
            value={metrics.ram_usage.toFixed(0)}
            unit="%"
            iconName="hard-drive"
            color="#a855f7"
            iconColor="#c084fc"
            progress={metrics.ram_usage}
            secondary={`${formatBytes(metrics.ram_used)}G`}
          />
        );
      case "battery":
        return (
          <MetricButton
            title="Battery"
            value={metrics.battery_level}
            unit="%"
            iconName={metrics.is_charging ? "battery-charging" : "battery"}
            color={metrics.is_charging ? "#22c55e" : "#eab308"}
            iconColor={metrics.is_charging ? "#4ade80" : "#facc15"}
            progress={metrics.battery_level}
            badge={
              metrics.is_charging
                ? { icon: "zap", color: "#ffffff", bgColor: "#22c55e" }
                : undefined
            }
          />
        );
      case "volume":
        const volumeBadges: BadgeConfig[] = [];
        if (metrics.volume_muted) {
          volumeBadges.push({
            icon: "volume-x",
            color: "#ffffff",
            bgColor: "#ef4444",
          });
        }
        volumeBadges.push(
          metrics.mic_muted
            ? { icon: "mic-off", color: "#ffffff", bgColor: "#ef4444" }
            : { icon: "mic", color: "#ffffff", bgColor: "#22c55e" }
        );
        return (
          <MetricButton
            title="Vol"
            value={metrics.volume_level}
            unit="%"
            iconName={metrics.volume_muted ? "volume-x" : "volume-2"}
            color={metrics.volume_muted ? "#ef4444" : "#06b6d4"}
            iconColor={metrics.volume_muted ? "#f87171" : "#22d3ee"}
            progress={metrics.volume_level}
            badges={volumeBadges}
          />
        );
      case "network":
        return (
          <NetworkButton
            upload={metrics.network_upload}
            download={metrics.network_download}
          />
        );
      case "temperature":
        return (
          <MetricButton
            title="Temp"
            value={metrics.cpu_temp.toFixed(0)}
            unit="°"
            iconName="thermometer"
            color={metrics.cpu_temp > 80 ? "#ef4444" : "#f97316"}
            iconColor={metrics.cpu_temp > 80 ? "#f87171" : "#fb923c"}
            progress={(metrics.cpu_temp / 100) * 100}
            secondary={metrics.cpu_temp > 80 ? "High" : ""}
          />
        );
      case "clock":
        return <ClockButton />;
      case "weather":
        return <WeatherButton refreshKey={weatherRefreshKey} />;
      default:
        return null;
    }
  };

  if (!metrics) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      {/* Settings and connection indicator */}
      <View style={styles.topRightContainer}>
        {/* Settings button */}
        {onSettingsClick && (
          <TouchableOpacity
            onPress={onSettingsClick}
            style={styles.settingsButton}
          >
            <Feather name="settings" size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}
        {/* Connection indicator */}
        <View style={styles.connectionIndicator}>
          <View
            style={[
              styles.connectionDot,
              { backgroundColor: connected ? "#22c55e" : "#ef4444" },
            ]}
          />
        </View>
      </View>

      {/* Metrics Grid */}
      {enabledWidgets.length === 0 ? (
        <EmptyState
          icon="activity"
          title="No widgets enabled"
          subtitle="Use the desktop app to enable widgets"
        />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.metricsGrid}
          showsVerticalScrollIndicator={false}
        >
          {enabledWidgets.map((widget) => (
            <View key={widget.id} style={styles.metricWrapper}>
              {renderWidget(widget)}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const { width } = Dimensions.get("window");
const numColumns = width > 400 ? 4 : 3;
const metricSize = (width - 32 - (numColumns - 1) * 8) / numColumns;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
    padding: 8,
    paddingBottom: 40,
  },
  topRightContainer: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
    alignItems: "center",
    gap: 4,
  },
  connectionIndicator: {
    alignItems: "center",
    justifyContent: "center",
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  settingsButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(31, 41, 55, 0.5)",
  },
  scrollView: {
    flex: 1,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 8,
  },
  metricWrapper: {
    width: metricSize,
    aspectRatio: 1,
  },
  metricButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
    position: "relative",
    overflow: "hidden",
  },
  progressContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "rgba(31, 41, 55, 0.5)",
  },
  progressBar: {
    height: "100%",
  },
  metricIconContainer: {
    marginBottom: 2,
  },
  valueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  valueText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
  },
  unitText: {
    fontSize: 10,
    color: "#9ca3af",
  },
  titleText: {
    fontSize: 8,
    color: "#9ca3af",
  },
  secondaryText: {
    fontSize: 7,
    color: "#6b7280",
  },
  networkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  networkSpeed: {
    fontSize: 10,
    fontWeight: "500",
    color: "#ffffff",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
});
