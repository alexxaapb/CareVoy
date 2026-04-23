import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

import { supabase } from "../lib/supabase";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const WHITE = "#FFFFFF";
const MUTED = "#8A93A6";
const INPUT_BG = "#0E1A33";
const ERROR = "#FF6B6B";

function formatDate(d: Date | null): string {
  if (!d) return "Select date";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function OnboardingScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDateChange = (_e: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== "ios") setShowPicker(false);
    if (selected) setDob(selected);
  };

  const handleContinue = async () => {
    setError(null);
    if (!fullName.trim()) return setError("Please enter your full name");
    if (!address.trim()) return setError("Please enter your home address");
    if (!dob) return setError("Please select your date of birth");

    setLoading(true);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      setLoading(false);
      setError("You're not signed in. Please log in again.");
      return;
    }
    const user = userData.user;
    const { error: upsertErr } = await supabase.from("patients").upsert(
      {
        id: user.id,
        full_name: fullName.trim(),
        home_address: address.trim(),
        date_of_birth: dob.toISOString().slice(0, 10),
        phone: user.phone ? "+" + user.phone.replace(/\D/g, "") : null,
        email: user.email ?? null,
        onboarding_complete: true,
      },
      { onConflict: "id" },
    );
    setLoading(false);
    if (upsertErr) {
      setError(upsertErr.message);
      return;
    }
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Welcome to CareVoy</Text>
            <Text style={styles.subtitle}>
              A few quick details so we can book rides for your surgery.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              placeholder="Jane Doe"
              placeholderTextColor={MUTED}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              editable={!loading}
            />

            <Text style={styles.label}>Home address</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="123 Main St, Apt 4, San Francisco, CA"
              placeholderTextColor={MUTED}
              value={address}
              onChangeText={setAddress}
              multiline
              editable={!loading}
            />

            <Text style={styles.label}>Date of birth</Text>
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
                  value={dob ?? new Date(1990, 0, 1)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  maximumDate={new Date()}
                  onChange={onDateChange}
                  themeVariant="dark"
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

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                (loading || pressed) && styles.buttonPressed,
              ]}
              onPress={handleContinue}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={NAVY} />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  flex: { flex: 1 },
  container: { padding: 28, paddingTop: 40, paddingBottom: 40 },
  header: { marginBottom: 32, marginTop: 16 },
  title: {
    color: WHITE,
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: MUTED,
    fontSize: 15,
    marginTop: 8,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  form: { width: "100%" },
  label: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: INPUT_BG,
    color: WHITE,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  multiline: { minHeight: 72, textAlignVertical: "top", paddingTop: 16 },
  dateText: { color: WHITE, fontSize: 16, fontFamily: "Inter_500Medium" },
  placeholder: { color: MUTED },
  pickerWrap: {
    backgroundColor: INPUT_BG,
    borderRadius: 14,
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
  button: {
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 28,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    color: NAVY,
    fontSize: 17,
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
