const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

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

  res.status(200).json({ received: true });
};
