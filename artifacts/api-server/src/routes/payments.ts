import { Router, type IRouter } from "express";
import {
  getStripePublishableKey,
  getUncachableStripeClient,
} from "../lib/stripeClient";
import {
  fetchOwnPatient,
  requireSupabaseUser,
  updateOwnPatient,
} from "../middlewares/supabaseAuth";

const router: IRouter = Router();

function appendQuery(url: string, param: string): string {
  return url + (url.includes("?") ? "&" : "?") + param;
}

/**
 * Resolve the authenticated user's Stripe customer id, verifying ownership
 * via Stripe `metadata.patient_id`. Returns null if there is no valid,
 * owned customer (caller decides whether to error or return empty).
 */
async function resolveOwnedCustomer(
  userJwt: string,
  userId: string,
): Promise<string | null> {
  const patient = await fetchOwnPatient(userJwt, userId, "stripe_customer_id");
  const raw = patient?.["stripe_customer_id"];
  const id = typeof raw === "string" && raw.startsWith("cus_") ? raw : null;
  if (!id) return null;

  const stripe = await getUncachableStripeClient();
  try {
    const got = await stripe.customers.retrieve(id);
    if ((got as { deleted?: boolean }).deleted) return null;
    const meta = (got as { metadata?: Record<string, string> }).metadata;
    if (!meta || meta["patient_id"] !== userId) return null;
    return id;
  } catch {
    return null;
  }
}

/**
 * GET /api/payments/config
 * Public — returns the Stripe publishable key.
 */
router.get("/payments/config", async (_req, res) => {
  try {
    const publishableKey = await getStripePublishableKey();
    return res.json({ publishableKey });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "stripe_not_configured", detail: String(err) });
  }
});

/**
 * GET /api/payments/return
 * Public friendly page Stripe redirects to after a Checkout session.
 */
router.get("/payments/return", (req, res) => {
  const status = String(
    req.query["stripe_status"] ?? req.query["status"] ?? "success",
  );
  const ok = status === "success";
  const title = ok ? "Payment method saved" : "No changes made";
  const subtitle = ok
    ? "You can close this window and return to CareVoy."
    : "You can close this window and try again whenever you're ready.";
  const accent = ok ? "#00C2A8" : "#6B7280";
  res
    .status(200)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .send(
      `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#050D1F;margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center}
        .card{max-width:340px}
        .dot{width:64px;height:64px;border-radius:32px;background:${accent};margin:0 auto 20px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:32px;font-weight:700}
        h1{font-size:22px;margin:0 0 8px;letter-spacing:-0.3px}
        p{color:#6B7280;font-size:14px;line-height:20px;margin:0 0 24px}
        button{background:#00C2A8;color:#050D1F;border:0;border-radius:10px;padding:14px 22px;font-size:15px;font-weight:600;cursor:pointer;width:100%}
      </style></head><body><div class="card"><div class="dot">${ok ? "✓" : "—"}</div><h1>${title}</h1><p>${subtitle}</p><button onclick="window.close()">Close</button></div></body></html>`,
    );
});

// All routes below require a valid Supabase user JWT.
router.use("/payments", requireSupabaseUser);

type SetupBody = {
  email?: string;
  returnUrl?: string;
};

/**
 * POST /api/payments/setup-session
 * Body: { email?, returnUrl }
 * Identity comes from the bearer token (req.userId), NOT the body.
 * - Loads patients row via RLS using the user's own JWT.
 * - Reuses a real Stripe customer if patients.stripe_customer_id starts with "cus_".
 * - Persists the new customer id back via RLS.
 * - Creates a `mode: "setup"` Checkout Session and returns its URL.
 */
router.post("/payments/setup-session", async (req, res) => {
  try {
    const body = (req.body ?? {}) as SetupBody;
    const userId = req.userId!;
    const userJwt = req.userJwt!;
    const returnUrl = (body.returnUrl ?? "").trim();
    if (!returnUrl)
      return res.status(400).json({ error: "return_url_required" });

    const patient = await fetchOwnPatient(
      userJwt,
      userId,
      "email,first_name,last_name,stripe_customer_id",
    );
    if (!patient) {
      return res.status(404).json({ error: "patient_not_found" });
    }

    const email =
      (body.email && body.email.trim()) ||
      (typeof patient["email"] === "string"
        ? (patient["email"] as string).trim()
        : "") ||
      req.userEmail ||
      "";
    if (!email) {
      return res
        .status(400)
        .json({ error: "email_required", detail: "Add a receipt email first." });
    }

    const fullName = [patient["first_name"], patient["last_name"]]
      .filter((v): v is string => typeof v === "string" && v.length > 0)
      .join(" ")
      .trim();

    const stripe = await getUncachableStripeClient();
    const existingId =
      typeof patient["stripe_customer_id"] === "string" &&
      (patient["stripe_customer_id"] as string).startsWith("cus_")
        ? (patient["stripe_customer_id"] as string)
        : null;

    // Reuse the existing customer ONLY if Stripe's own metadata says it
    // belongs to this user. Anything else (deleted, no metadata, or pointing
    // at a different patient_id) is treated as not-owned and a fresh customer
    // is created — this closes the "attacker writes a foreign cus_… into
    // patients.stripe_customer_id" attack vector.
    let customerId: string | null = existingId;
    if (customerId) {
      try {
        const got = await stripe.customers.retrieve(customerId);
        if ((got as { deleted?: boolean }).deleted) {
          customerId = null;
        } else {
          const meta = (got as { metadata?: Record<string, string> }).metadata;
          if (!meta || meta["patient_id"] !== userId) {
            customerId = null;
          }
        }
      } catch {
        customerId = null;
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: fullName || undefined,
        metadata: { patient_id: userId },
      });
      customerId = customer.id;
      // Persist back to patients via RLS using the user's own JWT.
      await updateOwnPatient(userJwt, userId, {
        stripe_customer_id: customerId,
      });
    } else {
      await stripe.customers.update(customerId, {
        email,
        ...(fullName ? { name: fullName } : {}),
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      payment_method_types: ["card"],
      success_url: appendQuery(returnUrl, "stripe_status=success"),
      cancel_url: appendQuery(returnUrl, "stripe_status=cancel"),
    });

    if (!session.url) {
      return res.status(500).json({ error: "no_session_url" });
    }

    return res.json({ url: session.url, customerId });
  } catch (err) {
    req.log.error({ err: String(err) }, "setup-session failed");
    return res.status(500).json({ error: "setup_session_failed" });
  }
});

/**
 * GET /api/payments/methods
 * Returns the authenticated user's saved card payment methods.
 * The Stripe customer is resolved server-side from patients.stripe_customer_id.
 */
router.get("/payments/methods", async (req, res) => {
  try {
    const userId = req.userId!;
    const userJwt = req.userJwt!;
    const cust = await resolveOwnedCustomer(userJwt, userId);
    if (!cust) return res.json({ methods: [] });

    const stripe = await getUncachableStripeClient();
    const list = await stripe.paymentMethods.list({
      customer: cust,
      type: "card",
      limit: 10,
    });

    const methods = list.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand ?? "card",
      last4: pm.card?.last4 ?? "••••",
      expMonth: pm.card?.exp_month ?? null,
      expYear: pm.card?.exp_year ?? null,
    }));

    return res.json({ methods });
  } catch (err) {
    req.log.warn({ err: String(err) }, "list payment methods failed");
    return res.json({ methods: [] });
  }
});

/**
 * DELETE /api/payments/methods/:id
 * Detaches a payment method, but ONLY if it belongs to the authenticated
 * user's Stripe customer.
 */
router.delete("/payments/methods/:id", async (req, res) => {
  const id = String(req.params["id"] ?? "").trim();
  if (!id) return res.status(400).json({ error: "id_required" });
  try {
    const userId = req.userId!;
    const userJwt = req.userJwt!;
    const cust = await resolveOwnedCustomer(userJwt, userId);
    if (!cust) return res.status(403).json({ error: "no_customer" });

    const stripe = await getUncachableStripeClient();
    const pm = await stripe.paymentMethods.retrieve(id);
    if (pm.customer !== cust) {
      return res.status(403).json({ error: "not_owner" });
    }

    await stripe.paymentMethods.detach(id);
    return res.json({ ok: true });
  } catch (err) {
    req.log.warn({ err: String(err) }, "detach failed");
    return res.status(500).json({ error: "detach_failed" });
  }
});

export default router;
