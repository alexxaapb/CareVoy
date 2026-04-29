import { Feather } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";

WebBrowser.maybeCompleteAuthSession();

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const INPUT_BG = "#F8FAFC";
const BORDER = "#E2E8F0";
const ERROR = "#EF4444";
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

type ConnectionInfo = {
  email: string | null;
  expiresAt: string | null;
};

export default function ConnectCalendarScreen() {
  const router = useRouter();

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;
  const isConfigured = !!webClientId;

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId,
    iosClientId,
    androidClientId,
    scopes: SCOPES,
  });

  const [info, setInfo] = useState<ConnectionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCurrent = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("patients")
      .select(
        "google_calendar_email, google_calendar_token_expires_at, google_calendar_access_token",
      )
      .eq("id", userData.user.id)
      .maybeSingle();
    if (data?.google_calendar_access_token) {
      setInfo({
        email: data.google_calendar_email ?? null,
        expiresAt: data.google_calendar_token_expires_at ?? null,
      });
    } else {
      setInfo(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadCurrent();
  }, []);

  // When OAuth completes, store the token in the patient record.
  useEffect(() => {
    (async () => {
      if (response?.type !== "success") return;
      const accessToken = response.authentication?.accessToken;
      const expiresIn = response.authentication?.expiresIn ?? 3600;
      if (!accessToken) return;
      setBusy(true);
      setError(null);

      // Get the user's Google email so we can show "Connected as ___".
      let gcalEmail: string | null = null;
      try {
        const me = await fetch(
          "https://www.googleapis.com/oauth2/v2/userinfo",
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (me.ok) {
          const j = (await me.json()) as { email?: string };
          gcalEmail = j.email ?? null;
        }
      } catch {
        // non-fatal
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setBusy(false);
        setError("You're not signed in.");
        return;
      }
      const expiresAt = new Date(
        Date.now() + (expiresIn - 60) * 1000,
      ).toISOString();
      const { error: upErr } = await supabase
        .from("patients")
        .update({
          google_calendar_access_token: accessToken,
          google_calendar_token_expires_at: expiresAt,
          google_calendar_email: gcalEmail,
        })
        .eq("id", userData.user.id);
      setBusy(false);
      if (upErr) {
        setError(upErr.message);
        return;
      }
      await loadCurrent();
    })();
  }, [response]);

  const onConnect = async () => {
    setError(null);
    if (!isConfigured) {
      setError(
        "Calendar sync isn't configured yet. Ask your team to add the Google OAuth client IDs.",
      );
      return;
    }
    try {
      await promptAsync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  const doDisconnect = async () => {
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setBusy(false);
      return;
    }
    await supabase
      .from("patients")
      .update({
        google_calendar_access_token: null,
        google_calendar_refresh_token: null,
        google_calendar_token_expires_at: null,
        google_calendar_email: null,
      })
      .eq("id", userData.user.id);
    setBusy(false);
    setInfo(null);
  };

  const onDisconnect = () => {
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (
        typeof window !== "undefined" &&
        window.confirm("Disconnect Google Calendar?")
      ) {
        void doDisconnect();
      }
      return;
    }
    Alert.alert(
      "Disconnect calendar",
      "We'll stop checking your calendar for upcoming appointments. You can reconnect anytime.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: () => void doDisconnect(),
        },
      ],
    );
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
        <Text style={styles.topTitle}>Calendar Integration</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.iconWrap}>
          <Feather name="calendar" size={32} color={TEAL} />
        </View>
        <Text style={styles.title}>Google Calendar</Text>
        <Text style={styles.subtitle}>
          We&apos;ll scan upcoming events for medical keywords (doctor,
          dialysis, surgery, hospital names, etc.) and offer one-tap CareVoy
          bookings. We never write to your calendar and we don&apos;t store
          calendar data.
        </Text>

        {loading ? (
          <ActivityIndicator color={TEAL} style={{ marginTop: 24 }} />
        ) : info ? (
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Feather name="check-circle" size={18} color={TEAL} />
              <Text style={styles.statusText}>
                Connected{info.email ? ` as ${info.email}` : ""}
              </Text>
            </View>
            {info.expiresAt ? (
              <Text style={styles.statusSub}>
                Access expires{" "}
                {new Date(info.expiresAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                . Reconnect anytime to refresh.
              </Text>
            ) : null}
            <Pressable
              onPress={onDisconnect}
              disabled={busy}
              style={({ pressed }) => [
                styles.dangerBtn,
                pressed && styles.pressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={ERROR} />
              ) : (
                <Text style={styles.dangerText}>Disconnect</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            disabled={!request || busy}
            onPress={onConnect}
            style={({ pressed }) => [
              styles.button,
              (!request || busy || pressed) && styles.buttonPressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <>
                <Feather name="link" size={18} color={NAVY} />
                <Text style={styles.buttonText}>Connect Google Calendar</Text>
              </>
            )}
          </Pressable>
        )}

        {!isConfigured ? (
          <View style={styles.warn}>
            <Feather name="alert-triangle" size={14} color="#B45309" />
            <Text style={styles.warnText}>
              Calendar sync isn&apos;t configured yet. A Google OAuth client ID
              needs to be added before you can connect.
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorRow}>
            <Feather name="alert-circle" size={14} color={ERROR} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Text style={styles.privacy}>
          We request only read access to your calendar. You can disconnect at
          any time, and you can also revoke access from your Google account
          settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
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
  },
  container: { padding: 24, alignItems: "center" },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "rgba(0,194,168,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  title: {
    color: NAVY,
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 24,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: "100%",
    maxWidth: 360,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  statusCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 8,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  statusSub: {
    color: MUTED,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  dangerBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ERROR,
  },
  dangerText: {
    color: ERROR,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  warn: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(251,191,36,0.1)",
    borderWidth: 1,
    borderColor: "#FBBF24",
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    width: "100%",
    maxWidth: 360,
  },
  warnText: {
    color: "#B45309",
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
    fontFamily: "Inter_500Medium",
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
    marginTop: 16,
    width: "100%",
    maxWidth: 360,
  },
  errorText: {
    color: ERROR,
    fontSize: 13,
    flex: 1,
    fontFamily: "Inter_500Medium",
  },
  privacy: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 32,
    textAlign: "center",
    paddingHorizontal: 16,
    fontFamily: "Inter_400Regular",
  },
  pressed: { opacity: 0.85 },
});
