import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { runOnJS } from "react-native-worklets";
import Svg, { Circle } from "react-native-svg";

interface BrightnessKnobButtonProps {
  value: number;
  onChange: (value: number) => void;
  color: string;
  name: string;
}

export function BrightnessKnobButton({
  value,
  onChange,
  color,
  name,
}: BrightnessKnobButtonProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const knobRef = useRef<View>(null);
  const knobLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Update local value when prop changes (for real-time updates from WebSocket)
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  const calculateValueFromPosition = useCallback(
    (absoluteX: number, absoluteY: number) => {
      const { x, y, width, height } = knobLayout.current;
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      // Calculate angle from center
      const angleRad = Math.atan2(absoluteY - centerY, absoluteX - centerX);
      let angleDeg = angleRad * (180 / Math.PI);

      // Shift so 0° is at top
      angleDeg = angleDeg + 90;

      // Normalize to 0-360 range
      if (angleDeg < 0) angleDeg += 360;

      // Map the angle to a value
      let normalizedAngle;
      if (angleDeg >= 225) {
        normalizedAngle = angleDeg - 225;
      } else if (angleDeg <= 45) {
        normalizedAngle = angleDeg + 135;
      } else {
        if (angleDeg < 135) {
          normalizedAngle = 270;
        } else {
          normalizedAngle = 0;
        }
      }

      let newValue = Math.round((normalizedAngle / 270) * 100);
      newValue = Math.max(0, Math.min(100, newValue));

      return newValue;
    },
    []
  );

  const handleGestureUpdate = useCallback(
    (absoluteX: number, absoluteY: number) => {
      const newValue = calculateValueFromPosition(absoluteX, absoluteY);
      setLocalValue(newValue);
      onChange(newValue);
    },
    [calculateValueFromPosition, onChange]
  );

  const handleGestureBegin = useCallback(() => {
    setIsDragging(true);
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();

    // Measure the knob position
    knobRef.current?.measureInWindow(
      (x: number, y: number, width: number, height: number) => {
        knobLayout.current = { x, y, width, height };
      }
    );
  }, [scaleAnim]);

  const handleGestureEnd = useCallback(() => {
    setIsDragging(false);
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      runOnJS(handleGestureBegin)();
    })
    .onUpdate((event) => {
      runOnJS(handleGestureUpdate)(event.absoluteX, event.absoluteY);
    })
    .onEnd(() => {
      runOnJS(handleGestureEnd)();
    })
    .onFinalize(() => {
      runOnJS(handleGestureEnd)();
    });

  // Display value
  const displayValue = isDragging ? localValue : value;

  // Knob rotation: 0% = -135deg, 100% = 135deg (270 degree range)
  const rotation = (displayValue / 100) * 270 - 135;

  // Calculate arc for the progress indicator
  const size = 80;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270 degrees
  const progress = (displayValue / 100) * arcLength;

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          ref={knobRef as any}
          style={[
            styles.container,
            {
              backgroundColor: `${color}10`,
              borderColor: color,
              shadowColor: color,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Mini Knob SVG */}
          <View style={styles.knobWrapper}>
            <Svg width={size} height={size} style={styles.svgAbsolute}>
              {/* Background track */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#374151"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${arcLength} ${circumference}`}
                rotation={135}
                origin={`${size / 2}, ${size / 2}`}
              />
              {/* Progress track */}
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${progress} ${circumference}`}
                rotation={135}
                origin={`${size / 2}, ${size / 2}`}
              />
            </Svg>

            {/* Center knob with indicator */}
            <View style={styles.centerKnob}>
              <View
                style={[
                  styles.indicatorWrapper,
                  { transform: [{ rotate: `${rotation}deg` }] },
                ]}
              >
                <View style={[styles.indicator, { backgroundColor: color }]} />
              </View>
            </View>
          </View>

          {/* Value display */}
          <Text style={styles.valueText}>{displayValue}%</Text>

          {/* Name */}
          <Text style={styles.nameText} numberOfLines={1}>
            {name}
          </Text>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    aspectRatio: 1,
  },
  container: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    gap: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  knobWrapper: {
    width: 80,
    height: 80,
    position: "relative",
  },
  svgAbsolute: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  centerKnob: {
    position: "absolute",
    top: "15%",
    left: "15%",
    width: "70%",
    height: "70%",
    borderRadius: 100,
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  indicatorWrapper: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  indicator: {
    position: "absolute",
    top: "12%",
    left: "50%",
    width: 3,
    height: "20%",
    borderRadius: 1.5,
    marginLeft: -1.5,
  },
  valueText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#ffffff",
  },
  nameText: {
    fontSize: 8,
    fontWeight: "500",
    color: "#ffffff",
    opacity: 0.7,
    textAlign: "center",
    paddingHorizontal: 2,
  },
});
