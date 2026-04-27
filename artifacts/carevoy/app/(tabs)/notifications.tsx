import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const GREEN = "#22C55E";
const AMBER = "#F59E0B";
const RED = "#EF4444";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const CARD = "#F8FAFC";
const BORDER = "#E2E8F0";

type Notification = {
  id: string;
  created_at: string;
  channel: "sms" | "email" | "push" | null;
  message: string | null;
  status: string | null;
  sent_at: string | null;
};

function relTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function channelIcon(channel: string | null): keyof typeof Feather.glyphMap {
  if (channel === "email") return "mail";
  if (channel === "push") return "bell";
  return "message-square";
}

function statusColor(status: string | null): string {
  if (status === "sent" || status === "delivered") return GREEN;
  if (status === "failed") return RED;
  return AMBER;
}

function statusLabel(status: string | null): string {
  return (status ?? "pending").toUpperCase();
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, created_at, channel, message, status, sent_at")
      .eq("recipient_type", "patient")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data as unknown as Notification[]) ?? []);
  }, []);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={TEAL}
          />
        }
      >
        <Text style={styles.title}>My Alerts</Text>
        <Text style={styles.subtitle}>
          Updates about your rides, drivers, and receipts.
        </Text>

        {loading ? (
          <ActivityIndicator color={TEAL} style={{ marginTop: 32 }} />
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="bell-off" size={28} color={MUTED} />
            <Text style={styles.emptyText}>
              No notifications yet. You&apos;ll be notified about your rides
              here.
            </Text>
          </View>
        ) : (
          items.map((n) => (
            <View key={n.id} style={styles.card}>
              <View style={styles.iconWrap}>
                <Feather name={channelIcon(n.channel)} size={18} color={TEAL} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.message}>
                  {n.message ?? "(no message)"}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>{relTime(n.created_at)}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: statusColor(n.status) },
                    ]}
                  />
                  <Text
                    style={[styles.status, { color: statusColor(n.status) }]}
                  >
                    {statusLabel(n.status)}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
  container: { padding: 24, paddingBottom: 40 },
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
    marginTop: 6,
    marginBottom: 24,
    fontFamily: "Inter_400Regular",
  },
  card: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(0,194,168,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    color: NAVY,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_500Medium",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  meta: {
    color: MUTED,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  metaDot: { color: MUTED, fontSize: 12 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  status: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontFamily: "Inter_700Bold",
  },
  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 28,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 8,
  },
  emptyText: {
    color: MUTED,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
});
