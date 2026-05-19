const Stripe = require("stripe");
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
    );

    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: "Unauthorized" });

    const { data: patient } = await supabase
      .from("patients")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!patient?.stripe_customer_id) return res.status(200).json([]);

    const methods = await stripe.paymentMethods.list({
      customer: patient.stripe_customer_id,
      type: "card",
    });

    const result = methods.data.map(m => ({
      id: m.id,
      brand: m.card?.brand ?? "card",
      last4: m.card?.last4 ?? "????",
      expMonth: m.card?.exp_month ?? null,
      expYear: m.card?.exp_year ?? null,
    }));

    res.status(200).json(result);
  } catch (e) {
    console.error("list-methods error:", e);
    res.status(500).json({ error: e.message });
  }
};
