import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import type { Button, ActionType, InstalledApp, Script } from '../types';
import { IconPicker, getIconComponent } from './IconPicker';
import { getApps, searchApps, getScripts } from '../api';

interface ButtonEditorProps {
  button?: Button;
  onSave: (button: Omit<Button, 'id'>) => void;
  onUpdate: (button: Button) => void;
  onClose: () => void;
}

const actionTypes: { value: ActionType; label: string; description: string }[] = [
  { value: 'mute_mic', label: 'Toggle Mic', description: 'Toggle microphone on/off' },
  { value: 'volume_up', label: 'Volume Up', description: 'Increase system volume' },
  { value: 'volume_down', label: 'Volume Down', description: 'Decrease system volume' },
  { value: 'volume_mute', label: 'Toggle Volume', description: 'Toggle volume on/off' },
  { value: 'volume_knob', label: 'Volume Knob', description: 'Interactive volume control' },
  { value: 'brightness_knob', label: 'Brightness Knob', description: 'Interactive brightness control' },
  { value: 'launch_app', label: 'Launch App', description: 'Open an application' },
  { value: 'run_script', label: 'Run Script', description: 'Execute a custom script' },
  { value: 'open_url', label: 'Open URL', description: 'Open a website' },
];

const colorPresets = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
];

// Get default icon and color for action types
function getDefaultsForActionType(actionType: ActionType): { icon: string; color: string } {
  switch (actionType) {
    case 'mute_mic':
      return { icon: 'mic', color: '#22c55e' };
    case 'volume_mute':
      return { icon: 'volume-2', color: '#06b6d4' };
    default:
      return { icon: 'circle', color: '#3b82f6' };
  }
}

export function ButtonEditor({ button, onSave, onUpdate, onClose }: ButtonEditorProps) {
  const initialActionType = button?.action_type || 'mute_mic';
  const defaults = getDefaultsForActionType(initialActionType);
  
  const [name, setName] = useState(button?.name || '');
  const [icon, setIcon] = useState(button?.icon || defaults.icon);
  const [actionType, setActionType] = useState<ActionType>(initialActionType);
  const [actionData, setActionData] = useState<Record<string, string>>(button?.action_data || {});
  const [color, setColor] = useState(button?.color || defaults.color);
  const position = button?.position || 0;
  
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [appSearch, setAppSearch] = useState('');
  const [filteredApps, setFilteredApps] = useState<InstalledApp[]>([]);

  useEffect(() => {
    loadApps();
    loadScripts();
  }, []);

  useEffect(() => {
    if (appSearch) {
      searchApps(appSearch).then(setFilteredApps);
    } else {
      setFilteredApps(apps.slice(0, 20));
    }
  }, [appSearch, apps]);

  const loadApps = async () => {
    try {
      const data = await getApps();
      setApps(data || []);
      setFilteredApps((data || []).slice(0, 20));
    } catch (e) {
      console.error('Failed to load apps:', e);
    }
  };

  const loadScripts = async () => {
    try {
      const data = await getScripts();
      setScripts(data || []);
    } catch (e) {
      console.error('Failed to load scripts:', e);
    }
  };

  const handleSave = () => {
    if (button) {
      // Update existing button
      onUpdate({
        id: button.id,
        name,
        icon,
        action_type: actionType,
        action_data: actionData,
        position,
        color,
      });
    } else {
      // Create new button
      onSave({
        name,
        icon,
        action_type: actionType,
        action_data: actionData,
        position,
        color,
      });
    }
  };

  const IconComponent = getIconComponent(icon);

  const renderActionConfig = () => {
    switch (actionType) {
      case 'volume_up':
      case 'volume_down':
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">Volume Step</label>
            <input
              type="range"
              min="1"
              max="25"
              value={parseInt(actionData.step || '5')}
              onChange={(e) => setActionData({ ...actionData, step: e.target.value })}
              className="w-full accent-blue-500"
            />
            <div className="text-center text-lg font-semibold text-white">
              {actionData.step || '5'}%
            </div>
          </div>
        );

      case 'launch_app':
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">Select Application</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                placeholder="Search apps..."
                className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 bg-gray-800/50 rounded-lg p-2">
              {filteredApps && filteredApps.map((app) => (
                <button
                  key={app.path}
                  onClick={() => {
                    setActionData({ ...actionData, app_path: app.path });
                    if (!name) setName(app.name);
                  }}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    actionData.app_path === app.path
                      ? 'bg-blue-500/30 ring-1 ring-blue-500'
                      : 'hover:bg-gray-700/50'
                  }`}
                >
                  <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center">
                    <span className="text-xs">{app.name.charAt(0)}</span>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">{app.name}</div>
                    <div className="text-xs text-gray-400">{app.category}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 'run_script':
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">Select Script</label>
            <div className="max-h-48 overflow-y-auto space-y-1 bg-gray-800/50 rounded-lg p-2">
              {scripts.length === 0 ? (
                <div className="text-center py-4 text-gray-400">
                  No scripts configured. Add scripts via the API.
                </div>
              ) : (
                scripts.map((script) => (
                  <button
                    key={script.id}
                    onClick={() => {
                      setActionData({ ...actionData, script_id: script.id });
                      if (!name) setName(script.name);
                    }}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      actionData.script_id === script.id
                        ? 'bg-blue-500/30 ring-1 ring-blue-500'
                        : 'hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="text-left">
                      <div className="text-sm font-medium text-white">{script.name}</div>
                      <div className="text-xs text-gray-400">{script.description}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        );

      case 'open_url':
        return (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">URL</label>
            <input
              type="url"
              value={actionData.url || ''}
              onChange={(e) => setActionData({ ...actionData, url: e.target.value })}
              placeholder="https://example.com"
              className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        );

      case 'volume_knob':
      case 'brightness_knob':
        return (
          <div className="space-y-4">
            {/* Control Style Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Control Style</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const { slider_direction, ...rest } = actionData;
                    setActionData({ ...rest, control_style: 'knob' });
                  }}
                  className={`p-3 rounded-lg text-left transition-all ${
                    (!actionData.control_style || actionData.control_style === 'knob')
                      ? 'bg-blue-500/20 ring-2 ring-blue-500'
                      : 'bg-gray-800/50 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="text-sm font-medium text-white">Knob</div>
                  <div className="text-xs text-gray-400">Circular rotary control</div>
                </button>
                <button
                  onClick={() => setActionData({ ...actionData, control_style: 'slider', slider_direction: actionData.slider_direction || 'horizontal' })}
                  className={`p-3 rounded-lg text-left transition-all ${
                    actionData.control_style === 'slider'
                      ? 'bg-blue-500/20 ring-2 ring-blue-500'
                      : 'bg-gray-800/50 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="text-sm font-medium text-white">Slider</div>
                  <div className="text-xs text-gray-400">Linear slide control</div>
                </button>
              </div>
            </div>

            {/* Slider Direction (only shown when slider is selected) */}
            {actionData.control_style === 'slider' && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">Slider Direction</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setActionData({ ...actionData, slider_direction: 'horizontal' })}
                    className={`p-3 rounded-lg text-left transition-all ${
                      (!actionData.slider_direction || actionData.slider_direction === 'horizontal')
                        ? 'bg-blue-500/20 ring-2 ring-blue-500'
                        : 'bg-gray-800/50 hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="text-sm font-medium text-white">Horizontal</div>
                    <div className="text-xs text-gray-400">Left to right</div>
                  </button>
                  <button
                    onClick={() => setActionData({ ...actionData, slider_direction: 'vertical' })}
                    className={`p-3 rounded-lg text-left transition-all ${
                      actionData.slider_direction === 'vertical'
                        ? 'bg-blue-500/20 ring-2 ring-blue-500'
                        : 'bg-gray-800/50 hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="text-sm font-medium text-white">Vertical</div>
                    <div className="text-xs text-gray-400">Bottom to top</div>
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">
            {button ? 'Edit Button' : 'Create Button'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Preview */}
          <div className="flex justify-center">
            <div
              className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-lg transition-all"
              style={{
                background: `linear-gradient(135deg, ${color}33, ${color}11)`,
                border: `2px solid ${color}`,
                boxShadow: `0 0 30px ${color}33`,
              }}
            >
              {IconComponent && <IconComponent size={32} color={color} />}
              <span className="text-xs font-medium text-white truncate px-2">
                {name || 'Button'}
              </span>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Button Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Button"
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Icon - hidden for toggle buttons (uses dynamic icon based on state) */}
          {actionType !== 'mute_mic' && actionType !== 'volume_mute' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Icon</label>
              <button
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-full flex items-center gap-3 px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white hover:bg-gray-700/50 transition-colors"
              >
                {IconComponent && <IconComponent size={20} color={color} />}
                <span>Select Icon</span>
              </button>
              {showIconPicker && (
                <IconPicker
                  selectedIcon={icon}
                  onSelect={(newIcon) => {
                    setIcon(newIcon);
                    setShowIconPicker(false);
                  }}
                  color={color}
                />
              )}
            </div>
          )}

          {/* Color - hidden for toggle buttons (uses dynamic color based on state) */}
          {actionType !== 'mute_mic' && actionType !== 'volume_mute' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Color</label>
              <div className="flex flex-wrap gap-2">
                {colorPresets.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setColor(preset)}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      color === preset ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900' : ''
                    }`}
                    style={{ background: preset }}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent"
                />
              </div>
            </div>
          )}

          {/* Info for mute_mic dynamic color */}
          {actionType === 'mute_mic' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Appearance</label>
              <div className="p-3 bg-gray-800/50 rounded-lg text-sm text-gray-400">
                Icon and color change automatically based on mic state:
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500"></div>
                    <span>Mic On</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-500"></div>
                    <span>Mic Muted</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info for volume_mute dynamic color */}
          {actionType === 'volume_mute' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Appearance</label>
              <div className="p-3 bg-gray-800/50 rounded-lg text-sm text-gray-400">
                Icon and color change automatically based on volume state:
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-cyan-500"></div>
                    <span>Volume On</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-500"></div>
                    <span>Volume Muted</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Type */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Action Type</label>
            <div className="grid grid-cols-2 gap-2">
              {actionTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => {
                    setActionType(type.value);
                    setActionData({});
                    // Set default icon for toggle buttons
                    if (type.value === 'mute_mic') {
                      setIcon('mic');
                      setColor('#22c55e');
                    } else if (type.value === 'volume_mute') {
                      setIcon('volume-2');
                      setColor('#06b6d4');
                    }
                  }}
                  className={`p-3 rounded-lg text-left transition-all ${
                    actionType === type.value
                      ? 'bg-blue-500/20 ring-2 ring-blue-500'
                      : 'bg-gray-800/50 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="text-sm font-medium text-white">{type.label}</div>
                  <div className="text-xs text-gray-400">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Action Config */}
          {renderActionConfig()}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
          >
            {button ? 'Save Changes' : 'Create Button'}
          </button>
        </div>
      </div>
    </div>
  );
}
