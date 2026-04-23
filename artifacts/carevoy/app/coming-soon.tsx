import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../lib/supabase";

const NAVY = "#050D1F";
const TEAL = "#00C2A8";
const WHITE = "#FFFFFF";
const MUTED = "#8A93A6";

export default function ComingSoonScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.icon}>
          <Feather name="clock" size={36} color={TEAL} />
        </View>
        <Text style={styles.title}>Coming soon</Text>
        <Text style={styles.subtitle}>
          The Care Coordinator portal is under construction. Check back soon.
        </Text>
        <Pressable
          onPress={async () => {
            await supabase.auth.signOut();
            router.replace("/login");
          }}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.btnText}>Sign Out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0,194,168,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    color: WHITE,
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  subtitle: {
    color: MUTED,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  btn: {
    borderWidth: 1.5,
    borderColor: TEAL,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  btnText: {
    color: TEAL,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
