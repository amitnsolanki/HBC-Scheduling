import React, { useId } from 'react';
import { User, Shield } from 'lucide-react';
import { SkillLevel, PlayStylePreference } from '../types';
import { getLevelColorHex } from '../lib/utils';

interface PlayerAvatarProps {
  photoURL?: string | null;
  displayName?: string | null;
  role?: string;
  level?: SkillLevel;
  playStyles?: PlayStylePreference[];
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export default function PlayerAvatar({ photoURL, displayName, role, level, playStyles, size = 'md', className = '' }: PlayerAvatarProps) {
  const id = useId();
  const sizeMap = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 64,
    xl: 96,
  };

  const currentSize = sizeMap[size];
  const strokeWidth = size === 'xl' ? 6 : size === 'lg' ? 4 : 3;
  const radius = (currentSize - strokeWidth) / 2;
  const center = currentSize / 2;

  // Find preferences and levels
  const singles = playStyles?.find(p => p.style === 'Singles') || { preference: 1, level: level || '' };
  const doubles = playStyles?.find(p => p.style === 'Doubles') || { preference: 1, level: level || '' };
  const mixed = playStyles?.find(p => p.style === 'Mixed') || { preference: 1, level: level || '' };

  // Calculate proportional angles that sum to 360
  const prefS = Math.max(0.1, singles.preference || 0);
  const prefD = Math.max(0.1, doubles.preference || 0);
  const prefM = Math.max(0.1, mixed.preference || 0);
  const totalPref = prefS + prefD + prefM;

  const angleS = (prefS / totalPref) * 360;
  const angleD = (prefD / totalPref) * 360;
  const angleM = (prefM / totalPref) * 360;

  // Helper to calculate arc path
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
  };

  // Start Singles centered at the top (0 degrees)
  const startS = -angleS / 2;
  const endS = angleS / 2;
  const startD = endS;
  const endD = startD + angleD;
  const startM = endD;
  const endM = startM + angleM;

  const slots = [
    { label: 'Singles', start: startS, end: endS, color: getLevelColorHex(singles.level || level) },
    { label: 'Doubles', start: startD, end: endD, color: getLevelColorHex(doubles.level || level) },
    { label: 'Mixed', start: startM, end: endM, color: getLevelColorHex(mixed.level || level) },
  ];

  const iconSizes = {
    xs: 12,
    sm: 14,
    md: 18,
    lg: 28,
    xl: 40,
  };

  const isAdmin = role === 'admin';
  const arrowSize = strokeWidth * 1.2; // Reverted to a smaller size that worked before

  return (
    <div className={`relative inline-block flex-shrink-0 ${className}`} style={{ width: currentSize, height: currentSize }}>
      {/* SVG Border Ring */}
      <svg width={currentSize} height={currentSize} className="absolute inset-0 overflow-visible">
        <defs>
          {slots.map((slot, i) => (
            <marker
              key={`arrow-${i}`}
              id={`arrowhead-${id.replace(/:/g, '')}-${i}`}
              markerWidth={arrowSize}
              markerHeight={arrowSize}
              refX={arrowSize * 0.8} // Adjusted for smaller size
              refY={arrowSize / 2}
              orient="auto"
            >
              <path
                d={`M0,${arrowSize * 0.1} L${arrowSize * 0.8},${arrowSize / 2} L0,${arrowSize * 0.9} L${arrowSize * 0.2},${arrowSize / 2} Z`}
                fill={slot.color}
              />
            </marker>
          ))}
        </defs>
        
        <g>
          {slots.map((slot, i) => (
            <path
              key={i}
              d={describeArc(center, center, radius, slot.start, slot.end)}
              fill="none"
              stroke={slot.color}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              markerEnd={`url(#arrowhead-${id.replace(/:/g, '')}-${i})`}
            />
          ))}
        </g>
      </svg>


      {/* Avatar Content */}
      <div 
        className="absolute inset-0 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border-white"
        style={{ 
          margin: strokeWidth / 2 + 1,
          width: currentSize - strokeWidth - 2,
          height: currentSize - strokeWidth - 2,
          borderWidth: 1.5
        }}
      >
        {photoURL ? (
          <img 
            src={photoURL} 
            alt={displayName || 'Player'} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <User size={iconSizes[size] * 0.8} className="text-slate-400" />
        )}
      </div>
      
      {/* Ornate Shield for admins */}
      {isAdmin && (
        <div className="absolute -bottom-1 -right-1 z-10 flex items-center justify-center">
          <AdminShieldIcon size={Math.max(14, currentSize * 0.35)} />
        </div>
      )}
    </div>
  );
}

const AdminShieldIcon = ({ size = 20 }: { size?: number }) => (
  <svg 
    width={size} 
    height={size * 1.15} 
    viewBox="0 0 100 115" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    style={{ filter: "drop-shadow(0px 3px 3px rgba(0,0,0,0.6))" }}
  >
    <defs>
      <filter id="nebulaBlur" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="8" />
      </filter>
      <clipPath id="innerClip">
        <path d="M50 10 C62 20, 86 20, 86 20 L86 50 C86 84, 50 103, 50 103 C50 103, 14 84, 14 50 L14 20 C14 20, 38 20, 50 10 Z" />
      </clipPath>
      
      <linearGradient id="goldBorder" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#92400E" />
        <stop offset="25%" stopColor="#FDE047" />
        <stop offset="50%" stopColor="#D97706" />
        <stop offset="75%" stopColor="#FEF08A" />
        <stop offset="100%" stopColor="#78350F" />
      </linearGradient>

      <linearGradient id="glintShine" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
        <stop offset="40%" stopColor="#ffffff" stopOpacity="0.1" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
    </defs>

    {/* Base Shield (Thick Gold border) */}
    <path 
      d="M50 2 C65 15, 95 15, 95 15 L95 50 C95 90, 50 113, 50 113 C50 113, 5 90, 5 50 L5 15 C5 15, 35 15, 50 2 Z" 
      fill="url(#goldBorder)" 
    />
    
    {/* Inner Cosmic Field */}
    <g clipPath="url(#innerClip)">
      {/* Deep Space Background */}
      <rect x="0" y="0" width="100" height="115" fill="#090014" />
      
      {/* Swirling Nebula Colors */}
      <g filter="url(#nebulaBlur)">
        <ellipse cx="20" cy="30" rx="40" ry="30" fill="#C026D3" opacity="0.8" transform="rotate(-30 20 30)" />
        <ellipse cx="80" cy="70" rx="35" ry="45" fill="#06B6D4" opacity="0.8" transform="rotate(45 80 70)" />
        <circle cx="50" cy="80" r="30" fill="#4F46E5" opacity="0.9" />
        <ellipse cx="60" cy="30" rx="25" ry="20" fill="#F59E0B" opacity="0.7" transform="rotate(20 60 30)" />
        <circle cx="30" cy="85" r="25" fill="#10B981" opacity="0.6" />
        {/* Center bright core */}
        <circle cx="50" cy="55" r="15" fill="#FFF" opacity="0.4" />
      </g>

      {/* Stardust / Tiny Stars */}
      <circle cx="25" cy="25" r="1" fill="#fff" opacity="0.9" />
      <circle cx="70" cy="35" r="1.5" fill="#fff" opacity="1" />
      <circle cx="80" cy="20" r="0.8" fill="#fff" opacity="0.6" />
      <circle cx="35" cy="80" r="1.2" fill="#fff" opacity="0.8" />
      <circle cx="15" cy="65" r="1" fill="#fff" opacity="0.5" />
      <circle cx="75" cy="85" r="1.5" fill="#fff" opacity="0.9" />
      <circle cx="50" cy="45" r="1" fill="#fff" opacity="1" />
      <circle cx="65" cy="55" r="0.8" fill="#fff" opacity="0.7" />
      <circle cx="40" cy="65" r="1.5" fill="#fff" opacity="0.8" />
      <circle cx="20" cy="95" r="1" fill="#fff" opacity="0.9" />

      {/* Shiny Diagonal Glint Overlay */}
      <polygon points="0,0 45,0 -10,120 -55,120" fill="url(#glintShine)" />
      <polygon points="55,0 65,0 10,120 0,120" fill="url(#glintShine)" opacity="0.7" />
      
      {/* Top curve highlight for extra polish glass effect */}
      <path d="M14 20 C30 15, 50 10, 50 10 C50 10, 70 15, 86 20 L86 25 C70 20, 50 16, 50 16 C50 16, 30 20, 14 25 Z" fill="#FFF" opacity="0.4" />
    </g>

    {/* Inner shadow rim for depth */}
    <path 
      d="M50 10 C62 20, 86 20, 86 20 L86 50 C86 84, 50 103, 50 103 C50 103, 14 84, 14 50 L14 20 C14 20, 38 20, 50 10 Z" 
      fill="none" 
      stroke="#000" 
      strokeWidth="3"
      opacity="0.5"
    />
    
    {/* Inner bright gold bezel ring */}
    <path 
      d="M50 10 C62 20, 86 20, 86 20 L86 50 C86 84, 50 103, 50 103 C50 103, 14 84, 14 50 L14 20 C14 20, 38 20, 50 10 Z" 
      fill="none" 
      stroke="#FEF08A" 
      strokeWidth="1"
      opacity="0.8"
    />
  </svg>
);
