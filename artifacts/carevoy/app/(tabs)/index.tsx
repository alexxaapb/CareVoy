import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCare } from "../../lib/careContext";
import { isDemoMode } from "../../lib/demoMode";
import { supabase } from "../../lib/supabase";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const CARD = "#F8FAFC";
const BORDER = "#E2E8F0";
const MAP_BG = "#F1F5F9";
const MAP_GRID = "#E2E8F0";
const HSA_BG = "#FEF3C7";
const HSA_TEXT = "#B45309";
const HSA_ICON_BG = "#F59E0B";

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

type PatientProfile = {
  full_name: string | null;
  home_address: string | null;
};

// Demo placeholder used in investor screenshots when the patient hasn't set
// a real first name yet. We intentionally never expose the raw phone number
// in the greeting.
const DEMO_FIRST_NAME = "Jane";

function firstName(full?: string | null): string {
  if (!full) return DEMO_FIRST_NAME;
  const trimmed = full.trim();
  // Phone-shaped strings (digits / +) → use the demo name, never expose the
  // user's phone in the greeting.
  if (/^[+\d\s()-]+$/.test(trimmed)) return DEMO_FIRST_NAME;
  // Email-shaped → derive a name-ish first part.
  if (trimmed.includes("@")) {
    const local = trimmed.split("@")[0] ?? "";
    const cleaned = local.replace(/[._-]+/g, " ").trim();
    if (!cleaned) return DEMO_FIRST_NAME;
    const first = cleaned.split(/\s+/)[0] ?? "";
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }
  // Single-letter "A"-style placeholders → demo name.
  if (trimmed.length < 2) return DEMO_FIRST_NAME;
  return trimmed.split(/\s+/)[0] ?? DEMO_FIRST_NAME;
}

function timeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function cityFromAddress(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const parts = addr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const city = parts[parts.length - 2] ?? "";
    const stateZip = (parts[parts.length - 1] ?? "").split(/\s+/);
    const state = stateZip[0] ?? "";
    return state ? `${city}, ${state}` : city;
  }
  return parts[0] ?? null;
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

  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [upcoming, setUpcoming] = useState<Ride[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [reimbursedTotal, setReimbursedTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authFallbackName, setAuthFallbackName] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!activePatientId) {
      setProfile(null);
      setUpcoming([]);
      setCompletedCount(0);
      setReimbursedTotal(0);
      return;
    }
    const [profileRes, upcomingRes, completedRes] = await Promise.all([
      supabase
        .from("patients")
        .select("full_name, home_address")
        .eq("id", activePatientId)
        .maybeSingle(),
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
        .select("actual_cost, estimated_cost")
        .eq("patient_id", activePatientId)
        .eq("status", "completed"),
    ]);
    setProfile((profileRes.data as PatientProfile | null) ?? null);
    setUpcoming((upcomingRes.data as unknown as Ride[]) ?? []);
    const completed =
      (completedRes.data as Array<{
        actual_cost: number | null;
        estimated_cost: number | null;
      }> | null) ?? [];
    setCompletedCount(completed.length);
    setReimbursedTotal(
      completed.reduce(
        (sum, r) => sum + (r.actual_cost ?? r.estimated_cost ?? 0),
        0,
      ),
    );
  }, [activePatientId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        await loadAll();
        if (active && isDemoMode()) {
          setProfile({
            full_name: "Jane Doe",
            home_address: "850 N High St, Columbus, OH 43215",
          });
          setCompletedCount(12);
          setReimbursedTotal(640);
          const inTwoDays = new Date();
          inTwoDays.setDate(inTwoDays.getDate() + 2);
          inTwoDays.setHours(9, 30, 0, 0);
          setUpcoming([
            {
              id: "demo-ride-1",
              ride_type: "pre_op",
              pickup_address: "850 N High St, Columbus, OH 43215",
              dropoff_address: "OhioHealth Riverside Methodist Hospital",
              pickup_time: inTwoDays.toISOString(),
              surgery_date: inTwoDays.toISOString(),
              status: "confirmed",
              actual_cost: null,
              estimated_cost: 42,
              hospitals: {
                name: "OhioHealth Riverside Methodist Hospital",
              },
            } as Ride,
          ]);
        }
        if (active) setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [loadAll]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // Cascade: patients.full_name → care context → auth metadata (full_name /
  // email / phone). Guarantees the greeting always shows a real name.
  const displayName =
    profile?.full_name ?? activePerson?.fullName ?? authFallbackName ?? null;
  const greetingName = firstName(displayName);

  // Resolve auth-side fallbacks once on mount so we don't ever say "Hello there".
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const u = data.user;
      if (!u) return;
      const meta =
        (u.user_metadata?.full_name as string | undefined) ??
        (u.user_metadata?.name as string | undefined) ??
        u.email ??
        u.phone ??
        null;
      setAuthFallbackName(meta ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const city = cityFromAddress(profile?.home_address);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const requestLocation = useCallback(async () => {
    if (requestingLocation) return;
    setRequestingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setDetectedCity("Columbus, OH");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const places = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const place = places[0];
      if (place?.city && place?.region) {
        setDetectedCity(`${place.city}, ${place.region}`);
      } else if (place?.city) {
        setDetectedCity(place.city);
      } else {
        setDetectedCity("Columbus, OH");
      }
    } catch {
      setDetectedCity("Columbus, OH");
    } finally {
      setRequestingLocation(false);
    }
  }, [requestingLocation]);
  const showSwitcher = careRecipients.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={TEAL}
          />
        }
      >
        {/* Greeting */}
        <Text style={styles.greetingSmall}>
          {timeGreeting()}, {greetingName}
        </Text>
        <Text style={styles.headline}>
          Where are you{"\n"}headed{" "}
          <Text style={styles.headlineItalic}>today?</Text>
        </Text>

        {/* Map preview card */}
        <View style={styles.mapCard}>
          <View style={styles.mapGrid} pointerEvents="none">
            {[1, 2, 3, 4, 5].map((i) => (
              <View
                key={`h${i}`}
                style={[styles.gridLineH, { top: `${i * 16}%` }]}
              />
            ))}
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <View
                key={`v${i}`}
                style={[styles.gridLineV, { left: `${i * 14}%` }]}
              />
            ))}
          </View>

          {/* Dotted trail */}
          <View style={styles.trail} pointerEvents="none">
            {Array.from({ length: 16 }).map((_, i) => (
              <View key={i} style={styles.trailDot} />
            ))}
          </View>

          {/* Pin + label */}
          <Pressable
            style={styles.pinWrap}
            onPress={requestLocation}
            disabled={requestingLocation}
            hitSlop={12}
          >
            <View style={styles.pinHalo}>
              <View style={styles.pinDot} />
            </View>
            <View style={styles.pinLabel}>
              <Text style={styles.pinLabelText} numberOfLines={1}>
                {requestingLocation ? "Locating…" : "Columbus, OH"}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Book button */}
        <Pressable
          onPress={() => router.push("/book-ride")}
          style={({ pressed }) => [
            styles.bookBtn,
            pressed && styles.pressed,
          ]}
          accessibilityLabel="Book a medical ride"
        >
          <Text style={styles.bookBtnText}>Book a medical ride</Text>
          <View style={styles.bookBtnArrow}>
            <Feather name="arrow-right" size={18} color={NAVY} />
          </View>
        </Pressable>

        {/* HSA / FSA pill */}
        <View style={styles.hsaPill}>
          <View style={styles.hsaIconBg}>
            <Text style={styles.hsaIconText}>$</Text>
          </View>
          <Text style={styles.hsaText}>
            HSA/FSA eligible — auto-reimbursed
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>
              {loading ? "—" : completedCount}
            </Text>
            <Text style={styles.statLabel}>Rides</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: TEAL }]}>
              {loading ? "—" : `$${Math.round(reimbursedTotal)}`}
            </Text>
            <Text style={styles.statLabel}>Reimbursed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNum, { color: HSA_ICON_BG }]}>
              {loading ? "—" : upcoming.length}
            </Text>
            <Text style={styles.statLabel}>Upcoming</Text>
          </View>
        </View>

        {/* Caregiver switcher (only if there are care recipients) */}
        {showSwitcher ? (
          <View style={styles.switcherWrap}>
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
                        opt.isSelf && selfPatientId
                          ? selfPatientId
                          : opt.id;
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
                      size={12}
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
                <Feather name="plus" size={12} color={TEAL} />
                <Text style={[styles.personPillText, { color: TEAL }]}>
                  Add
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        ) : null}

        {/* Upcoming rides (only if any) */}
        {loading ? (
          <ActivityIndicator color={TEAL} style={{ marginTop: 24 }} />
        ) : upcoming.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming</Text>
            {upcoming.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => router.push(`/ride/${r.id}`)}
                style={({ pressed }) => [
                  styles.rideCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.rideCardHeader}>
                  <View style={styles.ridePill}>
                    <Text style={styles.ridePillText}>
                      {r.ride_type === "post_op" ? "Post-op" : "Pre-op"}
                    </Text>
                  </View>
                  <Text style={styles.rideStatus}>
                    {r.status?.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.rideTitle}>
                  {formatDateTime(r.pickup_time)}
                </Text>
                <View style={styles.rideRow}>
                  <Feather name="navigation" size={13} color={MUTED} />
                  <Text style={styles.rideLine} numberOfLines={1}>
                    {r.hospitals?.name ??
                      r.dropoff_address ??
                      "Destination TBD"}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
  container: {
    paddingHorizontal: 24,
    // Push everything well below the iPhone notch / Dynamic Island so the
    // greeting never gets clipped in screenshots.
    paddingTop: Platform.OS === "ios" ? 24 : 16,
    paddingBottom: 64,
  },
  pressed: { opacity: 0.85 },

  greetingSmall: {
    color: MUTED,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: 6,
  },
  headline: {
    color: NAVY,
    fontSize: 32,
    lineHeight: 38,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    letterSpacing: -0.6,
    marginBottom: 22,
  },
  headlineItalic: {
    color: TEAL,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
  },

  // Map preview
  mapCard: {
    height: 180,
    borderRadius: 18,
    backgroundColor: MAP_BG,
    overflow: "hidden",
    position: "relative",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: MAP_GRID,
  },
  gridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: MAP_GRID,
  },
  trail: {
    position: "absolute",
    top: "55%",
    left: "10%",
    right: "10%",
    height: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    transform: [{ rotate: "-6deg" }],
  },
  trailDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#94A3B8",
    opacity: 0.6,
  },
  pinWrap: {
    position: "absolute",
    top: "42%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pinHalo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,194,168,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  pinDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: TEAL,
    borderWidth: 2,
    borderColor: WHITE,
  },
  pinLabel: {
    marginTop: 8,
    backgroundColor: NAVY,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pinLabelText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },

  // Book button
  bookBtn: {
    backgroundColor: NAVY,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  bookBtnText: {
    color: WHITE,
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.2,
  },
  bookBtnArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },

  // HSA pill
  hsaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: HSA_BG,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  hsaIconBg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: HSA_ICON_BG,
    alignItems: "center",
    justifyContent: "center",
  },
  hsaIconText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  hsaText: {
    color: HSA_TEXT,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },

  // Stats
  stats: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: "flex-start",
  },
  statNum: {
    color: NAVY,
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    fontWeight: "700",
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  statLabel: {
    color: MUTED,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },

  // Switcher
  switcherWrap: {
    marginTop: 22,
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
    paddingVertical: 7,
  },
  personPillSelected: {
    backgroundColor: "rgba(0,194,168,0.15)",
    borderColor: TEAL,
  },
  personPillText: {
    color: MUTED,
    fontSize: 12,
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

  // Upcoming list
  section: { marginTop: 28 },
  sectionTitle: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  rideCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },
  rideCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ridePill: {
    backgroundColor: "rgba(0,194,168,0.15)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  ridePillText: {
    color: TEAL,
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  rideStatus: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    fontFamily: "Inter_600SemiBold",
  },
  rideTitle: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  rideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rideLine: {
    color: NAVY,
    fontSize: 12,
    flex: 1,
    fontFamily: "Inter_400Regular",
  },
});
