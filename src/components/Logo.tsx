import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const DustLogo: React.FC<LogoProps> = ({ className = '', size = 48 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#d4af37" />
          <stop offset="50%" stopColor="#f4d03f" />
          <stop offset="100%" stopColor="#d4af37" />
        </linearGradient>
        <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8a2be2" />
          <stop offset="100%" stopColor="#4b0082" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Background circle with gradient */}
      <circle
        cx="50"
        cy="50"
        r="45"
        fill="url(#purpleGradient)"
        opacity="0.3"
      />
      
      {/* Main diamond/coin shape */}
      <path
        d="M 50 15 L 70 35 L 50 55 L 30 35 Z"
        fill="url(#goldGradient)"
        stroke="#d4af37"
        strokeWidth="2"
        filter="url(#glow)"
      />
      
      {/* Inner sparkle/dust particles */}
      <circle cx="50" cy="30" r="3" fill="#f4d03f" opacity="0.9" />
      <circle cx="40" cy="40" r="2" fill="#f4d03f" opacity="0.7" />
      <circle cx="60" cy="40" r="2" fill="#f4d03f" opacity="0.7" />
      <circle cx="50" cy="45" r="2.5" fill="#f4d03f" opacity="0.8" />
      
      {/* Letter D in the center */}
      <text
        x="50"
        y="42"
        fontSize="24"
        fontWeight="bold"
        fill="#1a0f1f"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
      >
        D
      </text>
    </svg>
  );
};

export default DustLogo;
