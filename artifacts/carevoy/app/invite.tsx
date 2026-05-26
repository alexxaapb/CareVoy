import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
const MUTED = "#6B7280";
const INPUT_BG = "#F8FAFC";
const BORDER = "#E2E8F0";
const ERROR = "#EF4444";

type Invite = {
  id: string;
  role: "nemt" | "coordinator";
  email: string | null;
  company_name: string | null;
  facility_name: string | null;
  expires_at: string;
};

export default function InviteRedeem() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = params.token;

  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!token) {
      setError("This invite link is invalid.");
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error: err } = await supabase
        .from("invites")
        .select("id, role, email, company_name, facility_name, expires_at, used_at")
        .eq("token", token)
        .maybeSingle();
      if (err || !data) {
        setError("This invite link is invalid or has expired.");
      } else if (data.used_at) {
        setError("This invite has already been used.");
      } else if (new Date(data.expires_at) < new Date()) {
        setError("This invite link has expired. Please contact CareVoy for a new one.");
      } else {
        setInvite(data);
        if (data.email) setEmail(data.email);
        if (data.company_name) setCompanyName(data.company_name);
        if (data.facility_name) setCompanyName(data.facility_name);
      }
      setLoading(false);
    })();
  }, [token]);

  const onSubmit = async () => {
    if (!invite) return;
    if (!fullName.trim() || !email.trim() || !password || !companyName.trim() || !phone.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // 1. Create auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        phone: phone.trim(),
      });
      if (authErr) throw authErr;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Failed to create account.");

      // 2. Create appropriate role record
      if (invite.role === "nemt") {
        const { error: nemtErr } = await supabase.from("nemt_partners").insert({
          id: userId,
          company_name: companyName.trim(),
          active: true,
        });
        if (nemtErr) throw nemtErr;
        await supabase.from("staff").insert({
          id: userId,
          full_name: fullName.trim(),
          role: "nemt",
        });
      } else {
        // coordinator
        const { error: hospErr } = await supabase.from("hospitals").insert({
          name: companyName.trim(),
          active: true,
        }).select().single();
        if (hospErr) throw hospErr;
        await supabase.from("staff").insert({
          id: userId,
          full_name: fullName.trim(),
          role: "coordinator",
        });
      }

      // 3. Mark invite as used
      await supabase
        .from("invites")
        .update({ used_at: new Date().toISOString() })
        .eq("id", invite.id);

      // 4. Redirect to appropriate dashboard
      if (invite.role === "nemt") {
        router.replace("/driver");
      } else {
        router.replace("/coordinator");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signup failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !invite) {
    return (
      <SafeAreaView style={styles.safe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Feather name="alert-circle" size={48} color={ERROR} />
          <Text style={styles.errorTitle}>Invalid Invite</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.helpText}>
            Need help? Email partners@carevoy.co
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const roleLabel = invite?.role === "nemt" ? "NEMT Partner" : "Facility Coordinator";
  const companyLabel = invite?.role === "nemt" ? "Company Name" : "Facility Name";

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
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
              <Image
                source={require("../assets/images/icon.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <View>
                <Text style={styles.brand}>CareVoy</Text>
                <Text style={styles.brandSub}>Partner Onboarding</Text>
              </View>
            </View>

            <Text style={styles.title}>Welcome to CareVoy</Text>
            <Text style={styles.subtitle}>
              Complete your {roleLabel} account setup. This takes about 2 minutes.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Your Full Name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Jane Smith"
                placeholderTextColor={MUTED}
                style={styles.input}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>{companyLabel}</Text>
              <TextInput
                value={companyName}
                onChangeText={setCompanyName}
                placeholder={invite?.role === "nemt" ? "Acme Medical Transport" : "St. Mary's Hospital"}
                placeholderTextColor={MUTED}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Work Phone</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="(555) 123-4567"
                placeholderTextColor={MUTED}
                style={styles.input}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@company.com"
                placeholderTextColor={MUTED}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Create Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Minimum 8 characters"
                placeholderTextColor={MUTED}
                style={styles.input}
                secureTextEntry
              />
            </View>

            {error ? <Text style={styles.errorInline}>{error}</Text> : null}

            <Pressable
              onPress={onSubmit}
              disabled={submitting}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && { opacity: 0.85 },
                submitting && { opacity: 0.6 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={WHITE} />
              ) : (
                <Text style={styles.submitText}>Create Account & Continue</Text>
              )}
            </Pressable>

            <Text style={styles.tosText}>
              By creating an account, you agree to CareVoy&apos;s Terms of Service and Privacy Policy.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F1F5F9" },
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 24,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  logo: { width: 44, height: 44, borderRadius: 10 },
  brand: { color: NAVY, fontSize: 18, fontWeight: "700" },
  brandSub: { color: MUTED, fontSize: 12 },
  title: { color: NAVY, fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: MUTED, fontSize: 14, lineHeight: 20, marginBottom: 24 },
  field: { marginBottom: 16 },
  label: { color: NAVY, fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: INPUT_BG,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: NAVY,
  },
  errorInline: { color: ERROR, fontSize: 13, marginBottom: 12 },
  errorTitle: { color: NAVY, fontSize: 20, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  errorText: { color: MUTED, fontSize: 14, textAlign: "center", marginBottom: 16 },
  helpText: { color: TEAL, fontSize: 13, fontWeight: "600" },
  submitBtn: {
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  submitText: { color: WHITE, fontSize: 15, fontWeight: "700" },
  tosText: { color: MUTED, fontSize: 11, textAlign: "center", marginTop: 16, lineHeight: 16 },
});
