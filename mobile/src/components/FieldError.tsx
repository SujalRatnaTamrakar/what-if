/**
 * mobile/src/components/FieldError.tsx — inline validation messages (§7.5 S1).
 * Never loses the user's input: it only annotates.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { DANGER } from "./PrimaryButton";

export function FieldError({ errors }: { errors?: string[] | null }) {
  if (!errors || errors.length === 0) return null;
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      {errors.map((e, i) => (
        <Text key={i} style={styles.text}>
          {e}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6, gap: 2 },
  text: { color: DANGER, fontSize: 13 },
});
