import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../../lib/supabase";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const CARD = "#F8FAFC";
const BORDER = "#E2E8F0";
const AMBER = "#F5A623";
const BLUE = "#3B82F6";
const GREEN = "#22C55E";

type Ride = {
  id: string;
  ride_type: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  pickup_time: string | null;
  surgery_date: string | null;
  procedure_type: string | null;
  status: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_type: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string | null;
  hospitals: { name: string | null } | null;
  nemt_partners: { company_name: string | null } | null;
};

type Payment = {
  id: string;
  amount: number | null;
  payment_method: string | null;
  status: string | null;
  irs_expense_code: string | null;
  created_at: string | null;
};

type Patient = {
  full_name: string | null;
  email: string | null;
};

const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  pending: {
    label: "Pending",
    color: AMBER,
    bg: "rgba(245,165,36,0.15)",
  },
  confirmed: {
    label: "Confirmed",
    color: TEAL,
    bg: "rgba(0,194,168,0.15)",
  },
  en_route: {
    label: "En Route",
    color: BLUE,
    bg: "rgba(59,130,246,0.15)",
  },
  completed: {
    label: "Completed",
    color: GREEN,
    bg: "rgba(34,197,94,0.15)",
  },
  cancelled: {
    label: "Cancelled",
    color: MUTED,
    bg: "rgba(138,147,166,0.15)",
  },
};

const TIMELINE_STEPS = [
  { key: "requested", label: "Ride requested" },
  { key: "confirmed", label: "Ride confirmed" },
  { key: "assigned", label: "Driver assigned" },
  { key: "en_route", label: "Driver en route" },
  { key: "arrived", label: "Arrived at pickup" },
  { key: "completed", label: "Dropped off" },
];

function statusToProgress(status: string | null, hasDriver: boolean): number {
  switch (status) {
    case "completed":
      return 6;
    case "arrived":
      return 5;
    case "en_route":
      return 4;
    case "confirmed":
      return hasDriver ? 3 : 2;
    case "pending":
    default:
      return 1;
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMoney(n: number | null): string {
  if (n == null) return "—";
  return `$${n.toFixed(2)}`;
}

function methodLabel(m: string | null): string {
  if (m === "hsa") return "HSA Card";
  if (m === "fsa") return "FSA Card";
  if (m === "card") return "Credit Card";
  return "—";
}

export default function RideDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ride, setRide] = useState<Ride | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailing, setEmailing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const [rideRes, paymentRes, patientRes] = await Promise.all([
      supabase
        .from("rides")
        .select(
          "id, ride_type, pickup_address, dropoff_address, pickup_time, surgery_date, procedure_type, status, driver_name, driver_phone, vehicle_type, estimated_cost, actual_cost, created_at, hospitals(name), nemt_partners(company_name)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("payments")
        .select(
          "id, amount, payment_method, status, irs_expense_code, created_at",
        )
        .eq("ride_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("patients")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    setRide((rideRes.data as unknown as Ride) ?? null);
    setPayment((paymentRes.data as unknown as Payment) ?? null);
    setPatient((patientRes.data as unknown as Patient) ?? null);
  }, [id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useEffect(() => {
    if (!ride) return;
    if (ride.status === "en_route") {
      router.replace(`/ride/${ride.id}/track`);
    } else if (ride.status === "completed") {
      // stays on detail; completion screen is opened from tracking flow
    }
  }, [ride, router]);

  const callDriver = () => {
    if (!ride?.driver_phone) return;
    const tel = ride.driver_phone.replace(/[^\d+]/g, "");
    Linking.openURL(`tel:${tel}`).catch(() => {
      Alert.alert("Couldn't open dialer");
    });
  };

  const emailReceipt = async () => {
    if (!ride || !patient?.email) {
      Alert.alert("No email on file");
      return;
    }
    setEmailing(true);
    try {
      await supabase.from("notifications").insert({
        recipient_id: ride.id ? undefined : undefined,
        recipient_type: "patient",
        channel: "email",
        message: `Receipt for ride on ${formatDateTime(ride.pickup_time)} — ${formatMoney(payment?.amount ?? ride.actual_cost)} — IRS Code 213(d) Medical Transportation`,
        status: "pending",
      });
      Alert.alert(
        "Receipt sent",
        `A copy has been emailed to ${patient.email}.`,
      );
    } catch {
      Alert.alert("Couldn't send receipt", "Please try again.");
    } finally {
      setEmailing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loading}>
          <ActivityIndicator color={TEAL} />
        </View>
      </SafeAreaView>
    );
  }

  if (!ride) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Feather name="arrow-left" size={24} color={NAVY} />
          </Pressable>
        </View>
        <View style={styles.loading}>
          <Text style={styles.emptyText}>Ride not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusKey = ride.status ?? "pending";
  const meta = STATUS_META[statusKey] ?? STATUS_META.pending;
  const hasDriver = !!ride.driver_name;
  const progress = statusToProgress(ride.status, hasDriver);
  const hospitalName = ride.hospitals?.name ?? ride.dropoff_address ?? "—";
  const isCompleted = ride.status === "completed";
  const amount = payment?.amount ?? ride.actual_cost ?? ride.estimated_cost;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Feather name="arrow-left" size={24} color={NAVY} />
          </Pressable>
          <View style={styles.badgeRow}>
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>
                {ride.ride_type === "post_op" ? "POST-OP" : "PRE-OP"}
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
              <View
                style={[styles.statusDot, { backgroundColor: meta.color }]}
              />
              <Text style={[styles.statusPillText, { color: meta.color }]}>
                {meta.label}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.title}>
          {ride.ride_type === "post_op"
            ? "Post-op Ride Home"
            : "Ride to Surgery"}
        </Text>
        <Text style={styles.subtitle}>{formatDateTime(ride.pickup_time)}</Text>

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.timeline}>
            {TIMELINE_STEPS.map((step, idx) => {
              const done = idx < progress;
              const current = idx === progress - 1;
              const isLast = idx === TIMELINE_STEPS.length - 1;
              return (
                <View key={step.key} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View
                      style={[
                        styles.dot,
                        done
                          ? styles.dotDone
                          : current
                            ? styles.dotCurrent
                            : styles.dotIdle,
                      ]}
                    >
                      {done ? (
                        <Feather name="check" size={12} color={NAVY} />
                      ) : null}
                    </View>
                    {!isLast ? (
                      <View
                        style={[
                          styles.line,
                          done ? styles.lineDone : styles.lineIdle,
                        ]}
                      />
                    ) : null}
                  </View>
                  <View style={styles.timelineBody}>
                    <Text
                      style={[
                        styles.timelineLabel,
                        !done && styles.timelineLabelMuted,
                      ]}
                    >
                      {step.label}
                    </Text>
                    {done ? (
                      <Text style={styles.timelineTime}>
                        {idx === 0
                          ? formatTimestamp(ride.created_at)
                          : current
                            ? formatTimestamp(ride.pickup_time)
                            : ""}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Ride Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ride details</Text>
          <View style={styles.card}>
            <DetailRow
              icon="calendar"
              label="Surgery date"
              value={
                ride.surgery_date
                  ? new Date(ride.surgery_date).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"
              }
            />
            <DetailRow
              icon="clock"
              label="Pickup time"
              value={formatDateTime(ride.pickup_time)}
            />
            <DetailRow
              icon="map-pin"
              label="Pickup"
              value={ride.pickup_address ?? "—"}
            />
            <DetailRow
              icon="navigation"
              label="Hospital"
              value={hospitalName}
            />
            {ride.procedure_type ? (
              <DetailRow
                icon="activity"
                label="Procedure"
                value={ride.procedure_type}
              />
            ) : null}
            {ride.vehicle_type ? (
              <DetailRow
                icon="truck"
                label="Vehicle"
                value={ride.vehicle_type}
                last
              />
            ) : null}
          </View>
        </View>

        {/* Driver */}
        {hasDriver ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your driver</Text>
            <View style={styles.card}>
              <View style={styles.driverRow}>
                <View style={styles.avatar}>
                  <Feather name="user" size={22} color={TEAL} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>{ride.driver_name}</Text>
                  {ride.nemt_partners?.company_name ? (
                    <Text style={styles.driverSub}>
                      {ride.nemt_partners.company_name}
                    </Text>
                  ) : null}
                  {ride.vehicle_type ? (
                    <Text style={styles.driverSub}>{ride.vehicle_type}</Text>
                  ) : null}
                </View>
                {ride.driver_phone ? (
                  <Pressable
                    onPress={callDriver}
                    style={({ pressed }) => [
                      styles.callBtn,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Feather name="phone" size={18} color={NAVY} />
                  </Pressable>
                ) : null}
              </View>
              {ride.driver_phone ? (
                <Pressable onPress={callDriver}>
                  <Text style={styles.phoneText}>{ride.driver_phone}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Payment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.card}>
            <View style={styles.paymentTop}>
              <Text style={styles.paymentAmount}>{formatMoney(amount)}</Text>
              <View
                style={[
                  styles.paymentStatus,
                  {
                    backgroundColor:
                      payment?.status === "completed"
                        ? "rgba(34,197,94,0.15)"
                        : "rgba(245,165,36,0.15)",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.paymentStatusText,
                    {
                      color: payment?.status === "completed" ? GREEN : AMBER,
                    },
                  ]}
                >
                  {(payment?.status ?? "pending").toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.paymentMethod}>
              Paid with {methodLabel(payment?.payment_method ?? null)}
            </Text>
            <View style={styles.irsBadge}>
              <Feather name="shield" size={12} color={TEAL} />
              <Text style={styles.irsBadgeText}>
                IRS Code 213(d) — HSA/FSA eligible
              </Text>
            </View>
          </View>
        </View>

        {/* Receipt */}
        {isCompleted ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Receipt</Text>
            <View style={styles.card}>
              <View style={styles.receiptHeader}>
                <Feather name="file-text" size={18} color={TEAL} />
                <Text style={styles.receiptTitle}>HSA/FSA Receipt</Text>
              </View>
              <ReceiptLine
                label="Provider"
                value={ride.nemt_partners?.company_name ?? "CareVoy NEMT"}
              />
              <ReceiptLine
                label="Date"
                value={formatDateTime(ride.pickup_time)}
              />
              <ReceiptLine label="Amount" value={formatMoney(amount)} />
              <ReceiptLine
                label="IRS Code"
                value={payment?.irs_expense_code ?? "213(d)"}
              />
              <ReceiptLine
                label="Service"
                value="Medical Transportation"
                last
              />
              <Pressable
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && styles.pressed,
                ]}
                onPress={() =>
                  Alert.alert("Receipt downloaded", "Saved to your device.")
                }
              >
                <Feather name="download" size={18} color={NAVY} />
                <Text style={styles.primaryBtnText}>Download Receipt</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.linkBtn,
                  pressed && styles.pressed,
                ]}
                onPress={emailReceipt}
                disabled={emailing}
              >
                <Feather name="mail" size={16} color={TEAL} />
                <Text style={styles.linkBtnText}>
                  {emailing ? "Sending…" : "Email receipt again"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  icon,
  label,
  value,
  last,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Feather name={icon} size={16} color={MUTED} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function ReceiptLine({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.receiptRow, !last && styles.receiptRowBorder]}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <Text style={styles.receiptValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
  container: { padding: 24, paddingBottom: 48 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  badgeRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  typePill: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  typePillText: {
    color: NAVY,
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  pressed: { opacity: 0.75 },
  title: {
    color: NAVY,
    fontSize: 26,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: MUTED,
    fontSize: 15,
    marginTop: 4,
    marginBottom: 24,
    fontFamily: "Inter_400Regular",
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginBottom: 12,
  },
  timeline: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  timelineRow: { flexDirection: "row", gap: 14 },
  timelineLeft: { alignItems: "center", width: 22 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  dotDone: { backgroundColor: TEAL, borderColor: TEAL },
  dotCurrent: {
    backgroundColor: "rgba(0,194,168,0.25)",
    borderColor: TEAL,
  },
  dotIdle: { backgroundColor: "transparent", borderColor: BORDER },
  line: { flex: 1, width: 2, marginVertical: 4, minHeight: 18 },
  lineDone: { backgroundColor: TEAL },
  lineIdle: { backgroundColor: BORDER },
  timelineBody: { flex: 1, paddingBottom: 18 },
  timelineLabel: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  timelineLabelMuted: { color: MUTED, fontWeight: "400" },
  timelineTime: {
    color: MUTED,
    fontSize: 12,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  detailRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    alignItems: "flex-start",
  },
  detailRowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  detailLabel: {
    color: MUTED,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 2,
  },
  detailValue: {
    color: NAVY,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,194,168,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  driverName: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  driverSub: {
    color: MUTED,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneText: {
    color: TEAL,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginTop: 12,
  },
  paymentTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  paymentAmount: {
    color: NAVY,
    fontSize: 26,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  paymentStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  paymentMethod: {
    color: MUTED,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 14,
  },
  irsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,194,168,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  irsBadgeText: {
    color: TEAL,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  receiptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  receiptTitle: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  receiptRowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  receiptLabel: {
    color: MUTED,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  receiptValue: {
    color: NAVY,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    textAlign: "right",
    marginLeft: 12,
  },
  primaryBtn: {
    backgroundColor: TEAL,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  primaryBtnText: {
    color: NAVY,
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  linkBtnText: {
    color: TEAL,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    color: MUTED,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
