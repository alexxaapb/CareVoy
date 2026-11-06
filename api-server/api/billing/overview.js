'use strict';
// GET /api/billing/overview   (admins only)
// One row per facility: plan, rides used this month vs contract limit, status, add-ons.
const { getCaller, adminClient } = require('../../lib/security');
const { COUNTED_STATUSES, TIER_LABELS, monthRangeUTC } = require('../../lib/billing');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });
    if (!caller.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const sb = adminClient();
    const { start, end } = monthRangeUTC();
    const [hosp, bill, rides] = await Promise.all([
      sb.from('hospitals').select('id, name, tier, active'),
      sb.from('facility_billing').select('*'),
      sb.from('rides').select('hospital_id')
        .in('status', COUNTED_STATUSES).gte('pickup_time', start).lt('pickup_time', end).limit(20000),
    ]);
    if (hosp.error) return res.status(500).json({ error: 'Could not load facilities' });
    const billBy = {};
    (bill.error ? [] : bill.data || []).forEach((b) => { billBy[b.hospital_id] = b; });
    const used = {};
    (rides.data || []).forEach((r) => { if (r.hospital_id) used[r.hospital_id] = (used[r.hospital_id] || 0) + 1; });

    const rows = (hosp.data || []).map((h) => {
      const b = billBy[h.id] || null;
      const limit = b && b.ride_limit ? b.ride_limit : null;
      const n = used[h.id] || 0;
      return {
        hospital_id: h.id,
        name: h.name,
        active: h.active !== false,
        plan: TIER_LABELS[h.tier] || h.tier || 'Starter',
        rides_this_month: n,
        ride_limit: limit,
        percent: limit ? Math.round((n / limit) * 100) : null,
        subscription_status: b ? b.subscription_status || null : null,
        renews_on: b ? b.current_period_end || null : null,
        monthly_price_cents: b ? b.monthly_price_cents || null : null,
        addons: b ? b.addons || [] : [],
        billing_linked: !!(b && b.stripe_customer_id),
        ehr_system: b ? b.ehr_system || null : null,
      };
    }).sort((a, b) => (b.percent == null ? -1 : b.percent) - (a.percent == null ? -1 : a.percent));
    return res.status(200).json({ rows, partial_usage: !!rides.error });
  } catch (e) {
    console.error('billing/overview', e.message);
    return res.status(500).json({ error: 'Could not load overview' });
  }
};
