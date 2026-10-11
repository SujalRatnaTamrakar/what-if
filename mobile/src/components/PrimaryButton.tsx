/**
 * mobile/src/components/PrimaryButton.tsx — the one button style (§7.5 Global).
 * Tappable areas ≥ 44pt. Accent: deep civic green.
 */
import React from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "./Text";

export const ACCENT = "#1d5c40";
export const ACCENT_DARK = "#14432e";
export const ORANGE = "#e8a33d";
export const PAPER = "#f6f1e7";
export const INK = "#1F2933";
export const MUTED = "#6B7280";
export const DANGER = "#B3261E";

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={[
        styles.base,
        variant === "primary" ? styles.primary : styles.secondary,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : ACCENT} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === "primary" ? styles.labelPrimary : styles.labelSecondary,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  primary: { backgroundColor: ACCENT },
  secondary: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  disabled: { opacity: 0.45 },
  label: { fontSize: 16, fontWeight: "700" },
  labelPrimary: { color: "#fff" },
  labelSecondary: { color: ACCENT },
});
