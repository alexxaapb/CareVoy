module.exports = async function handler(req, res) {
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
