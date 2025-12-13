import React, { useState, useRef, useEffect, useCallback } from 'react';

interface BrightnessSliderButtonProps {
  value: number;
  onChange: (value: number) => void;
  color: string;
  name: string;
  direction: 'horizontal' | 'vertical';
}

export function BrightnessSliderButton({ value, onChange, color, name, direction }: BrightnessSliderButtonProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  // Update local value when prop changes (for real-time updates from WebSocket)
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  const calculateValueFromPosition = useCallback((clientX: number, clientY: number) => {
    if (!sliderRef.current) return localValue;

    const rect = sliderRef.current.getBoundingClientRect();
    let percentage: number;

    if (direction === 'horizontal') {
      const relativeX = clientX - rect.left;
      percentage = (relativeX / rect.width) * 100;
    } else {
      // Vertical: top = 100%, bottom = 0%
      const relativeY = clientY - rect.top;
      percentage = 100 - (relativeY / rect.height) * 100;
    }

    return Math.max(0, Math.min(100, Math.round(percentage)));
  }, [localValue, direction]);

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

  return (
    <div
      ref={sliderRef}
      className={`w-full aspect-square rounded-2xl relative overflow-hidden transition-all duration-200 cursor-pointer select-none ${
        isDragging ? 'scale-95' : 'hover:scale-105'
      }`}
      style={{
        backgroundColor: '#1f2937',
        border: `2px solid ${color}`,
        boxShadow: isDragging
          ? `0 0 40px ${color}66, inset 0 0 30px ${color}22`
          : `0 0 20px ${color}22`,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Filled portion */}
      <div
        className="absolute transition-all"
        style={{
          backgroundColor: `${color}66`,
          boxShadow: `0 0 20px ${color}33`,
          transition: isDragging ? 'none' : 'all 0.1s ease-out',
          ...(direction === 'horizontal'
            ? {
                left: 0,
                top: 0,
                bottom: 0,
                width: `${displayValue}%`,
              }
            : {
                left: 0,
                right: 0,
                bottom: 0,
                height: `${displayValue}%`,
              }),
        }}
      />

      {/* Center content overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <span
          className="text-2xl font-bold drop-shadow-lg"
          style={{
            color: '#ffffff',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          {displayValue}%
        </span>
        <span
          className="text-sm font-medium truncate px-2 max-w-full drop-shadow-lg"
          style={{
            color: '#ffffff',
            opacity: 0.9,
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          {name}
        </span>
      </div>
    </div>
  );
}
