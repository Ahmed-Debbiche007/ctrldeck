import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import type { MediaState } from "@/types";

const { width } = Dimensions.get("window");
const numColumns = width > 400 ? 4 : 3;
const buttonSize = (width - 32 - (numColumns - 1) * 8) / numColumns;

interface MediaPlayPauseButtonProps {
  media: MediaState;
  isExecuting: boolean;
  onPress: () => void;
}

export function MediaPlayPauseButton({
  media,
  isExecuting,
  onPress,
}: MediaPlayPauseButtonProps) {
  const isPaused = media.status === "Paused";
  const isStopped =
    media.status === "Stopped" || media.status === "" || !media.title;
  const hasArtwork = media.thumbnail && media.thumbnail.length > 0;

  const defaultColor = "#8b5cf6";

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.container,
        {
          transform: [{ scale: isExecuting ? 0.9 : 1 }],
        },
      ]}
      activeOpacity={0.7}
    >
      {/* Background - Album Art or Default */}
      {hasArtwork ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${media.thumbnail}` }}
          style={styles.albumArt}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.defaultBackground,
            {
              backgroundColor: `${defaultColor}22`,
              borderColor: defaultColor,
            },
          ]}
        >
          <Feather name="music" size={28} color={defaultColor} />
        </View>
      )}

      {/* Gradient overlay */}
      <View style={styles.gradientOverlay} />

      {/* Paused Overlay */}
      {isPaused && !isStopped && (
        <View style={styles.pausedOverlay}>
          <View style={styles.pauseIconContainer}>
            <Feather name="pause" size={24} color="#ffffff" />
          </View>
        </View>
      )}

      {/* Stopped/No Media State */}
      {isStopped && (
        <View style={styles.stoppedOverlay}>
          <Feather name="music" size={20} color="#9ca3af" />
          <Text style={styles.noMediaText}>No media</Text>
        </View>
      )}

      {/* Text Content - Title & Artist */}
      {!isStopped && (
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {media.title || "Unknown"}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {media.artist || "Unknown Artist"}
          </Text>
        </View>
      )}

      {/* Playing indicator */}
      {media.status === "Playing" && (
        <View style={styles.playingIndicator}>
          <View style={[styles.bar, styles.bar1]} />
          <View style={[styles.bar, styles.bar2]} />
          <View style={[styles.bar, styles.bar3]} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  albumArt: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  defaultBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  gradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    // Simulating gradient with a semi-transparent overlay at bottom
  },
  pausedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  pauseIconContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 25,
    padding: 10,
  },
  stoppedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  noMediaText: {
    color: "#9ca3af",
    fontSize: 8,
    marginTop: 2,
  },
  textContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 6,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  title: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "600",
    lineHeight: 11,
  },
  artist: {
    color: "#d1d5db",
    fontSize: 7,
    lineHeight: 9,
  },
  playingIndicator: {
    position: "absolute",
    top: 4,
    right: 4,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 1,
  },
  bar: {
    width: 2,
    backgroundColor: "#4ade80",
    borderRadius: 1,
  },
  bar1: {
    height: 8,
  },
  bar2: {
    height: 12,
  },
  bar3: {
    height: 6,
  },
});
