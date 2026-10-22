import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/theme/colors";

interface Props extends TextInputProps {
  label?: string;
  error?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  /** e.g. a password show/hide eye button. */
  rightElement?: React.ReactNode;
  /** Forwarded to the TextInput (React 19 ref-as-prop) for focus chaining. */
  ref?: React.Ref<TextInput>;
}

export function Input({
  label,
  error,
  icon,
  rightElement,
  ref,
  style,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputRow,
          focused && styles.inputRowFocused,
          !!error && styles.inputError,
        ]}
      >
        {icon ? (
          <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.icon} />
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightElement}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing(0.5) },
  label: { color: colors.text, fontSize: 13, fontWeight: "600" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing(1.75),
  },
  inputRowFocused: { borderColor: colors.blue, backgroundColor: colors.surface },
  icon: { marginRight: spacing(1) },
  input: {
    flex: 1,
    paddingVertical: spacing(1.5),
    color: colors.text,
    fontSize: 15,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12 },
});
