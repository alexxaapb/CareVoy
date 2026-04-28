import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { supabase } from "../lib/supabase";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

type Role = "patient" | "nemt" | "coordinator" | "admin" | "unknown";

type AuthState = {
  userId: string | null;
  role: Role;
  onboarded: boolean | null;
};

type AuthContextValue = {
  refresh: () => Promise<void>;
};

const AuthRefreshContext = createContext<AuthContextValue>({
  refresh: async () => {},
});

export function useAuthRefresh() {
  return useContext(AuthRefreshContext);
}

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const [auth, setAuth] = useState<AuthState>({
    userId: null,
    role: "unknown",
    onboarded: null,
  });
  const [ready, setReady] = useState(false);

  const refreshFromUser = useCallback(async (userId: string | null) => {
    if (!userId) {
      setAuth({ userId: null, role: "unknown", onboarded: null });
      return;
    }
    const [patientRes, staffRes, coordRes] = await Promise.all([
      supabase
        .from("patients")
        .select("onboarding_complete")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("staff").select("role").eq("id", userId).maybeSingle(),
      supabase
        .from("hospital_coordinators")
        .select("id")
        .eq("id", userId)
        .maybeSingle(),
    ]);
    if (patientRes.data) {
      setAuth({
        userId,
        role: "patient",
        onboarded: !!patientRes.data.onboarding_complete,
      });
    } else if (staffRes.data?.role) {
      setAuth({
        userId,
        role: staffRes.data.role as Role,
        onboarded: true,
      });
    } else if (coordRes.data) {
      setAuth({ userId, role: "coordinator", onboarded: true });
    } else {
      setAuth({ userId, role: "patient", onboarded: false });
    }
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await refreshFromUser(data.session?.user.id ?? null);
  }, [refreshFromUser]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      await refreshFromUser(data.session?.user.id ?? null);
      setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, s) => {
      await refreshFromUser(s?.user.id ?? null);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [refreshFromUser]);

  useEffect(() => {
    if (!ready) return;
    const top = segments[0];
    const inLogin = top === "login";
    const inPartners = top === "partners";
    const inOnboarding = top === "onboarding";
    const inDriver = top === "driver";
    const inComingSoon = top === "coming-soon";
    const inTabs = top === "(tabs)";

    if (!auth.userId) {
      // /partners is the public web sign-in for staff — let it render
      if (!inLogin && !inPartners) router.replace("/login");
      return;
    }
    if (auth.role === "nemt") {
      if (!inDriver) router.replace("/driver");
      return;
    }
    if (auth.role === "coordinator") {
      if (top !== "coordinator") router.replace("/coordinator");
      return;
    }
    if (auth.role === "admin") {
      if (top !== "admin") router.replace("/admin");
      return;
    }
    // patient flow
    if (auth.onboarded === false) {
      if (!inOnboarding) router.replace("/onboarding");
      return;
    }
    if (
      auth.onboarded === true &&
      (inLogin ||
        inPartners ||
        inOnboarding ||
        inDriver ||
        inComingSoon ||
        top === "coordinator" ||
        top === "admin")
    ) {
      router.replace("/(tabs)");
    }
    void inTabs;
  }, [ready, auth, segments, router]);

  return (
    <AuthRefreshContext.Provider value={{ refresh }}>
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="partners" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="book-ride" options={{ headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen name="driver" options={{ headerShown: false }} />
        <Stack.Screen name="coordinator" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="coming-soon" options={{ headerShown: false }} />
      </Stack>
    </AuthRefreshContext.Provider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <RootLayoutNav />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
