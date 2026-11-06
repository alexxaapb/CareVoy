'use strict';
// Read-only API for facility IT.
//   GET /api/v1/rides?status=completed&since=2026-11-01&limit=100
//   Authorization: Bearer cv_live_...
// Returns the rides of the facility that owns the key, newest first (max 200 per call).
const crypto = require('crypto');
const { adminClient } = require('../../lib/security');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const key = ((req.headers['authorization'] || '').replace(/^Bearer\s+/i, '')).trim();
    if (!/^cv_live_[A-Za-z0-9_-]{20,}$/.test(key)) return res.status(401).json({ error: 'Missing or invalid API key' });
    const sb = adminClient();
    const { data: row } = await sb.from('facility_api').select('hospital_id').eq('api_key_hash', crypto.createHash('sha256').update(key).digest('hex')).maybeSingle();
    if (!row) return res.status(401).json({ error: 'Missing or invalid API key' });

    const q = req.query || {};
    const limit = Math.min(Math.max(parseInt(q.limit, 10) || 100, 1), 200);
    let query = sb.from('rides')
      .select('id, status, pickup_time, procedure_type, pickup_address, dropoff_address, driver_name, payment_responsibility, actual_cost, estimated_cost, patient_name, created_at, completed_at')
      .eq('hospital_id', row.hospital_id)
      .order('pickup_time', { ascending: false })
      .limit(limit);
    if (q.status) query = query.eq('status', String(q.status).slice(0, 30));
    if (q.since && !isNaN(Date.parse(q.since))) query = query.gte('pickup_time', new Date(q.since).toISOString());
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Could not load rides' });
    return res.status(200).json({
      data: (data || []).map((r) => ({
        id: r.id, status: r.status, pickup_time: r.pickup_time, appointment_type: r.procedure_type,
        pickup_address: r.pickup_address, destination_address: r.dropoff_address, driver_name: r.driver_name,
        paid_by: r.payment_responsibility === 'facility' ? 'facility' : 'patient',
        amount: (r.actual_cost || r.estimated_cost) ? Number(r.actual_cost || r.estimated_cost) : null,
        patient_name: r.patient_name, created_at: r.created_at, completed_at: r.completed_at,
      })),
      count: (data || []).length,
    });
  } catch (e) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
};
