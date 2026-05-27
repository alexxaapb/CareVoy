import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCare } from "../../lib/careContext";
import { supabase } from "../../lib/supabase";

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
  avatar_url: string | null;
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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("patients")
      .select("full_name, phone, email, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    setProfile({
      full_name: data?.full_name ?? null,
      phone: data?.phone ?? userData.user?.phone ?? null,
      email: data?.email ?? userData.user?.email ?? null,
      avatar_url: data?.avatar_url ?? null,
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
    await supabase.auth.signOut();
    setSigningOut(false);
    router.replace("/login");
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

  const pickAndUploadPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined")
          window.alert("Allow photo library access to set a profile photo.");
      } else {
        Alert.alert(
          "Permission needed",
          "Please allow photo library access to set a profile photo.",
        );
      }
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    setUploadingPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
      const mimeType = ext === "png" ? "image/png" : "image/jpeg";
      const path = `${userId}/avatar.${ext === "png" ? "png" : "jpg"}`;
      const fetchResponse = await fetch(uri);
      const blob = await fetchResponse.blob();
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: mimeType });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("patients")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", userId);
      if (updateError) throw updateError;
      setProfile((prev) =>
        prev
          ? { ...prev, avatar_url: `${urlData.publicUrl}?t=${Date.now()}` }
          : prev,
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Could not upload photo.";
      if (Platform.OS === "web") {
        if (typeof window !== "undefined")
          window.alert(`Upload failed: ${msg}`);
      } else {
        Alert.alert("Upload failed", msg);
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profileCard}>
          {loading ? (
            <ActivityIndicator color={TEAL} />
          ) : (
            <>
              <Pressable
                onPress={pickAndUploadPhoto}
                disabled={uploadingPhoto}
                accessibilityLabel="Change profile photo"
              >
                <View style={styles.avatar}>
                  {uploadingPhoto ? (
                    <ActivityIndicator color={WHITE} size="small" />
                  ) : profile?.avatar_url ? (
                    <Image
                      source={{ uri: profile.avatar_url }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Text style={styles.avatarText}>
                      {(profile?.full_name ?? profile?.phone ?? "U")
                        .trim()
                        .slice(0, 1)
                        .toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.cameraBadge}>
                  <Feather name="camera" size={10} color={WHITE} />
                </View>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>
                  {profile?.full_name && profile.full_name.trim().length > 1
                    ? profile.full_name
                    : profile?.full_name || ""}
                </Text>
                <Text style={styles.profileSub}>{profile?.email || ""}</Text>
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
            onPress={() => Linking.openURL("mailto:support@carevoy.co")}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="message-circle"
            label="Chat with care coordinator"
            onPress={() => router.push("/chat")}
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 8 : 4,
    paddingBottom: 16,
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
    fontFamily: "System",
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
    overflow: "hidden",
  },
  avatarImage: {
    width: 52,
    height: 52,
  },
  cameraBadge: {
    position: "absolute",
    bottom: -2,
    right: -4,
    backgroundColor: NAVY,
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: WHITE,
  },
  avatarText: {
    color: NAVY,
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "System",
  },
  profileName: {
    color: NAVY,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "System",
  },
  profileSub: {
    color: MUTED,
    fontSize: 13,
    marginTop: 3,
    fontFamily: "System",
  },
  groupLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "System",
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
    fontFamily: "System",
  },
  rowSub: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
    fontFamily: "System",
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
    fontFamily: "System",
  },
});
