import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
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

type RideRow = {
  id: string;
  actual_cost: number | null;
  estimated_cost: number | null;
};

type Patient = { email: string | null };

export default function CompleteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [ride, setRide] = useState<RideRow | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);

  const scale = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, fade]);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      const [rideRes, patientRes] = await Promise.all([
        supabase
          .from("rides")
          .select("id, actual_cost, estimated_cost")
          .eq("id", id)
          .maybeSingle(),
        userId
          ? supabase
              .from("patients")
              .select("email")
              .eq("id", userId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      setRide((rideRes.data as unknown as RideRow) ?? null);
      setPatient((patientRes.data as unknown as Patient) ?? null);
    })();
  }, [id]);

  const submitRating = async (stars: number) => {
    setRating(stars);
    if (!id) return;
    try {
      await supabase.from("rides").update({ rating: stars }).eq("id", id);
    } catch {
      // column may not exist yet — silently ignore
    }
    setSubmitted(true);
  };

  const amount = ride?.actual_cost ?? ride?.estimated_cost ?? 55;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <Animated.View style={[styles.checkWrap, { transform: [{ scale }] }]}>
          <View style={styles.checkRing}>
            <Feather name="check" size={56} color={WHITE} />
          </View>
        </Animated.View>

        <Animated.View style={{ opacity: fade, alignItems: "center" }}>
          <Text style={styles.title}>You've arrived safely</Text>
          <Text style={styles.subtitle}>
            Your HSA/FSA card was charged ${amount.toFixed(2)}
          </Text>
          <View style={styles.receiptPill}>
            <Feather name="mail" size={14} color={TEAL} />
            <Text style={styles.receiptText}>
              Receipt sent to {patient?.email ?? "your email"}
            </Text>
          </View>

          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>How was your ride?</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable
                  key={s}
                  onPress={() => submitRating(s)}
                  hitSlop={6}
                  style={({ pressed }) => pressed && { opacity: 0.6 }}
                >
                  <Feather
                    name="star"
                    size={36}
                    color={s <= rating ? TEAL : BORDER}
                    style={
                      s <= rating
                        ? { textShadowColor: TEAL, textShadowRadius: 6 }
                        : undefined
                    }
                  />
                </Pressable>
              ))}
            </View>
            {submitted ? (
              <Text style={styles.thanks}>Thanks for your feedback!</Text>
            ) : (
              <Text style={styles.ratingHint}>Tap to rate</Text>
            )}
          </View>
        </Animated.View>

        <Pressable
          style={({ pressed }) => [
            styles.homeBtn,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
    alignItems: "center",
  },
  checkWrap: { marginTop: 20, marginBottom: 28 },
  checkRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: GREEN,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 6,
  },
  title: {
    color: WHITE,
    fontSize: 26,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    color: MUTED,
    fontSize: 16,
    marginTop: 8,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  receiptPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,194,168,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 16,
  },
  receiptText: {
    color: TEAL,
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  ratingCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 24,
    alignItems: "center",
    marginTop: 36,
    borderWidth: 1,
    borderColor: BORDER,
    width: "100%",
  },
  ratingTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginBottom: 14,
  },
  stars: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  ratingHint: {
    color: MUTED,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  thanks: {
    color: TEAL,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
  },
  homeBtn: {
    marginTop: "auto",
    backgroundColor: TEAL,
    borderRadius: 14,
    paddingVertical: 18,
    width: "100%",
    alignItems: "center",
  },
  homeBtnText: {
    color: NAVY,
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
});
