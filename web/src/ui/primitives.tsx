/**
 * web/src/ui/primitives.tsx — the tiny DOM layer the screens are built on.
 * View/Text/Pressable mirror React Native's box model (see `.v` in
 * styles.css) and accept RN-style nested style arrays, so every screen keeps
 * the mobile app's exact style values.
 */
import React, { forwardRef, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, HTMLAttributes, ImgHTMLAttributes } from "react";

export type StyleInput = CSSProperties | false | null | undefined | 0 | "" | StyleInput[];

/** Flattens an RN-style nested style array into one CSSProperties object. */
export function sx(...input: StyleInput[]): CSSProperties {
  const out: CSSProperties = {};
  const walk = (s: StyleInput) => {
    if (!s) return;
    if (Array.isArray(s)) s.forEach(walk);
    else Object.assign(out, s);
  };
  input.forEach(walk);
  return out;
}

/** Typed style sheet (identity; mirrors StyleSheet.create). */
export function styleSheet<T extends Record<string, CSSProperties>>(s: T): T {
  return s;
}

export const absoluteFill: CSSProperties = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 };

const cls = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

type DivProps = Omit<HTMLAttributes<HTMLDivElement>, "style"> & { style?: StyleInput };

export const View = forwardRef<HTMLDivElement, DivProps>(function View({ style, className, ...rest }, ref) {
  return <div ref={ref} {...rest} className={cls("v", className)} style={sx(style)} />;
});

type TextProps = Omit<HTMLAttributes<HTMLSpanElement>, "style"> & {
  style?: StyleInput;
  /** numberOfLines */
  lines?: number;
  as?: "span" | "h1" | "h2" | "p" | "label";
  /** for `as="label"` */
  htmlFor?: string;
};

export function Text({ style, lines, className, as = "span", ...rest }: TextProps) {
  const clamp: CSSProperties | null = lines
    ? lines === 1
      ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
      : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "normal" }
    : null;
  const Tag = as;
  return <Tag {...rest} className={cls("t", className)} style={sx(style, clamp)} />;
}

export type PressFeedback = "opacity" | "soft" | "scale" | "scale-lg" | "tile" | "bg" | "none";

type PressableProps = Omit<HTMLAttributes<HTMLButtonElement>, "style" | "role"> & {
  style?: StyleInput;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  disabled?: boolean;
  label?: string;
  role?: "button" | "tab" | "radio" | "checkbox" | "link";
  selected?: boolean;
  checked?: boolean;
  busy?: boolean;
  feedback?: PressFeedback;
};

export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(function Pressable(
  { style, onPress, onPressIn, onPressOut, disabled, label, role, selected, checked, busy, feedback = "opacity", className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      role={role && role !== "button" ? role : undefined}
      aria-label={label}
      aria-selected={role === "tab" ? !!selected : undefined}
      aria-checked={role === "radio" || role === "checkbox" ? !!(checked ?? selected) : undefined}
      aria-pressed={role === undefined && selected !== undefined ? selected : undefined}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={onPress ? () => onPress() : undefined}
      onPointerDown={onPressIn ? () => onPressIn() : undefined}
      onPointerUp={onPressOut ? () => onPressOut() : undefined}
      onPointerLeave={onPressOut ? () => onPressOut() : undefined}
      onPointerCancel={onPressOut ? () => onPressOut() : undefined}
      className={cls("v press", feedback !== "none" && `press-${feedback}`, className)}
      style={sx(style)}
    >
      {children}
    </button>
  );
});

type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "style"> & {
  style?: StyleInput;
  fit?: "cover" | "contain";
  /** absoluteFill */
  fill?: boolean;
  /** fade-in duration in ms (expo-image `transition`) */
  transition?: number;
};

export function Img({ style, fit = "cover", fill, transition = 0, alt = "", onLoad, src, ...rest }: ImgProps) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(transition === 0);
  // A cached image can finish loading before React attaches onLoad: check
  // `complete` whenever the source changes instead of assuming "not loaded".
  useLayoutEffect(() => {
    if (!transition) return;
    const el = ref.current;
    setLoaded(!!el && el.complete && el.naturalWidth > 0);
  }, [src, transition]);
  return (
    <img
      {...rest}
      ref={ref}
      src={src}
      alt={alt}
      draggable={false}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      style={sx(
        { display: "block", objectFit: fit, width: "100%", height: "100%" },
        fill && absoluteFill,
        transition ? { opacity: loaded ? 1 : 0, transition: `opacity ${transition}ms ease` } : null,
        style
      )}
    />
  );
}

export function Spinner({ size = "small", color = "#1D5C40", style }: { size?: "small" | "large" | number; color?: string; style?: StyleInput }) {
  const px = typeof size === "number" ? size : size === "large" ? 36 : 20;
  return (
    <span
      role="progressbar"
      aria-label="Loading"
      className="spinner"
      style={sx({ width: px, height: px, borderWidth: Math.max(2, Math.round(px / 9)), borderColor: color, alignSelf: "center" }, style)}
    />
  );
}

/** Centered full-area loader (the screens' `styles.center` + large spinner). */
export function CenterSpinner({ style }: { style?: StyleInput }) {
  return (
    <View style={[{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F6F1E7" }, style]}>
      <Spinner size="large" />
    </View>
  );
}

// ---------------------------------------------------------------- responsive
function subscribeResize(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}

/** Window width (useWindowDimensions().width). */
export function useWindowWidth(): number {
  return useSyncExternalStore(subscribeResize, () => window.innerWidth, () => 1024);
}

export function useWindowHeight(): number {
  return useSyncExternalStore(subscribeResize, () => window.innerHeight, () => 768);
}

/** Desktop-width layout (≥ 900px): grids and side-by-side panes. */
export function useWide(): boolean {
  return useWindowWidth() >= 900;
}

/** Max width of the single-column app body on large screens. */
export const COLUMN = 600;
