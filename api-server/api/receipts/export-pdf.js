const { createClient } = require("@supabase/supabase-js");

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fmtTimestamp(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

function rideTypeLabel(t) {
  if (t === "pre_op") return "Pre-operative transport";
  if (t === "post_op") return "Post-operative transport";
  return t ? t.replace(/_/g, " ") : "Medical transport";
}

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
      .select("receipt_number, date")
      .eq("ride_id", rideId)
      .order("date", { ascending: false })
      .limit(1)
      .single();

    const total = ride.actual_cost ?? ride.estimated_cost ?? 0;
    const baseFare = Math.min(total, 45);
    const serviceFee = Math.max(0, total - baseFare);
    const facilityParts = [ride.hospitals?.address, ride.hospitals?.city, ride.hospitals?.state].filter(Boolean);
    const receiptNum = receipt?.receipt_number ?? `CVR-${Date.now()}`;
    const patientName = ride.patients?.full_name ?? "Patient";

    const row = (label, value) => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #F1F5F9;color:#6B7280;font-size:12px;width:160px;">${label}</td>
        <td style="padding:9px 0;border-bottom:1px solid #F1F5F9;color:#050D1F;font-size:12px;font-weight:600;text-align:right;">${value}</td>
      </tr>`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>CareVoy Receipt ${receiptNum}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #050D1F; background: #fff; }
    .header { background: #050D1F; color: #fff; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; border-radius: 12px 12px 0 0; }
    .logo { display: flex; align-items: center; gap: 10px; }
    .logo-mark { background: #00C2A8; border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; color: #050D1F; }
    .logo-name { font-size: 20px; font-weight: 700; }
    .header-right { text-align: right; }
    .header-right .label { font-size: 10px; color: #00C2A8; text-transform: uppercase; letter-spacing: 1px; }
    .header-right .val { font-size: 14px; font-weight: 700; margin-top: 2px; }
    .meta-bar { background: #F0FAFA; padding: 14px 32px; display: flex; justify-content: space-between; border-bottom: 1px solid #E2E8F0; }
    .meta-item .label { font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-item .val { font-size: 13px; font-weight: 700; color: #050D1F; margin-top: 2px; }
    .body { padding: 24px 32px; }
    .amount-block { text-align: center; padding: 20px 0; border-bottom: 1px solid #E2E8F0; margin-bottom: 20px; }
    .amount-label { font-size: 11px; color: #6B7280; }
    .amount { font-size: 42px; font-weight: 800; color: #050D1F; margin: 6px 0; }
    .badge { display: inline-block; background: #00C2A8; border-radius: 999px; padding: 4px 14px; font-size: 11px; font-weight: 700; color: #050D1F; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; margin: 20px 0 8px; }
    table { width: 100%; border-collapse: collapse; }
    .note-box { background: #F0FAFA; border: 1px solid #00C2A8; border-radius: 8px; padding: 12px 16px; margin-top: 16px; }
    .note-box .note-title { font-size: 12px; font-weight: 700; color: #050D1F; margin-bottom: 4px; }
    .note-box .note-body { font-size: 11px; color: #6B7280; line-height: 17px; }
    .lmn-box { background: #FFF9F0; border: 1px solid #F5A623; border-radius: 8px; padding: 12px 16px; margin-top: 12px; }
    .audit { margin-top: 20px; padding-top: 16px; border-top: 1px solid #E2E8F0; }
    .audit-text { font-size: 9px; color: #A0AEC0; font-family: Menlo, monospace; line-height: 15px; }
    .footer { text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #6B7280; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <div class="logo-mark">C</div>
      <div class="logo-name">CareVoy</div>
    </div>
    <div class="header-right">
      <div class="label">Ride Receipt</div>
      <div class="val">${receiptNum}</div>
    </div>
  </div>

  <div class="meta-bar">
    <div class="meta-item"><div class="label">Date Issued</div><div class="val">${fmtDate(new Date().toISOString())}</div></div>
    <div class="meta-item"><div class="label">Patient</div><div class="val">${patientName}</div></div>
    <div class="meta-item"><div class="label">IRS Code</div><div class="val" style="color:#00C2A8;">213(d)</div></div>
  </div>

  <div class="body">
    <div class="amount-block">
      <div class="amount-label">Amount Paid</div>
      <div class="amount">$${total.toFixed(2)}</div>
      <span class="badge">HSA/FSA ELIGIBLE ✓</span>
    </div>

    <div class="section-title">Cost Breakdown</div>
    <table>
      ${row("Base fare", `$${baseFare.toFixed(2)}`)}
      ${serviceFee > 0 ? row("Service fee", `$${serviceFee.toFixed(2)}`) : ""}
      <tr>
        <td style="padding:9px 0;color:#050D1F;font-size:13px;font-weight:700;">Total</td>
        <td style="padding:9px 0;color:#050D1F;font-size:13px;font-weight:700;text-align:right;">$${total.toFixed(2)}</td>
      </tr>
    </table>

    <div class="section-title">Trip Details</div>
    <table>
      ${row("Ride type", rideTypeLabel(ride.ride_type))}
      ${ride.procedure_type ? row("Procedure", ride.procedure_type) : ""}
      ${ride.hospitals?.name ? row("Facility", ride.hospitals.name + (facilityParts.length ? `<br><span style="font-size:10px;color:#6B7280;">${facilityParts.join(", ")}</span>` : "")) : ""}
      ${row("Pickup address", ride.pickup_address ?? "—")}
      ${ride.pickup_time ? row("Pickup time", fmtTimestamp(ride.pickup_time)) : ""}
      ${row("Destination", ride.dropoff_address ?? "—")}
      ${ride.dropoff_timestamp ? row("Dropoff time", fmtTimestamp(ride.dropoff_timestamp)) : ""}
      ${row("Provider", "CareVoy / APB Ventures LLC")}
    </table>

    ${ride.lmn_notes ? `
    <div class="lmn-box">
      <div class="note-title">Letter of Medical Necessity Note</div>
      <div class="note-body">${ride.lmn_notes}</div>
    </div>` : ""}

    <div class="note-box">
      <div class="note-title">HSA/FSA Reimbursement</div>
      <div class="note-body">This receipt confirms that your CareVoy transportation qualifies as a medical expense under IRS Code 213(d). Submit this receipt to your HSA or FSA administrator for tax-free reimbursement.</div>
    </div>

    <div class="audit">
      <div class="audit-text">
        Ride ID: ${rideId} | Patient ID: ${ride.patient_id} | Booked: ${fmtTimestamp(ride.created_at)}${ride.payment_timestamp ? ` | Payment: ${fmtTimestamp(ride.payment_timestamp)}` : ""} | Receipt: ${receiptNum}
      </div>
    </div>

    <div class="footer">
      CareVoy · carevoy.co · APB Ventures LLC · Columbus, OH · support@carevoy.co
    </div>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="carevoy-receipt-${receiptNum}.html"`);
    res.status(200).send(html);
  } catch (e) {
    console.error("export-pdf error:", e);
    res.status(500).json({ error: e.message });
  }
};
