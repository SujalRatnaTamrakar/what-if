/**
 * mobile/src/components/ErrorState.tsx — maps ApiError.code to a friendly
 * message (§5.6 table via friendlyMessage()). Has a retry slot; never clears
 * the caller's form state.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "./Text";
import { ApiError, displayMessage } from "../api/errors";
import { Button } from "../ui/Button";
import { AlertIcon } from "./icons";
import { theme } from "../theme";

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
      <View style={styles.row}>
        <AlertIcon size={22} color={theme.colors.coral} />
        <Text style={styles.message}>{displayMessage(apiError)}</Text>
      </View>
      {__DEV__ ? <Text style={styles.code}>{apiError.code}</Text> : null}
      {onRetry ? (
        <Button title={retryLabel} onPress={onRetry} variant="secondary" size="m" style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.colors.coralSoft,
    borderRadius: theme.radius.xl,
    padding: 16,
  },
  row: { flexDirection: "row", alignItems: "center" },
  message: { flex: 1, marginLeft: 10, fontSize: 15, color: theme.colors.text, fontWeight: "600", lineHeight: 21 },
  code: { fontSize: 11, color: theme.colors.muted, marginTop: 6, marginLeft: 32 },
  button: { marginTop: 12, alignSelf: "flex-start" },
});
