const Stripe = require("stripe");
const { isInternal, getCaller } = require('../../lib/security');

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Nothing in the apps calls this directly (charges happen in rides/update-status).
    // Only server-to-server calls or an admin may use it.
    if (!isInternal(req)) {
      const caller = await getCaller(req);
      if (!caller) return res.status(401).json({ error: "Unauthorized" });
      if (!caller.isAdmin) return res.status(403).json({ error: "Forbidden" });
    }
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { amount, customerId, paymentMethodId, rideId, patientId } = req.body;

    const intent = await stripe.paymentIntents.create({
      amount, // in cents
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      metadata: { rideId, patientId },
      description: "CareVoy medical transportation — IRS Code 213(d)",
    });

    res.status(200).json({ clientSecret: intent.client_secret, status: intent.status });
  } catch (e) {
    console.error("payment-intent error:", e);
    if (e.code === 'authentication_required' || e.type === 'StripeCardError') {
      return res.status(402).json({ error: 'Card declined or requires authentication: ' + e.message, requiresAction: true });
    }
    res.status(500).json({ error: e.message });
  }
};
