import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
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

type Ride = {
  id: string;
  ride_type: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  pickup_time: string | null;
  surgery_date: string | null;
  status: string | null;
  actual_cost: number | null;
  estimated_cost: number | null;
  hospitals: { name: string | null } | null;
};

function firstName(full?: string | null): string {
  if (!full) return "there";
  return full.trim().split(/\s+/)[0] ?? "there";
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(n: number | null): string {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const {
    activePerson,
    selfPatientId,
    careRecipients,
    setActivePersonById,
  } = useCare();
  const activePatientId = activePerson?.patientId ?? null;
  const isSelf = !!activePerson?.isSelf;

  const [upcoming, setUpcoming] = useState<Ride[]>([]);
  const [past, setPast] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRides = useCallback(async () => {
    if (!activePatientId) {
      setUpcoming([]);
      setPast([]);
      return;
    }
    const [upcomingRes, pastRes] = await Promise.all([
      supabase
        .from("rides")
        .select(
          "id, ride_type, pickup_address, dropoff_address, pickup_time, surgery_date, status, actual_cost, estimated_cost, hospitals(name)",
        )
        .eq("patient_id", activePatientId)
        .in("status", ["pending", "confirmed"])
        .order("pickup_time", { ascending: true }),
      supabase
        .from("rides")
        .select(
          "id, ride_type, pickup_address, dropoff_address, pickup_time, surgery_date, status, actual_cost, estimated_cost, hospitals(name)",
        )
        .eq("patient_id", activePatientId)
        .eq("status", "completed")
        .order("pickup_time", { ascending: false })
        .limit(20),
    ]);
    setUpcoming((upcomingRes.data as unknown as Ride[]) ?? []);
    setPast((pastRes.data as unknown as Ride[]) ?? []);
  }, [activePatientId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        await loadRides();
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [loadRides]),
  );

  // When the active person changes, reload rides immediately.
  useEffect(() => {
    void loadRides();
  }, [loadRides]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRides();
    setRefreshing(false);
  };

  const greetingName = firstName(activePerson?.fullName);
  const showSwitcher = careRecipients.length > 0;

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
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Hi {greetingName},</Text>
              <Text style={styles.subGreeting}>
                {isSelf
                  ? "need a ride to your next appointment?"
                  : `let's plan ${greetingName}'s next ride.`}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Open settings"
              onPress={() => router.push("/settings")}
              hitSlop={10}
              style={({ pressed }) => [
                styles.settingsBtn,
                pressed && styles.pressed,
              ]}
            >
              <Feather name="settings" size={20} color={NAVY} />
            </Pressable>
          </View>
        </View>

        {showSwitcher ? (
          <View style={styles.switcherCard}>
            <Text style={styles.switcherLabel}>Booking for</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.switcherRow}
            >
              {[
                { id: selfPatientId ?? "self", label: "Me", isSelf: true },
                ...careRecipients.map((p) => ({
                  id: p.patientId,
                  label: p.fullName,
                  isSelf: false,
                })),
              ].map((opt) => {
                const selected =
                  (opt.isSelf && isSelf) ||
                  (!opt.isSelf && activePatientId === opt.id);
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => {
                      const target =
                        opt.isSelf && selfPatientId ? selfPatientId : opt.id;
                      void setActivePersonById(target);
                    }}
                    style={({ pressed }) => [
                      styles.personPill,
                      selected && styles.personPillSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Feather
                      name={opt.isSelf ? "user" : "users"}
                      size={13}
                      color={selected ? NAVY : MUTED}
                    />
                    <Text
                      style={[
                        styles.personPillText,
                        selected && styles.personPillTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => router.push("/care/add")}
                style={({ pressed }) => [
                  styles.personPill,
                  styles.addPill,
                  pressed && styles.pressed,
                ]}
              >
                <Feather name="plus" size={13} color={TEAL} />
                <Text style={[styles.personPillText, { color: TEAL }]}>
                  Add
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/book-ride")}
          >
            <Feather name="plus-circle" size={20} color={NAVY} />
            <Text style={styles.primaryBtnText}>Book a Ride</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/chat")}
          >
            <Feather name="message-circle" size={20} color={TEAL} />
            <Text style={styles.secondaryBtnText}>
              Chat with Care Coordinator
            </Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Rides</Text>
          {loading ? (
            <ActivityIndicator color={TEAL} style={{ marginTop: 16 }} />
          ) : upcoming.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="calendar" size={28} color={MUTED} />
              <Text style={styles.emptyText}>
                {isSelf
                  ? "No rides booked yet. Tap Book a Ride to get started."
                  : `No rides booked for ${greetingName} yet.`}
              </Text>
            </View>
          ) : (
            upcoming.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => router.push(`/ride/${r.id}`)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>
                      {r.ride_type === "post_op" ? "Post-op" : "Pre-op"}
                    </Text>
                  </View>
                  <Text style={styles.statusText}>
                    {r.status?.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.cardTitle}>
                  {formatDateTime(r.pickup_time)}
                </Text>
                <View style={styles.row}>
                  <Feather name="map-pin" size={14} color={MUTED} />
                  <Text style={styles.cardLine} numberOfLines={1}>
                    {r.pickup_address ?? "Pickup TBD"}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Feather name="navigation" size={14} color={MUTED} />
                  <Text style={styles.cardLine} numberOfLines={1}>
                    {r.hospitals?.name ?? r.dropoff_address ?? "Destination TBD"}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Past Rides</Text>
          {loading ? null : past.length === 0 ? (
            <View style={styles.emptyCard}>
              <Feather name="clock" size={28} color={MUTED} />
              <Text style={styles.emptyText}>
                Your ride history will appear here after your first trip.
              </Text>
            </View>
          ) : (
            past.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => router.push(`/ride/${r.id}`)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View style={styles.pastRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {r.hospitals?.name ?? "Hospital"}
                    </Text>
                    <Text style={styles.cardLineMuted}>
                      {formatDate(r.pickup_time ?? r.surgery_date)}
                    </Text>
                  </View>
                  <Text style={styles.cost}>
                    {formatMoney(r.actual_cost ?? r.estimated_cost)}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
  container: { padding: 24, paddingBottom: 40 },
  header: { marginTop: 8, marginBottom: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: {
    color: NAVY,
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subGreeting: {
    color: MUTED,
    fontSize: 18,
    marginTop: 4,
    fontFamily: "Inter_400Regular",
  },
  switcherCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
  },
  switcherLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 8,
    fontFamily: "Inter_600SemiBold",
  },
  switcherRow: {
    gap: 8,
    paddingRight: 4,
  },
  personPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  personPillSelected: {
    backgroundColor: "rgba(0,194,168,0.15)",
    borderColor: TEAL,
  },
  personPillText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: "600",
    maxWidth: 130,
    fontFamily: "Inter_600SemiBold",
  },
  personPillTextSelected: { color: NAVY },
  addPill: {
    backgroundColor: WHITE,
    borderColor: TEAL,
    borderStyle: "dashed",
  },
  actions: { gap: 12, marginBottom: 32 },
  primaryBtn: {
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryBtnText: {
    color: NAVY,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  secondaryBtn: {
    backgroundColor: CARD,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  secondaryBtnText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  section: { marginBottom: 28 },
  sectionTitle: {
    color: NAVY,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyText: {
    color: MUTED,
    fontSize: 14,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pill: {
    backgroundColor: "rgba(0,194,168,0.15)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    color: TEAL,
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  statusText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    fontFamily: "Inter_600SemiBold",
  },
  cardTitle: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  cardLine: {
    color: NAVY,
    fontSize: 13,
    flex: 1,
    fontFamily: "Inter_400Regular",
  },
  cardLineMuted: {
    color: MUTED,
    fontSize: 13,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  pastRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cost: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  pressed: { opacity: 0.85 },
});
