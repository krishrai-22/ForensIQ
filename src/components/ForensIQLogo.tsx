import React from 'react';

interface ForensIQLogoProps {
  className?: string;
  size?: number;
}

export const ForensIQLogo: React.FC<ForensIQLogoProps> = ({ className = 'w-6 h-6', size }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-label="ForensIQ Logo"
    >
      <defs>
        {/* Lens Rim Gradient */}
        <linearGradient id="forensiq-rim" x1="15" y1="15" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="50%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>

        {/* Lens Glass Fill */}
        <radialGradient id="forensiq-glass" cx="42" cy="42" r="28" fx="36" fy="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.4" />
          <stop offset="85%" stopColor="#0f172a" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.3" />
        </radialGradient>

        {/* Handle Gradient */}
        <linearGradient id="forensiq-handle" x1="64" y1="64" x2="90" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="40%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>

        {/* Medicine Pill - Top Half (Blue/Cyan) */}
        <linearGradient id="pill-top" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        {/* Medicine Pill - Bottom Half (Clean White) */}
        <linearGradient id="pill-bottom" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>

      {/* Magnifying Glass Handle */}
      <path
        d="M63 63 L86 86"
        stroke="url(#forensiq-handle)"
        strokeWidth="9"
        strokeLinecap="round"
      />
      {/* Handle Grip Highlight Accent */}
      <path
        d="M68 68 L78 78"
        stroke="#93c5fd"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Search Ring / Lens Outer Rim */}
      <circle
        cx="42"
        cy="42"
        r="28"
        fill="url(#forensiq-glass)"
        stroke="url(#forensiq-rim)"
        strokeWidth="6"
      />

      {/* Lens Inner Glass Glare (Upper Left) */}
      <path
        d="M24 34 A20 20 0 0 1 34 24"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Medicine Capsule / Pill inside Search Lens */}
      {/* Rotated 45 degrees centered at (42, 42) */}
      <g transform="translate(42, 42) rotate(45) translate(-7.5, -15)">
        {/* Clip path for the two halves of the pill */}
        <rect
          x="0"
          y="0"
          width="15"
          height="30"
          rx="7.5"
          fill="#0f172a"
          stroke="#0f172a"
          strokeWidth="0.8"
        />

        {/* Top Half (Medical Cyan) */}
        <path
          d="M0 7.5 C0 3.35 3.35 0 7.5 0 C11.65 0 15 3.35 15 7.5 V15 H0 Z"
          fill="url(#pill-top)"
        />

        {/* Bottom Half (Medical White) */}
        <path
          d="M0 15 H15 V22.5 C15 26.65 11.65 30 7.5 30 C3.35 30 0 26.65 0 22.5 Z"
          fill="url(#pill-bottom)"
        />

        {/* Dividing Belt Line */}
        <line
          x1="0"
          y1="15"
          x2="15"
          y2="15"
          stroke="#0f172a"
          strokeWidth="1.2"
          opacity="0.8"
        />

        {/* Medicine Pill Highlight / Gloss */}
        <path
          d="M3 5 C3 3.5 4.5 2.5 6 2.5"
          stroke="#ffffff"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* Medical Cross Detail on White Half */}
        <rect x="6.5" y="19" width="2" height="6" rx="0.5" fill="#0284c7" opacity="0.85" />
        <rect x="4.5" y="21" width="6" height="2" rx="0.5" fill="#0284c7" opacity="0.85" />
      </g>

      {/* Target Focus Reticle Ticks around the lens */}
      <line x1="42" y1="8" x2="42" y2="12" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      <line x1="8" y1="42" x2="12" y2="42" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      <line x1="42" y1="72" x2="42" y2="76" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
};
