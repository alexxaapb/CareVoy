import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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

import { supabase } from "../../lib/supabase";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const INPUT_BG = "#F8FAFC";
const BORDER = "#E2E8F0";
const ERROR = "#EF4444";

async function resolveRoleAndRedirect(
  router: ReturnType<typeof useRouter>,
  userId: string,
) {
  const [staffRes, coordRes] = await Promise.all([
    supabase.from("staff").select("role").eq("id", userId).maybeSingle(),
    supabase
      .from("hospital_coordinators")
      .select("id")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  if (staffRes.data?.role === "admin") {
    router.replace("/admin");
    return true;
  }
  if (staffRes.data?.role === "nemt") {
    router.replace("/driver");
    return true;
  }
  if (coordRes.data) {
    router.replace("/coordinator");
    return true;
  }
  return false;
}

export default function PartnersPortal() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  // Show the current session (if any) — but DON'T auto-redirect. The user came
  // to /partners on purpose, probably to switch accounts. Auto-bouncing them
  // into whichever dashboard their current session points at would trap them.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setCurrentEmail(data.session?.user?.email ?? null);
      setChecking(false);
    })();
  }, []);

  const switchAccount = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setCurrentEmail(null);
    setEmail("");
    setPassword("");
    setError(null);
    setLoading(false);
  };

  const onSignIn = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (err) {
      setLoading(false);
      setError(err.message);
      return;
    }
    const uid = data.user?.id;
    if (!uid) {
      setLoading(false);
      setError("Sign-in succeeded but no user was returned.");
      return;
    }
    const ok = await resolveRoleAndRedirect(router, uid);
    setLoading(false);
    if (!ok) {
      await supabase.auth.signOut();
      setError(
        "This account isn't linked to a partner role. Contact your CareVoy admin.",
      );
    }
  };

  if (checking) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.brandRow}>
              <View style={styles.logoMark}>
                <Text style={styles.logoMarkText}>C</Text>
              </View>
              <View>
                <Text style={styles.brandWord}>CareVoy</Text>
                <Text style={styles.brandSub}>Partner Portal</Text>
              </View>
            </View>

            <Text style={styles.title}>Sign in to your dashboard</Text>
            <Text style={styles.subtitle}>
              For NEMT drivers, hospital coordinators, and CareVoy admins.
              Patients should use the CareVoy mobile app instead.
            </Text>

            {currentEmail ? (
              <View
                style={{
                  backgroundColor: "#F8FAFC",
                  borderColor: "#E2E8F0",
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 12,
                  marginTop: 16,
                  marginBottom: 4,
                }}
              >
                <Text style={{ color: MUTED, fontSize: 12, marginBottom: 4 }}>
                  Currently signed in as
                </Text>
                <Text
                  style={{
                    color: NAVY,
                    fontSize: 14,
                    fontWeight: "600",
                    marginBottom: 10,
                  }}
                >
                  {currentEmail}
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={async () => {
                      const { data } = await supabase.auth.getSession();
                      const uid = data.session?.user?.id;
                      if (uid) await resolveRoleAndRedirect(router, uid);
                    }}
                    style={{
                      flex: 1,
                      backgroundColor: TEAL,
                      paddingVertical: 10,
                      borderRadius: 8,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: WHITE, fontWeight: "600" }}>
                      Continue
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={switchAccount}
                    disabled={loading}
                    style={{
                      flex: 1,
                      backgroundColor: WHITE,
                      borderColor: BORDER,
                      borderWidth: 1,
                      paddingVertical: 10,
                      borderRadius: 8,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: NAVY, fontWeight: "600" }}>
                      Use different account
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <Text style={styles.label}>Work email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@nemtcompany.com"
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

            {error ? (
              <View style={styles.errorRow}>
                <Feather name="alert-circle" size={14} color={ERROR} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                (loading || pressed) && styles.buttonPressed,
              ]}
              onPress={onSignIn}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={NAVY} />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </Pressable>

            <View style={styles.footer}>
              <Feather name="smartphone" size={14} color={MUTED} />
              <Text style={styles.footerText}>
                Are you a patient? Download CareVoy from the App Store or Google
                Play.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
  flex: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: NAVY,
    shadowOpacity: 0.06,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  logoMarkText: {
    color: NAVY,
    fontSize: 22,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
  },
  brandWord: {
    color: NAVY,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  brandSub: {
    color: TEAL,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  title: {
    color: NAVY,
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    marginBottom: 22,
    fontFamily: "Inter_400Regular",
  },
  label: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
    marginTop: 4,
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
    marginBottom: 14,
  },
  button: {
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 6,
  },
  buttonPressed: { opacity: 0.9 },
  buttonText: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: ERROR,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    marginTop: 4,
  },
  errorText: {
    color: ERROR,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  footerText: {
    color: MUTED,
    fontSize: 12,
    flex: 1,
    fontFamily: "Inter_400Regular",
  },
});
