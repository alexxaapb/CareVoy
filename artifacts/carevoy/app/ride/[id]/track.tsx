import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  MapView,
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
} from "../../../lib/maps";
import { supabase } from "../../../lib/supabase";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const CARD = "#F8FAFC";
const BORDER = "#E2E8F0";

const COLUMBUS_PICKUP = { latitude: 39.9612, longitude: -82.9988 };
const SIM_START_OFFSET = { dLat: 0.045, dLng: 0.06 };
const SIM_DURATION_MS = 6 * 60 * 1000;
const POLL_MS = 10_000;
const SIM_TICK_MS = 1_000;

type RideRow = {
  id: string;
  status: string | null;
  driver_name: string | null;
  vehicle_type: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  driver_lat: number | null;
  driver_lng: number | null;
};

type LatLng = { latitude: number; longitude: number };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export default function TrackRideScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ride, setRide] = useState<RideRow | null>(null);
  const startedAt = useRef<number>(Date.now());
  const [progress, setProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const pickup: LatLng = useMemo(
    () => ({
      latitude: ride?.pickup_lat ?? COLUMBUS_PICKUP.latitude,
      longitude: ride?.pickup_lng ?? COLUMBUS_PICKUP.longitude,
    }),
    [ride?.pickup_lat, ride?.pickup_lng],
  );

  const simStart: LatLng = useMemo(
    () => ({
      latitude: pickup.latitude + SIM_START_OFFSET.dLat,
      longitude: pickup.longitude - SIM_START_OFFSET.dLng,
    }),
    [pickup.latitude, pickup.longitude],
  );

  const driverPos: LatLng = useMemo(() => {
    if (ride?.driver_lat != null && ride?.driver_lng != null) {
      return { latitude: ride.driver_lat, longitude: ride.driver_lng };
    }
    return {
      latitude: lerp(simStart.latitude, pickup.latitude, progress),
      longitude: lerp(simStart.longitude, pickup.longitude, progress),
    };
  }, [ride?.driver_lat, ride?.driver_lng, simStart, pickup, progress]);

  const etaMin = Math.max(
    0,
    Math.round(((1 - progress) * SIM_DURATION_MS) / 60_000),
  );

  const loadRide = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("rides")
      .select(
        "id, status, driver_name, vehicle_type, pickup_lat, pickup_lng, driver_lat, driver_lng",
      )
      .eq("id", id)
      .maybeSingle();
    setRide((data as unknown as RideRow) ?? null);
    if ((data as RideRow | null)?.status === "completed") {
      router.replace(`/ride/${id}/complete`);
    }
  }, [id, router]);

  useEffect(() => {
    loadRide();
    const poll = setInterval(loadRide, POLL_MS);
    return () => clearInterval(poll);
  }, [loadRide]);

  useEffect(() => {
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const p = Math.min(1, elapsed / SIM_DURATION_MS);
      setProgress(p);
      Animated.timing(progressAnim, {
        toValue: p,
        duration: SIM_TICK_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
      if (p >= 1) clearInterval(tick);
    }, SIM_TICK_MS);
    return () => clearInterval(tick);
  }, [progressAnim]);

  const region = {
    latitude: (driverPos.latitude + pickup.latitude) / 2,
    longitude: (driverPos.longitude + pickup.longitude) / 2,
    latitudeDelta: Math.max(
      0.01,
      Math.abs(driverPos.latitude - pickup.latitude) * 2.2,
    ),
    longitudeDelta: Math.max(
      0.01,
      Math.abs(driverPos.longitude - pickup.longitude) * 2.2,
    ),
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      {MapView ? (
        <MapView
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          region={region}
          showsUserLocation={false}
          customMapStyle={DARK_MAP_STYLE}
        >
          <Polyline
            coordinates={[driverPos, pickup]}
            strokeColor={TEAL}
            strokeWidth={4}
          />
          <Marker coordinate={driverPos} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarker}>
              <Feather name="navigation" size={18} color={NAVY} />
            </View>
          </Marker>
          <Marker coordinate={pickup} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.pickupMarker}>
              <Feather name="home" size={16} color={NAVY} />
            </View>
          </Marker>
        </MapView>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.mapFallback]}>
          <View style={styles.fallbackGrid} />
          <View
            style={[
              styles.fallbackPin,
              { top: "30%", left: "25%", backgroundColor: TEAL },
            ]}
          >
            <Feather name="navigation" size={18} color={NAVY} />
          </View>
          <View
            style={[
              styles.fallbackLine,
              {
                top: "33%",
                left: "27%",
                width: `${40 + progress * 30}%`,
              },
            ]}
          />
          <View
            style={[
              styles.fallbackPin,
              { top: "62%", left: "65%", backgroundColor: WHITE },
            ]}
          >
            <Feather name="home" size={16} color={NAVY} />
          </View>
          <Text style={styles.fallbackHint}>Map preview</Text>
        </View>
      )}

      <SafeAreaView style={styles.topSafe} edges={["top"]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={22} color={NAVY} />
        </Pressable>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomSafe} edges={["bottom"]}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle}>Your driver is on the way</Text>
          <View style={styles.driverRow}>
            <View style={styles.avatar}>
              <Feather name="user" size={20} color={TEAL} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>
                {ride?.driver_name ?? "Driver"}
              </Text>
              <Text style={styles.driverSub}>
                {ride?.vehicle_type ?? "Wheelchair-accessible van"}
              </Text>
            </View>
            <View style={styles.etaBox}>
              <Text style={styles.etaLabel}>ETA</Text>
              <Text style={styles.etaValue}>~{etaMin} min</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["4%", "100%"],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.progressNote}>
            {progress < 1
              ? "Driver is en route to your pickup"
              : "Driver is arriving now"}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#F1F5F9" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6B7280" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#FFFFFF" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#FFFFFF" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#E2E8F0" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#DBEAFE" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#E2E8F0" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#E2E8F0" }],
  },
];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WHITE },
  mapFallback: {
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackGrid: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    borderColor: "#E2E8F0",
    borderWidth: 0,
  },
  fallbackPin: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  fallbackLine: {
    position: "absolute",
    height: 3,
    backgroundColor: TEAL,
    borderRadius: 2,
    transform: [{ rotate: "25deg" }],
  },
  fallbackHint: {
    color: MUTED,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    position: "absolute",
    bottom: 220,
  },
  topSafe: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  liveText: {
    color: NAVY,
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
  driverMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: NAVY,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  pickupMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: WHITE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: NAVY,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  bottomSafe: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderColor: BORDER,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetTitle: {
    color: NAVY,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 14,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
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
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  driverSub: {
    color: MUTED,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  etaBox: { alignItems: "flex-end" },
  etaLabel: {
    color: MUTED,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  etaValue: {
    color: TEAL,
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  progressTrack: {
    height: 6,
    backgroundColor: BORDER,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: TEAL,
    borderRadius: 3,
  },
  progressNote: {
    color: MUTED,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
    textAlign: "center",
  },
});
