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
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const INPUT_BG = "#F8FAFC";
const BORDER = "#E2E8F0";
const ERROR = "#EF4444";
const GOLD = "#F5A623";

type Mode = "patient" | "staff";

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  return "+" + digits;
}

const TEST_PHONE = "+15005550006";
const TEST_OTP = "123456";

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("patient");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setError(null);
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Enter a valid phone number");
      return;
    }
    const normalized = normalizePhone(phone);
    // Test-mode bypass: skip the SMS round-trip entirely for the dev
    // sandbox number. We still call verifyOtp, which Supabase will
    // accept because the matching test number/code pair must be
    // configured in the Auth dashboard.
    if (normalized === TEST_PHONE) {
      setStep("code");
      setCode(TEST_OTP);
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      phone: normalized,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setStep("code");
  };

  const verifyCode = async () => {
    setError(null);
    if (code.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.verifyOtp({
      phone: normalizePhone(phone),
      token: code,
      type: "sms",
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace("/(tabs)");
  };

  const staffSignIn = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    // _layout will route based on role
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setStep("phone");
    setCode("");
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
              source={require("../assets/images/logo-motion.png")}
              style={styles.logoImg}
              resizeMode="contain"
            />
            <Text style={styles.tagline}>
              Medical rides. HSA/FSA. Simplified.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.tabs}>
              <Pressable
                style={[styles.tab, mode === "patient" && styles.tabActive]}
                onPress={() => switchMode("patient")}
              >
                <Text
                  style={[
                    styles.tabText,
                    mode === "patient" && styles.tabTextActive,
                  ]}
                >
                  Patient
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tab, mode === "staff" && styles.tabActive]}
                onPress={() => switchMode("staff")}
              >
                <Text
                  style={[
                    styles.tabText,
                    mode === "staff" && styles.tabTextActive,
                  ]}
                >
                  Driver / Staff
                </Text>
              </Pressable>
            </View>

            {mode === "patient" ? (
              step === "phone" ? (
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
                    style={({ pressed }) => [
                      styles.button,
                      (loading || pressed) && styles.buttonPressed,
                    ]}
                    onPress={sendCode}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color={NAVY} />
                    ) : (
                      <Text style={styles.buttonText}>Send Code</Text>
                    )}
                  </Pressable>
                  <Text style={styles.hint}>
                    We&apos;ll text you a 6-digit code to verify your number.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Enter the code</Text>
                  <Text style={styles.subLabel}>
                    Sent to {normalizePhone(phone)}
                  </Text>
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
                    style={({ pressed }) => [
                      styles.button,
                      (loading || pressed) && styles.buttonPressed,
                    ]}
                    onPress={verifyCode}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color={NAVY} />
                    ) : (
                      <Text style={styles.buttonText}>Verify & Sign In</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setStep("phone");
                      setCode("");
                      setError(null);
                    }}
                    disabled={loading}
                  >
                    <Text style={styles.link}>Use a different number</Text>
                  </Pressable>
                </>
              )
            ) : (
              <>
                <Text style={styles.label}>Work email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="driver@nemtcompany.com"
                  placeholderTextColor={MUTED}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChangeText={setEmail}
                  editable={!loading}
                />
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={MUTED}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Pressable
                  style={({ pressed }) => [
                    styles.button,
                    (loading || pressed) && styles.buttonPressed,
                  ]}
                  onPress={staffSignIn}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={NAVY} />
                  ) : (
                    <Text style={styles.buttonText}>Sign In</Text>
                  )}
                </Pressable>
                <Text style={styles.hint}>
                  For NEMT drivers and care coordinators.
                </Text>
              </>
            )}
          </View>
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
  brand: { alignItems: "center", marginTop: 24 },
  logoImg: { width: 200, height: 140, marginBottom: 4 },
  tagline: {
    color: MUTED,
    fontSize: 15,
    marginTop: 4,
    fontFamily: "Inter_400Regular",
  },
  form: { width: "100%" },
  tabs: {
    flexDirection: "row",
    backgroundColor: INPUT_BG,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: { backgroundColor: TEAL },
  tabText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  tabTextActive: { color: NAVY },
  label: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
  },
  subLabel: {
    color: MUTED,
    fontSize: 13,
    marginBottom: 12,
    fontFamily: "Inter_400Regular",
  },
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
  codeInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: "center",
    fontFamily: "Inter_600SemiBold",
  },
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
  buttonText: {
    color: NAVY,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  hint: {
    color: MUTED,
    fontSize: 13,
    marginTop: 16,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  link: {
    color: TEAL,
    fontSize: 14,
    textAlign: "center",
    marginTop: 16,
    fontFamily: "Inter_500Medium",
  },
  error: {
    color: ERROR,
    fontSize: 13,
    marginBottom: 10,
    fontFamily: "Inter_500Medium",
  },
});
