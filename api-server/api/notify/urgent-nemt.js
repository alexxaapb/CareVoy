// POST /api/notify/urgent-nemt
// SMS the NEMT dispatcher about a short-notice ride needing acceptance.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { phone, patient_name, facility, state, when, ride_id } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'Missing phone' });

    const msg = 'CareVoy URGENT: ride needed for ' + (patient_name || 'a patient') +
      ' to ' + (facility || 'a facility') + ' (' + (state || '') + ') on ' + (when || 'soon') +
      '. Open your CareVoy dashboard to accept: https://partners.carevoy.co';

    let sent = false;
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_FROM) {
      try {
        const tw = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + process.env.TWILIO_ACCOUNT_SID + '/Messages.json', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ To: phone, From: process.env.TWILIO_PHONE_FROM, Body: msg }).toString()
        });
        if (tw.ok) sent = true;
      } catch (e) { console.warn('urgent NEMT SMS failed:', e.message); }
    }
    return res.status(200).json({ success: true, sent });
  } catch (e) {
    console.error('urgent-nemt error:', e);
    return res.status(500).json({ error: e.message });
  }
};
