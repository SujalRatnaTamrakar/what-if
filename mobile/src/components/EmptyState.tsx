/**
 * mobile/src/components/EmptyState.tsx — friendly empty/sign-in state with
 * an illustrated sprout badge and one clear action.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { Display } from "../ui/Display";
import { Button } from "../ui/Button";
import { SproutIcon } from "./icons";
import { theme } from "../theme";

interface Props {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export function EmptyState({ title, message, actionLabel, onAction, icon }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>{icon ?? <SproutIcon size={44} />}</View>
      <Display size={24} style={styles.title}>
        {title}
      </Display>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={styles.btn} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 24 },
  badge: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: theme.colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: { textAlign: "center" },
  message: { fontSize: 15, color: theme.colors.muted, textAlign: "center", marginTop: 8, lineHeight: 22, maxWidth: 320 },
  btn: { marginTop: 22, minWidth: 220 },
});
