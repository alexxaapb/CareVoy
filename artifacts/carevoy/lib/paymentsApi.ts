// Thin client for the Stripe-backed /api/payments routes on the api-server.
// All authenticated routes require the user's Supabase JWT in the Authorization
// header — the server never trusts client-supplied identity.
import { Platform } from "react-native";

import { supabase } from "./supabase";

export type SavedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
};

function url(path: string): string {
  const api = process.env["EXPO_PUBLIC_API_URL"];
  if (api) return `${api}${path}`;
  return path;
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function createSetupSession(input: {
  email?: string;
}): Promise<{ clientSecret: string; customerId: string }> {
  const headers = {
    "Content-Type": "application/json",
    ...(await authHeader()),
  };
  const res = await fetch(url("/api/stripe/setup-session"), {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`setup-session failed: ${res.status} ${text}`);
  }
  return (await res.json()) as { clientSecret: string; customerId: string };
}

export async function listPaymentMethods(): Promise<SavedPaymentMethod[]> {
  const headers = await authHeader();
  if (!headers.Authorization) return [];
  const res = await fetch(url("/api/stripe/list-methods"), { headers });
  if (!res.ok) return [];
  const data = (await res.json()) as { methods?: SavedPaymentMethod[] };
  return data.methods ?? [];
}

export async function detachPaymentMethod(id: string): Promise<boolean> {
  const headers = await authHeader();
  if (!headers.Authorization) return false;
  const res = await fetch(url(`/api/stripe/detach-method?id=${id}`), {
    method: "DELETE",
    headers,
  });
  return res.ok;
}

/**
 * Build the URL Stripe redirects to after Checkout completes.
 * - Web: send the user back to the in-app payment screen so they keep their
 *   session, with a `?stripe_status=success|cancel` flag we can read.
 * - Native: route to the api-server's static "return" page; the user dismisses
 *   the in-app browser sheet and we refresh on focus.
 */
export function getReturnUrl(): string {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.search = "";
      u.hash = "";
      return u.toString();
    }
  }
  const dom = process.env["EXPO_PUBLIC_DOMAIN"];
  const base = dom ? `https://${dom}` : "";
  return base || "https://carevoy.co";
}
