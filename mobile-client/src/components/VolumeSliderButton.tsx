import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-worklets';

interface VolumeSliderButtonProps {
  value: number;
  onChange: (value: number) => void;
  color: string;
  name: string;
  direction: 'horizontal' | 'vertical';
}

export function VolumeSliderButton({ value, onChange, color, name, direction }: VolumeSliderButtonProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const sliderRef = useRef<View>(null);
  const sliderLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Update local value when prop changes (for real-time updates from WebSocket)
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  const calculateValueFromPosition = useCallback((absoluteX: number, absoluteY: number) => {
    const { x, y, width, height } = sliderLayout.current;
    let percentage: number;

    if (direction === 'horizontal') {
      const relativeX = absoluteX - x;
      percentage = (relativeX / width) * 100;
    } else {
      // Vertical: top = 100%, bottom = 0%
      const relativeY = absoluteY - y;
      percentage = 100 - (relativeY / height) * 100;
    }

    return Math.max(0, Math.min(100, Math.round(percentage)));
  }, [direction]);

  const handleGestureUpdate = useCallback((absoluteX: number, absoluteY: number) => {
    const newValue = calculateValueFromPosition(absoluteX, absoluteY);
    setLocalValue(newValue);
    onChange(newValue);
  }, [calculateValueFromPosition, onChange]);

  const handleGestureBegin = useCallback(() => {
    setIsDragging(true);
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
    
    // Measure the slider position
    sliderRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
      sliderLayout.current = { x, y, width, height };
    });
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

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <GestureDetector gesture={panGesture}>
        <Animated.View
          ref={sliderRef as any}
          style={[
            styles.container,
            {
              borderColor: color,
              shadowColor: color,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Filled portion */}
          <View
            style={[
              styles.filledPortion,
              {
                backgroundColor: `${color}66`,
                shadowColor: color,
              },
              direction === 'horizontal'
                ? {
                    width: `${displayValue}%` as any,
                    height: '100%',
                    left: 0,
                    top: 0,
                  }
                : {
                    width: '100%',
                    height: `${displayValue}%` as any,
                    left: 0,
                    bottom: 0,
                  },
            ]}
          />

          {/* Center content overlay */}
          <View style={styles.contentOverlay}>
            <Text style={styles.valueText}>
              {displayValue}%
            </Text>
            <Text style={styles.nameText} numberOfLines={1}>
              {name}
            </Text>
          </View>
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
    backgroundColor: '#1f2937',
    overflow: 'hidden',
    position: 'relative',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  filledPortion: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  contentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  nameText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
    paddingHorizontal: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
