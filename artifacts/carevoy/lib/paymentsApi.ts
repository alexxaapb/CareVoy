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
  const dom = process.env["EXPO_PUBLIC_DOMAIN"];
  if (dom) return `https://${dom}${path}`;
  return path;
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function createSetupSession(input: {
  email?: string;
  returnUrl: string;
}): Promise<{ url: string; customerId: string }> {
  // Temporarily disabled - will be enabled in v1.0.1
  throw new Error("Payment features coming soon");
}

export async function listPaymentMethods(): Promise<SavedPaymentMethod[]> {
  // Temporarily disabled - will be enabled in v1.0.1
  return [];
}

export async function detachPaymentMethod(id: string): Promise<boolean> {
  // Temporarily disabled - will be enabled in v1.0.1
  return false;
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
  return `${base}/api/payments/return`;
}
