import { useState, useEffect, useRef } from 'react';
import { X, MapPin, Navigation, RotateCcw, Check, Loader2, AlertCircle } from 'lucide-react';
import {
  getLocationSettings,
  setLocation,
  clearLocation,
  requestBrowserLocation,
  reverseGeocode,
  type LocationSettings,
} from '../api';

// Leaflet imports will be loaded dynamically
let L: typeof import('leaflet') | null = null;

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationChanged: () => void;
}

export function LocationModal({ isOpen, onClose, onLocationChanged }: LocationModalProps) {
  const [currentSettings, setCurrentSettings] = useState<LocationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Map state
  const [selectedLat, setSelectedLat] = useState<number>(36.8065); // Default: Tunis
  const [selectedLng, setSelectedLng] = useState<number>(10.1815);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [mapReady, setMapReady] = useState(false);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Load current location settings
  useEffect(() => {
    if (isOpen) {
      loadLocationSettings();
    }
  }, [isOpen]);

  // Initialize map when modal opens
  useEffect(() => {
    if (isOpen && mapContainerRef.current && !mapRef.current) {
      initializeMap();
    }
    
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [isOpen]);

  // Update marker when coordinates change
  useEffect(() => {
    if (mapRef.current && markerRef.current && mapReady) {
      markerRef.current.setLatLng([selectedLat, selectedLng]);
      mapRef.current.setView([selectedLat, selectedLng], mapRef.current.getZoom());
    }
  }, [selectedLat, selectedLng, mapReady]);

  const initializeMap = async () => {
    if (!mapContainerRef.current) return;

    try {
      // Dynamically import Leaflet
      if (!L) {
        L = await import('leaflet');
        // Import CSS
        await import('leaflet/dist/leaflet.css');
        
        // Fix marker icon issue
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });
      }

      // Create map
      const map = L.map(mapContainerRef.current).setView([selectedLat, selectedLng], 10);

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);

      // Add marker
      const marker = L.marker([selectedLat, selectedLng], { draggable: true }).addTo(map);

      // Handle marker drag
      marker.on('dragend', async () => {
        const pos = marker.getLatLng();
        setSelectedLat(pos.lat);
        setSelectedLng(pos.lng);
        
        // Get city name
        const city = await reverseGeocode(pos.lat, pos.lng);
        setSelectedCity(city);
      });

      // Handle map click
      map.on('click', async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        setSelectedLat(lat);
        setSelectedLng(lng);
        marker.setLatLng([lat, lng]);
        
        // Get city name
        const city = await reverseGeocode(lat, lng);
        setSelectedCity(city);
      });

      mapRef.current = map;
      markerRef.current = marker;
      setMapReady(true);

      // Force a resize after a small delay to ensure proper rendering
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    } catch (err) {
      console.error('Failed to initialize map:', err);
      setError('Failed to load map');
    }
  };

  const loadLocationSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const settings = await getLocationSettings();
      setCurrentSettings(settings);
      
      // If we have saved coordinates, use them
      if (settings.latitude && settings.longitude) {
        setSelectedLat(settings.latitude);
        setSelectedLng(settings.longitude);
        setSelectedCity(settings.city || '');
        
        // Update map view if ready
        if (mapRef.current && markerRef.current) {
          mapRef.current.setView([settings.latitude, settings.longitude], 10);
          markerRef.current.setLatLng([settings.latitude, settings.longitude]);
        }
      }
    } catch (err) {
      setError('Failed to load location settings');
    } finally {
      setLoading(false);
    }
  };

  const handleUseBrowserLocation = async () => {
    try {
      setGettingLocation(true);
      setError(null);
      setSuccess(null);
      
      const coords = await requestBrowserLocation();
      const city = await reverseGeocode(coords.latitude, coords.longitude);
      
      // Update map
      setSelectedLat(coords.latitude);
      setSelectedLng(coords.longitude);
      setSelectedCity(city);
      
      // Save to backend
      await setLocation(coords.latitude, coords.longitude, city, 'browser');
      
      setSuccess('Location updated from browser');
      onLocationChanged();
      await loadLocationSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get browser location');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSaveManualLocation = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      // Get city name if not set
      let city = selectedCity;
      if (!city) {
        city = await reverseGeocode(selectedLat, selectedLng);
        setSelectedCity(city);
      }
      
      await setLocation(selectedLat, selectedLng, city, 'manual');
      
      setSuccess('Location saved successfully');
      onLocationChanged();
      await loadLocationSettings();
    } catch (err) {
      setError('Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  const handleClearLocation = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      await clearLocation();
      
      setSuccess('Location cleared, using IP-based detection');
      onLocationChanged();
      await loadLocationSettings();
    } catch (err) {
      setError('Failed to clear location');
    } finally {
      setSaving(false);
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'manual':
        return 'Manual (Map)';
      case 'browser':
        return 'Browser Geolocation';
      case 'ip':
        return 'IP-based (Auto)';
      default:
        return source;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/20">
              <MapPin className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Weather Location</h2>
              <p className="text-sm text-gray-400">Set your location for accurate weather data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Current Status */}
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
            </div>
          ) : currentSettings && (
            <div className="bg-gray-800/50 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-2">Current Location Source</h3>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  currentSettings.source === 'manual' ? 'bg-purple-500/20 text-purple-400' :
                  currentSettings.source === 'browser' ? 'bg-green-500/20 text-green-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {getSourceLabel(currentSettings.source)}
                </span>
                {currentSettings.city && (
                  <span className="text-sm text-gray-400">• {currentSettings.city}</span>
                )}
              </div>
            </div>
          )}

          {/* Browser Location Button */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Automatic Location</h3>
            <button
              onClick={handleUseBrowserLocation}
              disabled={gettingLocation}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-sky-500/20 text-sky-400 hover:bg-sky-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {gettingLocation ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Getting location...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-5 h-5" />
                  <span>Use My Current Location</span>
                </>
              )}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              This will request permission to access your device's location. Updated hourly.
            </p>
          </div>

          {/* Manual Location Map */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Manual Location</h3>
            <p className="text-xs text-gray-500 mb-3">
              Click on the map or drag the marker to select your location.
            </p>
            
            {/* Map Container */}
            <div 
              ref={mapContainerRef}
              className="w-full h-64 rounded-lg overflow-hidden bg-gray-900"
              style={{ minHeight: '256px' }}
            />

            {/* Coordinates Display */}
            <div className="mt-3 flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs text-gray-500">Latitude</label>
                <input
                  type="number"
                  value={selectedLat.toFixed(4)}
                  onChange={(e) => setSelectedLat(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                  step="0.0001"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500">Longitude</label>
                <input
                  type="number"
                  value={selectedLng.toFixed(4)}
                  onChange={(e) => setSelectedLng(parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                  step="0.0001"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500">City</label>
                <input
                  type="text"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  placeholder="Auto-detected"
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <button
              onClick={handleSaveManualLocation}
              disabled={saving}
              className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>Save This Location</span>
                </>
              )}
            </button>
          </div>

          {/* Reset to IP-based */}
          <div className="bg-gray-800/50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Reset Location</h3>
            <button
              onClick={handleClearLocation}
              disabled={saving || currentSettings?.source === 'ip'}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gray-700/50 text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-5 h-5" />
              <span>Reset to IP-based Detection</span>
            </button>
            <p className="text-xs text-gray-500 mt-2">
              Clear saved location and use automatic IP-based geolocation.
            </p>
          </div>

          {/* Messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 text-red-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/20 text-green-400">
              <Check className="w-5 h-5 shrink-0" />
              <span className="text-sm">{success}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
