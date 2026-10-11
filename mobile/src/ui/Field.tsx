/**
 * mobile/src/ui/Field.tsx — outlined input with a floating label, counter,
 * inline errors and optional suggestion chips.
 */
import React, { useState } from "react";
import { ScrollView, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Text } from "../components/Text";
import { Chip } from "./Chip";
import { fonts, theme } from "../theme";

interface Props extends Omit<TextInputProps, "style"> {
  label: string;
  errors?: string[];
  maxLength?: number;
  suggestions?: string[];
  onSuggestion?: (s: string) => void;
}

export function Field({ label, errors, maxLength, multiline, value, suggestions, onSuggestion, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const hasError = !!errors && errors.length > 0;
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.box,
          multiline && styles.multi,
          focused && styles.focused,
          hasError && styles.error,
        ]}
      >
        <Text style={[styles.label, focused && { color: theme.colors.accent }, hasError && { color: theme.colors.danger }]}>
          {label}
        </Text>
        <TextInput
          {...rest}
          value={value}
          multiline={multiline}
          maxLength={maxLength}
          placeholderTextColor={theme.colors.faint}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          accessibilityLabel={label}
          style={[styles.input, multiline && styles.inputMulti]}
        />
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.err}>{hasError ? errors![0] : ""}</Text>
        {maxLength ? (
          <Text style={styles.count}>
            {(value ?? "").length}/{maxLength}
          </Text>
        ) : null}
      </View>
      {suggestions && suggestions.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sugs}>
          {suggestions.map((s) => (
            <Chip key={s} label={s} tone="light" onPress={() => onSuggestion?.(s)} style={styles.sug} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  box: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.l,
    backgroundColor: theme.colors.card,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
  },
  multi: { minHeight: 120 },
  focused: { borderColor: theme.colors.accent },
  error: { borderColor: theme.colors.danger },
  label: { fontSize: 12, fontWeight: "500", color: theme.colors.muted },
  input: { fontFamily: fonts.regular, fontSize: 16, color: theme.colors.text, paddingVertical: 4, minHeight: 30 },
  inputMulti: { minHeight: 84, textAlignVertical: "top" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, marginTop: 4, minHeight: 16 },
  err: { fontSize: 12, color: theme.colors.danger, flex: 1 },
  count: { fontSize: 12, color: theme.colors.faint },
  sugs: { paddingVertical: 4, gap: 8 },
  sug: { minHeight: 34 },
});
