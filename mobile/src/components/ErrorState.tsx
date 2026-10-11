/**
 * mobile/src/components/ErrorState.tsx — maps ApiError.code to a friendly
 * message (§5.6 table via friendlyMessage()). Has a retry slot; never clears
 * the caller's form state.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ApiError, friendlyMessage } from "../api/errors";
import { DANGER, INK, MUTED } from "./PrimaryButton";
import { PrimaryButton } from "./PrimaryButton";

interface Props {
  error: unknown;
  onRetry?: () => void;
  retryLabel?: string;
}

export function asApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  const message = e instanceof Error ? e.message : "Something went wrong.";
  return new ApiError(0, "INTERNAL", message, true);
}

export function ErrorState({ error, onRetry, retryLabel = "Try again" }: Props) {
  const apiError = asApiError(error);
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.message}>{friendlyMessage(apiError.code)}</Text>
      {__DEV__ ? <Text style={styles.code}>{apiError.code}</Text> : null}
      {onRetry ? (
        <PrimaryButton
          title={retryLabel}
          onPress={onRetry}
          variant="secondary"
          style={styles.button}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#FDECEA",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F5C6C2",
  },
  icon: { fontSize: 24, marginBottom: 8 },
  message: { fontSize: 15, color: INK, textAlign: "center", fontWeight: "600" },
  code: { fontSize: 11, color: MUTED, marginTop: 4, fontFamily: "monospace" },
  button: { marginTop: 12, minWidth: 160 },
});
