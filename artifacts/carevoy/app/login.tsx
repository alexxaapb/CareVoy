import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { supabase } from "../lib/supabase";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const GOLD = "#F5A623";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const LIGHT_MUTED = "#94A3B8";
const INPUT_BG = "#F8FAFC";
const BORDER = "#E2E8F0";
const ERROR = "#EF4444";

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  return "+" + digits;
}

export default function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code" | "booking-for">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setError(null);
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Enter a valid phone number");
      return;
    }
    const normalized = normalizePhone(phone);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      phone: normalized,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setStep("code");
  };

  const verifyCode = async () => {
    setError(null);
    if (code.length !== 6) { setError("Enter the 6-digit code"); return; }
    setLoading(true);
    const { data: verifyData, error: err } = await supabase.auth.verifyOtp({
      phone: normalizePhone(phone),
      token: code,
      type: "sms",
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    // Persist the verified OTP phone onto the patient row so it shows in the
    // profile. The row is created by the auth trigger, so a plain update is safe.
    const userId = verifyData.user?.id;
    if (userId) {
      // fire-and-forget so a failed phone-save never blocks sign-in
      supabase
        .from("patients")
        .update({ phone: normalizePhone(phone) })
        .eq("id", userId);
    }
    setStep("booking-for");
  };

  const handleBookingFor = (forSelf: boolean) => {
    if (forSelf) {
      router.replace("/(tabs)");
    } else {
      router.replace("/(tabs)?caregiverMode=true");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <View style={styles.brand}>
            <Image
              source={require("../assets/images/icon.png")}
              style={styles.logoMark}
              resizeMode="contain"
            />
            <Text style={styles.brandWord}>CareVoy</Text>
            <Text style={styles.tagline}>
              Medical rides. HSA/FSA. Simplified.
            </Text>
          </View>

          <View style={styles.form}>
            {step === "phone" && (
              <>
                <Text style={styles.label}>Phone number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="(555) 123-4567"
                  placeholderTextColor={MUTED}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  value={phone}
                  onChangeText={setPhone}
                  editable={!loading}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable
                  style={({ pressed }) => [styles.button, (loading || pressed) && styles.buttonPressed]}
                  onPress={sendCode}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color={NAVY} /> : <Text style={styles.buttonText}>Send Code</Text>}
                </Pressable>
                <Text style={styles.hint}>
                  We&apos;ll text you a 6-digit code to verify your number.
                </Text>
                <Text
                  style={{
                    color: MUTED,
                    fontSize: 11,
                    lineHeight: 16,
                    textAlign: "center",
                    marginTop: 14,
                  }}
                >
                  By tapping Send Code, you agree to receive SMS messages from
                  CareVoy at the number provided, including one-time verification
                  codes and ride updates. Msg &amp; data rates may apply. Msg
                  frequency varies. Reply STOP to cancel, HELP for help. See our
                  Privacy Policy at carevoy.co/privacy-policy and Terms at
                  carevoy.co/terms.
                </Text>
              </>
            )}

            {step === "code" && (
              <>
                <Text style={styles.label}>Enter the code</Text>
                <Text style={styles.subLabel}>Sent to {normalizePhone(phone)}</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="123456"
                  placeholderTextColor={MUTED}
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                  editable={!loading}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable
                  style={({ pressed }) => [styles.button, (loading || pressed) && styles.buttonPressed]}
                  onPress={verifyCode}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color={NAVY} /> : <Text style={styles.buttonText}>Verify & Sign In</Text>}
                </Pressable>
                <Pressable onPress={() => { setStep("phone"); setCode(""); setError(null); }} disabled={loading}>
                  <Text style={styles.link}>Use a different number</Text>
                </Pressable>
              </>
            )}

            {step === "booking-for" && (
              <>
                <Text style={styles.bookingTitle}>Who are you booking for?</Text>
                <Text style={styles.bookingSubtitle}>
                  You can always book for someone else later too.
                </Text>

                <Pressable
                  style={({ pressed }) => [styles.choiceCard, pressed && styles.choiceCardPressed]}
                  onPress={() => handleBookingFor(true)}
                >
                  <Text style={styles.choiceEmoji}>🙋</Text>
                  <View style={styles.choiceText}>
                    <Text style={styles.choiceTitle}>Myself</Text>
                    <Text style={styles.choiceDesc}>I'm booking my own medical rides</Text>
                  </View>
                  <Text style={styles.choiceArrow}>→</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.choiceCard, styles.choiceCardAlt, pressed && styles.choiceCardPressed]}
                  onPress={() => handleBookingFor(false)}
                >
                  <Text style={styles.choiceEmoji}>👨‍👩‍👧</Text>
                  <View style={styles.choiceText}>
                    <Text style={styles.choiceTitle}>Someone else</Text>
                    <Text style={styles.choiceDesc}>I'm helping a family member or patient</Text>
                  </View>
                  <Text style={styles.choiceArrow}>→</Text>
                </Pressable>
              </>
            )}
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
    paddingTop: 40,
    paddingBottom: 40,
  },
  brand: { alignItems: "center", marginTop: 24 },
  logoMark: { width: 88, height: 88, borderRadius: 22, marginBottom: 14 },
  brandWord: { color: WHITE, fontSize: 30, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  tagline: { color: LIGHT_MUTED, fontSize: 15, marginTop: 6, fontFamily: "Inter_400Regular" },
  form: { width: "100%" },
  label: { color: WHITE, fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  subLabel: { color: LIGHT_MUTED, fontSize: 13, marginBottom: 12, fontFamily: "Inter_400Regular" },
  input: {
    backgroundColor: INPUT_BG,
    color: NAVY,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    fontFamily: "Inter_500Medium",
    marginBottom: 14,
  },
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: "center", fontFamily: "Inter_600SemiBold" },
  button: {
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 4,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 3,
  },
  buttonPressed: { opacity: 0.9 },
  buttonText: { color: NAVY, fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold" },
  hint: { color: LIGHT_MUTED, fontSize: 13, marginTop: 16, textAlign: "center", fontFamily: "Inter_400Regular" },
  link: { color: TEAL, fontSize: 14, textAlign: "center", marginTop: 16, fontFamily: "Inter_500Medium" },
  error: { color: ERROR, fontSize: 13, marginBottom: 10, fontFamily: "Inter_500Medium" },
  footer: { alignItems: "center", paddingHorizontal: 12, gap: 4 },
  footerLabel: { color: LIGHT_MUTED, fontSize: 13, fontFamily: "Inter_500Medium" },
  footerLink: { color: WHITE, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },

  // Booking-for screen
  bookingTitle: {
    color: WHITE,
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
    textAlign: "center",
  },
  bookingSubtitle: {
    color: LIGHT_MUTED,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 32,
  },
  choiceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: INPUT_BG,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    gap: 14,
  },
  choiceCardAlt: {
    borderColor: TEAL,
    backgroundColor: "#F0FDFB",
  },
  choiceCardPressed: { opacity: 0.8 },
  choiceEmoji: { fontSize: 28 },
  choiceText: { flex: 1 },
  choiceTitle: { color: NAVY, fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", marginBottom: 2 },
  choiceDesc: { color: MUTED, fontSize: 13, fontFamily: "Inter_400Regular" },
  choiceArrow: { color: TEAL, fontSize: 20, fontWeight: "700" },
});