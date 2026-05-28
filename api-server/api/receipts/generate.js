const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");

function classifyEligibility(procedureType, facilityType) {
  const proc = (procedureType ?? "").toLowerCase();
  const ftype = (facilityType ?? "").toLowerCase();
  const highKeywords = [
    "dialysis", "chemotherapy", "chemo", "oncology", "radiation",
    "surgery", "discharge", "cardiac", "orthopedic", "physical therapy",
    "wound care", "infusion", "transplant", "pre_op", "post_op",
    "hospital", "urgent", "emergency", "inpatient", "outpatient procedure",
  ];
  if (ftype === "dialysis") return "high_likelihood";
  if (highKeywords.some((k) => proc.includes(k) || ftype.includes(k))) return "high_likelihood";
  if (ftype === "assisted_living") return "conditional";
  if (ftype === "other") return "conditional";
  return "high_likelihood";
}

function eligibilityLabel(tag) {
  if (tag === "high_likelihood") return "High Likelihood Eligible";
  if (tag === "conditional") return "Conditionally Eligible";
  return "Non-Medical";
}

function rideTypeLabel(t) {
  if (t === "pre_op") return "Pre-operative transport";
  if (t === "post_op") return "Post-operative transport";
  if (t === "dialysis") return "Dialysis transport";
  return t ? t.replace(/_/g, " ") : "Medical transport";
}

function fmtTimestamp(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

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
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { rideId, patientId } = req.body;

    const { data: ride } = await supabase
      .from("rides")
      .select("*, patients(full_name, email), hospitals(name, address, city, state)")
      .eq("id", rideId)
      .single();

    if (!ride) return res.status(404).json({ error: "Ride not found" });

    const receiptNumber = `CVR-${Date.now()}`;
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    const totalAmount = ride.actual_cost ?? ride.estimated_cost ?? 0;
    const baseFare = Math.min(totalAmount, 45);
    const serviceFee = Math.max(0, totalAmount - baseFare);
    const patientName = ride.patients?.full_name ?? "Patient";
    const patientEmail = ride.patients?.email;

    const facilityName = ride.hospitals?.name ?? null;
    const facilityAddressParts = [
      ride.hospitals?.address,
      ride.hospitals?.city,
      ride.hospitals?.state,
    ].filter(Boolean);
    const facilityAddress = facilityAddressParts.length ? facilityAddressParts.join(", ") : null;

    const eligibilityTag = classifyEligibility(ride.procedure_type, ride.facility_type);

    const receipt = {
      receipt_number: receiptNumber,
      date: new Date().toISOString(),
      patient_name: patientName,
      patient_id: patientId,
      ride_id: rideId,
      pickup: ride.pickup_address,
      destination: ride.dropoff_address,
      facility_name: facilityName,
      facility_address: facilityAddress,
      pickup_timestamp: ride.pickup_time,
      dropoff_timestamp: ride.dropoff_timestamp ?? null,
      procedure_type: ride.procedure_type,
      ride_type: ride.ride_type,
      base_fare: baseFare,
      service_fee: serviceFee,
      amount: totalAmount,
      eligibility_tag: eligibilityTag,
      lmn_notes: ride.lmn_notes ?? null,
      irs_code: "213(d)",
      expense_type: "Medical Transportation",
      provider: "CareVoy / APB Ventures LLC",
      status: "paid",
      booking_timestamp: ride.created_at,
      payment_timestamp: ride.payment_timestamp ?? null,
    };

    const { data: insertedReceipt } = await supabase.from("receipts").insert({
      receipt_number: receiptNumber,
      date: receipt.date,
      patient_name: patientName,
      patient_id: patientId,
      ride_id: rideId,
      pickup: ride.pickup_address,
      destination: ride.dropoff_address,
      amount: totalAmount,
      irs_code: "213(d)",
      expense_type: "Medical Transportation",
      provider: "CareVoy / APB Ventures LLC",
      status: "paid",
    }).select().single();

    const eligLabel = eligibilityLabel(eligibilityTag);
    const eligColor = eligibilityTag === "high_likelihood" ? "#00C2A8" : eligibilityTag === "conditional" ? "#F5A623" : "#6B7280";

    if (patientEmail) {
      await resend.emails.send({
        from: "CareVoy Receipts <receipts@carevoy.co>",
        to: patientEmail,
        subject: `Your CareVoy Receipt — ${receiptNumber}`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;">

        <!-- Header -->
        <tr>
          <td style="background:#050D1F;padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="display:inline-block;background:#00C2A8;border-radius:10px;padding:8px 14px;">
                    <span style="color:#050D1F;font-size:20px;font-weight:800;letter-spacing:-0.5px;">C</span>
                  </div>
                  <span style="color:#FFFFFF;font-size:22px;font-weight:700;margin-left:12px;vertical-align:middle;">CareVoy</span>
                </td>
                <td align="right">
                  <span style="color:#00C2A8;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Ride Receipt</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Receipt number + date -->
        <tr>
          <td style="background:#F0FAFA;padding:20px 40px;border-bottom:1px solid #E2E8F0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Receipt Number</p>
                  <p style="margin:4px 0 0;color:#050D1F;font-size:16px;font-weight:700;">${receiptNumber}</p>
                </td>
                <td align="right">
                  <p style="margin:0;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Date Issued</p>
                  <p style="margin:4px 0 0;color:#050D1F;font-size:16px;font-weight:700;">${date}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Amount + eligibility -->
        <tr>
          <td style="padding:32px 40px;text-align:center;border-bottom:1px solid #E2E8F0;">
            <p style="margin:0;color:#6B7280;font-size:13px;">Amount Paid</p>
            <p style="margin:8px 0;color:#050D1F;font-size:48px;font-weight:800;">$${totalAmount.toFixed(2)}</p>
            <div style="display:inline-block;background:#00C2A8;border-radius:999px;padding:6px 16px;margin-bottom:8px;">
              <span style="color:#050D1F;font-size:12px;font-weight:700;letter-spacing:0.5px;">HSA/FSA ELIGIBLE ✓</span>
            </div>
            <br>
            <div style="display:inline-block;background:${eligColor}22;border:1px solid ${eligColor};border-radius:999px;padding:4px 12px;">
              <span style="color:${eligColor};font-size:11px;font-weight:700;">${eligLabel.toUpperCase()}</span>
            </div>
          </td>
        </tr>

        <!-- Cost breakdown -->
        <tr>
          <td style="padding:24px 40px;border-bottom:1px solid #E2E8F0;">
            <p style="margin:0 0 12px;color:#050D1F;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Cost Breakdown</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#6B7280;font-size:13px;">Base fare</span></td>
                <td align="right" style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#050D1F;font-size:13px;font-weight:600;">$${baseFare.toFixed(2)}</span></td>
              </tr>
              ${serviceFee > 0 ? `<tr>
                <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#6B7280;font-size:13px;">Service fee</span></td>
                <td align="right" style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#050D1F;font-size:13px;font-weight:600;">$${serviceFee.toFixed(2)}</span></td>
              </tr>` : ""}
              <tr>
                <td style="padding:10px 0;"><span style="color:#050D1F;font-size:14px;font-weight:700;">Total</span></td>
                <td align="right" style="padding:10px 0;"><span style="color:#050D1F;font-size:14px;font-weight:700;">$${totalAmount.toFixed(2)}</span></td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Trip details -->
        <tr>
          <td style="padding:24px 40px;border-bottom:1px solid #E2E8F0;">
            <p style="margin:0 0 12px;color:#050D1F;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Trip Details</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;width:140px;"><span style="color:#6B7280;font-size:13px;">Patient</span></td>
                <td align="right" style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#050D1F;font-size:13px;font-weight:600;">${patientName}</span></td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#6B7280;font-size:13px;">Ride type</span></td>
                <td align="right" style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#050D1F;font-size:13px;font-weight:600;">${rideTypeLabel(ride.ride_type)}</span></td>
              </tr>
              ${ride.procedure_type ? `<tr>
                <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#6B7280;font-size:13px;">Procedure</span></td>
                <td align="right" style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#050D1F;font-size:13px;font-weight:600;">${ride.procedure_type}</span></td>
              </tr>` : ""}
              ${facilityName ? `<tr>
                <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#6B7280;font-size:13px;">Facility</span></td>
                <td align="right" style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#050D1F;font-size:13px;font-weight:600;">${facilityName}${facilityAddress ? `<br><span style="color:#6B7280;font-size:11px;">${facilityAddress}</span>` : ""}</span></td>
              </tr>` : ""}
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#6B7280;font-size:13px;">Pickup</span></td>
                <td align="right" style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#050D1F;font-size:13px;font-weight:600;">${ride.pickup_address ?? "—"}</span></td>
              </tr>
              ${ride.pickup_time ? `<tr>
                <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#6B7280;font-size:13px;">Pickup time</span></td>
                <td align="right" style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#050D1F;font-size:13px;font-weight:600;">${fmtTimestamp(ride.pickup_time)}</span></td>
              </tr>` : ""}
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#6B7280;font-size:13px;">Destination</span></td>
                <td align="right" style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#050D1F;font-size:13px;font-weight:600;">${ride.dropoff_address ?? "—"}</span></td>
              </tr>
              ${ride.dropoff_timestamp ? `<tr>
                <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#6B7280;font-size:13px;">Dropoff time</span></td>
                <td align="right" style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#050D1F;font-size:13px;font-weight:600;">${fmtTimestamp(ride.dropoff_timestamp)}</span></td>
              </tr>` : ""}
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#6B7280;font-size:13px;">Provider</span></td>
                <td align="right" style="padding:8px 0;border-bottom:1px solid #F1F5F9;"><span style="color:#050D1F;font-size:13px;font-weight:600;">CareVoy / APB Ventures LLC</span></td>
              </tr>
              <tr>
                <td style="padding:8px 0;"><span style="color:#6B7280;font-size:13px;">IRS Expense Code</span></td>
                <td align="right" style="padding:8px 0;"><span style="color:#00C2A8;font-size:13px;font-weight:700;">213(d)</span></td>
              </tr>
            </table>
          </td>
        </tr>

        ${receipt.lmn_notes ? `
        <!-- LMN notes -->
        <tr>
          <td style="padding:0 40px 24px;">
            <div style="background:#FFF9F0;border:1px solid #F5A623;border-radius:12px;padding:16px 20px;">
              <p style="margin:0;color:#050D1F;font-size:13px;font-weight:700;">Letter of Medical Necessity Note</p>
              <p style="margin:6px 0 0;color:#6B7280;font-size:12px;line-height:18px;">${receipt.lmn_notes}</p>
            </div>
          </td>
        </tr>` : ""}

        <!-- HSA note -->
        <tr>
          <td style="padding:0 40px 24px;">
            <div style="background:#F0FAFA;border:1px solid #00C2A8;border-radius:12px;padding:16px 20px;">
              <p style="margin:0;color:#050D1F;font-size:13px;font-weight:700;">HSA/FSA Reimbursement</p>
              <p style="margin:6px 0 0;color:#6B7280;font-size:12px;line-height:18px;">
                This receipt confirms that your CareVoy transportation qualifies as a medical expense
                under IRS Code 213(d). Submit this receipt to your HSA or FSA administrator for
                tax-free reimbursement.
              </p>
            </div>
          </td>
        </tr>

        <!-- Audit trail -->
        <tr>
          <td style="padding:0 40px 24px;">
            <p style="margin:0 0 8px;color:#6B7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Audit Trail</p>
            <p style="margin:0;color:#A0AEC0;font-size:10px;font-family:Menlo,monospace;line-height:16px;">
              Ride ID: ${rideId}<br>
              Patient ID: ${patientId}<br>
              Booked: ${fmtTimestamp(ride.created_at)}<br>
              ${ride.payment_timestamp ? `Payment: ${fmtTimestamp(ride.payment_timestamp)}<br>` : ""}
              Receipt: ${receiptNumber}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;padding:24px 40px;border-top:1px solid #E2E8F0;text-align:center;">
            <p style="margin:0;color:#6B7280;font-size:12px;">Questions? Email <a href="mailto:support@carevoy.co" style="color:#00C2A8;">support@carevoy.co</a></p>
            <p style="margin:8px 0 0;color:#A0AEC0;font-size:11px;">CareVoy · carevoy.co · APB Ventures LLC · Columbus, OH</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
      });
    }

    res.status(200).json({ receipt, emailSent: !!patientEmail });
  } catch (e) {
    console.error("receipt error:", e);
    res.status(500).json({ error: e.message });
  }
};
