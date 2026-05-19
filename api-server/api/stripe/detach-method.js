const Stripe = require("stripe");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { paymentMethodId } = req.body;
    if (!paymentMethodId) return res.status(400).json({ error: "paymentMethodId required" });

    await stripe.paymentMethods.detach(paymentMethodId);
    res.status(200).json({ success: true });
  } catch (e) {
    console.error("detach-method error:", e);
    res.status(500).json({ error: e.message });
  }
};
