import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Wifi, Copy, Check, RefreshCw, Smartphone } from 'lucide-react';
import { getServerInfo } from '../api';

export function ConnectionPage() {
  const [ipAddresses, setIpAddresses] = useState<string[]>([]);
  const [selectedIp, setSelectedIp] = useState<string>('');
  const [port, setPort] = useState<string>('8080');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = selectedIp ? `http://${selectedIp}:${port}` : '';

  useEffect(() => {
    fetchServerInfo();
  }, []);

  const fetchServerInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await getServerInfo();
      setIpAddresses(info.ip_addresses);
      setPort(info.port);
      // Select the first IP by default
      if (info.ip_addresses.length > 0) {
        setSelectedIp(info.ip_addresses[0]);
      }
    } catch (e) {
      console.error('Failed to fetch server info:', e);
      setError('Failed to fetch server info. Is the backend running?');
      // Fallback to localhost
      setIpAddresses(['localhost']);
      setSelectedIp('localhost');
    }
    setLoading(false);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(apiUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Connect Device</h1>
          <p className="text-gray-400 mt-1">Scan QR code to connect your mobile device</p>
        </div>
        <button
          onClick={fetchServerInfo}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-all"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
          {error}
        </div>
      )}

      {/* QR Code Card */}
      <div className="flex flex-col items-center">
        <div className="bg-gray-800/50 rounded-3xl p-8 border border-gray-700 max-w-md w-full">
          {/* QR Code */}
          <div className="flex justify-center mb-6">
            <div className="bg-white p-4 rounded-2xl shadow-2xl">
              {loading ? (
                <div className="w-48 h-48 flex items-center justify-center">
                  <RefreshCw size={40} className="text-gray-400 animate-spin" />
                </div>
              ) : (
                <QRCodeSVG
                  value={apiUrl}
                  size={192}
                  level="H"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              )}
            </div>
          </div>

          {/* IP Address Selection */}
          {ipAddresses.length > 1 && (
            <div className="mb-4">
              <label className="text-sm text-gray-400 block mb-2">Select IP Address</label>
              <select
                value={selectedIp}
                onChange={(e) => setSelectedIp(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              >
                {ipAddresses.map((ip) => (
                  <option key={ip} value={ip}>
                    {ip}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Connection URL */}
          <div className="space-y-3">
            <label className="text-sm text-gray-400 block text-center">Server URL</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 font-mono text-sm text-white text-center">
                {loading ? 'Loading...' : apiUrl}
              </div>
              <button
                onClick={copyToClipboard}
                disabled={loading}
                className="p-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 rounded-xl transition-colors"
              >
                {copied ? (
                  <Check size={20} className="text-white" />
                ) : (
                  <Copy size={20} className="text-white" />
                )}
              </button>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Smartphone size={20} className="text-blue-400" />
              </div>
              <div className="text-sm">
                <p className="text-blue-400 font-medium mb-1">How to connect:</p>
                <ol className="text-gray-400 space-y-1 list-decimal list-inside">
                  <li>Open the Stream Deck app on your phone</li>
                  <li>Scan this QR code or enter the URL manually</li>
                  <li>Make sure both devices are on the same network</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Network Info */}
      <div className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Wifi size={20} className="text-green-400" />
          </div>
          <div>
            <h3 className="font-medium text-white">Network Information</h3>
            <p className="text-sm text-gray-400">Your server is running on this address</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900/50 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">IP Address{ipAddresses.length > 1 ? 'es' : ''}</div>
            <div className="font-mono text-white">
              {loading ? '...' : ipAddresses.length > 1 ? (
                <div className="space-y-1">
                  {ipAddresses.map((ip, index) => (
                    <div 
                      key={ip} 
                      className={`${ip === selectedIp ? 'text-blue-400' : 'text-gray-400'}`}
                    >
                      {ip}
                      {ip === selectedIp && <span className="text-xs ml-2">(selected)</span>}
                    </div>
                  ))}
                </div>
              ) : selectedIp}
            </div>
          </div>
          <div className="bg-gray-900/50 rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Port</div>
            <div className="font-mono text-white">{port}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
