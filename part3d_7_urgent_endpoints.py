import os, subprocess

REPO = '/workspaces/CareVoy'
notifydir = os.path.join(REPO, 'api-server', 'api', 'notify')
os.makedirs(notifydir, exist_ok=True)

# ── Endpoint 1: urgent SMS to NEMT dispatcher ──
urgent_nemt = r'''// POST /api/notify/urgent-nemt
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
'''
open(os.path.join(notifydir, 'urgent-nemt.js'), 'w').write(urgent_nemt)
print("1. Created api/notify/urgent-nemt.js")

# ── Endpoint 2: escalation email to coordinator ──
urgent_esc = r'''// POST /api/notify/urgent-escalate
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
'''
open(os.path.join(notifydir, 'urgent-escalate.js'), 'w').write(urgent_esc)
print("2. Created api/notify/urgent-escalate.js")

cmds = [
    'rm -f part3d_7_urgent_endpoints.py',
    'git add api-server/api/notify/urgent-nemt.js api-server/api/notify/urgent-escalate.js',
    'git commit -m "feat: urgent NEMT alert + escalation endpoints (Part 3D final piece)"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
