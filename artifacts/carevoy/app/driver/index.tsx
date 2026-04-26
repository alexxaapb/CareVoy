import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const GREEN = "#22C55E";
const WHITE = "#FFFFFF";
const MUTED = "#8A93A6";
const CARD = "#0E1A33";
const BORDER = "#1B2A4A";
const AMBER = "#F5A524";
const BLUE = "#3B82F6";

const COLUMBUS = { lat: 39.9612, lng: -82.9988 };

type Patient = {
  full_name: string | null;
};

type Ride = {
  id: string;
  pickup_time: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  procedure_type: string | null;
  mobility_needs: string | null;
  companion_requested: boolean | null;
  status: string | null;
  estimated_cost: number | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  hospitals: { name: string | null } | null;
  patients: Patient | null;
};

type Staff = {
  full_name: string | null;
  nemt_partner_id: string | null;
  nemt_partners: { company_name: string | null } | null;
};

function firstName(full?: string | null): string {
  if (!full) return "Patient";
  return full.trim().split(/\s+/)[0] ?? "Patient";
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusMeta(status: string | null) {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", color: TEAL, bg: "rgba(0,194,168,0.15)" };
    case "en_route":
      return { label: "En Route", color: BLUE, bg: "rgba(59,130,246,0.15)" };
    case "completed":
      return { label: "Completed", color: GREEN, bg: "rgba(34,197,94,0.15)" };
    case "pending":
      return { label: "Pending", color: AMBER, bg: "rgba(245,165,36,0.15)" };
    default:
      return {
        label: status ?? "—",
        color: MUTED,
        bg: "rgba(138,147,166,0.15)",
      };
  }
}

function todayBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function isExtraTime(needs: string | null): boolean {
  if (!needs) return false;
  return /slow|mobility|assist|extra time|patient/i.test(needs);
}

function isWheelchair(needs: string | null): boolean {
  if (!needs) return false;
  return /wheel/i.test(needs);
}

export default function DriverHomeScreen() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const { data: staffData } = await supabase
      .from("staff")
      .select("full_name, nemt_partner_id, nemt_partners(company_name)")
      .eq("id", userId)
      .maybeSingle();

    const s = staffData as unknown as Staff | null;
    setStaff(s);

    if (!s?.nemt_partner_id) {
      setRides([]);
      return;
    }

    const { start, end } = todayBounds();
    const { data: ridesData } = await supabase
      .from("rides")
      .select(
        "id, pickup_time, pickup_address, dropoff_address, procedure_type, mobility_needs, companion_requested, status, estimated_cost, pickup_lat, pickup_lng, hospitals(name), patients(full_name)",
      )
      .eq("nemt_partner_id", s.nemt_partner_id)
      .gte("pickup_time", start)
      .lt("pickup_time", end)
      .order("pickup_time", { ascending: true });

    setRides((ridesData as unknown as Ride[]) ?? []);
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

  const startRide = async (ride: Ride) => {
    setActingId(ride.id);
    // ~5 km offset northwest of pickup (or Columbus default)
    const lat = (ride.pickup_lat ?? COLUMBUS.lat) + 0.045;
    const lng = (ride.pickup_lng ?? COLUMBUS.lng) - 0.06;
    const { error } = await supabase
      .from("rides")
      .update({
        status: "en_route",
        driver_lat: lat,
        driver_lng: lng,
      })
      .eq("id", ride.id);
    setActingId(null);
    if (error) {
      Alert.alert("Couldn't start ride", error.message);
      return;
    }
    await load();
  };

  const completeRide = async (ride: Ride) => {
    setActingId(ride.id);
    const { error } = await supabase
      .from("rides")
      .update({
        status: "completed",
        actual_cost: ride.estimated_cost,
      })
      .eq("id", ride.id);
    setActingId(null);
    if (error) {
      Alert.alert("Couldn't complete ride", error.message);
      return;
    }
    await load();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const company = staff?.nemt_partners?.company_name ?? "NEMT Partner";
  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

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
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>NEMT Driver Portal</Text>
            <Text style={styles.subtitle}>
              {company} • {dateStr}
            </Text>
          </View>
          <Pressable onPress={signOut} hitSlop={10}>
            <Feather name="log-out" size={20} color={MUTED} />
          </Pressable>
        </View>

        <View style={styles.testingNotice}>
          <Feather name="alert-circle" size={14} color={AMBER} />
          <Text style={styles.testingText}>
            MVP testing tool — for simulating ride status before NEMT API
            integration.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={TEAL} style={{ marginTop: 32 }} />
        ) : rides.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="calendar" size={28} color={MUTED} />
            <Text style={styles.emptyText}>No assigned rides for today.</Text>
          </View>
        ) : (
          rides.map((r) => {
            const meta = statusMeta(r.status);
            const acting = actingId === r.id;
            return (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.time}>{formatTime(r.pickup_time)}</Text>
                  <View
                    style={[styles.statusPill, { backgroundColor: meta.bg }]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: meta.color },
                      ]}
                    />
                    <Text style={[styles.statusText, { color: meta.color }]}>
                      {meta.label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.patientName}>
                  {firstName(r.patients?.full_name)}
                </Text>

                <View style={styles.row}>
                  <Feather name="map-pin" size={14} color={MUTED} />
                  <Text style={styles.rowText} numberOfLines={2}>
                    {r.pickup_address ?? "Pickup TBD"}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Feather name="navigation" size={14} color={MUTED} />
                  <Text style={styles.rowText} numberOfLines={2}>
                    {r.hospitals?.name ?? r.dropoff_address ?? "—"}
                  </Text>
                </View>
                {r.procedure_type ? (
                  <View style={styles.row}>
                    <Feather name="activity" size={14} color={MUTED} />
                    <Text style={styles.rowText} numberOfLines={1}>
                      {r.procedure_type}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.badges}>
                  {isWheelchair(r.mobility_needs) ? (
                    <Badge icon="♿" label="Wheelchair" />
                  ) : null}
                  {r.companion_requested ? (
                    <Badge icon="👥" label="Companion" />
                  ) : null}
                  {isExtraTime(r.mobility_needs) ? (
                    <Badge icon="⏱" label="Extra time" />
                  ) : null}
                </View>

                {r.status === "confirmed" ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionBtn,
                      { backgroundColor: TEAL },
                      (acting || pressed) && styles.pressed,
                    ]}
                    onPress={() => startRide(r)}
                    disabled={acting}
                  >
                    {acting ? (
                      <ActivityIndicator color={NAVY} />
                    ) : (
                      <>
                        <Feather name="play" size={16} color={NAVY} />
                        <Text style={styles.actionText}>Start Ride</Text>
                      </>
                    )}
                  </Pressable>
                ) : r.status === "en_route" ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionBtn,
                      { backgroundColor: GREEN },
                      (acting || pressed) && styles.pressed,
                    ]}
                    onPress={() => completeRide(r)}
                    disabled={acting}
                  >
                    {acting ? (
                      <ActivityIndicator color={NAVY} />
                    ) : (
                      <>
                        <Feather name="check" size={16} color={NAVY} />
                        <Text style={styles.actionText}>Complete Ride</Text>
                      </>
                    )}
                  </Pressable>
                ) : r.status === "completed" ? (
                  <View style={styles.completedBadge}>
                    <Feather name="check-circle" size={14} color={GREEN} />
                    <Text style={styles.completedText}>Completed</Text>
                  </View>
                ) : (
                  <View style={styles.completedBadge}>
                    <Text style={[styles.completedText, { color: MUTED }]}>
                      Awaiting confirmation
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Badge({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeIcon}>{icon}</Text>
      <Text style={styles.badgeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  container: { padding: 24, paddingBottom: 40 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  title: {
    color: WHITE,
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: MUTED,
    fontSize: 14,
    marginTop: 4,
    fontFamily: "Inter_400Regular",
  },
  testingNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245,165,36,0.10)",
    borderColor: "rgba(245,165,36,0.35)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 20,
  },
  testingText: {
    color: AMBER,
    fontSize: 12,
    flex: 1,
    fontFamily: "Inter_500Medium",
  },
  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 28,
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 12,
  },
  emptyText: {
    color: MUTED,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  time: {
    color: TEAL,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  patientName: {
    color: WHITE,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 4,
  },
  rowText: {
    color: WHITE,
    fontSize: 14,
    flex: 1,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,194,168,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeIcon: { fontSize: 12 },
  badgeLabel: {
    color: TEAL,
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  actionBtn: {
    marginTop: 14,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pressed: { opacity: 0.85 },
  actionText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  completedBadge: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(34,197,94,0.10)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)",
  },
  completedText: {
    color: GREEN,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
