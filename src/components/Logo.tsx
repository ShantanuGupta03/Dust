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
        {/* Gold gradient */}
        <linearGradient id="dustGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fcd34d" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        
        {/* Ember accent gradient */}
        <linearGradient id="dustEmberGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#ff6b35" />
        </linearGradient>
        
        {/* Background dark gradient */}
        <linearGradient id="dustBgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a1a28" />
          <stop offset="100%" stopColor="#0d0d14" />
        </linearGradient>
        
        {/* Glow filter */}
        <filter id="dustGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        
        {/* Particle glow */}
        <filter id="particleGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2" result="glow"/>
          <feMerge>
            <feMergeNode in="glow"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {/* Background circle */}
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="url(#dustBgGradient)"
        stroke="url(#dustGoldGradient)"
        strokeWidth="1.5"
        opacity="0.95"
      />
      
      {/* Inner glow ring */}
      <circle
        cx="50"
        cy="50"
        r="38"
        fill="none"
        stroke="url(#dustGoldGradient)"
        strokeWidth="0.5"
        opacity="0.3"
      />
      
      {/* Main diamond shape */}
      <path
        d="M 50 18 L 68 38 L 50 58 L 32 38 Z"
        fill="url(#dustGoldGradient)"
        filter="url(#dustGlow)"
      />
      
      {/* Diamond highlight */}
      <path
        d="M 50 18 L 50 38 L 32 38 Z"
        fill="rgba(255, 255, 255, 0.2)"
      />
      
      {/* Floating dust particles */}
      <g filter="url(#particleGlow)">
        <circle cx="25" cy="65" r="2.5" fill="#fbbf24" opacity="0.9">
          <animate attributeName="opacity" values="0.9;0.4;0.9" dur="2s" repeatCount="indefinite" />
          <animate attributeName="cy" values="65;62;65" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="75" cy="68" r="2" fill="#fcd34d" opacity="0.8">
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="cy" values="68;64;68" dur="3.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="40" cy="72" r="1.5" fill="#f59e0b" opacity="0.7">
          <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="cy" values="72;69;72" dur="2.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="60" cy="75" r="2" fill="#fbbf24" opacity="0.85">
          <animate attributeName="opacity" values="0.85;0.35;0.85" dur="2.2s" repeatCount="indefinite" />
          <animate attributeName="cy" values="75;71;75" dur="3.2s" repeatCount="indefinite" />
        </circle>
        <circle cx="50" cy="80" r="1.8" fill="#fcd34d" opacity="0.75">
          <animate attributeName="opacity" values="0.75;0.25;0.75" dur="2s" repeatCount="indefinite" />
          <animate attributeName="cy" values="80;76;80" dur="3s" repeatCount="indefinite" />
        </circle>
        {/* Additional sparkles */}
        <circle cx="30" cy="78" r="1" fill="#ff6b35" opacity="0.6">
          <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="70" cy="82" r="1.2" fill="#ff6b35" opacity="0.5">
          <animate attributeName="opacity" values="0.5;0.1;0.5" dur="1.7s" repeatCount="indefinite" />
        </circle>
      </g>
      
      {/* Letter D - bold and modern */}
      <text
        x="50"
        y="44"
        fontSize="26"
        fontWeight="800"
        fill="#0d0d14"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
        dominantBaseline="middle"
      >
        D
      </text>
    </svg>
  );
};

export default DustLogo;
