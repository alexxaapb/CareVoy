const Stripe = require("stripe");
const ws = require('ws');
const { createClient } = require("@supabase/supabase-js");
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    , { realtime: { transport: ws } });
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });
    const { data: patient } = await supabase
      .from("patients")
      .select("stripe_customer_id, stripe_payment_method_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!patient || !patient.stripe_payment_method_id) {
      return res.status(200).json({ hasCard: false });
    }
    const pm = await stripe.paymentMethods.retrieve(patient.stripe_payment_method_id);
    if (pm.customer !== patient.stripe_customer_id) {
      return res.status(200).json({ hasCard: false });
    }
    res.status(200).json({
      hasCard: true,
      brand: pm.card ? pm.card.brand : null,
      last4: pm.card ? pm.card.last4 : null,
    });
  } catch (e) {
    console.error("get-card-details error:", e);
    res.status(200).json({ hasCard: false });
  }
};
