import React, { useState, useRef, useEffect } from 'react';

interface VolumeKnobProps {
  value: number;
  onChange: (value: number) => void;
  size?: number;
  color?: string;
  label?: string;
}

export function VolumeKnob({ value, onChange, size = 150, color = '#3b82f6', label }: VolumeKnobProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updateValue(e);
  };

  const updateValue = (e: MouseEvent | React.MouseEvent) => {
    if (!knobRef.current) return;

    const rect = knobRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    
    let normalizedAngle = angle + 90;
    if (normalizedAngle < -135) normalizedAngle += 360;
    if (normalizedAngle > 225) normalizedAngle -= 360;
    
    let newValue = ((normalizedAngle + 135) / 270) * 100;
    newValue = Math.max(0, Math.min(100, newValue));
    
    onChange(Math.round(newValue));
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        updateValue(e);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Calculate SVG parameters
  const svgSize = size;
  const strokeWidth = 10;
  const radius = (svgSize - strokeWidth) / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270 degrees
  const progress = (value / 100) * arcLength;
  const rotation = (value / 100) * 270 - 135;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      {label && (
        <span style={{ fontSize: '14px', fontWeight: 500, color: '#9ca3af' }}>{label}</span>
      )}
      <div
        ref={knobRef}
        style={{
          position: 'relative',
          width: svgSize,
          height: svgSize,
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onMouseDown={handleMouseDown}
      >
        {/* SVG Ring */}
        <svg
          width={svgSize}
          height={svgSize}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {/* Background track */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke="#374151"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            transform={`rotate(135 ${svgSize / 2} ${svgSize / 2})`}
          />
          {/* Progress track */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            transform={`rotate(135 ${svgSize / 2} ${svgSize / 2})`}
            style={{
              filter: `drop-shadow(0 0 8px ${color})`,
              transition: isDragging ? 'none' : 'stroke-dasharray 0.15s ease-out',
            }}
          />
        </svg>

        {/* Inner knob circle */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '20%',
            width: '60%',
            height: '60%',
            borderRadius: '50%',
            backgroundColor: '#1f2937',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `inset 0 2px 15px rgba(0,0,0,0.5), 0 0 25px ${color}33`,
          }}
        >
          {/* Indicator line */}
          <div
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              transform: `rotate(${rotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '10%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '4px',
                height: '15%',
                borderRadius: '2px',
                backgroundColor: color,
                boxShadow: `0 0 10px ${color}`,
              }}
            />
          </div>

          {/* Value display */}
          <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'white' }}>{value}</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>%</div>
          </div>
        </div>

        {/* Tick labels */}
        {[0, 50, 100].map((tick) => {
          const tickAngle = ((tick / 100) * 270 - 135) * (Math.PI / 180);
          const labelRadius = radius + 20;
          const x = svgSize / 2 + labelRadius * Math.cos(tickAngle - Math.PI / 2);
          const y = svgSize / 2 + labelRadius * Math.sin(tickAngle - Math.PI / 2);
          
          return (
            <span
              key={tick}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                transform: 'translate(-50%, -50%)',
                fontSize: '11px',
                fontWeight: 500,
                color: value >= tick ? color : '#6b7280',
              }}
            >
              {tick}
            </span>
          );
        })}
      </div>
    </div>
  );
}
