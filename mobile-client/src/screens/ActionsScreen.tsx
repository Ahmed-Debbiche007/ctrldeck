import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import type { Button, SystemMetrics } from "@/types";
import { LoadingScreen, EmptyState } from "@/components/fallback";
import {
  getButtons,
  executeAction,
  setVolume,
  setBrightness,
  connectWebSocket,
  getSystemMetrics,
} from "@/api";
import { VolumeKnobButton } from "@/components/VolumeKnobButton";
import { VolumeSliderButton } from "@/components/VolumeSliderButton";
import { BrightnessKnobButton } from "@/components/BrightnessKnobButton";
import { BrightnessSliderButton } from "@/components/BrightnessSliderButton";
import { MediaPlayPauseButton } from "@/components/MediaPlayPauseButton";

// Icon name normalization helper
function normalizeIconName(icon: string): string {
  const iconMap: Record<string, string> = {
    mic: "mic",
    "mic-off": "mic-off",
    volume: "volume-2",
    "volume-1": "volume-1",
    "volume-2": "volume-2",
    "volume-x": "volume-x",
    sun: "sun",
    monitor: "monitor",
    play: "play",
    pause: "pause",
    "skip-forward": "skip-forward",
    "skip-back": "skip-back",
    terminal: "terminal",
    code: "code",
    folder: "folder",
    file: "file",
    settings: "settings",
    power: "power",
    wifi: "wifi",
    bluetooth: "bluetooth",
    camera: "camera",
    video: "video",
    music: "music",
    globe: "globe",
    mail: "mail",
    "message-square": "message-square",
    phone: "phone",
    clock: "clock",
    calendar: "calendar",
    bell: "bell",
    heart: "heart",
    star: "star",
    home: "home",
    user: "user",
    lock: "lock",
    unlock: "unlock",
    key: "key",
    search: "search",
    "zoom-in": "zoom-in",
    "zoom-out": "zoom-out",
    maximize: "maximize",
    minimize: "minimize",
    x: "x",
    check: "check",
    plus: "plus",
    minus: "minus",
    "refresh-cw": "refresh-cw",
    download: "download",
    upload: "upload",
    share: "share",
    link: "link",
    eye: "eye",
    "eye-off": "eye-off",
    edit: "edit",
    trash: "trash",
    copy: "copy",
    clipboard: "clipboard",
    save: "save",
    printer: "printer",
    cast: "cast",
    tv: "tv",
    radio: "radio",
    headphones: "headphones",
    speaker: "speaker",
    image: "image",
    film: "film",
    circle: "circle",
    square: "square",
    triangle: "triangle",
    zap: "zap",
    cloud: "cloud",
    moon: "moon",
    cpu: "cpu",
    "hard-drive": "hard-drive",
    database: "database",
    server: "server",
    activity: "activity",
    command: "command",
    hash: "hash",
    "at-sign": "at-sign",
    layers: "layers",
    layout: "layout",
    grid: "grid",
    sidebar: "sidebar",
    list: "list",
    menu: "menu",
    "more-horizontal": "more-horizontal",
    "more-vertical": "more-vertical",
  };
  return iconMap[icon.toLowerCase()] || "circle";
}

interface ActionsScreenProps {
  onSettingsClick?: () => void;
}

export function ActionsScreen({ onSettingsClick }: ActionsScreenProps) {
  const [buttons, setButtons] = useState<Button[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    loadButtons();
    loadInitialMetrics();
    connectToWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const loadButtons = async () => {
    try {
      const data = await getButtons();
      setButtons(data || []);
    } catch (e) {
      console.error("Failed to load buttons:", e);
    } finally {
      setLoading(false);
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
          // Reconnect on error
          setTimeout(connectToWebSocket, 3000);
        },
        (changedType) => {
          // Reload buttons when config changes
          if (changedType === "buttons" || changedType === "all") {
            console.log("Config changed, reloading buttons...");
            loadButtons();
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

  const handleExecuteAction = async (buttonId: string) => {
    setExecutingId(buttonId);
    try {
      const result = await executeAction(buttonId);
      console.log("Action result:", result);
    } catch (e) {
      console.error("Failed to execute action:", e);
    } finally {
      setTimeout(() => setExecutingId(null), 300);
    }
  };

  const handleVolumeChange = async (level: number) => {
    try {
      await setVolume(level);
    } catch (e) {
      console.error("Failed to set volume:", e);
    }
  };

  const handleBrightnessChange = async (level: number) => {
    try {
      await setBrightness(level);
    } catch (e) {
      console.error("Failed to set brightness:", e);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  const renderButton = (button: Button) => {
    // Render Toggle Mic button with dynamic color and icon
    if (button.action_type === "mute_mic") {
      const isExecuting = executingId === button.id;
      const isMuted = metrics?.mic_muted ?? false;
      const dynamicColor = isMuted ? "#ef4444" : "#22c55e"; // Red when muted, Green when on
      const dynamicIcon = isMuted ? "mic-off" : "mic"; // Dynamic icon based on mic state

      return (
        <View key={button.id} style={styles.buttonWrapper}>
          <TouchableOpacity
            onPress={() => handleExecuteAction(button.id)}
            style={[
              styles.actionButton,
              {
                backgroundColor: `${dynamicColor}15`,
                borderColor: dynamicColor,
                transform: [{ scale: isExecuting ? 0.9 : 1 }],
              },
            ]}
            activeOpacity={0.7}
          >
            <Feather name={dynamicIcon as any} size={20} color={dynamicColor} />
            <Text style={styles.buttonName} numberOfLines={1}>
              {button.name}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Render Toggle Volume button with dynamic color and icon
    if (button.action_type === "volume_mute") {
      const isExecuting = executingId === button.id;
      const isVolumeMuted = metrics?.volume_muted ?? false;
      const dynamicColor = isVolumeMuted ? "#ef4444" : "#06b6d4"; // Red when muted, Cyan when on
      const dynamicIcon = isVolumeMuted ? "volume-x" : "volume-2"; // Dynamic icon based on volume state

      return (
        <View key={button.id} style={styles.buttonWrapper}>
          <TouchableOpacity
            onPress={() => handleExecuteAction(button.id)}
            style={[
              styles.actionButton,
              {
                backgroundColor: `${dynamicColor}15`,
                borderColor: dynamicColor,
                transform: [{ scale: isExecuting ? 0.9 : 1 }],
              },
            ]}
            activeOpacity={0.7}
          >
            <Feather name={dynamicIcon as any} size={20} color={dynamicColor} />
            <Text style={styles.buttonName} numberOfLines={1}>
              {button.name}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Render Volume control (knob or slider)
    if (button.action_type === "volume_knob") {
      const controlStyle = button.action_data?.control_style || "knob";
      const sliderDirection = (button.action_data?.slider_direction ||
        "horizontal") as "horizontal" | "vertical";

      return (
        <View key={button.id} style={styles.buttonWrapper}>
          {controlStyle === "slider" ? (
            <VolumeSliderButton
              value={metrics?.volume_level ?? 50}
              onChange={handleVolumeChange}
              color={button.color}
              name={button.name}
              direction={sliderDirection}
            />
          ) : (
            <VolumeKnobButton
              value={metrics?.volume_level ?? 50}
              onChange={handleVolumeChange}
              color={button.color}
              name={button.name}
            />
          )}
        </View>
      );
    }

    // Render Brightness control (knob or slider)
    if (button.action_type === "brightness_knob") {
      const controlStyle = button.action_data?.control_style || "knob";
      const sliderDirection = (button.action_data?.slider_direction ||
        "horizontal") as "horizontal" | "vertical";

      return (
        <View key={button.id} style={styles.buttonWrapper}>
          {controlStyle === "slider" ? (
            <BrightnessSliderButton
              value={metrics?.brightness_level ?? 50}
              onChange={handleBrightnessChange}
              color={button.color}
              name={button.name}
              direction={sliderDirection}
            />
          ) : (
            <BrightnessKnobButton
              value={metrics?.brightness_level ?? 50}
              onChange={handleBrightnessChange}
              color={button.color}
              name={button.name}
            />
          )}
        </View>
      );
    }

    // Render Media Play/Pause button with rich now playing info
    if (button.action_type === "media_play_pause") {
      const isExecuting = executingId === button.id;
      const mediaState = metrics?.media ?? {
        title: "",
        artist: "",
        status: "" as const,
        thumbnail: "",
      };

      return (
        <View key={button.id} style={styles.buttonWrapper}>
          <MediaPlayPauseButton
            media={mediaState}
            isExecuting={isExecuting}
            onPress={() => handleExecuteAction(button.id)}
          />
        </View>
      );
    }

    // Render Media Next/Prev buttons
    if (
      button.action_type === "media_next" ||
      button.action_type === "media_prev"
    ) {
      const isExecuting = executingId === button.id;
      const mediaColor = "#8b5cf6";
      const iconName =
        button.action_type === "media_next" ? "skip-forward" : "skip-back";

      return (
        <View key={button.id} style={styles.buttonWrapper}>
          <TouchableOpacity
            onPress={() => handleExecuteAction(button.id)}
            style={[
              styles.actionButton,
              {
                backgroundColor: `${mediaColor}15`,
                borderColor: mediaColor,
                transform: [{ scale: isExecuting ? 0.9 : 1 }],
              },
            ]}
            activeOpacity={0.7}
          >
            <Feather name={iconName as any} size={20} color={mediaColor} />
            <Text style={styles.buttonName} numberOfLines={1}>
              {button.name}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Render regular button
    const isExecuting = executingId === button.id;
    const iconName = normalizeIconName(button.icon);

    return (
      <View key={button.id} style={styles.buttonWrapper}>
        <TouchableOpacity
          onPress={() => handleExecuteAction(button.id)}
          style={[
            styles.actionButton,
            {
              backgroundColor: `${button.color}15`,
              borderColor: button.color,
              transform: [{ scale: isExecuting ? 0.9 : 1 }],
            },
          ]}
          activeOpacity={0.7}
        >
          <Feather name={iconName as any} size={20} color={button.color} />
          <Text style={styles.buttonName} numberOfLines={1}>
            {button.name}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

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

      {/* Button Grid */}
      {buttons.length === 0 ? (
        <EmptyState
          icon="grid"
          title="No buttons configured"
          subtitle="Use the desktop app to configure buttons"
        />
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.buttonGrid}
          showsVerticalScrollIndicator={false}
        >
          {buttons.map(renderButton)}
        </ScrollView>
      )}
    </View>
  );
}

const { width } = Dimensions.get("window");
const numColumns = width > 400 ? 4 : 3;
const buttonSize = (width - 32 - (numColumns - 1) * 8) / numColumns;

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
  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 8,
  },
  buttonWrapper: {
    width: buttonSize,
    aspectRatio: 1,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 6,
  },
  buttonName: {
    fontSize: 9,
    fontWeight: "500",
    color: "#ffffff",
    textAlign: "center",
    paddingHorizontal: 2,
  },
});
