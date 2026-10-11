/**
 * mobile/src/components/icons.tsx — stroke icon set in the mockup visual
 * language (react-native-svg; no icon-font dependency).
 * All icons: 24x24 viewBox, 2px stroke, round caps.
 */
import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function Base({
  size = 20,
  color = "currentColor",
  strokeWidth = 2,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function PinIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
      <Circle cx="12" cy="10" r="3" />
    </Base>
  );
}

export function PeopleIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx="9" cy="7" r="4" />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <Path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Base>
  );
}

export function BankIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M3 21h18" />
      <Path d="M5 21v-9" />
      <Path d="M9.5 21v-9" />
      <Path d="M14.5 21v-9" />
      <Path d="M19 21v-9" />
      <Path d="M2 10l10-6 10 6" />
    </Base>
  );
}

export function DownloadIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Path d="M7 10l5 5 5-5" />
      <Path d="M12 15V3" />
    </Base>
  );
}

export function BookmarkIcon({ filled = false, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Svg
      width={p.size ?? 20}
      height={p.size ?? 20}
      viewBox="0 0 24 24"
      fill={filled ? p.color ?? "currentColor" : "none"}
      stroke={p.color ?? "currentColor"}
      strokeWidth={p.strokeWidth ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Circle cx="11" cy="11" r="7" />
      <Path d="M21 21l-4.35-4.35" />
    </Base>
  );
}

export function KebabIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Circle cx="12" cy="5" r="1" fill={p.color} />
      <Circle cx="12" cy="12" r="1" fill={p.color} />
      <Circle cx="12" cy="19" r="1" fill={p.color} />
    </Base>
  );
}

/** Sprout logo mark: two leaves + stem, orange accent per mockups. */
export function SproutIcon({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M16 28c0-8 0-12 0-15"
        stroke="#1d5c40"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <Path
        d="M16 14C16 8.5 12 5 5.5 5c0 6.5 4 9.5 10.5 9.5z"
        fill="#e8a33d"
      />
      <Path
        d="M16 17c0-5 3.5-8.5 10.5-8.5 0 6-4.5 9-10.5 8.5z"
        fill="#1d5c40"
      />
    </Svg>
  );
}
