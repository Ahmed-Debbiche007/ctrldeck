import React from 'react';
import * as Icons from 'lucide-react';

interface IconPickerProps {
  selectedIcon: string;
  onSelect: (icon: string) => void;
  color?: string;
}

const commonIcons = [
  'Mic', 'MicOff', 'Volume2', 'VolumeX', 'Volume1',
  'Play', 'Pause', 'SkipForward', 'SkipBack', 'Square',
  'Monitor', 'Laptop', 'Smartphone', 'Tablet', 'Tv',
  'Globe', 'Chrome', 'Github', 'Twitter', 'Youtube',
  'Mail', 'MessageSquare', 'Send', 'Bell', 'BellOff',
  'Folder', 'File', 'FileText', 'Image', 'Video',
  'Camera', 'Music', 'Headphones', 'Radio', 'Podcast',
  'Settings', 'Sliders', 'Wrench', 'Tool', 'Cog',
  'Power', 'PowerOff', 'Zap', 'Battery', 'BatteryCharging',
  'Wifi', 'WifiOff', 'Bluetooth', 'Cast', 'Airplay',
  'Sun', 'Moon', 'CloudSun', 'CloudMoon', 'Cloud',
  'Home', 'Building', 'Store', 'Briefcase', 'Archive',
  'Terminal', 'Code', 'CodeSquare', 'Braces', 'Hash',
  'Cpu', 'HardDrive', 'Database', 'Server', 'Router',
  'Lock', 'Unlock', 'Key', 'Shield', 'ShieldCheck',
  'Eye', 'EyeOff', 'Search', 'ZoomIn', 'ZoomOut',
  'Plus', 'Minus', 'X', 'Check', 'RefreshCw',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Move',
  'Maximize', 'Minimize', 'Expand', 'Shrink', 'Fullscreen',
  'Clock', 'Timer', 'Alarm', 'Calendar', 'CalendarDays',
];

// Convert PascalCase to kebab-case
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

// Convert kebab-case to PascalCase
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

export function IconPicker({ selectedIcon, onSelect, color = '#3b82f6' }: IconPickerProps) {
  return (
    <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto p-2 bg-gray-800/50 rounded-lg">
      {commonIcons.map((iconName) => {
        const IconComponent = (Icons as any)[iconName];
        if (!IconComponent) return null;
        
        const kebabName = toKebabCase(iconName);
        const isSelected = selectedIcon === kebabName || selectedIcon === iconName.toLowerCase();
        
        return (
          <button
            key={iconName}
            onClick={() => onSelect(kebabName)}
            className={`p-2 rounded-lg transition-all ${
              isSelected
                ? 'bg-blue-500/30 ring-2 ring-blue-500'
                : 'hover:bg-gray-700/50'
            }`}
            title={iconName}
          >
            <IconComponent
              size={20}
              color={isSelected ? color : '#9ca3af'}
            />
          </button>
        );
      })}
    </div>
  );
}

export function getIconComponent(iconName: string): any {
  if (!iconName) return Icons.Circle;
  
  // Try direct match first (PascalCase)
  if ((Icons as any)[iconName]) {
    return (Icons as any)[iconName];
  }
  
  // Convert kebab-case to PascalCase
  const pascalCase = toPascalCase(iconName);
  
  if ((Icons as any)[pascalCase]) {
    return (Icons as any)[pascalCase];
  }
  
  // Try with first letter capitalized (simple names like "mic" -> "Mic")
  const capitalized = iconName.charAt(0).toUpperCase() + iconName.slice(1).toLowerCase();
  
  if ((Icons as any)[capitalized]) {
    return (Icons as any)[capitalized];
  }
  
  return Icons.Circle;
}
