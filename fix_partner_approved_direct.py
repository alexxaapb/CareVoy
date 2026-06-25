import os, subprocess

REPO = '/workspaces/CareVoy'

new_approved = r"""const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, name, type } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Missing email' });
    if (!process.env.RESEND_API_KEY) return res.status(200).json({ success: false, note: 'Resend not configured' });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const portal = 'https://partners.carevoy.co';
    const roleLabel = type === 'nemt' ? 'transport partner' : 'facility coordinator';
    const dashUrl = type === 'nemt' ? portal + '/driver.html' : portal + '/coordinator.html';

    const body = `Welcome${name ? ' ' + name : ''}! Your CareVoy ${roleLabel} account has been approved. You can now sign in anytime at <a href="${portal}" style="color:#00C2A8;text-decoration:none">partners.carevoy.co</a> to manage rides and coordinate transportation.<br><br>Need help getting started? Just reply to this email or reach us at the contacts below.`;

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F0F4F8;font-family:-apple-system,Segoe UI,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px">
      <div style="background:#050D1F;border-radius:14px 14px 0 0;padding:24px 28px">
        <span style="color:#fff;font-size:18px;font-weight:700">CareVoy</span>
        <span style="color:#00C2A8;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-left:8px">Partner Portal</span>
      </div>
      <div style="background:#fff;border-radius:0 0 14px 14px;padding:28px;border:1px solid #E2E8F0;border-top:none">
        <h1 style="font-size:19px;color:#050D1F;margin:0 0 12px">Your account is ready</h1>
        <div style="font-size:14px;color:#374151;line-height:1.6">${body}</div>
        <a href="${dashUrl}" style="display:inline-block;margin-top:20px;background:#050D1F;color:#00C2A8;text-decoration:none;padding:12px 24px;border-radius:9px;font-size:14px;font-weight:700">Go to My Dashboard</a>
        <div style="margin-top:24px;padding-top:18px;border-top:1px solid #F0F4F8;font-size:12px;color:#9CA3AF;line-height:1.6">
          <div style="margin-bottom:4px">Account changes: <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a></div>
          <div style="margin-bottom:4px">Billing: <a href="mailto:billing@carevoy.co" style="color:#00C2A8;text-decoration:none">billing@carevoy.co</a></div>
          <div>Help: <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a></div>
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid #F0F4F8;font-size:11px;color:#B0B7C3;line-height:1.7">
            This is an automated message from CareVoy. Please do not reply to this email.<br>
            If you need assistance, contact us at <a href="mailto:contact@carevoy.co" style="color:#9CA3AF;text-decoration:none">contact@carevoy.co</a>.<br>
            &copy; 2026 CareVoy. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  </body></html>`;

    const { error } = await resend.emails.send({
      from: 'CareVoy <notifications@carevoy.co>',
      to: [email],
      subject: 'Welcome to CareVoy - Your account is ready',
      html
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(200).json({ success: false, error: error.message });
    }
    return res.status(200).json({ success: true, sent: true });
  } catch(e) {
    console.error('partner-approved error:', e);
    return res.status(500).json({ error: e.message });
  }
};
"""

pf = os.path.join(REPO, 'api-server', 'api', 'notify', 'partner-approved.js')
open(pf, 'w').write(new_approved)
print("1. partner-approved.js uses Resend SDK directly - no internal fetch")

cmds = [
    'rm -f fix_partner_approved_direct.py',
    'git add api-server/api/notify/partner-approved.js',
    'git commit -m "fix: partner-approved uses Resend SDK directly, same template as welcome email"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
