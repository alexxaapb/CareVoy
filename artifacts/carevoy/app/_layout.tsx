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
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { supabase } from "../lib/supabase";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

type AuthState = {
  userId: string | null;
  onboarded: boolean | null;
};

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const [auth, setAuth] = useState<AuthState>({
    userId: null,
    onboarded: null,
  });
  const [ready, setReady] = useState(false);

  const refreshFromUser = async (userId: string | null) => {
    if (!userId) {
      setAuth({ userId: null, onboarded: null });
      return;
    }
    const { data, error } = await supabase
      .from("patients")
      .select("onboarding_complete")
      .eq("id", userId)
      .maybeSingle();
    const onboarded = !error && !!data?.onboarding_complete;
    setAuth({ userId, onboarded });
  };

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
  }, []);

  useEffect(() => {
    if (!ready) return;
    const top = segments[0];
    const inLogin = top === "login";
    const inOnboarding = top === "onboarding";

    if (!auth.userId) {
      if (!inLogin) router.replace("/login");
      return;
    }
    if (auth.onboarded === false) {
      if (!inOnboarding) router.replace("/onboarding");
      return;
    }
    if (auth.onboarded === true && (inLogin || inOnboarding)) {
      router.replace("/(tabs)");
    }
  }, [ready, auth, segments, router]);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
    </Stack>
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
