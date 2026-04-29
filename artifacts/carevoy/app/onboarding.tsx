import { Feather } from "@expo/vector-icons";
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
import { useAuthRefresh } from "./_layout";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const INPUT_BG = "#F8FAFC";
const BORDER = "#E2E8F0";
const ERROR = "#EF4444";

const TOTAL_STEPS = 4;

const MOBILITY_OPTIONS: { key: string; label: string; sub?: string }[] = [
  { key: "standard", label: "Standard vehicle", sub: "Default" },
  { key: "wheelchair", label: "Wheelchair accessible" },
  { key: "extra_assistance", label: "Need extra assistance" },
  { key: "companion", label: "Bringing a companion" },
];

const LANGUAGE_OPTIONS: { key: string; label: string }[] = [
  { key: "en", label: "English" },
  { key: "es", label: "Spanish" },
  { key: "other", label: "Other" },
];

const REFERRAL_OPTIONS: { key: string; label: string }[] = [
  { key: "hospital", label: "From my hospital / clinic" },
  { key: "care_facility", label: "From my care facility" },
  { key: "online", label: "Online search" },
  { key: "friend_family", label: "Friend or family" },
  { key: "other", label: "Other" },
];

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function formatDate(d: Date | null): string {
  if (!d) return "Select date";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  return digits ? "+" + digits : "";
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { refresh } = useAuthRefresh();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [dob, setDob] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Step 2
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [mobility, setMobility] = useState<string>("standard");

  // Step 3 (optional)
  const [language, setLanguage] = useState<string>("en");
  const [referral, setReferral] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDateChange = (_e: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== "ios") setShowPicker(false);
    if (selected) setDob(selected);
  };

  const goNext = () => {
    setError(null);
    if (step === 1) {
      if (!fullName.trim()) return setError("Please enter your full name");
      if (!isValidEmail(email))
        return setError("Please enter a valid email address");
      if (!dob) return setError("Please select your date of birth");
      if (!address.trim()) return setError("Please enter your home address");
      setStep(2);
    } else if (step === 2) {
      if (!emergencyName.trim())
        return setError("Please enter an emergency contact name");
      if (normalizePhone(emergencyPhone).length < 11)
        return setError("Please enter a valid emergency contact phone");
      void saveRequiredAndAdvance();
    }
  };

  const goBack = () => {
    setError(null);
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
  };

  const saveRequiredAndAdvance = async () => {
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
        date_of_birth: dob ? dob.toISOString().slice(0, 10) : null,
        phone: user.phone ? "+" + user.phone.replace(/\D/g, "") : null,
        email: email.trim(),
        emergency_contact_name: emergencyName.trim(),
        emergency_contact_phone: normalizePhone(emergencyPhone),
        default_mobility_needs: mobility,
        onboarding_complete: true,
      },
      { onConflict: "id" },
    );
    setLoading(false);
    if (upsertErr) {
      setError(upsertErr.message);
      return;
    }
    setStep(3);
  };

  const finishOptional = async (skip: boolean) => {
    setError(null);
    if (skip) {
      // Required step already marked onboarding_complete=true.
      // Do NOT call refresh() here — it would trigger the auth guard
      // in _layout.tsx to immediately redirect to /(tabs), skipping step 4.
      setStep(4);
      return;
    }
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      setError("You're not signed in. Please log in again.");
      return;
    }
    const { error: upsertErr } = await supabase
      .from("patients")
      .update({
        preferred_language: language,
        referral_source: referral,
      })
      .eq("id", userData.user.id);
    if (upsertErr) {
      setLoading(false);
      setError(upsertErr.message);
      return;
    }
    setLoading(false);
    setStep(4);
  };

  const finishWhoFor = async (mode: "self" | "other") => {
    if (mode === "other") {
      // Navigate FIRST so the auth guard doesn't intercept while we
      // refresh — /care/add isn't in the "redirect onboarded users away"
      // list, so refresh inside that screen is safe.
      router.replace("/care/add?from=onboarding");
      return;
    }
    // "self": refresh auth — the guard sees onboarded=true on /onboarding
    // and redirects us to /(tabs) for free.
    setLoading(true);
    await refresh();
    setLoading(false);
  };

  const ProgressDots = () => (
    <View style={styles.progress}>
      {[1, 2, 3, 4].map((n) => (
        <View
          key={n}
          style={[
            styles.dot,
            n <= step && styles.dotActive,
            n === step && styles.dotCurrent,
          ]}
        />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.topBar}>
          {step > 1 && step < 4 ? (
            <Pressable
              onPress={goBack}
              hitSlop={10}
              style={({ pressed }) => [
                styles.backBtn,
                pressed && styles.pressed,
              ]}
              accessibilityLabel="Back"
            >
              <Feather name="arrow-left" size={20} color={NAVY} />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
          <Text style={styles.stepLabel}>
            Step {step} of {TOTAL_STEPS}
          </Text>
          {step === 3 ? (
            <Pressable
              onPress={() => void finishOptional(true)}
              hitSlop={10}
              disabled={loading}
              style={({ pressed }) => [
                styles.skipBtn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.skipText}>Skip for now</Text>
            </Pressable>
          ) : (
            <View style={{ width: 92 }} />
          )}
        </View>

        <ProgressDots />

        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Create your account</Text>
                <Text style={styles.subtitle}>
                  We&apos;ll use these details to book your rides and send HSA /
                  FSA receipts.
                </Text>
              </View>

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

              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={MUTED}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!loading}
              />
              <Text style={styles.helper}>
                Required for HSA / FSA receipts.
              </Text>

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
            </>
          )}

          {step === 2 && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Safety &amp; needs</Text>
                <Text style={styles.subtitle}>
                  Required for medical transport. We&apos;ll only contact your
                  emergency contact in case of an issue during your ride.
                </Text>
              </View>

              <Text style={styles.label}>Emergency contact name</Text>
              <TextInput
                style={styles.input}
                placeholder="Alex Doe"
                placeholderTextColor={MUTED}
                value={emergencyName}
                onChangeText={setEmergencyName}
                autoCapitalize="words"
                editable={!loading}
              />

              <Text style={styles.label}>Emergency contact phone</Text>
              <TextInput
                style={styles.input}
                placeholder="(555) 123-4567"
                placeholderTextColor={MUTED}
                value={emergencyPhone}
                onChangeText={setEmergencyPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
                editable={!loading}
              />

              <Text style={[styles.label, { marginTop: 22 }]}>
                Default mobility needs
              </Text>
              <Text style={styles.helper}>
                You can change this on each ride.
              </Text>
              {MOBILITY_OPTIONS.map((opt) => (
                <ChoiceRow
                  key={opt.key}
                  label={opt.label}
                  sub={opt.sub}
                  selected={mobility === opt.key}
                  onPress={() => setMobility(opt.key)}
                />
              ))}
            </>
          )}

          {step === 3 && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>A few preferences</Text>
                <Text style={styles.subtitle}>
                  Optional — these help us tailor your experience. You can skip
                  and update them later in Settings.
                </Text>
              </View>

              <Text style={styles.label}>Preferred language</Text>
              {LANGUAGE_OPTIONS.map((opt) => (
                <ChoiceRow
                  key={opt.key}
                  label={opt.label}
                  selected={language === opt.key}
                  onPress={() => setLanguage(opt.key)}
                />
              ))}

              <Text style={[styles.label, { marginTop: 22 }]}>
                How did you hear about CareVoy?
              </Text>
              {REFERRAL_OPTIONS.map((opt) => (
                <ChoiceRow
                  key={opt.key}
                  label={opt.label}
                  selected={referral === opt.key}
                  onPress={() => setReferral(opt.key)}
                />
              ))}
            </>
          )}

          {step === 4 && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Who will use CareVoy?</Text>
                <Text style={styles.subtitle}>
                  You can always add or change this later in Settings.
                </Text>
              </View>

              <Pressable
                onPress={() => void finishWhoFor("self")}
                disabled={loading}
                style={({ pressed }) => [
                  styles.bigChoice,
                  pressed && styles.pressed,
                  loading && styles.bigChoiceDisabled,
                ]}
              >
                <View style={styles.bigChoiceIcon}>
                  <Feather name="user" size={22} color={NAVY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigChoiceLabel}>
                    I&apos;m booking for myself
                  </Text>
                  <Text style={styles.bigChoiceSub}>
                    Rides, receipts, and reminders all go to you.
                  </Text>
                </View>
                {loading ? (
                  <ActivityIndicator size="small" color={MUTED} />
                ) : (
                  <Feather name="chevron-right" size={20} color={MUTED} />
                )}
              </Pressable>

              <Pressable
                onPress={() => void finishWhoFor("other")}
                disabled={loading}
                style={({ pressed }) => [
                  styles.bigChoice,
                  pressed && styles.pressed,
                  loading && styles.bigChoiceDisabled,
                ]}
              >
                <View
                  style={[
                    styles.bigChoiceIcon,
                    { backgroundColor: "rgba(0,194,168,0.12)" },
                  ]}
                >
                  <Feather name="users" size={22} color={NAVY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigChoiceLabel}>
                    I&apos;m booking for someone in my care
                  </Text>
                  <Text style={styles.bigChoiceSub}>
                    A parent, spouse, child, or other family member. You stay in
                    control of their rides.
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={MUTED} />
              </Pressable>
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step !== 4 && (
            <Pressable
              style={({ pressed }) => [
                styles.button,
                (loading || pressed) && styles.buttonPressed,
              ]}
              onPress={
                step === 3 ? () => void finishOptional(false) : goNext
              }
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={NAVY} />
              ) : (
                <Text style={styles.buttonText}>
                  {step === 3
                    ? "Save & continue"
                    : step === 2
                      ? "Save & continue"
                      : "Continue"}
                </Text>
              )}
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ChoiceRow({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.radio,
          selected && { borderColor: TEAL, backgroundColor: TEAL },
        ]}
      >
        {selected ? (
          <Feather name="check" size={12} color={NAVY} />
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.choiceLabel}>{label}</Text>
        {sub ? <Text style={styles.choiceSub}>{sub}</Text> : null}
      </View>
    </Pressable>
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
    paddingTop: 8,
    paddingBottom: 8,
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
  stepLabel: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 92,
    alignItems: "flex-end",
  },
  skipText: {
    color: TEAL,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  progress: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 28,
    marginTop: 4,
    marginBottom: 8,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
  },
  dotActive: { backgroundColor: TEAL },
  dotCurrent: { backgroundColor: TEAL },
  container: { padding: 28, paddingTop: 20, paddingBottom: 60 },
  header: { marginBottom: 20 },
  title: {
    color: NAVY,
    fontSize: 26,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: MUTED,
    fontSize: 14,
    marginTop: 8,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  label: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
    marginTop: 14,
  },
  helper: {
    color: MUTED,
    fontSize: 12,
    marginBottom: 6,
    marginTop: -2,
    fontFamily: "Inter_400Regular",
  },
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
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  choiceSelected: {
    borderColor: TEAL,
    backgroundColor: "rgba(0,194,168,0.08)",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceLabel: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  choiceSub: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  button: {
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 28,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  pressed: { opacity: 0.85 },
  bigChoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginTop: 12,
    boxShadow: "0px 1px 3px rgba(5, 13, 31, 0.04)",
  },
  bigChoiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: INPUT_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  bigChoiceLabel: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  bigChoiceSub: {
    color: MUTED,
    fontSize: 13,
    marginTop: 4,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  bigChoiceDisabled: { opacity: 0.6 },
  error: {
    color: ERROR,
    fontSize: 13,
    marginTop: 16,
    fontFamily: "Inter_500Medium",
  },
});
