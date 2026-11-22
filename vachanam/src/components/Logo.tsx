import React from "react";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

/** Vachanam mark: an open book with light rising from it and a small cross. */
export function Logo({ size = 56, bg = "#1F4D3A", gold = "#C9A24E" }: { size?: number; bg?: string; gold?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityLabel="Vachanam logo">
      <Defs>
        <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={gold} stopOpacity="1" />
          <Stop offset="1" stopColor={gold} stopOpacity="0.75" />
        </LinearGradient>
      </Defs>
      <Circle cx="32" cy="32" r="31" fill={bg} />
      <Circle cx="32" cy="32" r="28.5" fill="none" stroke={gold} strokeOpacity="0.45" strokeWidth="1" />
      {/* light rays */}
      {[-50, -25, 0, 25, 50].map((a) => (
        <Path key={a} d="M32 30 L32 13" stroke={gold} strokeOpacity={a === 0 ? 0.9 : 0.45} strokeWidth={a === 0 ? 1.6 : 1.1} strokeLinecap="round" transform={`rotate(${a} 32 30)`} />
      ))}
      {/* cross */}
      <Path d="M32 15 V27 M27.5 19.5 H36.5" stroke={gold} strokeWidth="2.2" strokeLinecap="round" />
      {/* open book */}
      <Path d="M12 34 C19 31 26 32 32 36 C38 32 45 31 52 34 L52 47 C45 44.5 38 45 32 49 C26 45 19 44.5 12 47 Z" fill="url(#g)" />
      <Path d="M32 36 V49" stroke={bg} strokeWidth="1.2" />
      <Path d="M16 38 C21 36.5 26 37 29.5 39 M16 42 C21 40.5 26 41 29.5 43 M48 38 C43 36.5 38 37 34.5 39 M48 42 C43 40.5 38 41 34.5 43" stroke={bg} strokeOpacity="0.35" strokeWidth="0.9" fill="none" />
    </Svg>
  );
}
