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
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { CareProvider } from "../lib/careContext";
import { isDemoMode } from "../lib/demoMode";
import { supabase } from "../lib/supabase";

// Capture any module-evaluation errors that happen before React mounts so we
// can show them on screen instead of silently crashing to the home screen.
const moduleLoadErrors: string[] = [];

try {
  SplashScreen.preventAutoHideAsync();
} catch (e) {
  moduleLoadErrors.push(
    `SplashScreen.preventAutoHideAsync threw: ${(e as Error)?.message ?? String(e)}`,
  );
}

let queryClient: QueryClient;
try {
  queryClient = new QueryClient();
} catch (e) {
  moduleLoadErrors.push(
    `new QueryClient() threw: ${(e as Error)?.message ?? String(e)}`,
  );
  // Fallback so render doesn't crash on undefined.
  queryClient = {} as QueryClient;
}

// Visible error screen — always renders the actual error message + stack on
// device, regardless of __DEV__. Use this instead of the dev-only fallback so
// TestFlight builds also surface crashes.
function VisibleErrorScreen({
  error,
  extra,
}: {
  error: Error | null;
  extra?: string[];
}) {
  return (
    <SafeAreaView style={errStyles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={errStyles.container}>
        <Text style={errStyles.title}>CareVoy crashed on launch</Text>
        <Text style={errStyles.label}>Message</Text>
        <Text selectable style={errStyles.body}>
          {error?.message ?? "(no message)"}
        </Text>
        {error?.stack ? (
          <>
            <Text style={errStyles.label}>Stack</Text>
            <Text selectable style={errStyles.mono}>
              {error.stack}
            </Text>
          </>
        ) : null}
        {extra && extra.length > 0 ? (
          <>
            <Text style={errStyles.label}>Module-load errors</Text>
            {extra.map((e, i) => (
              <Text key={i} selectable style={errStyles.mono}>
                {e}
              </Text>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const errStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { padding: 20, paddingBottom: 60 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#B91C1C",
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginTop: 16,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  body: { fontSize: 15, color: "#050D1F", lineHeight: 22 },
  mono: {
    fontSize: 11,
    color: "#1F2937",
    fontFamily: "Menlo",
    lineHeight: 16,
  },
});

class LaunchErrorBoundary extends Component<
  { children: React.ReactNode; extra?: string[] },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[LaunchErrorBoundary]", error, info?.componentStack);
  }
  render() {
    if (this.state.error || (this.props.extra && this.props.extra.length > 0)) {
      return (
        <SafeAreaProvider>
          <VisibleErrorScreen
            error={this.state.error}
            extra={this.props.extra}
          />
        </SafeAreaProvider>
      );
    }
    return this.props.children;
  }
}

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
    // Demo mode (pitch-deck screenshots): skip Supabase auth entirely and
    // pretend the demo patient is signed in & onboarded. No subscription.
    if (isDemoMode()) {
      setAuth({ userId: "demo-jane", role: "patient", onboarded: true });
      setReady(true);
      return;
    }
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
    // Demo mode: never redirect — the URL is the source of truth so the
    // screenshot tool can capture any screen directly.
    if (isDemoMode()) return;
    const top = segments[0];
    const inLogin = top === "login";
    const inPartners = top === "partners";
    const inOnboarding = top === "onboarding";
    const inDriver = top === "driver";
    const inComingSoon = top === "coming-soon";
    const inTabs = top === "(tabs)";

    if (!auth.userId) {
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
    if (auth.onboarded === false) {
      const allowDuringOnboarding = inOnboarding || top === "care";
      if (!allowDuringOnboarding) router.replace("/onboarding");
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
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="book-ride" options={{ headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen name="driver" options={{ headerShown: false }} />
        <Stack.Screen name="coordinator" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="coming-soon" options={{ headerShown: false }} />
        <Stack.Screen name="care/add" options={{ headerShown: false }} />
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
  const demo = isDemoMode();
  useEffect(() => {
    if (fontsLoaded || fontError || demo) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, demo]);

  // Demo mode renders immediately so the screenshot tool catches painted UI.
  if (!demo && !fontsLoaded && !fontError) return null;

  // If anything failed during module evaluation, show the visible error screen
  // immediately instead of attempting to render the app.
  if (moduleLoadErrors.length > 0) {
    return (
      <SafeAreaProvider>
        <VisibleErrorScreen error={null} extra={moduleLoadErrors} />
      </SafeAreaProvider>
    );
  }

  try {
    return (
      <LaunchErrorBoundary extra={moduleLoadErrors}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <CareProvider>
                <RootLayoutNav />
              </CareProvider>
            </GestureHandlerRootView>
          </QueryClientProvider>
        </SafeAreaProvider>
      </LaunchErrorBoundary>
    );
  } catch (e) {
    return (
      <SafeAreaProvider>
        <VisibleErrorScreen
          error={e instanceof Error ? e : new Error(String(e))}
          extra={moduleLoadErrors}
        />
      </SafeAreaProvider>
    );
  }
}

// Suppress unused-export warning for the legacy ErrorBoundary if anything
// referenced it — we now use LaunchErrorBoundary inline above.
void View;
