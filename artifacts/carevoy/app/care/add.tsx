import { Feather } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCare } from "../../lib/careContext";
import { supabase } from "../../lib/supabase";
import { useAuthRefresh } from "../_layout";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const INPUT_BG = "#F8FAFC";
const BORDER = "#E2E8F0";
const ERROR = "#EF4444";

const RELATIONSHIPS = [
  "Parent",
  "Spouse / Partner",
  "Sibling",
  "Child",
  "Grandparent",
  "Other family",
  "Friend",
  "Professional caregiver",
];

function isValidEmail(s: string): boolean {
  if (!s) return true; // optional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  return digits ? "+" + digits : "";
}

function formatDate(d: Date | null): string {
  if (!d) return "Select date";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function AddCareRecipientScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromOnboarding = params.from === "onboarding";
  const { refresh, setActivePersonById } = useCare();
  const { refresh: refreshAuth } = useAuthRefresh();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [address, setAddress] = useState("");
  const [relationship, setRelationship] = useState<string>("Parent");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDateChange = (_e: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== "ios") setShowPicker(false);
    if (selected) setDob(selected);
  };

  const onSave = async () => {
    setError(null);
    if (!fullName.trim()) return setError("Please enter their full name");
    if (!address.trim()) return setError("Please enter their home address");
    if (email && !isValidEmail(email))
      return setError("Please enter a valid email or leave it blank");
    if (!consent)
      return setError(
        "You must confirm you have permission to manage rides for this person.",
      );

    setLoading(true);
    const { data, error: rpcErr } = await supabase.rpc(
      "add_care_recipient",
      {
        p_full_name: fullName.trim(),
        p_phone: normalizePhone(phone),
        p_email: email.trim(),
        p_dob: dob ? dob.toISOString().slice(0, 10) : null,
        p_address: address.trim(),
        p_relationship: relationship,
        p_consent_method: "app_checkbox",
      },
    );
    if (rpcErr) {
      setLoading(false);
      setError(rpcErr.message);
      return;
    }
    const newId = typeof data === "string" ? data : null;
    await refresh();
    if (newId) await setActivePersonById(newId);
    setLoading(false);

    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (typeof window !== "undefined")
        window.alert(`${fullName.trim()} added — you're now booking for them.`);
    } else {
      Alert.alert(
        "Care recipient added",
        `${fullName.trim()} has been added. You're now booking on their behalf.`,
      );
    }
    if (fromOnboarding) {
      // Refresh auth so the guard sees onboarded=true before we land on tabs;
      // otherwise the guard would bounce us back to /onboarding.
      await refreshAuth();
      router.replace("/(tabs)");
    } else {
      router.back();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={20} color={NAVY} />
        </Pressable>
        <Text style={styles.topTitle}>Add a person in my care</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.intro}>
            Add an elderly parent, spouse, or anyone you book medical rides for.
            You&apos;ll be able to switch between people on the home screen.
          </Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            placeholder="Mary Doe"
            placeholderTextColor={MUTED}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            editable={!loading}
          />

          <Text style={styles.label}>Their phone (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="(555) 123-4567"
            placeholderTextColor={MUTED}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            editable={!loading}
          />

          <Text style={styles.label}>Their email (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="mary@example.com"
            placeholderTextColor={MUTED}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />
          <Text style={styles.helper}>
            Receipts will go to your email and theirs (if provided).
          </Text>

          <Text style={styles.label}>Date of birth (optional)</Text>
          <Pressable
            style={styles.input}
            onPress={() => setShowPicker(true)}
            disabled={loading}
          >
            <Text style={[styles.dateText, !dob && styles.placeholder]}>
              {formatDate(dob)}
            </Text>
          </Pressable>
          {showPicker && (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={dob ?? new Date(1950, 0, 1)}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                onChange={onDateChange}
              />
              {Platform.OS === "ios" && (
                <Pressable
                  style={styles.pickerDone}
                  onPress={() => setShowPicker(false)}
                >
                  <Text style={styles.pickerDoneText}>Done</Text>
                </Pressable>
              )}
            </View>
          )}

          <Text style={styles.label}>Their home address</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="123 Elm St, Columbus, OH"
            placeholderTextColor={MUTED}
            value={address}
            onChangeText={setAddress}
            multiline
            editable={!loading}
          />

          <Text style={[styles.label, { marginTop: 22 }]}>
            Your relationship
          </Text>
          <View style={styles.chipRow}>
            {RELATIONSHIPS.map((r) => (
              <Pressable
                key={r}
                onPress={() => setRelationship(r)}
                style={({ pressed }) => [
                  styles.chip,
                  relationship === r && styles.chipSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    relationship === r && styles.chipTextSelected,
                  ]}
                >
                  {r}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => setConsent((c) => !c)}
            style={({ pressed }) => [
              styles.consentRow,
              pressed && styles.pressed,
            ]}
          >
            <View
              style={[
                styles.checkbox,
                consent && {
                  backgroundColor: TEAL,
                  borderColor: TEAL,
                },
              ]}
            >
              {consent ? (
                <Feather name="check" size={14} color={NAVY} />
              ) : null}
            </View>
            <Text style={styles.consentText}>
              I confirm I have permission to book rides and manage receipts for
              {fullName.trim() ? ` ${fullName.trim()}` : " this person"}.
            </Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={onSave}
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              (loading || pressed) && styles.buttonPressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <Text style={styles.buttonText}>Add person</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
  flex: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  topTitle: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  container: { padding: 24, paddingBottom: 60 },
  intro: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
    fontFamily: "Inter_400Regular",
  },
  label: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
    marginTop: 14,
  },
  helper: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4,
    fontFamily: "Inter_400Regular",
  },
  input: {
    backgroundColor: INPUT_BG,
    color: NAVY,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  multiline: { minHeight: 72, textAlignVertical: "top", paddingTop: 14 },
  dateText: { color: NAVY, fontSize: 15, fontFamily: "Inter_500Medium" },
  placeholder: { color: MUTED },
  pickerWrap: {
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    marginTop: 10,
    paddingVertical: 8,
  },
  pickerDone: {
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pickerDoneText: {
    color: TEAL,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  chip: {
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: "rgba(0,194,168,0.12)",
    borderColor: TEAL,
  },
  chipText: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  chipTextSelected: { color: NAVY },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 24,
    padding: 14,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  consentText: {
    flex: 1,
    color: NAVY,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_500Medium",
  },
  pressed: { opacity: 0.85 },
  button: {
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  error: {
    color: ERROR,
    fontSize: 13,
    marginTop: 16,
    fontFamily: "Inter_500Medium",
  },
});
