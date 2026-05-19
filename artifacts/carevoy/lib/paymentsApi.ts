import { Platform } from "react-native";
import { supabase } from "./supabase";

export type SavedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
};

const API_BASE = "https://care-voy-api-server.vercel.app";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function createSetupSession(input: {
  email?: string;
  returnUrl: string;
}): Promise<{ url: string; customerId: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const patientId = userData.user?.id;
  const headers = await authHeader();
  const res = await fetch(`${API_BASE}/api/stripe/setup-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ ...input, patientId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Could not start payment setup");
  }
  return res.json();
}

export async function listPaymentMethods(): Promise<SavedPaymentMethod[]> {
  const headers = await authHeader();
  const res = await fetch(`${API_BASE}/api/stripe/list-methods`, {
    method: "GET",
    headers,
  });
  if (!res.ok) return [];
  return res.json();
}

export async function detachPaymentMethod(id: string): Promise<boolean> {
  const headers = await authHeader();
  const res = await fetch(`${API_BASE}/api/stripe/detach-method`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ paymentMethodId: id }),
  });
  return res.ok;
}

export function getReturnUrl(): string {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.search = "";
      u.hash = "";
      return u.toString();
    }
  }
  return `${API_BASE}/api/payments/return`;
}
