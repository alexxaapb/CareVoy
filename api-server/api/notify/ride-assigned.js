// POST /api/notify/ride-assigned
// Called by the DB trigger when a ride becomes 'assigned'. Sends the patient
// an SMS (via Twilio) and/or email (via Resend) so they know a driver accepted
// even if they never enabled push notifications.
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { channel, phone, email, patient_name, facility, date, ride_id } = req.body || {};
    const name = patient_name || 'your';
    const fac = facility || 'your appointment';
    const when = date || 'your scheduled date';
    const msg = 'Good news! A driver has been assigned for ' + name + "'s ride to " + fac + ' on ' + when + '. Open CareVoy for details.';

    let sent = false;

    if (channel === 'sms' && phone) {
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_FROM) {
        try {
          const tw = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + process.env.TWILIO_ACCOUNT_SID + '/Messages.json', {
            method: 'POST',
            headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ To: phone, From: process.env.TWILIO_PHONE_FROM, Body: msg }).toString()
          });
          if (tw.ok) sent = true;
        } catch (e) { console.warn('assign SMS failed:', e.message); }
      }
    }

    if (channel === 'email' && email) {
      if (process.env.RESEND_API_KEY) {
        try {
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'CareVoy <notifications@carevoy.co>',
              to: [email],
              subject: 'Your CareVoy ride is confirmed',
              html: '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">' +
                '<div style="background:#050D1F;padding:20px 24px;border-radius:12px 12px 0 0;text-align:center">' +
                '<span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:1px">CareVoy</span></div>' +
                '<div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px">' +
                '<p style="color:#050D1F;font-size:16px;font-weight:600;margin:0 0 12px">Hi ' + name + ',</p>' +
                '<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">A driver has been assigned for your ride to <strong>' + fac + '</strong> on <strong>' + when + '</strong>.</p>' +
                '<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px">You can view your ride details and driver information in your patient portal.</p>' +
                '<a href="https://partners.carevoy.co/patients" style="display:inline-block;background:#050D1F;color:#fff;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">View My Ride</a>' +
                '<p style="color:#9CA3AF;font-size:12px;margin:24px 0 0">This notification was sent on behalf of ' + fac + ' via CareVoy.</p>' +
                '</div></div>'
            })
          });
          if (r.ok) sent = true;
        } catch (e) { console.warn('assign email failed:', e.message); }
      }
    }

    try {
      await supabase.from('audit_log').insert({ actor_role: 'system', action: 'ride.assigned_notify', entity_type: 'rides', entity_id: ride_id || null, new_value: { channel, sent } });
    } catch (auditErr) { console.warn('audit failed (non-fatal):', auditErr.message); }

    return res.status(200).json({ success: true, sent });
  } catch (e) {
    console.error('ride-assigned notify error:', e);
    return res.status(500).json({ error: e.message });
  }
};
