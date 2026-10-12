import React, { useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { colors, radius, spacing } from "@/theme/colors";

interface Props {
  value: string;
  onChange: (value: string) => void;
  length?: number;
}

/** Boxed digit-by-digit OTP input with auto-advance/auto-backspace. */
export function OtpInput({ value, onChange, length = 6 }: Props) {
  const refs = useRef<Array<TextInput | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function setDigit(index: number, char: string) {
    const digitsOnly = char.replace(/[^0-9]/g, "");
    // A paste or OS one-time-code autofill delivers the whole code at once —
    // spread it across the boxes instead of keeping only its last digit.
    if (digitsOnly.length > 1) {
      const filled = (value.slice(0, index) + digitsOnly).slice(0, length);
      onChange(filled);
      refs.current[Math.min(filled.length, length - 1)]?.focus();
      return;
    }
    const clean = digitsOnly.slice(-1);
    const next = digits.slice();
    next[index] = clean;
    onChange(next.join(""));
    if (clean && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  }

  function onKeyPress(index: number, key: string) {
    if (key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  return (
    <View style={styles.row}>
      {digits.map((digit, i) => (
        <TextInput
          key={i}
          ref={(r) => {
            refs.current[i] = r;
          }}
          value={digit}
          onChangeText={(t) => setDigit(i, t)}
          onKeyPress={({ nativeEvent }) => onKeyPress(i, nativeEvent.key)}
          keyboardType="number-pad"
          // First box accepts the full code so iOS/Android autofill can land.
          maxLength={i === 0 ? length : 1}
          textContentType={i === 0 ? "oneTimeCode" : "none"}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          style={[styles.box, digit ? styles.boxFilled : null]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing(1) },
  box: {
    width: 44,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  boxFilled: { borderColor: colors.blue, backgroundColor: colors.surface },
});
