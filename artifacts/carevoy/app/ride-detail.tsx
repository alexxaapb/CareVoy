import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator,
  Linking, Alert, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const GOLD = "#F5A623";
const MUTED = "#6B7280";

const STATUS_COLORS: Record<string, string> = {
  pending: GOLD,
  confirmed: TEAL,
  assigned: TEAL,
  en_route: "#2563EB",
  arrived: "#16A34A",
  completed: "#16A34A",
  cancelled: "#EF4444",
  invited: MUTED,
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  assigned: "Driver Assigned",
  en_route: "Driver En Route",
  arrived: "Driver Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
  invited: "Pending invite",
};

type Ride = {
  id: string;
  status: string;
  ride_type: string | null;
  pickup_address: string | null;
  dropoff_address: string | null;
  pickup_time: string | null;
  surgery_date: string | null;
  patient_name: string | null;
  hospital_name: string | null;
  procedure_type: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  payment_responsibility: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
};

export default function RideDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from("rides")
        .select("*")
        .eq("id", id)
        .single();
      setRide(data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={TEAL} />
      </View>
    );
  }

  if (!ride) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Ride not found</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[ride.status] || MUTED;
  const statusLabel = STATUS_LABELS[ride.status] || ride.status;
  const pickupDate = ride.pickup_time
    ? new Date(ride.pickup_time).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      })
    : "TBD";
  const pickupTimeStr = ride.pickup_time
    ? new Date(ride.pickup_time).toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit",
      })
    : "";

  const callDriver = () => {
    if (ride.driver_phone) Linking.openURL("tel:" + ride.driver_phone);
  };

  const call911 = () => {
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      if (typeof window !== "undefined") window.alert("Call 911 for emergencies");
      return;
    }
    Alert.alert("Emergency", "Call 911?", [
      { text: "Cancel", style: "cancel" },
      { text: "Call 911", style: "destructive", onPress: () => Linking.openURL("tel:911") },
    ]);
  };

  const paymentLabel =
    ride.payment_responsibility === "facility"
      ? "Covered by facility"
      : ride.payment_responsibility === "insurance"
      ? "Insurance / Medicaid"
      : "Self-pay (HSA/FSA eligible)";

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Feather name="arrow-left" size={22} color={NAVY} />
        </Pressable>
        <Text style={styles.headerTitle}>Ride Details</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        {/* Date + time */}
        <Text style={styles.dateText}>{pickupDate}</Text>
        {pickupTimeStr ? <Text style={styles.timeText}>Pickup at {pickupTimeStr}</Text> : null}

        {/* Driver card (only when assigned) */}
        {ride.driver_name && ["assigned", "en_route", "arrived"].includes(ride.status) ? (
          <View style={styles.driverCard}>
            <View style={styles.driverIcon}>
              <Feather name="user" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>{ride.driver_name}</Text>
              <Text style={styles.driverLabel}>Your driver</Text>
            </View>
            {ride.driver_phone ? (
              <Pressable onPress={callDriver} style={styles.callBtn}>
                <Feather name="phone" size={16} color={TEAL} />
                <Text style={styles.callBtnText}>Call</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Route */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route</Text>
          <View style={styles.routeRow}>
            <Feather name="circle" size={10} color={TEAL} style={{ marginTop: 4 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeText}>{ride.pickup_address || "TBD"}</Text>
            </View>
          </View>
          <View style={[styles.routeRow, { marginTop: 12 }]}>
            <Feather name="map-pin" size={10} color={NAVY} style={{ marginTop: 4 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.routeText}>{ride.hospital_name || ride.dropoff_address || "TBD"}</Text>
            </View>
          </View>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          {ride.procedure_type ? (
            <DetailRow label="Reason" value={ride.procedure_type} />
          ) : null}
          <DetailRow label="Ride type" value={ride.ride_type === "post_op" ? "Post-op return" : "To appointment"} />
          <DetailRow label="Payment" value={paymentLabel} />
        </View>

        {/* Schedule button for invited rides not yet booked */}
        {["invited", "app_downloaded", "reminder_sent", "no_response"].includes(ride.status) ? (
          <Pressable
            onPress={() => router.push(`/book-ride?rideId=${ride.id}&prefill=${encodeURIComponent(JSON.stringify({
              hospital_name: ride.hospital_name || ride.dropoff_address || "",
              procedure_type: ride.procedure_type || "",
              payment_responsibility: ride.payment_responsibility || "self_pay",
            }))}`)}
            style={styles.scheduleBtn}
          >
            <Feather name="calendar" size={16} color="#fff" />
            <Text style={styles.scheduleText}>Schedule this ride</Text>
          </Pressable>
        ) : null}

        {/* Safety button */}
        {["assigned", "en_route", "arrived"].includes(ride.status) ? (
          <Pressable onPress={call911} style={styles.safetyBtn}>
            <Feather name="alert-triangle" size={16} color="#EF4444" />
            <Text style={styles.safetyText}>Emergency — Call 911</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFBFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFBFC" },
  errorText: { fontSize: 16, color: MUTED, marginBottom: 16 },
  backBtn: { backgroundColor: TEAL, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  backBtnText: { color: NAVY, fontWeight: "700", fontSize: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F4F8" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: NAVY },
  scroll: { padding: 20, paddingBottom: 60 },
  statusBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginBottom: 16 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { fontSize: 14, fontWeight: "700" },
  dateText: { fontSize: 22, fontWeight: "700", color: NAVY, marginBottom: 4 },
  timeText: { fontSize: 15, color: MUTED, marginBottom: 24 },
  driverCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 24 },
  driverIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: NAVY, justifyContent: "center", alignItems: "center", marginRight: 12 },
  driverName: { fontSize: 16, fontWeight: "700", color: NAVY },
  driverLabel: { fontSize: 12, color: MUTED, marginTop: 2 },
  callBtn: { flexDirection: "row", alignItems: "center", backgroundColor: TEAL + "18", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, gap: 6 },
  callBtnText: { fontSize: 13, fontWeight: "700", color: TEAL },
  section: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 },
  routeRow: { flexDirection: "row" },
  routeLabel: { fontSize: 11, color: MUTED, fontWeight: "600", marginBottom: 2 },
  routeText: { fontSize: 14, color: NAVY, fontWeight: "500" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  detailLabel: { fontSize: 13, color: MUTED },
  detailValue: { fontSize: 13, color: NAVY, fontWeight: "600", textAlign: "right", flex: 1, marginLeft: 16 },
  scheduleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#050D1F",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  scheduleText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  safetyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 12, padding: 14, marginTop: 8, gap: 8 },
  safetyText: { fontSize: 14, fontWeight: "700", color: "#EF4444" },
});
