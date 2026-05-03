import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// IMPORTANT: createClient throws "supabaseUrl is required" synchronously on
// empty/invalid input. If we let that throw at import time, the entire app
// fails to load (splash → close on iOS native). Use a placeholder URL so the
// module loads; any actual auth call will fail gracefully at runtime instead.
const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder-anon-key";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase credentials missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment or eas.json.",
  );
}

export const supabase = createClient(
  supabaseUrl || PLACEHOLDER_URL,
  supabaseAnonKey || PLACEHOLDER_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUse: false,
    },
  },
);
