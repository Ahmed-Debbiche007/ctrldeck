import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { setApiBase, testConnection, getApiBase, isConfigured } from '@/api';

interface ConnectionSetupProps {
  onComplete: () => void;
  isBottomSheet?: boolean;
  onClose?: () => void;
  visible?: boolean;
}

export function ConnectionSetup({ 
  onComplete, 
  isBottomSheet = false, 
  onClose,
  visible = true 
}: ConnectionSetupProps) {
  const [url, setUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    loadCurrentUrl();
  }, []);

  const loadCurrentUrl = async () => {
    const configured = await isConfigured();
    if (configured) {
      const currentUrl = await getApiBase();
      setUrl(currentUrl);
    }
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);
    setTestResult(null);
    setError('');
  };

  const handleTestConnection = async () => {
    if (!url) {
      setError('Please enter a server URL');
      return;
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `http://${normalizedUrl}`;
    }
    normalizedUrl = normalizedUrl.replace(/\/$/, '');

    setTesting(true);
    setError('');
    setTestResult(null);

    const success = await testConnection(normalizedUrl);
    
    setTesting(false);
    setTestResult(success ? 'success' : 'error');
    
    if (!success) {
      setError('Could not connect. Check the URL and network.');
    }
  };

  const handleConnect = async () => {
    if (testResult !== 'success') {
      await handleTestConnection();
      return;
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `http://${normalizedUrl}`;
    }
    normalizedUrl = normalizedUrl.replace(/\/$/, '');

    await setApiBase(normalizedUrl);
    onComplete();
  };

  const handleSkip = async () => {
    await setApiBase('http://localhost:8080');
    onComplete();
  };

  const startScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        setError('Camera permission is required to scan QR codes');
        return;
      }
    }
    setShowScanner(true);
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setShowScanner(false);
    
    // Check if it's a valid URL
    if (data.includes('://') || data.match(/^\d+\.\d+\.\d+\.\d+/)) {
      handleUrlChange(data);
    } else {
      setError('Invalid QR code. Expected a server URL.');
    }
  };

  // QR Scanner Modal
  const renderScanner = () => (
    <Modal
      visible={showScanner}
      animationType="slide"
      onRequestClose={() => setShowScanner(false)}
    >
      <View style={styles.scannerContainer}>
        {/* Header */}
        <SafeAreaView edges={['top']} style={styles.scannerHeader}>
          <Text style={styles.scannerTitle}>Scan QR Code</Text>
          <TouchableOpacity
            onPress={() => setShowScanner(false)}
            style={styles.scannerCloseButton}
          >
            <Feather name="x" size={24} color="#ffffff" />
          </TouchableOpacity>
        </SafeAreaView>
        
        {/* Camera View */}
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={handleBarCodeScanned}
          />
          
          {/* Scan overlay */}
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame}>
              <View style={[styles.scanCorner, styles.topLeft]} />
              <View style={[styles.scanCorner, styles.topRight]} />
              <View style={[styles.scanCorner, styles.bottomLeft]} />
              <View style={[styles.scanCorner, styles.bottomRight]} />
            </View>
          </View>
        </View>
        
        {/* Instructions */}
        <SafeAreaView edges={['bottom']} style={styles.scannerFooter}>
          <Text style={styles.scannerInstruction}>
            Point your camera at the QR code on your desktop app
          </Text>
        </SafeAreaView>
      </View>
    </Modal>
  );

  // Connection form content
  const renderForm = () => (
    <View style={styles.form}>
      {/* Scan QR Button */}
      <TouchableOpacity
        onPress={startScanner}
        style={styles.scanButton}
      >
        <Feather name="camera" size={18} color="#ffffff" />
        <Text style={styles.scanButtonText}>Scan QR Code</Text>
      </TouchableOpacity>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or enter manually</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* URL Input */}
      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Server URL</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={handleUrlChange}
            placeholder="http://192.168.1.100:8080"
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          {testResult && (
            <View style={styles.inputIcon}>
              <Feather
                name={testResult === 'success' ? 'check-circle' : 'x-circle'}
                size={18}
                color={testResult === 'success' ? '#22c55e' : '#ef4444'}
              />
            </View>
          )}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      {/* Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          onPress={handleTestConnection}
          disabled={testing || !url}
          style={[
            styles.testButton,
            (!url || testing) && styles.buttonDisabled,
          ]}
        >
          {testing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Feather name="wifi" size={16} color="#ffffff" />
          )}
          <Text style={styles.testButtonText}>
            {testing ? 'Testing...' : 'Test'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleConnect}
          disabled={testing}
          style={[
            styles.connectButton,
            testResult === 'success' && styles.connectButtonSuccess,
          ]}
        >
          <Feather
            name={testResult === 'success' ? 'check-circle' : 'zap'}
            size={16}
            color="#ffffff"
          />
          <Text style={styles.connectButtonText}>
            Connect
          </Text>
        </TouchableOpacity>
      </View>

      {/* Skip option */}
      <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
        <Text style={styles.skipButtonText}>Use localhost instead</Text>
      </TouchableOpacity>
    </View>
  );

  // Bottom sheet modal
  if (isBottomSheet) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={onClose}
      >
        {renderScanner()}
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={onClose} 
          />
          <View style={styles.bottomSheet}>
            {/* Handle */}
            <TouchableOpacity onPress={onClose} style={styles.handleContainer}>
              <View style={styles.handle} />
            </TouchableOpacity>
            
            {/* Header */}
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.headerTitle}>Connection Settings</Text>
              {onClose && (
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Feather name="x" size={20} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Content */}
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.bottomSheetScrollContent}
            >
              {renderForm()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // Full screen setup
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {renderScanner()}
      <View style={styles.fullScreenContent}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Feather name="zap" size={32} color="#ffffff" />
          </View>
          <Text style={styles.appTitle}>CtrlDeck</Text>
          <Text style={styles.appSubtitle}>Press responsibly</Text>
        </View>

        {renderForm()}
      </View>
    </SafeAreaView>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  bottomSheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: '#1f2937',
    width: '100%',
    maxHeight: height * 0.85,
    paddingBottom: 24,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#4b5563',
    borderRadius: 2,
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  bottomSheetScrollContent: {
    padding: 16,
  },
  fullScreenContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#9ca3af',
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8b5cf6',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 16,
  },
  scanButtonText: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 14,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#374151',
  },
  dividerText: {
    color: '#6b7280',
    fontSize: 12,
    marginHorizontal: 12,
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 6,
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: 'rgba(31, 41, 55, 0.5)',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 40,
    color: '#ffffff',
    fontSize: 14,
  },
  inputIcon: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -9,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  testButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 10,
  },
  testButtonText: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 14,
  },
  connectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 10,
  },
  connectButtonSuccess: {
    backgroundColor: '#22c55e',
  },
  connectButtonText: {
    color: '#ffffff',
    fontWeight: '500',
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 12,
  },
  // Scanner styles
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
  },
  scannerTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },
  scannerCloseButton: {
    padding: 4,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 256,
    height: 256,
    position: 'relative',
  },
  scanCorner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#3b82f6',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  scannerFooter: {
    padding: 16,
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
  },
  scannerInstruction: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
  },
});
