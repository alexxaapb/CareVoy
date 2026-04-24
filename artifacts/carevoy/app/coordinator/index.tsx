import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
const MUTED = "#8A93A6";
const CARD = "#0E1A33";
const BORDER = "#1B2A4A";
const AMBER = "#F5A524";
const GREEN = "#22C55E";
const RED = "#EF4444";
const SIDEBAR_BG = "#08111F";

type Coord = {
  full_name: string | null;
  hospital_id: string | null;
  hospitals: { name: string | null } | null;
};

type Patient = { id: string; full_name: string | null; phone: string | null };

type Ride = {
  id: string;
  patient_id: string;
  surgery_date: string | null;
  pickup_time: string | null;
  procedure_type: string | null;
  status: string | null;
  driver_name: string | null;
  vehicle_type: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  patients: Patient | null;
};

type DateFilter = "today" | "week" | "all";
type StatusFilter = "all" | "needs" | "confirmed";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "home" as const },
  { key: "patients", label: "My Patients", icon: "users" as const },
  { key: "rides", label: "Rides", icon: "navigation" as const },
  { key: "alerts", label: "Alerts", icon: "bell" as const },
  { key: "settings", label: "Settings", icon: "settings" as const },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function firstName(full?: string | null): string {
  if (!full) return "there";
  return full.trim().split(/\s+/)[0] ?? "there";
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function endOfWeekISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function startOfMonthISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function fmtMoney(n: number | null): string {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

function rideTransportStatus(r: Ride): "confirmed" | "pending" | "none" {
  if (!r.status) return "none";
  if (["confirmed", "en_route", "completed", "arrived"].includes(r.status))
    return "confirmed";
  if (r.status === "pending") return "pending";
  return "none";
}

export default function CoordinatorDashboard() {
  const router = useRouter();
  const [coord, setCoord] = useState<Coord | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [monthCount, setMonthCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<Ride | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { data: coordData } = await supabase
      .from("hospital_coordinators")
      .select("full_name, hospital_id, hospitals(name)")
      .eq("id", userId)
      .maybeSingle();
    const c = coordData as unknown as Coord | null;
    setCoord(c);
    if (!c?.hospital_id) {
      setRides([]);
      setMonthCount(0);
      return;
    }
    const today = todayStr();
    const [ridesRes, monthRes] = await Promise.all([
      supabase
        .from("rides")
        .select(
          "id, patient_id, surgery_date, pickup_time, procedure_type, status, driver_name, vehicle_type, estimated_cost, actual_cost, patients(id, full_name, phone)",
        )
        .eq("hospital_id", c.hospital_id)
        .gte("surgery_date", today)
        .order("surgery_date", { ascending: true }),
      supabase
        .from("rides")
        .select("id", { count: "exact", head: true })
        .eq("hospital_id", c.hospital_id)
        .gte("surgery_date", startOfMonthISO()),
    ]);
    setRides((ridesRes.data as unknown as Ride[]) ?? []);
    setMonthCount(monthRes.count ?? 0);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const stats = useMemo(() => {
    const today = todayStr();
    const todaySurgeries = rides.filter(
      (r) => r.surgery_date === today,
    ).length;
    const confirmed = rides.filter(
      (r) => rideTransportStatus(r) === "confirmed",
    ).length;
    const needs = rides.filter(
      (r) => rideTransportStatus(r) !== "confirmed",
    ).length;
    return { todaySurgeries, confirmed, needs };
  }, [rides]);

  const filtered = useMemo(() => {
    const today = todayStr();
    const week = endOfWeekISO();
    const q = search.trim().toLowerCase();
    return rides.filter((r) => {
      if (dateFilter === "today" && r.surgery_date !== today) return false;
      if (
        dateFilter === "week" &&
        r.surgery_date &&
        r.surgery_date > week
      )
        return false;
      const ts = rideTransportStatus(r);
      if (statusFilter === "needs" && ts === "confirmed") return false;
      if (statusFilter === "confirmed" && ts !== "confirmed") return false;
      if (q && !(r.patients?.full_name ?? "").toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [rides, dateFilter, statusFilter, search]);

  const pendingCount = useMemo(
    () => rides.filter((r) => rideTransportStatus(r) !== "confirmed").length,
    [rides],
  );

  const sendReminder = async (ride: Ride) => {
    if (!ride.patients?.id) return;
    setSending(ride.id);
    const msg = `Hi ${firstName(ride.patients.full_name)}, your surgery at ${coord?.hospitals?.name ?? "the hospital"} is on ${fmtDate(ride.surgery_date)}. Book your CareVoy transportation to arrive safely. Download the app at carevoy.co`;
    const { error } = await supabase.from("notifications").insert({
      recipient_type: "patient",
      recipient_id: ride.patients.id,
      channel: "sms",
      message: msg,
      status: "pending",
    });
    setSending(null);
    if (error) {
      showToast("Couldn't send reminder");
      return;
    }
    showToast(`Reminder sent to ${firstName(ride.patients.full_name)}`);
  };

  const sendAllReminders = async () => {
    const targets = rides.filter(
      (r) => rideTransportStatus(r) !== "confirmed" && r.patients?.id,
    );
    if (targets.length === 0) return;
    setBulkSending(true);
    const rows = targets.map((r) => ({
      recipient_type: "patient",
      recipient_id: r.patients!.id,
      channel: "sms",
      message: `Hi ${firstName(r.patients?.full_name)}, your surgery at ${coord?.hospitals?.name ?? "the hospital"} is on ${fmtDate(r.surgery_date)}. Book your CareVoy transportation to arrive safely. Download the app at carevoy.co`,
      status: "pending",
    }));
    const { error } = await supabase.from("notifications").insert(rows);
    setBulkSending(false);
    if (error) {
      showToast("Couldn't send all reminders");
      return;
    }
    showToast(`Sent reminders to ${targets.length} patients`);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.shell}>
        {/* Sidebar */}
        <View style={styles.sidebar}>
          <View style={styles.brand}>
            <View style={styles.logoMark}>
              <Text style={styles.logoMarkText}>C</Text>
            </View>
            <Text style={styles.logoWord}>CareVoy</Text>
          </View>
          <View style={styles.navList}>
            {NAV_ITEMS.map((item) => {
              const active = activeNav === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setActiveNav(item.key)}
                  style={({ pressed }) => [
                    styles.navItem,
                    active && styles.navItemActive,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Feather
                    name={item.icon}
                    size={18}
                    color={active ? TEAL : MUTED}
                  />
                  <Text
                    style={[
                      styles.navText,
                      active && styles.navTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sidebarFoot}>
            <Text style={styles.hospName}>
              {coord?.hospitals?.name ?? "Hospital"}
            </Text>
            <Pressable
              onPress={signOut}
              style={({ pressed }) => [
                styles.signOutBtn,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Feather name="log-out" size={16} color={MUTED} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </View>
        </View>

        {/* Main */}
        <ScrollView
          style={styles.main}
          contentContainerStyle={styles.mainContent}
        >
          <View style={styles.headerBlock}>
            <Text style={styles.headerTitle}>
              {greeting()}, {firstName(coord?.full_name)}
            </Text>
            <Text style={styles.headerSub}>
              {coord?.hospitals?.name ?? "—"} • {dateStr}
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <StatCard
              label="Today's Surgeries"
              value={stats.todaySurgeries}
              color={WHITE}
              icon="calendar"
            />
            <StatCard
              label="Rides Confirmed"
              value={stats.confirmed}
              color={TEAL}
              icon="check-circle"
            />
            <StatCard
              label="Need Transport"
              value={stats.needs}
              color={AMBER}
              icon="alert-circle"
            />
            <StatCard
              label="This Month Total"
              value={monthCount}
              color={WHITE}
              icon="trending-up"
            />
          </View>

          {/* Bulk action */}
          {pendingCount > 0 ? (
            <View style={styles.bulkBar}>
              <View style={styles.bulkLeft}>
                <Feather name="alert-triangle" size={18} color={AMBER} />
                <Text style={styles.bulkText}>
                  {pendingCount} patient{pendingCount === 1 ? "" : "s"} need
                  transport arranged
                </Text>
              </View>
              <Pressable
                onPress={sendAllReminders}
                disabled={bulkSending}
                style={({ pressed }) => [
                  styles.bulkBtn,
                  (bulkSending || pressed) && { opacity: 0.85 },
                ]}
              >
                {bulkSending ? (
                  <ActivityIndicator color={NAVY} size="small" />
                ) : (
                  <>
                    <Feather name="send" size={14} color={NAVY} />
                    <Text style={styles.bulkBtnText}>
                      Send reminders to all
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}

          {/* Filters */}
          <View style={styles.filtersBar}>
            <View style={styles.searchWrap}>
              <Feather name="search" size={16} color={MUTED} />
              <TextInput
                placeholder="Search by patient name…"
                placeholderTextColor={MUTED}
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
              />
            </View>
            <View style={styles.chipGroup}>
              {(["today", "week", "all"] as DateFilter[]).map((f) => (
                <Chip
                  key={f}
                  label={
                    f === "today"
                      ? "Today"
                      : f === "week"
                        ? "This Week"
                        : "All Upcoming"
                  }
                  active={dateFilter === f}
                  onPress={() => setDateFilter(f)}
                />
              ))}
            </View>
            <View style={styles.chipGroup}>
              {(["all", "needs", "confirmed"] as StatusFilter[]).map((f) => (
                <Chip
                  key={f}
                  label={
                    f === "all"
                      ? "All"
                      : f === "needs"
                        ? "Needs Action"
                        : "Confirmed"
                  }
                  active={statusFilter === f}
                  onPress={() => setStatusFilter(f)}
                />
              ))}
            </View>
          </View>

          {/* Table */}
          <View style={styles.tableWrap}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colPatient]}>Patient</Text>
              <Text style={[styles.th, styles.colDate]}>Surgery Date</Text>
              <Text style={[styles.th, styles.colProc]}>Procedure</Text>
              <Text style={[styles.th, styles.colStatus]}>
                Transport Status
              </Text>
              <Text style={[styles.th, styles.colAction]}>Action</Text>
            </View>
            {loading ? (
              <ActivityIndicator
                color={TEAL}
                style={{ marginVertical: 32 }}
              />
            ) : filtered.length === 0 ? (
              <View style={styles.emptyRow}>
                <Feather name="inbox" size={24} color={MUTED} />
                <Text style={styles.emptyText}>No patients match.</Text>
              </View>
            ) : (
              filtered.map((r) => {
                const ts = rideTransportStatus(r);
                return (
                  <View key={r.id} style={styles.tr}>
                    <View style={styles.colPatient}>
                      <Text style={styles.patientName}>
                        {r.patients?.full_name ?? "—"}
                      </Text>
                      <Text style={styles.subMuted}>
                        {r.patients?.phone ?? ""}
                      </Text>
                    </View>
                    <Text style={[styles.td, styles.colDate]}>
                      {fmtDate(r.surgery_date)}
                    </Text>
                    <Text
                      style={[styles.td, styles.colProc]}
                      numberOfLines={1}
                    >
                      {r.procedure_type ?? "—"}
                    </Text>
                    <View style={styles.colStatus}>
                      <StatusPill kind={ts} />
                    </View>
                    <View style={styles.colAction}>
                      {ts === "confirmed" ? (
                        <Pressable
                          onPress={() => setViewing(r)}
                          style={({ pressed }) => [
                            styles.viewBtn,
                            pressed && { opacity: 0.85 },
                          ]}
                        >
                          <Text style={styles.viewBtnText}>View Ride</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={() => sendReminder(r)}
                          disabled={sending === r.id}
                          style={({ pressed }) => [
                            styles.remindBtn,
                            (sending === r.id || pressed) && {
                              opacity: 0.85,
                            },
                          ]}
                        >
                          {sending === r.id ? (
                            <ActivityIndicator color={NAVY} size="small" />
                          ) : (
                            <>
                              <Feather name="send" size={12} color={NAVY} />
                              <Text style={styles.remindBtnText}>
                                Send Reminder
                              </Text>
                            </>
                          )}
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </View>

      {/* View Ride Modal */}
      <Modal
        visible={!!viewing}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <Pressable
          style={styles.modalScrim}
          onPress={() => setViewing(null)}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Ride details</Text>
              <Pressable onPress={() => setViewing(null)} hitSlop={8}>
                <Feather name="x" size={20} color={MUTED} />
              </Pressable>
            </View>
            {viewing ? (
              <View style={{ gap: 14 }}>
                <Row
                  label="Patient"
                  value={viewing.patients?.full_name ?? "—"}
                />
                <Row
                  label="Pickup time"
                  value={
                    viewing.pickup_time
                      ? new Date(viewing.pickup_time).toLocaleString(
                          undefined,
                          {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          },
                        )
                      : "TBD"
                  }
                />
                <Row label="Driver" value={viewing.driver_name ?? "Unassigned"} />
                <Row
                  label="Vehicle"
                  value={viewing.vehicle_type ?? "—"}
                />
                <Row
                  label="Status"
                  value={
                    (viewing.status ?? "pending")
                      .replace("_", " ")
                      .toUpperCase()
                  }
                />
                <Row
                  label="Estimated cost"
                  value={fmtMoney(
                    viewing.estimated_cost ?? viewing.actual_cost,
                  )}
                />
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {toast ? (
        <View style={styles.toast}>
          <Feather name="check-circle" size={16} color={TEAL} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ComponentProps<typeof Feather>["name"];
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statHead}>
        <Text style={styles.statLabel}>{label}</Text>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatusPill({ kind }: { kind: "confirmed" | "pending" | "none" }) {
  const map = {
    confirmed: { label: "Confirmed", color: TEAL, bg: "rgba(0,194,168,0.15)" },
    pending: { label: "Pending", color: AMBER, bg: "rgba(245,165,36,0.15)" },
    none: { label: "No Action", color: RED, bg: "rgba(239,68,68,0.15)" },
  } as const;
  const m = map[kind];
  return (
    <View style={[styles.pill, { backgroundColor: m.bg }]}>
      <View style={[styles.pillDot, { backgroundColor: m.color }]} />
      <Text style={[styles.pillText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.modalRow}>
      <Text style={styles.modalLabel}>{label}</Text>
      <Text style={styles.modalValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  shell: { flex: 1, flexDirection: "row" },
  sidebar: {
    width: 240,
    backgroundColor: SIDEBAR_BG,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    paddingHorizontal: 18,
    paddingVertical: 24,
    justifyContent: "space-between",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 32,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  logoMarkText: {
    color: NAVY,
    fontSize: 18,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
  },
  logoWord: {
    color: WHITE,
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  navList: { gap: 4, flex: 1 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  navItemActive: { backgroundColor: "rgba(0,194,168,0.12)" },
  navText: {
    color: MUTED,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  navTextActive: {
    color: TEAL,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  sidebarFoot: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 16,
  },
  hospName: {
    color: WHITE,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginBottom: 12,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  signOutText: {
    color: MUTED,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  main: { flex: 1, backgroundColor: NAVY },
  mainContent: { padding: 32, gap: 24 },
  headerBlock: { marginBottom: 4 },
  headerTitle: {
    color: WHITE,
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  headerSub: {
    color: MUTED,
    fontSize: 14,
    marginTop: 4,
    fontFamily: "Inter_400Regular",
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
  },
  statCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  statHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  statLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 32,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  bulkBar: {
    backgroundColor: "rgba(245,165,36,0.10)",
    borderColor: "rgba(245,165,36,0.4)",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bulkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  bulkText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  bulkBtn: {
    backgroundColor: TEAL,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bulkBtnText: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  filtersBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 240,
    flex: 1,
  },
  searchInput: {
    color: WHITE,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
    outlineStyle: "none" as any,
  },
  chipGroup: { flexDirection: "row", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipActive: { backgroundColor: TEAL, borderColor: TEAL },
  chipText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  chipTextActive: { color: NAVY },
  tableWrap: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  tableHead: {
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: SIDEBAR_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  th: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  td: {
    color: WHITE,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  colPatient: { flex: 2 },
  colDate: { flex: 1.2 },
  colProc: { flex: 1.5 },
  colStatus: { flex: 1.2 },
  colAction: { flex: 1.2, alignItems: "flex-start" },
  patientName: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  subMuted: {
    color: MUTED,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  remindBtn: {
    backgroundColor: TEAL,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  remindBtnText: {
    color: NAVY,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  viewBtn: {
    borderWidth: 1,
    borderColor: TEAL,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  viewBtnText: {
    color: TEAL,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  emptyRow: {
    paddingVertical: 36,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    color: MUTED,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 460,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  modalTitle: {
    color: WHITE,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  modalLabel: {
    color: MUTED,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  modalValue: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    textAlign: "right",
    marginLeft: 12,
  },
  toast: {
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: TEAL,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  toastText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
