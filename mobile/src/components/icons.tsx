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

export function BackIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M19 12H5" />
      <Path d="M12 19l-7-7 7-7" />
    </Base>
  );
}

export function HomeIcon({ filled = false, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Base {...p}>
      <Path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"
        fill={filled ? p.color : "none"}
      />
    </Base>
  );
}

export function PlusCircleIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 8v8" />
      <Path d="M8 12h8" />
    </Base>
  );
}

export function StackIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M8 8h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <Path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h2" />
    </Base>
  );
}

export function UserIcon({ filled = false, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Base {...p}>
      <Circle cx="12" cy="8" r="4" fill={filled ? p.color : "none"} />
      <Path d="M4 21v-1a7 7 0 0 1 16 0v1" />
    </Base>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M5 12.5l4.5 4.5L19 7.5" />
    </Base>
  );
}

export function SparkleIcon(p: IconProps) {
  return (
    <Base {...p} strokeWidth={1.8}>
      <Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <Path d="M19 16v4M17 18h4" />
    </Base>
  );
}

export function BrushIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M18.4 2.6a2 2 0 0 1 2.9 2.8L11 15.7 7.6 12.3z" />
      <Path d="M7.6 12.3C5.5 12.3 4 13.8 4 16c0 1.5-.8 2.6-2 3.4 3.8 1.2 8.5.8 9.4-3.7" />
    </Base>
  );
}

export function EraserIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M20 20H9l-5.3-5.3a2 2 0 0 1 0-2.8l8.2-8.2a2 2 0 0 1 2.8 0l5.6 5.6a2 2 0 0 1 0 2.8L12 19" />
      <Path d="M7 9.5l7.5 7.5" />
    </Base>
  );
}

export function UndoIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M9 14L4 9l5-5" />
      <Path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </Base>
  );
}

export function TrashIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M3 6h18" />
      <Path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <Path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
      <Path d="M10 11v6M14 11v6" />
    </Base>
  );
}

export function MapIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z" />
      <Path d="M9 4v13.5M15 6.5V20" />
    </Base>
  );
}

export function CameraIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M3 8a2 2 0 0 1 2-2h2.2l1.4-2h6.8l1.4 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <Circle cx="12" cy="13" r="4" />
    </Base>
  );
}

export function ImageIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <Circle cx="8.5" cy="8.5" r="1.5" />
      <Path d="M21 15l-5-5L5 21" />
    </Base>
  );
}

export function LocateIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Circle cx="12" cy="12" r="7" />
      <Circle cx="12" cy="12" r="2.5" />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </Base>
  );
}

export function ShareIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <Path d="M16 6l-4-4-4 4" />
      <Path d="M12 2v13" />
    </Base>
  );
}

export function ArrowRightIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M5 12h14" />
      <Path d="M12 5l7 7-7 7" />
    </Base>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M9 6l6 6-6 6" />
    </Base>
  );
}

export function FlameIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M12 22c4 0 7-2.8 7-6.8 0-3.4-2.2-5.6-3.6-7.2-.4 2-1.6 3.2-2.9 3.6C13 8 11.6 4.6 9 2c0 3.6-4 6.4-4 11.2C5 18.9 8 22 12 22z" />
    </Base>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </Base>
  );
}

export function HeartIcon({ filled = false, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Base {...p}>
      <Path
        d="M12 20.5s-8-4.6-8-10.6A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.9c0 6-8 10.6-8 10.6z"
        fill={filled ? p.color : "none"}
      />
    </Base>
  );
}

export function AlertIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7.5v5.5" />
      <Path d="M12 16.5h.01" />
    </Base>
  );
}

export function ShieldIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z" />
      <Path d="M8.5 12l2.5 2.5 4.5-5" />
    </Base>
  );
}

export function EyeIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <Circle cx="12" cy="12" r="3" />
    </Base>
  );
}

export function XIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M6 6l12 12M18 6L6 18" />
    </Base>
  );
}

export function LogoutIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Path d="M16 17l5-5-5-5" />
      <Path d="M21 12H9" />
    </Base>
  );
}

export function BookIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v16H5.5A1.5 1.5 0 0 0 4 20.5z" />
      <Path d="M4 20.5A1.5 1.5 0 0 0 5.5 22H20" />
    </Base>
  );
}

export function WandIcon(p: IconProps) {
  return (
    <Base {...p}>
      <Path d="M4 20L15 9" />
      <Path d="M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
      <Path d="M19 11l.6 1.4L21 13l-1.4.6L19 15l-.6-1.4L17 13l1.4-.6z" />
    </Base>
  );
}
