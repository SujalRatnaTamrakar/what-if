/**
 * mobile/src/components/PrimaryButton.tsx — compatibility wrapper over the
 * ui/Button (kept so older imports keep working) + legacy color constants.
 */
import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Button } from "../ui/Button";
import { theme } from "../theme";

export const ACCENT = theme.colors.accent;
export const ACCENT_DARK = theme.colors.accentDark;
export const ORANGE = theme.colors.orange;
export const PAPER = theme.colors.background;
export const INK = theme.colors.text;
export const MUTED = theme.colors.muted;
export const DANGER = theme.colors.danger;

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
  style?: StyleProp<ViewStyle>;
}

export function PrimaryButton(props: Props) {
  return <Button {...props} />;
}
