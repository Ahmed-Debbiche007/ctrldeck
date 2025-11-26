import React, { useState, useRef, useEffect } from 'react';
import { Zap, Wifi, CheckCircle, XCircle, Loader2, QrCode, X, Camera, ScanLine } from 'lucide-react';
import { setApiBase, testConnection, getApiBase, isConfigured } from '../api';

interface ConnectionSetupProps {
  onComplete: () => void;
  isBottomSheet?: boolean;
  onClose?: () => void;
}

export function ConnectionSetup({ onComplete, isBottomSheet = false, onClose }: ConnectionSetupProps) {
  const [url, setUrl] = useState(isConfigured() ? getApiBase() : '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [error, setError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  const handleConnect = () => {
    if (testResult !== 'success') {
      handleTestConnection();
      return;
    }

    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `http://${normalizedUrl}`;
    }
    normalizedUrl = normalizedUrl.replace(/\/$/, '');

    setApiBase(normalizedUrl);
    onComplete();
  };

  const handleSkip = () => {
    setApiBase('http://localhost:8080');
    onComplete();
  };

  const startScanner = async () => {
    setShowScanner(true);
    setScanning(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      
      // Start scanning for QR codes
      scanQRCode();
    } catch (err) {
      console.error('Camera error:', err);
      setError('Could not access camera');
      setShowScanner(false);
      setScanning(false);
    }
  };

  const stopScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowScanner(false);
    setScanning(false);
  };

  const scanQRCode = () => {
    if (!videoRef.current || !scanning) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const scan = () => {
      if (!scanning || !videoRef.current) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Try to detect QR code using BarcodeDetector API if available
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          barcodeDetector.detect(imageData)
            .then((barcodes: any[]) => {
              if (barcodes.length > 0) {
                const qrData = barcodes[0].rawValue;
                handleQRCodeDetected(qrData);
              } else {
                requestAnimationFrame(scan);
              }
            })
            .catch(() => {
              requestAnimationFrame(scan);
            });
        } else {
          // BarcodeDetector not available, continue scanning
          requestAnimationFrame(scan);
        }
      } else {
        requestAnimationFrame(scan);
      }
    };

    requestAnimationFrame(scan);
  };

  const handleQRCodeDetected = (data: string) => {
    stopScanner();
    
    // Check if it's a valid URL
    if (data.includes('://') || data.match(/^\d+\.\d+\.\d+\.\d+/)) {
      handleUrlChange(data);
      // Auto-test the connection
      setTimeout(() => {
        setUrl(data);
      }, 100);
    } else {
      setError('Invalid QR code. Expected a server URL.');
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // QR Scanner Modal
  const renderScanner = () => (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900/80">
        <h3 className="text-white font-medium">Scan QR Code</h3>
        <button
          onClick={stopScanner}
          className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <X size={24} className="text-white" />
        </button>
      </div>
      
      {/* Camera View */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        
        {/* Scan overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-64 h-64 relative">
            {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-lg" />
            
            {/* Scanning line animation */}
            <div className="absolute inset-x-4 top-4 h-0.5 bg-blue-500 animate-scan-line" />
          </div>
        </div>
        
        {/* Darkened overlay outside scan area */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-black/50" style={{
            clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, calc(50% - 128px) calc(50% - 128px), calc(50% - 128px) calc(50% + 128px), calc(50% + 128px) calc(50% + 128px), calc(50% + 128px) calc(50% - 128px), calc(50% - 128px) calc(50% - 128px))'
          }} />
        </div>
      </div>
      
      {/* Instructions */}
      <div className="p-4 bg-gray-900/80 text-center">
        <p className="text-gray-400 text-sm">
          Point your camera at the QR code on your desktop app
        </p>
      </div>
    </div>
  );

  // Bottom sheet layout
  if (isBottomSheet) {
    return (
      <>
        {showScanner && renderScanner()}
        <div className="p-4 pb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Connection Settings</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            )}
          </div>

          {/* Connection Form */}
          <div className="space-y-3">
            {/* Scan QR Button */}
            <button
              onClick={startScanner}
              className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium text-sm transition-colors"
            >
              <QrCode size={18} />
              <span>Scan QR Code</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-gray-500 text-xs">or enter manually</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            {/* URL Input */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Server URL</label>
              <div className="relative">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="http://192.168.1.100:8080"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                {testResult && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {testResult === 'success' ? (
                      <CheckCircle size={18} className="text-green-400" />
                    ) : (
                      <XCircle size={18} className="text-red-400" />
                    )}
                  </div>
                )}
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleTestConnection}
                disabled={testing || !url}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 disabled:text-gray-500 text-white rounded-lg font-medium text-sm transition-colors"
              >
                {testing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Wifi size={16} />
                )}
                <span>{testing ? 'Testing...' : 'Test'}</span>
              </button>

              <button
                onClick={handleConnect}
                disabled={testing}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-medium text-sm transition-all ${
                  testResult === 'success'
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {testResult === 'success' ? (
                  <>
                    <CheckCircle size={16} />
                    <span>Connect</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    <span>Connect</span>
                  </>
                )}
              </button>
            </div>

            {/* Skip option */}
            <button
              onClick={handleSkip}
              className="w-full text-gray-500 hover:text-gray-400 text-xs py-2 transition-colors"
            >
              Use localhost instead
            </button>
          </div>
        </div>
      </>
    );
  }

  // Full screen layout (initial setup)
  return (
    <>
      {showScanner && renderScanner()}
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4 safe-area-top safe-area-bottom">
        {/* Logo */}
        <div className="mb-6">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/30">
            <Zap size={32} className="text-white" />
          </div>
        </div>

        <h1 className="text-xl font-bold text-white mb-1">Stream Deck</h1>
        <p className="text-gray-400 text-center text-sm mb-6">Connect to your server</p>

        {/* Connection Form */}
        <div className="w-full max-w-sm space-y-3">
          {/* Scan QR Button */}
          <button
            onClick={startScanner}
            className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <QrCode size={18} />
            <span>Scan QR Code</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-gray-500 text-xs">or enter manually</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* URL Input */}
          <div className="space-y-1.5">
            <label className="text-xs text-gray-400">Server URL</label>
            <div className="relative">
              <input
                type="url"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="http://192.168.1.100:8080"
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {testResult && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {testResult === 'success' ? (
                    <CheckCircle size={18} className="text-green-400" />
                  ) : (
                    <XCircle size={18} className="text-red-400" />
                  )}
                </div>
              )}
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          {/* Buttons */}
          <button
            onClick={handleTestConnection}
            disabled={testing || !url}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 disabled:text-gray-500 text-white rounded-lg font-medium text-sm transition-colors"
          >
            {testing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Testing...</span>
              </>
            ) : (
              <>
                <Wifi size={16} />
                <span>Test Connection</span>
              </>
            )}
          </button>

          <button
            onClick={handleConnect}
            disabled={testing}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg font-medium text-sm transition-all ${
              testResult === 'success'
                ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/25'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25'
            }`}
          >
            {testResult === 'success' ? (
              <>
                <CheckCircle size={16} />
                <span>Connect</span>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>Test & Connect</span>
              </>
            )}
          </button>

          {/* Skip option */}
          <button
            onClick={handleSkip}
            className="w-full text-gray-500 hover:text-gray-400 text-xs py-2 transition-colors"
          >
            Skip (use localhost)
          </button>
        </div>
      </div>
    </>
  );
}
