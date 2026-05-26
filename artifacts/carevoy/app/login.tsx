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

    // Call Edge Function for server-side rate limiting
    try {
      const response = await fetch(
        `https://byflpckbjjumxxjxoplk.supabase.co/functions/v1/send-otp-rate-limited`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ phone: normalized }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setLoading(false);
        setError(result.error || 'Failed to send code');
        return;
      }

      setLoading(false);
      setStep("code");
    } catch (err) {
      setLoading(false);
      setError('Network error. Please try again.');
    }
  };

  const verifyCode = async () => {
    setError(null);
    if (code.length !== 6) { setError("Enter the 6-digit code"); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.verifyOtp({
      phone: normalizePhone(phone),
      token: code,
      type: "sms",
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
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
              style={{ width: 90, height: 90, marginBottom: 16, borderRadius: 20 }}
              resizeMode="contain"
            />
            <Text style={styles.welcomeTitle}>Welcome</Text>
            <Text style={styles.welcomeSub}>Enter your number to continue</Text>
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
                    <View style={styles.choiceText}>
                    <Text style={styles.choiceTitle}>Someone else</Text>
                    <Text style={styles.choiceDesc}>I'm helping a family member or patient</Text>
                  </View>
                  <Text style={styles.choiceArrow}>→</Text>
                </Pressable>
              </>
            )}
          </View>

          {step !== "booking-for" && (
            <View style={styles.footer}>
              <Text style={styles.footerLabel}>Healthcare facility or driver?</Text>
              <Pressable onPress={() => router.push("/partners")}>
                <Text style={styles.footerLink}>Partner sign-in →</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
    paddingTop: 40,
    paddingBottom: 40,
  },
  brand: { alignItems: "center", marginTop: 48, marginBottom: 8 },
  logoImg: { width: 64, height: 64, marginBottom: 12, borderRadius: 16 },
  tagline: { color: MUTED, fontSize: 15, marginTop: 4, fontFamily: "System" },
  form: { width: "100%" },
  welcomeTitle: { color: NAVY, fontSize: 26, fontWeight: "700", fontFamily: "System", textAlign: "center", marginBottom: 4 },
  welcomeSub: { color: MUTED, fontSize: 14, fontFamily: "System", textAlign: "center", marginBottom: 28 },
  label: { color: NAVY, fontSize: 12, fontWeight: "600", fontFamily: "System", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  subLabel: { color: MUTED, fontSize: 13, marginBottom: 12, fontFamily: "System" },
  input: {
    backgroundColor: INPUT_BG,
    color: NAVY,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: "System",
    marginBottom: 12,
  },
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: "center", fontFamily: "System" },
  button: {
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: WHITE, fontSize: 16, fontWeight: "700", fontFamily: "System" },
  hint: { color: MUTED, fontSize: 12, marginTop: 14, textAlign: "center", fontFamily: "System" },
  link: { color: TEAL, fontSize: 14, textAlign: "center", marginTop: 16, fontFamily: "System" },
  error: { color: ERROR, fontSize: 13, marginBottom: 10, fontFamily: "System" },
  footer: { alignItems: "center", paddingHorizontal: 12, gap: 4 },
  footerLabel: { color: MUTED, fontSize: 13, fontFamily: "System" },
  footerLink: { color: NAVY, fontSize: 13, fontWeight: "600", fontFamily: "System", textAlign: "center" },

  // Booking-for screen
  bookingTitle: {
    color: NAVY,
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "System",
    marginBottom: 8,
    textAlign: "center",
  },
  bookingSubtitle: {
    color: MUTED,
    fontSize: 14,
    fontFamily: "System",
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
  choiceText: { flex: 1 },
  choiceTitle: { color: NAVY, fontSize: 16, fontWeight: "700", fontFamily: "System", marginBottom: 2 },
  choiceDesc: { color: MUTED, fontSize: 13, fontFamily: "System" },
  choiceArrow: { color: TEAL, fontSize: 20, fontWeight: "700" },
});