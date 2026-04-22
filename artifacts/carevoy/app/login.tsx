import React, { useState } from "react";
import {
  ActivityIndicator,
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
const MUTED = "#8A93A6";
const INPUT_BG = "#0E1A33";
const ERROR = "#FF6B6B";

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+1" + digits;
  return "+" + digits;
}

export default function LoginScreen() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
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
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      phone: normalizePhone(phone),
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

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <View style={styles.brand}>
            <View style={styles.logoMark}>
              <Text style={styles.logoMarkText}>C</Text>
            </View>
            <Text style={styles.logoWord}>CareVoy</Text>
            <Text style={styles.tagline}>Rides for surgery, simplified.</Text>
          </View>

          <View style={styles.form}>
            {step === "phone" ? (
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
    paddingTop: 60,
    paddingBottom: 40,
  },
  brand: { alignItems: "center", marginTop: 40 },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logoMarkText: {
    color: NAVY,
    fontSize: 36,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
  },
  logoWord: {
    color: WHITE,
    fontSize: 32,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  tagline: {
    color: MUTED,
    fontSize: 15,
    marginTop: 8,
    fontFamily: "Inter_400Regular",
  },
  form: { width: "100%" },
  label: {
    color: WHITE,
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
    color: WHITE,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
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
  },
  buttonPressed: { opacity: 0.85 },
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
