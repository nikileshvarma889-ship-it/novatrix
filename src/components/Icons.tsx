import React from "react";
import { DemoKind } from "../content/tools";

// Generic category glyphs (not brand logos).
export const CategoryIcon: React.FC<{ kind: DemoKind; size: number; color: string }> = ({ kind, size, color }) => {
  const common = { fill: "none", stroke: color, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<DemoKind, React.ReactNode> = {
    chat: (
      <>
        <path d="M4 5h16v10H9l-5 4z" {...common} />
        <path d="M8 9h8M8 12h5" {...common} />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6" {...common} />
        <path d="M15 15l5 5" {...common} />
      </>
    ),
    slides: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" {...common} />
        <path d="M12 16v4M8 20h8M7 12l3-3 2 2 4-4" {...common} />
      </>
    ),
    images: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" {...common} />
        <circle cx="9" cy="10" r="2" {...common} />
        <path d="M21 16l-5-5-9 9" {...common} />
      </>
    ),
    voice: (
      <>
        <rect x="9" y="3" width="6" height="11" rx="3" {...common} />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" {...common} />
      </>
    ),
    music: (
      <>
        <path d="M9 18V6l11-2v12" {...common} />
        <circle cx="6.5" cy="18" r="2.5" {...common} />
        <circle cx="17.5" cy="16" r="2.5" {...common} />
      </>
    ),
    design: (
      <>
        <path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 3 0 4-1 3-2 3-5a9 9 0 0 0-9-7z" {...common} />
        <circle cx="8" cy="10" r="1.2" {...common} />
        <circle cx="12" cy="7" r="1.2" {...common} />
        <circle cx="16" cy="10" r="1.2" {...common} />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      {paths[kind]}
    </svg>
  );
};

export const CheckIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="11" fill={`${color}26`} stroke={color} strokeWidth={1.5} />
    <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ThumbIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M7 10v11H3V10zM7 10l4-8c1.7 0 3 1.3 3 3v4h6c1.1 0 2 1 1.8 2.1l-1.6 8A2 2 0 0 1 18.2 21H7" fill={color} />
  </svg>
);

export const BellIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" fill={color} />
  </svg>
);

export const CommentIcon: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M4 4h16v12H8l-4 4z" fill={color} />
  </svg>
);

export const CursorIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M4 2l14 10-6 1.5L15 21l-3 1.2-3-7.4L4 19z" fill="#fff" stroke="#111" strokeWidth={1.3} strokeLinejoin="round" />
  </svg>
);
