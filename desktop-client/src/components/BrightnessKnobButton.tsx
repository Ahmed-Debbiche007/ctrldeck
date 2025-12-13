import React, { useState, useRef, useEffect, useCallback } from 'react';

interface BrightnessKnobButtonProps {
  value: number;
  onChange: (value: number) => void;
  color: string;
  name: string;
}

export function BrightnessKnobButton({ value, onChange, color, name }: BrightnessKnobButtonProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  // Update local value when prop changes (for real-time updates from WebSocket)
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  const calculateValueFromPosition = useCallback((clientX: number, clientY: number) => {
    if (!knobRef.current) return localValue;

    const rect = knobRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate angle from center (in degrees)
    const angleRad = Math.atan2(clientY - centerY, clientX - centerX);
    let angleDeg = angleRad * (180 / Math.PI);

    // Shift so 0° is at top (12 o'clock)
    angleDeg = angleDeg + 90;
    
    // Normalize to 0-360 range
    if (angleDeg < 0) angleDeg += 360;
    
    // Map the angle to a value
    let normalizedAngle;
    if (angleDeg >= 225) {
      normalizedAngle = angleDeg - 225;
    } else if (angleDeg <= 315 - 270) {
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
  }, [localValue]);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    const newValue = calculateValueFromPosition(clientX, clientY);
    setLocalValue(newValue);
    onChange(newValue);
  }, [calculateValueFromPosition, onChange]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    const newValue = calculateValueFromPosition(clientX, clientY);
    setLocalValue(newValue);
    onChange(newValue);
  }, [isDragging, calculateValueFromPosition, onChange]);

  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleStart(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleMouseUp = () => handleEnd();

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMove, handleEnd]);

  // Display value: use localValue when dragging, otherwise use prop value
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
    <div
      ref={knobRef}
      className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 transition-all duration-200 cursor-pointer select-none ${
        isDragging ? 'scale-95' : 'hover:scale-105'
      }`}
      style={{
        background: `linear-gradient(135deg, ${color}22, ${color}11)`,
        border: `2px solid ${color}`,
        boxShadow: isDragging
          ? `0 0 40px ${color}66, inset 0 0 30px ${color}33`
          : `0 0 20px ${color}22`,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Mini Knob SVG */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="absolute top-0 left-0">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#374151"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            transform={`rotate(135 ${size / 2} ${size / 2})`}
          />
          {/* Progress track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            transform={`rotate(135 ${size / 2} ${size / 2})`}
            style={{
              filter: `drop-shadow(0 0 6px ${color})`,
              transition: isDragging ? 'none' : 'stroke-dasharray 0.1s ease-out',
            }}
          />
        </svg>
        
        {/* Center knob with indicator */}
        <div
          className="absolute rounded-full flex items-center justify-center"
          style={{
            top: '15%',
            left: '15%',
            width: '70%',
            height: '70%',
            backgroundColor: '#1f2937',
            boxShadow: `inset 0 1px 8px rgba(0,0,0,0.5)`,
          }}
        >
          {/* Indicator dot */}
          <div
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              transform: `rotate(${rotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '12%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '4px',
                height: '22%',
                borderRadius: '2px',
                backgroundColor: color,
                boxShadow: `0 0 6px ${color}`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Value display */}
      <span className="text-lg font-bold text-white">
        {displayValue}%
      </span>
      
      {/* Name */}
      <span className="text-sm font-medium text-white truncate px-2 max-w-full opacity-80">
        {name}
      </span>
    </div>
  );
}
