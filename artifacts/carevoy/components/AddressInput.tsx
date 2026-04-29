import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
} from "react-native";

import {
  AddressSuggestion,
  searchAddresses,
} from "../lib/addressAutocomplete";

const NAVY = "#050D1F";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const INPUT_BG = "#F8FAFC";
const BORDER = "#E2E8F0";

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  editable?: boolean;
  inputStyle?: StyleProp<TextStyle>;
  /**
   * If true, this is the only zIndex thing in the form region — we lift the
   * dropdown above siblings.
   */
  zIndex?: number;
};

export function AddressInput({
  value,
  onChange,
  placeholder,
  multiline,
  editable,
  inputStyle,
  zIndex = 10,
}: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const lastQueriedRef = useRef<string>("");

  useEffect(() => {
    if (!focused) return;
    const q = value.trim();
    if (q.length < 4) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (q === lastQueriedRef.current) return;
    const handle = setTimeout(async () => {
      lastQueriedRef.current = q;
      setLoading(true);
      const results = await searchAddresses(q);
      setLoading(false);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 350);
    return () => clearTimeout(handle);
  }, [value, focused]);

  return (
    <View style={[styles.wrap, { zIndex }]}>
      <TextInput
        style={[styles.input, multiline ? styles.multiline : null, inputStyle]}
        placeholder={placeholder}
        placeholderTextColor={MUTED}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        editable={editable !== false}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // Delay so an onPress on a suggestion has time to fire before we
          // hide the dropdown.
          setTimeout(() => {
            setFocused(false);
            setShowSuggestions(false);
          }, 180);
        }}
      />
      {loading && focused ? (
        <View style={styles.loadingChip}>
          <ActivityIndicator size="small" color={MUTED} />
        </View>
      ) : null}
      {showSuggestions && suggestions.length > 0 ? (
        <View style={styles.dropdown}>
          {suggestions.map((s, idx) => (
            <Pressable
              key={s.id}
              style={({ pressed }) => [
                styles.row,
                idx === suggestions.length - 1 && styles.rowLast,
                pressed && styles.rowPressed,
              ]}
              onPress={() => {
                onChange(s.fullAddress);
                lastQueriedRef.current = s.fullAddress;
                setShowSuggestions(false);
              }}
            >
              <Text style={styles.rowTitle} numberOfLines={1}>
                {s.label}
              </Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {s.fullAddress}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  input: {
    backgroundColor: INPUT_BG,
    color: NAVY,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  multiline: { minHeight: 72, textAlignVertical: "top", paddingTop: 14 },
  loadingChip: {
    position: "absolute",
    right: 12,
    top: 14,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    marginTop: 6,
    maxHeight: 260,
    overflow: "hidden",
    boxShadow: "0px 6px 18px rgba(5,13,31,0.12)",
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: INPUT_BG },
  rowTitle: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  rowSub: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
});
