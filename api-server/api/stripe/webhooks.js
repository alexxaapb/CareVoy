const Stripe = require("stripe");
const ws = require('ws');
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  , { realtime: { transport: ws } });

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (e) {
    console.error("Webhook signature failed:", e.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const { rideId, patientId } = intent.metadata;
    await supabase.from("payments").update({ status: "paid" }).eq("ride_id", rideId);
    await supabase.from("rides").update({ payment_status: "paid" }).eq("id", rideId);
    console.log(`Payment succeeded for ride ${rideId}`);
  }

  if (event.type === "setup_intent.succeeded") {
    const setup = event.data.object;
    const customerId = setup.customer;
    // Update patient stripe_customer_id in Supabase
    const customers = await stripe.customers.retrieve(customerId);
    const patientId = customers.metadata?.patientId;
    if (patientId) {
      await supabase
        .from("patients")
        .update({ stripe_customer_id: customerId })
        .eq("id", patientId);
    }
  }

  // --- Facility add-ons and plan status (only acts on subscriptions tagged by CareVoy) ---
  if (event.type === "checkout.session.completed" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted") {
    try {
      const obj = event.data.object;
      const meta = obj.metadata || {};
      const hid = meta.hospital_id;
      if (hid && meta.kind === "plan" && meta.tier) {
        // A facility paid for its plan (or its plan subscription changed).
        const { PLANS } = require("../../lib/plans");
        const plan = PLANS[meta.tier];
        const paid = event.type === "checkout.session.completed" ||
          (event.type === "customer.subscription.updated" && ["active", "trialing", "past_due"].includes(obj.status));
        const ended = event.type === "customer.subscription.deleted" ||
          (event.type === "customer.subscription.updated" && ["canceled", "unpaid", "incomplete_expired"].includes(obj.status));
        const now = new Date().toISOString();
        if (paid && plan) {
          await supabase.from("hospitals").update({ active: true, pending_review: false, tier: meta.tier }).eq("id", hid);
          const patch = { subscription_status: event.type === "checkout.session.completed" ? "active" : obj.status,
            plan: meta.tier, ride_limit: plan.rides, monthly_price_cents: plan.cents, updated_at: now };
          if (event.type === "checkout.session.completed") patch.contract_start = now.slice(0, 10);
          if (obj.current_period_end) patch.current_period_end = new Date(obj.current_period_end * 1000).toISOString();
          await supabase.from("facility_billing").update(patch).eq("hospital_id", hid);
          if (event.type === "checkout.session.completed" && process.env.RESEND_API_KEY) {
            const { data: h } = await supabase.from("hospitals").select("name").eq("id", hid).maybeSingle();
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({ from: "CareVoy <partners@carevoy.co>", to: ["partners@carevoy.co"],
                subject: "New paying facility: " + ((h && h.name) || hid) + " (" + plan.label + ")",
                text: ((h && h.name) || hid) + " started the " + plan.label + " plan." }),
            }).catch(() => {});
          }
        } else if (ended) {
          await supabase.from("hospitals").update({ active: false }).eq("id", hid);
          await supabase.from("facility_billing").update({ subscription_status: obj.status || "canceled", updated_at: now }).eq("hospital_id", hid);
        }
      } else if (hid && meta.kind === "addon" && meta.addon) {
        const { data: row } = await supabase.from("facility_billing")
          .select("addons").eq("hospital_id", hid).maybeSingle();
        if (row) {
          let addons = (row.addons || []).filter((a) => a !== meta.addon);
          const on =
            event.type === "checkout.session.completed" ||
            (event.type === "customer.subscription.updated" && ["active", "trialing", "past_due"].includes(obj.status));
          if (on) addons.push(meta.addon);
          await supabase.from("facility_billing")
            .update({ addons, updated_at: new Date().toISOString() }).eq("hospital_id", hid);
        }
      } else if (event.type !== "checkout.session.completed" && obj.customer) {
        // Main plan subscription: keep status and renewal date current.
        const patch = { subscription_status: obj.status, updated_at: new Date().toISOString() };
        if (obj.current_period_end) patch.current_period_end = new Date(obj.current_period_end * 1000).toISOString();
        await supabase.from("facility_billing").update(patch).eq("stripe_customer_id", obj.customer);
      }
    } catch (e) {
      console.error("Webhook billing update failed:", e.message);
    }
  }

  res.status(200).json({ received: true });
};
