import os, subprocess

REPO = '/workspaces/CareVoy'

# Update partner-approved.js to call /api/notify/send with type=welcome
# instead of its own broken Resend implementation
new_approved = """module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, name, type } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Missing email' });

    // Use the existing welcome email template (same as invite flow)
    const r = await fetch('https://care-voy-api-server.vercel.app/api/notify/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'welcome',
        to: email,
        data: { full_name: name, role: type === 'nemt' ? 'nemt' : 'coordinator' }
      })
    });
    const result = await r.json();
    return res.status(200).json({ success: true, sent: result.success });
  } catch(e) {
    console.error('partner-approved error:', e);
    return res.status(500).json({ error: e.message });
  }
};
"""

pf = os.path.join(REPO, 'api-server', 'api', 'notify', 'partner-approved.js')
open(pf, 'w').write(new_approved)
print("1. partner-approved.js now uses the welcome email template (same as invite flow)")

# Also add decline email endpoint
decline_js = """module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, name, type } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const appType = type === 'nemt' ? 'transport partner' : 'facility partner';
    const html = '<div style="font-family:sans-serif;max-width:520px;margin:0 auto">' +
      '<div style="background:#050D1F;padding:20px 24px;border-radius:14px 14px 0 0">' +
      '<span style="color:#fff;font-size:18px;font-weight:700">CareVoy</span>' +
      '<span style="color:#00C2A8;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-left:8px">Partner Portal</span></div>' +
      '<div style="background:#fff;border-radius:0 0 14px 14px;padding:28px;border:1px solid #E2E8F0;border-top:none">' +
      '<h1 style="font-size:19px;color:#050D1F;margin:0 0 12px">Application update</h1>' +
      '<p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px">Hi ' + (name || 'there') + ',<br><br>Thank you for your interest in joining CareVoy as a ' + appType + '. After reviewing your application, we are not able to move forward at this time.</p>' +
      '<p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px">If you have questions or would like to reapply in the future, please reach out to us at <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a>.</p>' +
      '<div style="margin-top:24px;padding-top:18px;border-top:1px solid #F0F4F8;font-size:11px;color:#B0B7C3;line-height:1.7">' +
      'This is an automated message from CareVoy.<br>&copy; 2026 CareVoy. All rights reserved.</div>' +
      '</div></div>';

    let sent = false;
    if (process.env.RESEND_API_KEY || process.env.RESEND_API) {
      const key = process.env.RESEND_API_KEY || process.env.RESEND_API;
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'CareVoy <partners@carevoy.co>',
          to: [email],
          subject: 'Your CareVoy partner application',
          html
        })
      });
      if (r.ok) sent = true;
    }
    return res.status(200).json({ success: true, sent });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
"""

df = os.path.join(REPO, 'api-server', 'api', 'notify', 'partner-declined.js')
open(df, 'w').write(decline_js)
print("2. partner-declined.js created")

cmds = [
    'rm -f fix_approval_use_welcome.py',
    'git add api-server/api/notify/partner-approved.js api-server/api/notify/partner-declined.js',
    'git commit -m "feat: approval uses welcome email template, decline email added"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
