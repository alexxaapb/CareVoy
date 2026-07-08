module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://partners.carevoy.co');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return res.status(500).json({ error: 'reCAPTCHA not configured' });

  try {
    const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'secret=' + encodeURIComponent(secret) + '&response=' + encodeURIComponent(token),
    });
    const data = await r.json();
    if (!data.success) {
      return res.status(400).json({ error: 'reCAPTCHA failed', codes: data['error-codes'] });
    }
    return res.json({ success: true, score: data.score });
  } catch (e) {
    return res.status(500).json({ error: 'Verification error' });
  }
};
