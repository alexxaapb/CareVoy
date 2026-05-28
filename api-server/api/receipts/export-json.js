const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { rideId } = req.query;
    if (!rideId) return res.status(400).json({ error: "rideId required" });

    const { data: ride } = await supabase
      .from("rides")
      .select("*, patients(full_name, email, phone), hospitals(name, address, city, state)")
      .eq("id", rideId)
      .single();

    if (!ride) return res.status(404).json({ error: "Ride not found" });

    const { data: receipt } = await supabase
      .from("receipts")
      .select("*")
      .eq("ride_id", rideId)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    const facilityAddressParts = [
      ride.hospitals?.address,
      ride.hospitals?.city,
      ride.hospitals?.state,
    ].filter(Boolean);

    const export_ = {
      schema_version: "1.0",
      receipt_number: receipt?.receipt_number ?? null,
      issued_at: receipt?.date ?? new Date().toISOString(),
      patient: {
        id: ride.patient_id,
        name: ride.patients?.full_name ?? null,
        email: ride.patients?.email ?? null,
        phone: ride.patients?.phone ?? null,
      },
      ride: {
        id: ride.id,
        ride_type: ride.ride_type,
        procedure_type: ride.procedure_type ?? null,
        status: ride.status,
        pickup_address: ride.pickup_address,
        dropoff_address: ride.dropoff_address,
        pickup_time: ride.pickup_time ?? null,
        dropoff_timestamp: ride.dropoff_timestamp ?? null,
        surgery_date: ride.surgery_date ?? null,
        mobility_needs: ride.mobility_needs ?? null,
        companion_requested: ride.companion_requested ?? false,
        lmn_notes: ride.lmn_notes ?? null,
      },
      facility: {
        id: ride.hospital_id ?? null,
        name: ride.hospitals?.name ?? null,
        address: facilityAddressParts.length ? facilityAddressParts.join(", ") : null,
      },
      cost: {
        base_fare: Math.min(ride.actual_cost ?? ride.estimated_cost ?? 0, 45),
        service_fee: Math.max(0, (ride.actual_cost ?? ride.estimated_cost ?? 0) - 45),
        total: ride.actual_cost ?? ride.estimated_cost ?? 0,
        currency: "USD",
      },
      hsa_fsa: {
        eligible: true,
        irs_code: "213(d)",
        expense_type: "Medical Transportation",
        eligibility_note: "Transportation to and from medical care qualifies under IRS Code 213(d).",
      },
      audit_trail: {
        booking_timestamp: ride.created_at,
        payment_timestamp: ride.payment_timestamp ?? null,
        provider: "CareVoy / APB Ventures LLC",
        provider_ein: null,
      },
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="carevoy-receipt-${export_.receipt_number ?? rideId}.json"`);
    res.status(200).json(export_);
  } catch (e) {
    console.error("export-json error:", e);
    res.status(500).json({ error: e.message });
  }
};
