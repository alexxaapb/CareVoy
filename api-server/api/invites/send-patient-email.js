// POST /api/invites/send-patient-email   body: { email, patient_name, facility, city }
// Logged-in coordinators and admins only. Everything inserted into the email is escaped.
// Limit: 100 invite emails per person per 24 hours.
const { getCaller, escHtml, adminClient } = require('../../lib/security');
const { limited, record } = require('../../lib/ratelimit');

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ error: 'Please sign in again' });
    if (!caller.isAdmin && !caller.coordinator) return res.status(403).json({ error: 'Not allowed' });

    const body = req.body || {};
    const email = String(body.email || '').trim();
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Missing or invalid email' });

    const sb = adminClient();
    if (await limited(sb, caller.user.id, 'rate.patient_invite_email', 100, 86400000)) {
      return res.status(429).json({ error: 'Daily invite email limit reached' });
    }

    // Use the coordinator's own facility name from the database when there is one.
    let facility = String(body.facility || '').slice(0, 120);
    let city = String(body.city || '').slice(0, 80);
    if (caller.coordinator && caller.coordinator.hospital_id) {
      const { data: h } = await sb.from('hospitals').select('name, city').eq('id', caller.coordinator.hospital_id).maybeSingle();
      if (h && h.name) { facility = h.name; city = h.city || city; }
    }

    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const firstName = escHtml(String(body.patient_name || 'there').split(' ')[0].slice(0, 60));
    const facilityDisplay = escHtml([facility, city].filter(Boolean).join(', '));

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
          <a href="https://partners.carevoy.co/patients#signup"
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

    if (error) return res.status(500).json({ error: 'Could not send the email' });
    await record(sb, caller.user.id, caller.isAdmin ? 'admin' : 'coordinator', 'rate.patient_invite_email');
    return res.status(200).json({ success: true, email_sent: true });
  } catch (e) {
    console.error('Patient invite email error:', e);
    return res.status(500).json({ error: 'Could not send the email' });
  }
};
