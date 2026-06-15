const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { phone, patient_name, facility, ride_id } = req.body;
    if (!phone) return res.status(400).json({ error: 'Missing phone' });

    const appLink = 'https://apps.apple.com/us/app/carevoy/id6768714735';
    const message = (facility || 'Your care team') + ' has scheduled an appointment for ' + (patient_name || 'you') + '. Download CareVoy to book your ride and get your HSA/FSA receipt: ' + appLink;

    let smsSent = false;
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_FROM) {
      try {
        const twilioRes = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + process.env.TWILIO_ACCOUNT_SID + '/Messages.json', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ To: phone, From: process.env.TWILIO_PHONE_FROM, Body: message }).toString()
        });
        if (twilioRes.ok) smsSent = true;
      } catch(e) { console.warn('Twilio SMS failed:', e.message); }
    }

    if (ride_id) {
      await supabase.from('audit_log').insert({ actor_role: 'coordinator', action: 'invite.sms_sent', entity_type: 'rides', entity_id: ride_id, new_value: { sms_sent: smsSent, phone } }).catch(() => {});
    }

    return res.status(200).json({ success: true, sms_sent: smsSent });
  } catch(e) {
    console.error('Send SMS error:', e);
    return res.status(500).json({ error: e.message });
  }
};
