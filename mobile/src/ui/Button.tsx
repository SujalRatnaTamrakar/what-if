/**
 * mobile/src/ui/Button.tsx — the one button. Variants: primary (forest),
 * secondary (outlined), soft (mint), ghost, danger. Spring press-scale,
 * light haptic, ≥48pt target, optional leading icon.
 */
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Text } from "../components/Text";
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
  style?: StyleProp<ViewStyle>;
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
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const off = disabled || loading;
  // Disabled = solid muted fill (no transparency, so content never shows through).
  const p = disabled && !loading && variant !== "ghost"
    ? { bg: theme.colors.paperDeep, fg: theme.colors.faint, border: variant === "secondary" ? theme.colors.border : undefined }
    : PALETTE[variant];

  return (
    <Animated.View style={[anim, style]}>
      <Pressable
        onPress={() => {
          if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onPress();
        }}
        onPressIn={() => (scale.value = withSpring(0.97, { damping: 20, stiffness: 400 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 14, stiffness: 300 }))}
        disabled={off}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        accessibilityState={{ disabled: !!off, busy: !!loading }}
        style={[
          styles.base,
          size === "m" && styles.medium,
          { backgroundColor: p.bg },
          p.border ? { borderWidth: 1.5, borderColor: p.border } : null,
          loading && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={p.fg} />
        ) : (
          <View style={styles.row}>
            {icon ? <View style={styles.icon}>{icon(p.fg)}</View> : null}
            <Text style={[styles.label, size === "m" && styles.labelM, { color: p.fg }]}>{title}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  medium: { minHeight: 46, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center" },
  icon: { marginRight: 8 },
  label: { fontSize: 16, fontWeight: "600" },
  labelM: { fontSize: 14 },
  disabled: { opacity: 0.7 },
});
