'use strict';
// GET /api/billing/status   (?hospital_id=... only for admins)
// Returns the facility's plan, usage this month, contract and add-ons.
const { getCaller } = require('../../lib/security');
const { loadBilling } = require('../../lib/billing');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });
    let hid = caller.coordinator && caller.coordinator.hospital_id;
    if (caller.isAdmin && req.query && req.query.hospital_id) hid = req.query.hospital_id;
    if (!hid) return res.status(403).json({ error: 'Forbidden' });
    return res.status(200).json(await loadBilling(null, hid));
  } catch (e) {
    console.error('billing/status', e.message);
    return res.status(500).json({ error: 'Could not load billing' });
  }
};
