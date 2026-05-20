const { createClient } = require("@supabase/supabase-js");
const { Resend } = require("resend");

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
      .select("*, patients(full_name, email)")
      .eq("id", rideId)
      .single();

    if (!ride) return res.status(404).json({ error: "Ride not found" });

    const receiptNumber = `CVR-${Date.now()}`;
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric"
    });
    const amount = ride.actual_cost ?? ride.estimated_cost ?? 0;
    const patientName = ride.patients?.full_name ?? "Patient";
    const patientEmail = ride.patients?.email;

    const receipt = {
      receipt_number: receiptNumber,
      date: new Date().toISOString(),
      patient_name: patientName,
      patient_id: patientId,
      ride_id: rideId,
      pickup: ride.pickup_address,
      destination: ride.dropoff_address,
      amount,
      irs_code: "213(d)",
      expense_type: "Medical Transportation",
      provider: "CareVoy / APB Ventures LLC",
      status: "paid",
    };

    await supabase.from("receipts").insert({
      ...receipt,
      patient_id: patientId,
    });

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
                  <p style="margin:0;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Date</p>
                  <p style="margin:4px 0 0;color:#050D1F;font-size:16px;font-weight:700;">${date}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Amount -->
        <tr>
          <td style="padding:32px 40px;text-align:center;border-bottom:1px solid #E2E8F0;">
            <p style="margin:0;color:#6B7280;font-size:13px;">Amount Paid</p>
            <p style="margin:8px 0;color:#050D1F;font-size:48px;font-weight:800;">$${amount.toFixed(2)}</p>
            <div style="display:inline-block;background:#00C2A8;border-radius:999px;padding:6px 16px;">
              <span style="color:#050D1F;font-size:12px;font-weight:700;letter-spacing:0.5px;">HSA/FSA ELIGIBLE ✓</span>
            </div>
          </td>
        </tr>

        <!-- Trip details -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 16px;color:#050D1F;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Trip Details</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;">
                  <span style="color:#6B7280;font-size:13px;">Patient</span>
                </td>
                <td align="right" style="padding:10px 0;border-bottom:1px solid #E2E8F0;">
                  <span style="color:#050D1F;font-size:13px;font-weight:600;">${patientName}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;">
                  <span style="color:#6B7280;font-size:13px;">Pickup</span>
                </td>
                <td align="right" style="padding:10px 0;border-bottom:1px solid #E2E8F0;">
                  <span style="color:#050D1F;font-size:13px;font-weight:600;">${ride.pickup_address ?? "—"}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;">
                  <span style="color:#6B7280;font-size:13px;">Destination</span>
                </td>
                <td align="right" style="padding:10px 0;border-bottom:1px solid #E2E8F0;">
                  <span style="color:#050D1F;font-size:13px;font-weight:600;">${ride.dropoff_address ?? "—"}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;">
                  <span style="color:#6B7280;font-size:13px;">Service Type</span>
                </td>
                <td align="right" style="padding:10px 0;border-bottom:1px solid #E2E8F0;">
                  <span style="color:#050D1F;font-size:13px;font-weight:600;">Medical Transportation</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #E2E8F0;">
                  <span style="color:#6B7280;font-size:13px;">Provider</span>
                </td>
                <td align="right" style="padding:10px 0;border-bottom:1px solid #E2E8F0;">
                  <span style="color:#050D1F;font-size:13px;font-weight:600;">CareVoy / APB Ventures LLC</span>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;">
                  <span style="color:#6B7280;font-size:13px;">IRS Expense Code</span>
                </td>
                <td align="right" style="padding:10px 0;">
                  <span style="color:#00C2A8;font-size:13px;font-weight:700;">213(d)</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- HSA note -->
        <tr>
          <td style="padding:0 40px 32px;">
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
