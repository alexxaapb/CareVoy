const Stripe = require("stripe");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { amount, customerId, paymentMethodId, rideId, patientId } = req.body;

    const intent = await stripe.paymentIntents.create({
      amount, // in cents
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: { rideId, patientId },
      description: "CareVoy medical transportation — IRS Code 213(d)",
    });

    res.status(200).json({ clientSecret: intent.client_secret, status: intent.status });
  } catch (e) {
    console.error("payment-intent error:", e);
    res.status(500).json({ error: e.message });
  }
};
