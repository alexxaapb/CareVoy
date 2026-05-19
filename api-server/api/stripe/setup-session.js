const Stripe = require("stripe");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { email, returnUrl, patientId } = req.body;

    let customer;
    // Look up existing customer by patientId metadata
    const existing = await stripe.customers.search({
      query: `metadata['patientId']:'${patientId}'`,
      limit: 1,
    });

    if (existing.data.length > 0) {
      customer = existing.data[0];
    } else {
      customer = await stripe.customers.create({
        email,
        metadata: { patientId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customer.id,
      payment_method_types: ["card"],
      success_url: `${returnUrl}?stripe_status=success`,
      cancel_url: `${returnUrl}?stripe_status=cancel`,
    });

    res.status(200).json({ url: session.url, customerId: customer.id });
  } catch (e) {
    console.error("setup-session error:", e);
    res.status(500).json({ error: e.message });
  }
};
