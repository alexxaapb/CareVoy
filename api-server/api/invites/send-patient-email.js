module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, patient_name, facility, city } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const firstName = (patient_name || 'there').split(' ')[0];
    const facilityDisplay = [facility, city].filter(Boolean).join(', ');

    const { error } = await resend.emails.send({
      from: 'CareVoy <notifications@carevoy.co>',
      to: email,
      subject: 'Your medical ride is ready to schedule',
      html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
        <div style="background:#050D1F;padding:20px 24px;border-radius:12px 12px 0 0;text-align:center">
          <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:1px">CareVoy</span>
        </div>
        <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px">
          <p style="color:#1A1714;font-size:16px;font-weight:600;margin:0 0 12px">Hi ${firstName},</p>
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">
            <strong>${facilityDisplay}</strong> has arranged medical transportation for your upcoming appointment.
          </p>
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px">
            Please visit your CareVoy patient portal to schedule your pickup time and confirm your ride.
            Your HSA/FSA receipt will be generated automatically after your ride is completed.
          </p>
          <a href="https://partners.carevoy.co/patients"
             style="display:inline-block;background:#050D1F;color:#fff;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">
            Schedule My Ride
          </a>
          <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0;line-height:1.5">
            This message was sent on behalf of ${facilityDisplay} via CareVoy.<br>
            If you did not expect this message, please disregard it.
          </p>
        </div>
      </div>`
    });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, email_sent: true });
  } catch(e) {
    console.error('Patient invite email error:', e);
    return res.status(500).json({ error: e.message });
  }
};
