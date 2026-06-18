// POST /api/notify/urgent-escalate
// Fallback: email the coordinator when an urgent ride wasn't accepted in time.
// NOTE: uses Resend today; SWAP to a BAA email provider (AWS SES) before
// handling real PHI, since Resend does not sign a BAA.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, patient_name, when, ride_id } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const msg = 'Heads up: the urgent ride for ' + (patient_name || 'a patient') + ' on ' + (when || 'soon') +
      ' has not yet been accepted by a transport provider. You may want to follow up or arrange a backup. Ride ID: ' + (ride_id || 'n/a');

    let sent = false;
    if (process.env.RESEND_API_KEY) {
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'CareVoy <notifications@carevoy.co>',
            to: [email],
            subject: 'Action may be needed: urgent ride not yet accepted',
            html: '<p>' + msg + '</p>'
          })
        });
        if (r.ok) sent = true;
      } catch (e) { console.warn('escalate email failed:', e.message); }
    }
    return res.status(200).json({ success: true, sent });
  } catch (e) {
    console.error('urgent-escalate error:', e);
    return res.status(500).json({ error: e.message });
  }
};
