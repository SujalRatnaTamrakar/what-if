/**
 * mobile/src/components/EmptyState.tsx — generic empty view.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MUTED } from "./PrimaryButton";
import { PrimaryButton } from "./PrimaryButton";

interface Props {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, message, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <PrimaryButton
          title={actionLabel}
          onPress={onAction}
          variant="secondary"
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  title: { fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  message: { fontSize: 14, color: MUTED, textAlign: "center", marginBottom: 16 },
  button: { marginTop: 8 },
});
