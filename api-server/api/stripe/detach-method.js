const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "DELETE, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "DELETE" && req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

    const paymentMethodId =
      (req.query && req.query.id) || (req.body && req.body.paymentMethodId);
    if (!paymentMethodId)
      return res.status(400).json({ error: "paymentMethodId required" });

    const { data: patient } = await supabase
      .from("patients")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (!patient || !patient.stripe_customer_id || pm.customer !== patient.stripe_customer_id) {
      return res.status(403).json({ error: "Not your payment method" });
    }

    await stripe.paymentMethods.detach(paymentMethodId);
    res.status(200).json({ success: true });
  } catch (e) {
    console.error("detach-method error:", e);
    res.status(500).json({ error: e.message });
  }
};
