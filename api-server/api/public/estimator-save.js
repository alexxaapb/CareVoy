'use strict';
// POST /api/public/estimator-save   (public) body: { contact_email, ...the estimator fields }
// Quietly saves a half-finished estimator once the visitor has typed their email,
// so one reminder can be sent if they never press Send. Returns { token }.
const { adminClient } = require('../../lib/security');
const { hit, clientIp } = require('../../lib/ratelimit');
const { upsertLead, validEmail } = require('../../lib/estimator-leads');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const b = req.body || {};
    if (b.website) return res.status(200).json({ success: true });
    const sb = adminClient();
    if (await hit(sb, 'ip:' + clientIp(req), 'estimator_save', 30, 3600000)) return res.status(429).json({ error: 'Too many requests.' });
    if (!validEmail(b.contact_email)) return res.status(400).json({ error: 'Invalid email.' });
    const lead = await upsertLead(sb, b.contact_email, b, false);
    return res.status(200).json({ success: true, saved: !!lead });
  } catch (e) { return res.status(200).json({ success: false }); } // never bother the visitor
};
