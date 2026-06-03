const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
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

    const { email } = req.body || {};

    const { data: patient } = await supabase
      .from("patients")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    let customerId = patient?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || user.email,
        metadata: { patientId: user.id },
      });
      customerId = customer.id;
      await supabase
        .from("patients")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card", "link"],
      usage: "off_session",
    });

    res.status(200).json({ clientSecret: setupIntent.client_secret, customerId });
  } catch (e) {
    console.error("setup-session error:", e);
    res.status(500).json({ error: e.message });
  }
};
