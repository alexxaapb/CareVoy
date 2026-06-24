module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { type, name, email, phone, city, state, details } = req.body || {};
    const subject = (type === 'nemt' ? 'New NEMT Application: ' : 'New Facility Application: ') + (name || 'Unknown');
    const rows = Object.entries(details || {}).map(([k,v]) =>
      '<tr><td style="padding:6px 12px;color:#6B7280;font-size:13px">' + k.replace(/_/g,' ') +
      '</td><td style="padding:6px 12px;color:#050D1F;font-size:13px;font-weight:600">' + (v||'—') + '</td></tr>'
    ).join('');
    const html = '<div style="font-family:sans-serif;max-width:560px"><div style="background:#050D1F;padding:20px;border-radius:12px 12px 0 0"><span style="color:#00C2A8;font-weight:700;font-size:18px">CareVoy</span> <span style="color:#fff;font-size:12px">New ' + (type==='nemt'?'NEMT':'Facility') + ' Application</span></div><div style="background:#fff;border:1px solid #E2E8F0;padding:24px;border-radius:0 0 12px 12px"><p style="font-size:15px;font-weight:700;color:#050D1F;margin:0 0 4px">' + (name||'') + '</p><p style="font-size:13px;color:#6B7280;margin:0 0 20px">' + (email||'') + ' &bull; ' + (phone||'') + ' &bull; ' + (city||'') + ', ' + (state||'') + '</p><table style="width:100%;border-collapse:collapse;background:#F8FAFC;border-radius:8px">' + rows + '</table><div style="margin-top:20px;padding:14px;background:rgba(0,194,168,0.08);border-radius:8px;font-size:12px;color:#050D1F"><strong>Next step:</strong> Approve in Supabase: set active=true, pending_review=false</div></div></div>';
    let sent = false;
    if (process.env.RESEND_API_KEY) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'CareVoy <notifications@carevoy.co>', to: ['partners@carevoy.co'], subject, html })
      });
      if (r.ok) sent = true;
    }
    return res.status(200).json({ success: true, sent });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
