import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { View, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import PagerView from 'react-native-pager-view';
import { ActionsScreen } from '@/screens/ActionsScreen';
import { MetricsScreen } from '@/screens/MetricsScreen';
import { ConnectionSetup } from '@/screens/ConnectionSetup';
import { DisconnectedOverlay } from '@/components/fallback';
import { initializeApi, isConfigured, getApiBase, connectWebSocket } from '@/api';

// Context for WebSocket connection state
interface ConnectionContextType {
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
}

const ConnectionContext = createContext<ConnectionContextType>({
  wsConnected: false,
  setWsConnected: () => {},
});

export const useConnection = () => useContext(ConnectionContext);

type Page = 'buttons' | 'metrics';

export default function App() {
  const [currentPage, setCurrentPage] = useState(0);
  const [connected, setConnected] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const pagerRef = useRef<PagerView>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const pages: { id: Page; label: string }[] = [
    { id: 'buttons', label: 'Buttons' },
    { id: 'metrics', label: 'Metrics' },
  ];

  useEffect(() => {
    initializeApp();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Start WebSocket connection when initial connection is established
  useEffect(() => {
    if (connected && !isLoading) {
      startWebSocketConnection();
    }
  }, [connected, isLoading]);

  const initializeApp = async () => {
    try {
      await initializeApi();
      const configured = await isConfigured();
      
      if (!configured) {
        setShowSettings(true);
      } else {
        await checkConnection();
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startWebSocketConnection = async () => {
    try {
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      wsRef.current = await connectWebSocket(
        () => {
          // On metrics update - connection is healthy
          setWsConnected(true);
        },
        () => {
          // On disconnect
          setWsConnected(false);
          // Auto-retry after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            startWebSocketConnection();
          }, 3000);
        }
      );

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
      };
      
      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setWsConnected(false);
      };
      
      wsRef.current.onerror = () => {
        console.log('WebSocket error');
        setWsConnected(false);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setWsConnected(false);
    }
  };

  const handleRetryConnection = async () => {
    setIsRetrying(true);
    try {
      // Clear any pending reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      // First check if server is reachable
      const configured = await isConfigured();
      if (!configured) {
        setIsRetrying(false);
        return;
      }
      
      const apiBase = await getApiBase();
      
      // Create abort controller for fetch timeout
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 5000);
      
      let res;
      try {
        res = await fetch(`${apiBase}/api/buttons`, { 
          signal: controller.signal 
        });
      } catch (fetchError) {
        clearTimeout(fetchTimeout);
        console.log('HTTP check failed:', fetchError);
        setIsRetrying(false);
        return;
      }
      clearTimeout(fetchTimeout);
      
      if (!res.ok) {
        console.log('HTTP check failed');
        setIsRetrying(false);
        return;
      }
      
      // HTTP check passed, now try WebSocket with timeout
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      // Create a promise that resolves when WebSocket connects or rejects on timeout/error
      const connectionResult = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          console.log('WebSocket connection timeout');
          resolve(false);
        }, 5000);
        
        connectWebSocket(
          () => {
            // On metrics update - connection is healthy
            setWsConnected(true);
          },
          () => {
            // On disconnect
            setWsConnected(false);
            clearTimeout(timeout);
            resolve(false);
          }
        ).then((ws) => {
          wsRef.current = ws;
          
          ws.onopen = () => {
            console.log('WebSocket connected');
            clearTimeout(timeout);
            setWsConnected(true);
            resolve(true);
          };
          
          ws.onclose = () => {
            console.log('WebSocket disconnected');
            setWsConnected(false);
          };
          
          ws.onerror = () => {
            console.log('WebSocket error');
            clearTimeout(timeout);
            setWsConnected(false);
            resolve(false);
          };
        }).catch(() => {
          clearTimeout(timeout);
          resolve(false);
        });
      });
      
      if (connectionResult) {
        setConnected(true);
      }
      
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const checkConnection = async () => {
    const configured = await isConfigured();
    if (!configured) {
      setConnected(false);
      return;
    }
    
    try {
      const apiBase = await getApiBase();
      const res = await fetch(`${apiBase}/api/buttons`);
      setConnected(res.ok);
    } catch {
      setConnected(false);
    }
  };

  const handleConnectionComplete = () => {
    setShowSettings(false);
    checkConnection();
  };

  const onPageSelected = (event: any) => {
    setCurrentPage(event.nativeEvent.position);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar hidden={true} />
      </View>
    );
  }

  // Show full-screen connection setup if not configured
  if (!connected && !isLoading && showSettings) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar hidden={true} />
        <ConnectionSetup onComplete={handleConnectionComplete} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar hidden={true} />
      
      {/* Pager View for swipeable pages */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={onPageSelected}
      >
        {/* Actions Page */}
        <View key="1" style={styles.page}>
          <ActionsScreen onSettingsClick={() => setShowSettings(true)} />
        </View>
        
        {/* Metrics Page */}
        <View key="2" style={styles.page}>
          <MetricsScreen onSettingsClick={() => setShowSettings(true)} />
        </View>
      </PagerView>

      {/* Bottom Page Indicators */}
      <View style={styles.indicatorContainer}>
        <View style={styles.indicatorWrapper}>
          {/* Page dots */}
          <View style={styles.dotsContainer}>
            {pages.map((page, index) => (
              <TouchableOpacity
                key={page.id}
                onPress={() => pagerRef.current?.setPage(index)}
                style={[
                  styles.dot,
                  currentPage === index && styles.dotActive,
                ]}
              />
            ))}
          </View>
          
          {/* Swipe handle */}
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            style={styles.swipeHandle}
          >
            <View style={styles.handleBar} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Settings Bottom Sheet */}
      <ConnectionSetup
        visible={showSettings}
        isBottomSheet={true}
        onComplete={handleConnectionComplete}
        onClose={() => setShowSettings(false)}
      />

      {/* Disconnected Overlay - shows when WebSocket is not connected */}
      {connected && !wsConnected && !showSettings && (
        <DisconnectedOverlay
          onRetry={handleRetryConnection}
          onSettings={() => setShowSettings(true)}
          isRetrying={isRetrying}
        />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#030712',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  indicatorContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 4,
    alignItems: 'center',
  },
  indicatorWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4b5563',
  },
  dotActive: {
    width: 16,
    backgroundColor: '#3b82f6',
  },
  swipeHandle: {
    padding: 4,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#4b5563',
    borderRadius: 2,
    opacity: 0.5,
  },
});
