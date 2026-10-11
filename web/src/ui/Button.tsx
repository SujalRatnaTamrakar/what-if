/**
 * web/src/ui/Button.tsx — the one button. Variants: primary (forest),
 * secondary (outlined), soft (mint), ghost, danger. Press-scale, ≥48px
 * target, optional leading icon.
 */
import React from "react";
import { Pressable, Spinner, Text, View, styleSheet, type StyleInput } from "./primitives";
import { theme } from "../theme";

export type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger";

interface Props {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: (color: string) => React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  size?: "m" | "l";
  style?: StyleInput;
  accessibilityLabel?: string;
}

const PALETTE: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: theme.colors.accent, fg: "#fff" },
  secondary: { bg: theme.colors.card, fg: theme.colors.accent, border: theme.colors.accent },
  soft: { bg: theme.colors.accentSoft, fg: theme.colors.accentDark },
  ghost: { bg: "transparent", fg: theme.colors.accent },
  danger: { bg: theme.colors.coralSoft, fg: theme.colors.coral },
};

export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  disabled,
  loading,
  size = "l",
  style,
  accessibilityLabel,
}: Props) {
  const off = disabled || loading;
  // Disabled = solid muted fill (no transparency, so content never shows through).
  const p = disabled && !loading && variant !== "ghost"
    ? { bg: theme.colors.paperDeep, fg: theme.colors.faint, border: variant === "secondary" ? theme.colors.border : undefined }
    : PALETTE[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      label={accessibilityLabel ?? title}
      busy={!!loading}
      feedback="scale"
      style={[
        styles.base,
        size === "m" && styles.medium,
        { backgroundColor: p.bg },
        p.border ? { borderWidth: 1.5, borderColor: p.border } : null,
        loading && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <Spinner color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <View style={styles.icon}>{icon(p.fg)}</View> : null}
          <Text style={[styles.label, size === "m" && styles.labelM, { color: p.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = styleSheet({
  base: {
    minHeight: 56,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 22,
    paddingRight: 22,
  },
  medium: { minHeight: 46, paddingLeft: 16, paddingRight: 16 },
  row: { flexDirection: "row", alignItems: "center" },
  icon: { marginRight: 8 },
  label: { fontSize: 16, fontWeight: 600 },
  labelM: { fontSize: 14 },
  disabled: { opacity: 0.7 },
});
