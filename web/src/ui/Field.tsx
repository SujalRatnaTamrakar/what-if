/**
 * web/src/ui/Field.tsx — outlined input with a floating label, counter,
 * inline errors and optional suggestion chips.
 */
import React, { useId, useState } from "react";
import { Text, View, styleSheet } from "./primitives";
import { Chip } from "./Chip";
import { fonts, theme } from "../theme";

interface Props {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  errors?: string[];
  maxLength?: number;
  multiline?: boolean;
  suggestions?: string[];
  onSuggestion?: (s: string) => void;
  autoFocus?: boolean;
}

export function Field({
  label,
  errors,
  maxLength,
  multiline,
  value,
  onChangeText,
  onBlur,
  placeholder,
  suggestions,
  onSuggestion,
  autoFocus,
}: Props) {
  const [focused, setFocused] = useState(false);
  const id = useId();
  const hasError = !!errors && errors.length > 0;
  const common = {
    id,
    value,
    placeholder,
    maxLength,
    autoFocus,
    "aria-invalid": hasError || undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChangeText(e.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false);
      onBlur?.();
    },
  };
  return (
    <View style={styles.wrap}>
      <View style={[styles.box, multiline && styles.multi, focused && styles.focused, hasError && styles.error]}>
        <Text
          as="label"
          htmlFor={id}
          style={[styles.label, focused && { color: theme.colors.accent }, hasError && { color: theme.colors.danger }]}
        >
          {label}
        </Text>
        {multiline ? (
          <textarea {...common} rows={4} style={{ ...styles.input, ...styles.inputMulti }} />
        ) : (
          <input {...common} type="text" style={styles.input} />
        )}
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.err} role={hasError ? "alert" : undefined}>
          {hasError ? errors![0] : ""}
        </Text>
        {maxLength ? (
          <Text style={styles.count}>
            {(value ?? "").length}/{maxLength}
          </Text>
        ) : null}
      </View>
      {suggestions && suggestions.length > 0 ? (
        <View className="hscroll" style={styles.sugs}>
          {suggestions.map((s) => (
            <Chip key={s} label={s} tone="light" onPress={() => onSuggestion?.(s)} style={styles.sug} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = styleSheet({
  wrap: { marginBottom: 8 },
  box: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.l,
    backgroundColor: theme.colors.card,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 8,
    paddingBottom: 6,
    transition: "border-color 140ms ease",
  },
  multi: { minHeight: 120 },
  focused: { borderColor: theme.colors.accent },
  error: { borderColor: theme.colors.danger },
  label: { fontSize: 12, fontWeight: 500, color: theme.colors.muted },
  input: {
    fontFamily: fonts.ui,
    fontSize: 16,
    color: theme.colors.text,
    paddingTop: 4,
    paddingBottom: 4,
    minHeight: 30,
    border: "none",
    outline: "none",
    background: "transparent",
    padding: "4px 0",
    width: "100%",
  },
  inputMulti: { minHeight: 84, resize: "vertical", lineHeight: "22px" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", paddingLeft: 4, paddingRight: 4, marginTop: 4, minHeight: 16 },
  err: { fontSize: 12, color: theme.colors.danger, flex: 1 },
  count: { fontSize: 12, color: theme.colors.faint },
  sugs: { flexDirection: "row", paddingTop: 4, paddingBottom: 4, gap: 8 },
  sug: { minHeight: 34, flexShrink: 0 },
});
