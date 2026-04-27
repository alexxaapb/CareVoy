import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../lib/supabase";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const CARD = "#F8FAFC";
const BORDER = "#E2E8F0";
const AMBER = "#F5A623";
const GREEN = "#22C55E";
const RED = "#EF4444";
const SIDEBAR_BG = "#F8FAFC";

const NAV_ITEMS = [
  { key: "overview", label: "Overview", icon: "home" as const },
  { key: "patients", label: "All Patients", icon: "users" as const },
  { key: "rides", label: "All Rides", icon: "navigation" as const },
  { key: "facilities", label: "Facilities", icon: "plus-square" as const },
  { key: "nemt", label: "NEMT Partners", icon: "truck" as const },
  { key: "notifications", label: "Notifications", icon: "bell" as const },
  { key: "revenue", label: "Revenue", icon: "dollar-sign" as const },
  { key: "settings", label: "Settings", icon: "settings" as const },
];

type Ride = {
  id: string;
  status: string | null;
  pickup_time: string | null;
  surgery_date: string | null;
  procedure_type: string | null;
  driver_name: string | null;
  vehicle_type: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  patients: { id: string; full_name: string | null } | null;
  hospitals: { name: string | null } | null;
  nemt_partners: { company_name: string | null } | null;
};

type Notif = {
  id: string;
  recipient_type: string | null;
  channel: string | null;
  message: string | null;
  status: string | null;
  created_at: string;
};

type Hospital = {
  id: string;
  name: string | null;
  city: string | null;
  active: boolean;
};

type HospitalStats = Hospital & {
  activePatients: number;
  ridesThisMonth: number;
};

type NemtPartner = {
  id: string;
  company_name: string | null;
  city: string | null;
  active: boolean;
};

type NemtStats = NemtPartner & {
  totalRides: number;
  lastRideDate: string | null;
};

type Payment = {
  amount: number | null;
  status: string | null;
  created_at: string;
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function startOfLastMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 1).toISOString();
}

function fmtMoney(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtTimeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function fmtPickup(s: string | null) {
  if (!s) return "TBD";
  return new Date(s).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusColor(s: string | null) {
  if (s === "en_route" || s === "arrived") return TEAL;
  if (s === "confirmed") return TEAL;
  if (s === "completed") return GREEN;
  if (s === "pending") return AMBER;
  return MUTED;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPatients: 0,
    activeRides: 0,
    todayRides: 0,
    monthRevenue: 0,
    pendingNotifs: 0,
    activeHospitals: 0,
  });
  const [liveRides, setLiveRides] = useState<Ride[]>([]);
  const [activity, setActivity] = useState<Notif[]>([]);
  const [hospitals, setHospitals] = useState<HospitalStats[]>([]);
  const [partners, setPartners] = useState<NemtStats[]>([]);
  const [revenue, setRevenue] = useState({
    thisMonth: 0,
    lastMonth: 0,
    allTime: 0,
  });
  const [viewing, setViewing] = useState<Ride | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const { width: winWidth } = useWindowDimensions();
  const isMobile = winWidth < 900;
  const onNavSelect = useCallback((key: string) => {
    setActiveNav(key);
    setNavOpen(false);
  }, []);

  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const load = useCallback(async () => {
    const today = todayStr();
    const monthStart = startOfMonthISO();
    const lastMonthStart = startOfLastMonthISO();

    const [
      patientsCount,
      activeRidesRes,
      todayRidesCount,
      pendingNotifCount,
      hospitalsRes,
      partnersRes,
      ridesAllRes,
      paymentsRes,
      notifsRes,
    ] = await Promise.all([
      supabase.from("patients").select("id", { count: "exact", head: true }),
      supabase
        .from("rides")
        .select(
          "id, status, pickup_time, surgery_date, procedure_type, driver_name, vehicle_type, estimated_cost, actual_cost, patients(id, full_name), hospitals(name), nemt_partners(company_name)",
        )
        .in("status", ["confirmed", "en_route", "arrived"])
        .order("pickup_time", { ascending: true }),
      supabase
        .from("rides")
        .select("id", { count: "exact", head: true })
        .gte("pickup_time", `${today}T00:00:00`)
        .lt("pickup_time", `${today}T23:59:59`),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("hospitals").select("id, name, city, active"),
      supabase.from("nemt_partners").select("id, company_name, city, active"),
      supabase
        .from("rides")
        .select(
          "id, hospital_id, nemt_partner_id, patient_id, pickup_time, status, created_at",
        ),
      supabase.from("payments").select("amount, status, created_at"),
      supabase
        .from("notifications")
        .select("id, recipient_type, channel, message, status, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const allRides = (ridesAllRes.data ?? []) as Array<{
      id: string;
      hospital_id: string | null;
      nemt_partner_id: string | null;
      patient_id: string | null;
      pickup_time: string | null;
      status: string | null;
      created_at: string;
    }>;
    const payments = ((paymentsRes.data ?? []) as Payment[]).filter(
      (p) => p.status === "completed",
    );

    const monthRevenueAmt = payments
      .filter((p) => p.created_at >= monthStart)
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const lastMonthRevenueAmt = payments
      .filter(
        (p) => p.created_at >= lastMonthStart && p.created_at < monthStart,
      )
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const allTimeRevenueAmt = payments.reduce(
      (s, p) => s + (Number(p.amount) || 0),
      0,
    );

    const hospitalRows = (hospitalsRes.data ?? []) as Hospital[];
    const partnerRows = (partnersRes.data ?? []) as NemtPartner[];

    const monthStartDate = new Date(monthStart);
    const ridesByHospital = new Map<string, number>();
    const patientsByHospital = new Map<string, Set<string>>();
    const ridesByPartner = new Map<string, number>();
    const lastRideByPartner = new Map<string, string>();

    for (const r of allRides) {
      if (r.hospital_id) {
        if (r.pickup_time && new Date(r.pickup_time) >= monthStartDate) {
          ridesByHospital.set(
            r.hospital_id,
            (ridesByHospital.get(r.hospital_id) ?? 0) + 1,
          );
        }
        if (
          r.patient_id &&
          r.status &&
          ["confirmed", "en_route", "arrived", "pending"].includes(r.status)
        ) {
          if (!patientsByHospital.has(r.hospital_id))
            patientsByHospital.set(r.hospital_id, new Set());
          patientsByHospital.get(r.hospital_id)!.add(r.patient_id);
        }
      }
      if (r.nemt_partner_id) {
        ridesByPartner.set(
          r.nemt_partner_id,
          (ridesByPartner.get(r.nemt_partner_id) ?? 0) + 1,
        );
        const prev = lastRideByPartner.get(r.nemt_partner_id);
        if (!prev || (r.pickup_time && r.pickup_time > prev)) {
          if (r.pickup_time)
            lastRideByPartner.set(r.nemt_partner_id, r.pickup_time);
        }
      }
    }

    setHospitals(
      hospitalRows.map((h) => ({
        ...h,
        activePatients: patientsByHospital.get(h.id)?.size ?? 0,
        ridesThisMonth: ridesByHospital.get(h.id) ?? 0,
      })),
    );

    setPartners(
      partnerRows.map((p) => ({
        ...p,
        totalRides: ridesByPartner.get(p.id) ?? 0,
        lastRideDate: lastRideByPartner.get(p.id) ?? null,
      })),
    );

    setStats({
      totalPatients: patientsCount.count ?? 0,
      activeRides: (activeRidesRes.data ?? []).filter(
        (r: { status: string | null }) => r.status === "en_route",
      ).length,
      todayRides: todayRidesCount.count ?? 0,
      monthRevenue: monthRevenueAmt,
      pendingNotifs: pendingNotifCount.count ?? 0,
      activeHospitals: hospitalRows.filter((h) => h.active).length,
    });

    setLiveRides((activeRidesRes.data as unknown as Ride[]) ?? []);
    setActivity((notifsRes.data as unknown as Notif[]) ?? []);
    setRevenue({
      thisMonth: monthRevenueAmt,
      lastMonth: lastMonthRevenueAmt,
      allTime: allTimeRevenueAmt,
    });
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const dateStr = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    [],
  );

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const revenueMax = Math.max(revenue.thisMonth, revenue.lastMonth, 1);

  const sidebarInner = (
    <>
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
              onPress={() => onNavSelect(item.key)}
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
              <Text style={[styles.navText, active && styles.navTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.sidebarFoot}>
        <View style={styles.adminBadge}>
          <Feather name="shield" size={12} color={NAVY} />
          <Text style={styles.adminBadgeText}>ADMIN</Text>
        </View>
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
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.shell}>
        {!isMobile && <View style={styles.sidebar}>{sidebarInner}</View>}

        {/* Main */}
        <ScrollView
          style={styles.main}
          contentContainerStyle={styles.mainContent}
        >
          {isMobile && (
            <View style={styles.mobileBar}>
              <Pressable
                onPress={() => setNavOpen(true)}
                hitSlop={10}
                style={styles.menuBtn}
              >
                <Feather name="menu" size={24} color={NAVY} />
              </Pressable>
              <View style={styles.mobileBrand}>
                <View style={styles.mobileLogo}>
                  <Text style={styles.mobileLogoText}>C</Text>
                </View>
                <Text style={styles.mobileBrandText}>CareVoy</Text>
              </View>
              <View style={{ width: 24 }} />
            </View>
          )}
          <View style={styles.headerBlock}>
            <Text style={styles.headerTitle}>CareVoy Command Center</Text>
            <View style={styles.headerSubRow}>
              <Text style={styles.headerSub}>{dateStr} • </Text>
              <Animated.View style={[styles.liveDot, { opacity: pulse }]} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>

          {/* 6 stat cards */}
          <View style={styles.statsRow}>
            <StatCard
              label="Total Patients"
              value={stats.totalPatients}
              icon="users"
              color={NAVY}
            />
            <StatCard
              label="Active Rides"
              value={stats.activeRides}
              icon="navigation"
              color={TEAL}
            />
            <StatCard
              label="Today's Rides"
              value={stats.todayRides}
              icon="calendar"
              color={NAVY}
            />
            <StatCard
              label="This Month Revenue"
              value={fmtMoney(stats.monthRevenue)}
              icon="trending-up"
              color={TEAL}
            />
            <StatCard
              label="Pending Notifications"
              value={stats.pendingNotifs}
              icon="bell"
              color={AMBER}
            />
            <StatCard
              label="Facilities Active"
              value={stats.activeHospitals}
              icon="plus-square"
              color={NAVY}
            />
          </View>

          {/* Live rides + activity feed */}
          <View style={styles.twoCol}>
            <View style={styles.colMain}>
              <SectionTitle
                title="Live Rides — Right Now"
                subtitle={`${liveRides.length} in progress`}
              />
              <View style={styles.tableWrap}>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, styles.cPat]}>Patient</Text>
                  <Text style={[styles.th, styles.cHosp]}>Hospital</Text>
                  <Text style={[styles.th, styles.cPart]}>NEMT Partner</Text>
                  <Text style={[styles.th, styles.cStat]}>Status</Text>
                  <Text style={[styles.th, styles.cTime]}>Pickup</Text>
                  <Text style={[styles.th, styles.cAct]}>Action</Text>
                </View>
                {loading ? (
                  <ActivityIndicator
                    color={TEAL}
                    style={{ marginVertical: 28 }}
                  />
                ) : liveRides.length === 0 ? (
                  <View style={styles.empty}>
                    <Feather name="moon" size={22} color={MUTED} />
                    <Text style={styles.emptyText}>
                      No active rides right now.
                    </Text>
                  </View>
                ) : (
                  liveRides.map((r) => (
                    <View key={r.id} style={styles.tr}>
                      <Text style={[styles.td, styles.cPat]} numberOfLines={1}>
                        {r.patients?.full_name ?? "—"}
                      </Text>
                      <Text style={[styles.td, styles.cHosp]} numberOfLines={1}>
                        {r.hospitals?.name ?? "—"}
                      </Text>
                      <Text style={[styles.td, styles.cPart]} numberOfLines={1}>
                        {r.nemt_partners?.company_name ?? "Unassigned"}
                      </Text>
                      <View style={styles.cStat}>
                        <View
                          style={[
                            styles.statusPill,
                            { backgroundColor: `${statusColor(r.status)}22` },
                          ]}
                        >
                          <View
                            style={[
                              styles.statusDot,
                              { backgroundColor: statusColor(r.status) },
                            ]}
                          />
                          <Text
                            style={[
                              styles.statusText,
                              { color: statusColor(r.status) },
                            ]}
                          >
                            {(r.status ?? "—").replace("_", " ").toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.td, styles.cTime]}>
                        {fmtPickup(r.pickup_time)}
                      </Text>
                      <View style={styles.cAct}>
                        <Pressable
                          onPress={() => setViewing(r)}
                          style={({ pressed }) => [
                            styles.viewBtn,
                            pressed && { opacity: 0.85 },
                          ]}
                        >
                          <Text style={styles.viewBtnText}>View Details</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>

            <View style={styles.colSide}>
              <SectionTitle title="Recent Activity" subtitle="Last 20 events" />
              <View style={styles.activityCard}>
                {activity.length === 0 ? (
                  <View style={styles.empty}>
                    <Feather name="inbox" size={20} color={MUTED} />
                    <Text style={styles.emptyText}>No activity yet.</Text>
                  </View>
                ) : (
                  activity.map((n) => (
                    <View key={n.id} style={styles.activityRow}>
                      <View style={styles.activityIcon}>
                        <Feather
                          name={
                            n.channel === "email"
                              ? "mail"
                              : n.channel === "push"
                                ? "smartphone"
                                : "message-circle"
                          }
                          size={14}
                          color={TEAL}
                        />
                      </View>
                      <View style={styles.activityBody}>
                        <Text style={styles.activityMsg} numberOfLines={2}>
                          {(n.message ?? "").slice(0, 60)}
                          {(n.message ?? "").length > 60 ? "…" : ""}
                        </Text>
                        <Text style={styles.activityMeta}>
                          {(n.recipient_type ?? "—").toUpperCase()} •{" "}
                          {fmtTimeAgo(n.created_at)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusDotSm,
                          {
                            backgroundColor:
                              n.status === "sent"
                                ? GREEN
                                : n.status === "failed"
                                  ? RED
                                  : AMBER,
                          },
                        ]}
                      />
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>

          {/* Hospitals */}
          <SectionTitle
            title="Facilities"
            subtitle={`${hospitals.length} total`}
          />
          <View style={styles.tableWrap}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 2 }]}>Name</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>City</Text>
              <Text style={[styles.th, { flex: 1 }]}>Active Patients</Text>
              <Text style={[styles.th, { flex: 1 }]}>Rides This Month</Text>
              <Text style={[styles.th, { flex: 0.8 }]}>Status</Text>
            </View>
            {hospitals.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No facilities yet.</Text>
              </View>
            ) : (
              hospitals.map((h) => (
                <View key={h.id} style={styles.tr}>
                  <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>
                    {h.name ?? "—"}
                  </Text>
                  <Text style={[styles.td, { flex: 1.2 }]}>
                    {h.city ?? "—"}
                  </Text>
                  <Text style={[styles.td, { flex: 1 }]}>
                    {h.activePatients}
                  </Text>
                  <Text style={[styles.td, { flex: 1 }]}>
                    {h.ridesThisMonth}
                  </Text>
                  <View style={{ flex: 0.8 }}>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: h.active
                            ? `${GREEN}22`
                            : `${MUTED}22`,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: h.active ? GREEN : MUTED },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          { color: h.active ? GREEN : MUTED },
                        ]}
                      >
                        {h.active ? "ACTIVE" : "INACTIVE"}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* NEMT Partners */}
          <SectionTitle
            title="NEMT Partners"
            subtitle={`${partners.length} total`}
          />
          <View style={styles.tableWrap}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 2 }]}>Name</Text>
              <Text style={[styles.th, { flex: 1.2 }]}>City</Text>
              <Text style={[styles.th, { flex: 1 }]}>Total Rides</Text>
              <Text style={[styles.th, { flex: 0.8 }]}>Active</Text>
              <Text style={[styles.th, { flex: 1.4 }]}>Last Ride Date</Text>
            </View>
            {partners.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No partners yet.</Text>
              </View>
            ) : (
              partners.map((p) => (
                <View key={p.id} style={styles.tr}>
                  <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>
                    {p.company_name ?? "—"}
                  </Text>
                  <Text style={[styles.td, { flex: 1.2 }]}>
                    {p.city ?? "—"}
                  </Text>
                  <Text style={[styles.td, { flex: 1 }]}>{p.totalRides}</Text>
                  <Text
                    style={[
                      styles.td,
                      { flex: 0.8, color: p.active ? GREEN : MUTED },
                    ]}
                  >
                    {p.active ? "Yes" : "No"}
                  </Text>
                  <Text style={[styles.td, { flex: 1.4 }]}>
                    {p.lastRideDate
                      ? new Date(p.lastRideDate).toLocaleDateString()
                      : "—"}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* Revenue */}
          <SectionTitle
            title="Revenue Summary"
            subtitle="HSA / FSA / Card payments"
          />
          <View style={styles.revCard}>
            <RevenueBar
              label="This Month"
              amount={revenue.thisMonth}
              max={revenueMax}
              color={TEAL}
            />
            <RevenueBar
              label="Last Month"
              amount={revenue.lastMonth}
              max={revenueMax}
              color="#5B7290"
            />
            <View style={styles.revDivider} />
            <View style={styles.revAllTime}>
              <Text style={styles.revAllLabel}>Total all time</Text>
              <Text style={styles.revAllValue}>
                {fmtMoney(revenue.allTime)}
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Modal */}
      <Modal
        visible={!!viewing}
        transparent
        animationType="fade"
        onRequestClose={() => setViewing(null)}
      >
        <Pressable style={styles.modalScrim} onPress={() => setViewing(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Ride details</Text>
              <Pressable onPress={() => setViewing(null)} hitSlop={8}>
                <Feather name="x" size={20} color={MUTED} />
              </Pressable>
            </View>
            {viewing ? (
              <View style={{ gap: 14 }}>
                <ModalRow
                  label="Patient"
                  value={viewing.patients?.full_name ?? "—"}
                />
                <ModalRow
                  label="Facility"
                  value={viewing.hospitals?.name ?? "—"}
                />
                <ModalRow
                  label="NEMT Partner"
                  value={viewing.nemt_partners?.company_name ?? "Unassigned"}
                />
                <ModalRow
                  label="Pickup time"
                  value={fmtPickup(viewing.pickup_time)}
                />
                <ModalRow
                  label="Driver"
                  value={viewing.driver_name ?? "Unassigned"}
                />
                <ModalRow label="Vehicle" value={viewing.vehicle_type ?? "—"} />
                <ModalRow
                  label="Status"
                  value={(viewing.status ?? "pending")
                    .replace("_", " ")
                    .toUpperCase()}
                />
                <ModalRow
                  label="Estimated cost"
                  value={
                    viewing.estimated_cost != null
                      ? fmtMoney(Number(viewing.estimated_cost))
                      : viewing.actual_cost != null
                        ? fmtMoney(Number(viewing.actual_cost))
                        : "—"
                  }
                />
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {isMobile && (
        <Modal
          visible={navOpen}
          animationType="fade"
          transparent
          onRequestClose={() => setNavOpen(false)}
        >
          <Pressable
            style={styles.drawerBackdrop}
            onPress={() => setNavOpen(false)}
          />
          <View style={[styles.sidebar, styles.drawer]}>
            <Pressable
              style={styles.drawerClose}
              onPress={() => setNavOpen(false)}
              hitSlop={10}
            >
              <Feather name="x" size={22} color={NAVY} />
            </Pressable>
            {sidebarInner}
          </View>
        </Modal>
      )}
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
  value: number | string;
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

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function RevenueBar({
  label,
  amount,
  max,
  color,
}: {
  label: string;
  amount: number;
  max: number;
  color: string;
}) {
  const pct = Math.max(2, Math.round((amount / max) * 100));
  return (
    <View style={styles.revRow}>
      <Text style={styles.revLabel}>{label}</Text>
      <View style={styles.revTrack}>
        <View
          style={[styles.revFill, { width: `${pct}%`, backgroundColor: color }]}
        />
      </View>
      <Text style={styles.revValue}>{fmtMoney(amount)}</Text>
    </View>
  );
}

function ModalRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.modalRow}>
      <Text style={styles.modalLabel}>{label}</Text>
      <Text style={styles.modalValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
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
    color: NAVY,
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
  navText: { color: MUTED, fontSize: 14, fontFamily: "Inter_500Medium" },
  navTextActive: {
    color: TEAL,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  sidebarFoot: { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 16 },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: TEAL,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginBottom: 14,
  },
  adminBadgeText: {
    color: NAVY,
    fontSize: 11,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  signOutText: { color: MUTED, fontSize: 13, fontFamily: "Inter_500Medium" },
  main: { flex: 1, backgroundColor: WHITE },
  mainContent: { padding: 20, gap: 24 },
  mobileBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    marginBottom: 4,
  },
  menuBtn: { padding: 4 },
  mobileBrand: { flexDirection: "row", alignItems: "center", gap: 8 },
  mobileLogo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
  },
  mobileLogoText: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "Inter_700Bold",
  },
  mobileBrandText: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 260,
    paddingTop: 56,
  },
  drawerClose: {
    position: "absolute",
    top: 14,
    right: 14,
    padding: 6,
    zIndex: 2,
  },
  headerBlock: { marginBottom: 4 },
  headerTitle: {
    color: NAVY,
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  headerSubRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  headerSub: { color: MUTED, fontSize: 14, fontFamily: "Inter_400Regular" },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
    marginRight: 6,
  },
  liveText: {
    color: GREEN,
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  statsRow: { flexDirection: "row", gap: 14, flexWrap: "wrap" },
  statCard: {
    flexGrow: 1,
    flexBasis: 180,
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
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: { fontSize: 26, fontWeight: "700", fontFamily: "Inter_700Bold" },
  twoCol: { flexDirection: "row", gap: 20, alignItems: "flex-start" },
  colMain: { flex: 2, gap: 12 },
  colSide: { flex: 1, gap: 12, minWidth: 280 },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionTitle: {
    color: NAVY,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  sectionSubtitle: {
    color: MUTED,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  tableWrap: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  tableHead: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  td: { color: NAVY, fontSize: 13, fontFamily: "Inter_400Regular" },
  cPat: { flex: 1.6 },
  cHosp: { flex: 1.6 },
  cPart: { flex: 1.4 },
  cStat: { flex: 1.2 },
  cTime: { flex: 1.2 },
  cAct: { flex: 1, alignItems: "flex-start" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
  },
  viewBtn: {
    borderWidth: 1,
    borderColor: TEAL,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewBtnText: {
    color: TEAL,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  empty: { paddingVertical: 32, alignItems: "center", gap: 8 },
  emptyText: { color: MUTED, fontSize: 13, fontFamily: "Inter_400Regular" },
  activityCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,194,168,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  activityBody: { flex: 1 },
  activityMsg: {
    color: NAVY,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  activityMeta: {
    color: MUTED,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    letterSpacing: 0.3,
  },
  statusDotSm: { width: 8, height: 8, borderRadius: 4 },
  revCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 22,
    gap: 16,
  },
  revRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  revLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    width: 110,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  revTrack: {
    flex: 1,
    height: 12,
    backgroundColor: SIDEBAR_BG,
    borderRadius: 6,
    overflow: "hidden",
  },
  revFill: { height: "100%", borderRadius: 6 },
  revValue: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    width: 110,
    textAlign: "right",
  },
  revDivider: { height: 1, backgroundColor: BORDER, marginVertical: 4 },
  revAllTime: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  revAllLabel: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  revAllValue: {
    color: TEAL,
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
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
    maxWidth: 480,
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
    color: NAVY,
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
  modalLabel: { color: MUTED, fontSize: 13, fontFamily: "Inter_400Regular" },
  modalValue: {
    color: NAVY,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    flex: 1,
    textAlign: "right",
    marginLeft: 12,
  },
});
