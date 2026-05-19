const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { rideId, patientId } = req.body;

    const { data: ride } = await supabase
      .from("rides")
      .select("*, patients(full_name, email)")
      .eq("id", rideId)
      .single();

    if (!ride) return res.status(404).json({ error: "Ride not found" });

    const receipt = {
      receipt_number: `CVR-${Date.now()}`,
      date: new Date().toISOString(),
      patient_name: ride.patients?.full_name,
      patient_id: patientId,
      ride_id: rideId,
      pickup: ride.pickup_address,
      destination: ride.destination_address,
      amount: ride.fare_amount,
      irs_code: "213(d)",
      expense_type: "Medical Transportation",
      provider: "CareVoy / APB Ventures LLC",
      status: "paid",
    };

    await supabase.from("receipts").insert({
      ...receipt,
      patient_id: patientId,
    });

    res.status(200).json({ receipt });
  } catch (e) {
    console.error("receipt error:", e);
    res.status(500).json({ error: e.message });
  }
};
