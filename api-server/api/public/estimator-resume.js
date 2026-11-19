'use strict';
// GET /api/public/estimator-resume?token=<uuid>   (public)
// Returns the saved numbers for the "finish your snapshot" link. The token is a random id
// that only appears in the email we sent to that person.
const { adminClient } = require('../../lib/security');
const { hit, clientIp } = require('../../lib/ratelimit');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = String((req.query && req.query.token) || '');
    if (!/^[0-9a-f-]{36}$/i.test(token)) return res.status(400).json({ error: 'Bad link' });
    const sb = adminClient();
    if (await hit(sb, 'ip:' + clientIp(req), 'estimator_resume', 30, 3600000)) return res.status(429).json({ error: 'Too many requests.' });
    const { data } = await sb.from('estimator_leads')
      .select('email, contact_name, facility_name, visit_types, appointments, pct_commercial, pct_medicare, pct_medicaid, pct_selfpay, pct_need_ride')
      .eq('token', token).maybeSingle();
    if (!data) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json({ success: true, lead: data });
  } catch (e) { return res.status(500).json({ error: 'Something went wrong' }); }
};
