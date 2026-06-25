// POST /api/notify/partner-approved
// Call this when you approve a partner in Supabase.
// Body: { email, name, type } where type = 'nemt' or 'facility'
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, name, type } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const loginUrl = 'https://partners.carevoy.co';
    const appType = type === 'nemt' ? 'transport partner' : 'facility partner';
    const html = '<div style="font-family:Poppins,sans-serif;max-width:520px;margin:0 auto">' +
      '<div style="background:#050D1F;padding:20px 24px;border-radius:12px 12px 0 0">' +
      '<span style="color:#00C2A8;font-weight:700;font-size:18px">CareVoy</span></div>' +
      '<div style="background:#fff;border:1px solid #E2E8F0;padding:28px;border-radius:0 0 12px 12px">' +
      '<h2 style="color:#050D1F;font-size:18px;margin:0 0 12px">You're approved! Welcome to CareVoy.</h2>' +
      '<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">Hi ' + (name || 'there') + ', your CareVoy ' + appType + ' account has been approved. You can now log in to your dashboard and start receiving rides.</p>' +
      '<a href="' + loginUrl + '" style="display:inline-block;background:#050D1F;color:#00C2A8;padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;margin-bottom:20px">Access your dashboard</a>' +
      '<p style="color:#374151;font-size:13px;line-height:1.6">Log in with the email and password you used when you applied. If you have any questions, reach us at <a href="mailto:partners@carevoy.co" style="color:#00C2A8">partners@carevoy.co</a></p>' +
      '</div></div>';

    let sent = false;
    if (process.env.RESEND_API_KEY) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'CareVoy <partners@carevoy.co>',
          to: [email],
          subject: 'You're approved - welcome to CareVoy!',
          html
        })
      });
      if (r.ok) sent = true;
    }
    return res.status(200).json({ success: true, sent });
  } catch(e) {
    console.error('partner-approved error:', e);
    return res.status(500).json({ error: e.message });
  }
};
