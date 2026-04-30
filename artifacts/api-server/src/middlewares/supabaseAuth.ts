// Supabase JWT verification middleware.
//
// Validates `Authorization: Bearer <jwt>` against Supabase's GoTrue
// /auth/v1/user endpoint. Sets `req.userId` and `req.userJwt` on success.
//
// We deliberately use Supabase's own endpoint instead of decoding the JWT
// locally — that way Supabase enforces session expiry / revocation server-side,
// and we don't need to ship a service-role key.
import type { NextFunction, Request, RequestHandler, Response } from "express";

declare module "http" {
  interface IncomingMessage {
    userId?: string;
    userJwt?: string;
    userEmail?: string | null;
  }
}

const SUPABASE_URL =
  process.env["SUPABASE_URL"] ?? process.env["EXPO_PUBLIC_SUPABASE_URL"];
const SUPABASE_ANON_KEY =
  process.env["SUPABASE_ANON_KEY"] ??
  process.env["EXPO_PUBLIC_SUPABASE_ANON_KEY"];

export function getSupabaseConfig(): {
  url: string;
  anonKey: string;
} {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Supabase env not configured (need SUPABASE_URL/EXPO_PUBLIC_SUPABASE_URL + ANON_KEY)",
    );
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}

export const requireSupabaseUser: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const auth = req.headers["authorization"];
    const header = Array.isArray(auth) ? auth[0] : auth;
    if (!header || !header.toLowerCase().startsWith("bearer ")) {
      res.status(401).json({ error: "missing_bearer_token" });
      return;
    }
    const token = header.slice(7).trim();
    if (!token) {
      res.status(401).json({ error: "missing_bearer_token" });
      return;
    }

    const { url, anonKey } = getSupabaseConfig();
    const r = await fetch(`${url}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
    });
    if (!r.ok) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }
    const user = (await r.json()) as { id?: string; email?: string };
    if (!user?.id) {
      res.status(401).json({ error: "invalid_token" });
      return;
    }
    req.userId = user.id;
    req.userJwt = token;
    req.userEmail = user.email ?? null;
    next();
  } catch (err) {
    req.log?.error({ err: String(err) }, "supabase auth failed");
    res.status(401).json({ error: "auth_failed" });
  }
};

/**
 * Fetch one column-set from `patients` for the authenticated user, using
 * their own JWT so RLS applies (no service-role needed).
 */
export async function fetchOwnPatient(
  userJwt: string,
  userId: string,
  cols: string,
): Promise<Record<string, unknown> | null> {
  const { url, anonKey } = getSupabaseConfig();
  const r = await fetch(
    `${url}/rest/v1/patients?id=eq.${encodeURIComponent(userId)}&select=${encodeURIComponent(cols)}&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${userJwt}`,
        apikey: anonKey,
        Accept: "application/json",
      },
    },
  );
  if (!r.ok) return null;
  const rows = (await r.json()) as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

/**
 * Update the authenticated user's `patients` row via Supabase REST + RLS.
 * Returns true on 204.
 */
export async function updateOwnPatient(
  userJwt: string,
  userId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const { url, anonKey } = getSupabaseConfig();
  const r = await fetch(
    `${url}/rest/v1/patients?id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${userJwt}`,
        apikey: anonKey,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
    },
  );
  return r.ok;
}
