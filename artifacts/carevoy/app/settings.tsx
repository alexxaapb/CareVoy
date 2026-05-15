import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
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

import { useCare } from "../lib/careContext";
import { supabase } from "../lib/supabase";
import { useAuthRefresh } from "./_layout";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const CARD = "#F8FAFC";
const BORDER = "#E2E8F0";
const RED = "#EF4444";

type Profile = {
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

type RowProps = {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  sub?: string;
  onPress: () => void;
  destructive?: boolean;
};

function MenuRow({ icon, label, sub, onPress, destructive }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.rowIcon,
          destructive && { backgroundColor: "rgba(239,68,68,0.1)" },
        ]}
      >
        <Feather name={icon} size={18} color={destructive ? RED : TEAL} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, destructive && { color: RED }]}>
          {label}
        </Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Feather name="chevron-right" size={18} color={MUTED} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { careRecipients, refresh: refreshCare } = useCare();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("patients")
      .select("full_name, phone, email")
      .eq("id", userId)
      .maybeSingle();
    setProfile({
      full_name: data?.full_name ?? null,
      phone: data?.phone ?? userData.user?.phone ?? null,
      email: data?.email ?? userData.user?.email ?? null,
    });
    await refreshCare();
  }, [refreshCare]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        await load();
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [load]),
  );

  const doSignOut = async () => {
  setSigningOut(true);
  try {
    await supabase.auth.signOut();
    // Force immediate navigation without waiting for auth state
    router.replace("/login");
  } catch (error) {
    console.error("Sign out error:", error);
    // Still navigate even if sign out fails
    router.replace("/login");
  } finally {
    setSigningOut(false);
  }
};
  const handleSignOut = () => {
    if (Platform.OS === "web") {
      // window.confirm is the only reliable way to confirm on web RN
      // (Alert.alert with buttons doesn't show on web)
      // eslint-disable-next-line no-alert
      if (
        typeof window !== "undefined" &&
        window.confirm("Sign out of CareVoy?")
      ) {
        void doSignOut();
      }
      return;
    }
    Alert.alert("Sign out", "Sign out of CareVoy?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => void doSignOut() },
    ]);
  };

  const comingSoon = (label: string) => () => {
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (typeof window !== "undefined") window.alert(`${label} — coming soon`);
      return;
    }
    Alert.alert(label, "Coming soon.");
  };

  const { refresh: refreshAuth } = useAuthRefresh();
  const restartOnboarding = async () => {
    const { data: u } = await supabase.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) return;
    const { error: upErr } = await supabase
      .from("patients")
      .update({ onboarding_complete: false })
      .eq("id", userId);
    if (upErr) {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        // eslint-disable-next-line no-alert
        window.alert(`Could not restart onboarding: ${upErr.message}`);
      } else {
        Alert.alert("Couldn't restart", upErr.message);
      }
      return;
    }
    await refreshAuth();
    router.replace("/onboarding");
  };

  const confirmRestartOnboarding = () => {
    const msg =
      "Re-do the onboarding flow? This is for testing — your existing profile will stay, you'll just see the welcome screens again.";
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (typeof window !== "undefined" && window.confirm(msg)) {
        void restartOnboarding();
      }
      return;
    }
    Alert.alert("Restart onboarding", msg, [
      { text: "Cancel", style: "cancel" },
      { text: "Restart", onPress: () => void restartOnboarding() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && styles.pressed,
          ]}
          accessibilityLabel="Back"
        >
          <Feather name="arrow-left" size={20} color={NAVY} />
        </Pressable>
        <Text style={styles.topTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profileCard}>
          {loading ? (
            <ActivityIndicator color={TEAL} />
          ) : (
            <>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(profile?.full_name ?? profile?.phone ?? "U")
                    .trim()
                    .slice(0, 1)
                    .toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>
                  {profile?.full_name ?? "CareVoy patient"}
                </Text>
                <Text style={styles.profileSub}>
                  {profile?.phone ?? profile?.email ?? "—"}
                </Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.groupLabel}>Account</Text>
        <View style={styles.group}>
          <MenuRow
            icon="user"
            label="Edit profile"
            sub="Name, phone, and email"
            onPress={comingSoon("Edit profile")}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="credit-card"
            label="Manage payment methods"
            sub="HSA / FSA and cards"
            onPress={() => router.push("/(tabs)/payment")}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="bell"
            label="Notification preferences"
            sub="Texts, email, and push"
            onPress={comingSoon("Notification preferences")}
          />
        </View>

        <Text style={styles.groupLabel}>People in my care</Text>
        <View style={styles.group}>
          {careRecipients.map((p, idx) => (
            <React.Fragment key={p.patientId}>
              {idx > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.row}>
                <View style={styles.rowIcon}>
                  <Feather name="users" size={18} color={TEAL} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{p.fullName}</Text>
                  <Text style={styles.rowSub}>
                    {p.relationship ?? "Care recipient"}
                  </Text>
                </View>
              </View>
            </React.Fragment>
          ))}
          {careRecipients.length > 0 ? <View style={styles.divider} /> : null}
          <MenuRow
            icon="user-plus"
            label="Add a person in my care"
            sub="Book and track rides on their behalf"
            onPress={() => router.push("/care/add")}
          />
        </View>

        <Text style={styles.groupLabel}>Support</Text>
        <View style={styles.group}>
          <MenuRow
            icon="help-circle"
            label="Help & Support"
            sub="support@carevoy.co"
            onPress={comingSoon("Help & Support")}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="message-circle"
            label="Chat with care coordinator"
            onPress={() => router.push("/chat")}
          />
        </View>

        <View style={styles.group}>
          <MenuRow
            icon="refresh-ccw"
            label="Restart onboarding"
            sub="Re-do the welcome questions (for testing)"
            onPress={confirmRestartOnboarding}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="log-out"
            label={signingOut ? "Signing out…" : "Sign Out"}
            onPress={signingOut ? () => {} : handleSignOut}
            destructive
          />
        </View>

        <Text style={styles.versionText}>CareVoy · v1.0</Text>
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
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  topTitle: {
    color: NAVY,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  container: { padding: 20, paddingBottom: 60 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    minHeight: 80,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: NAVY,
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  profileName: {
    color: NAVY,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  profileSub: {
    color: MUTED,
    fontSize: 13,
    marginTop: 3,
    fontFamily: "Inter_400Regular",
  },
  groupLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 4,
  },
  group: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(0,194,168,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  rowSub: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginLeft: 64,
  },
  pressed: { opacity: 0.85 },
  versionText: {
    textAlign: "center",
    color: MUTED,
    fontSize: 12,
    marginTop: 12,
    fontFamily: "Inter_400Regular",
  },
});
