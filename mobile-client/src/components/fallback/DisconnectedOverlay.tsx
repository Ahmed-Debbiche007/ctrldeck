import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface DisconnectedOverlayProps {
  onRetry: () => void;
  onSettings: () => void;
  isRetrying: boolean;
}

export function DisconnectedOverlay({ 
  onRetry, 
  onSettings, 
  isRetrying 
}: DisconnectedOverlayProps) {
  return (
    <View style={styles.overlay}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Feather name="wifi-off" size={48} color="#ef4444" />
        </View>
        <Text style={styles.title}>Connection Lost</Text>
        <Text style={styles.message}>
          Unable to connect to the server. Please check that the server is running and you're on the same network.
        </Text>
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.retryButton, isRetrying && styles.retryButtonDisabled]}
            onPress={onRetry}
            disabled={isRetrying}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Feather name="refresh-cw" size={18} color="#ffffff" />
                <Text style={styles.retryButtonText}>Retry Connection</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsButton} onPress={onSettings}>
            <Feather name="settings" size={18} color="#9ca3af" />
            <Text style={styles.settingsButtonText}>Connection Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(3, 7, 18, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 100,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  buttons: {
    width: '100%',
    gap: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
  },
  retryButtonDisabled: {
    opacity: 0.6,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(75, 85, 99, 0.3)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
  },
  settingsButtonText: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '500',
  },
});
