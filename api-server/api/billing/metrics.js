'use strict';
// GET /api/billing/metrics   (admins only)
// Business numbers for the admin home: MRR, paying facilities, rides per month, completion rate.
//   MRR            = contract price of every active facility with a live subscription (or no
//                    Stripe status yet but a contract price) + $199/mo for each EHR Sync add-on.
//   Paying         = facilities counted in that MRR.
//   Rides / month  = rides that count toward plan limits, by pickup month, last 6 months.
//   Completion     = completed / (completed + cancelled) over the last 90 days.
const { getCaller, adminClient } = require('../../lib/security');
const { COUNTED_STATUSES } = require('../../lib/billing');

const ADDON_CENTS = { ehr_sync: 19900 };
const DEAD_STATUSES = ['canceled', 'cancelled', 'unpaid', 'incomplete_expired'];

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
    const now = new Date();
    const sixAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const ninetyAgo = new Date(now.getTime() - 90 * 86400000);

    const [hosp, bill, rides, closed] = await Promise.all([
      sb.from('hospitals').select('id, active'),
      sb.from('facility_billing').select('hospital_id, subscription_status, monthly_price_cents, addons'),
      sb.from('rides').select('pickup_time').in('status', COUNTED_STATUSES)
        .gte('pickup_time', sixAgo.toISOString()).limit(50000),
      sb.from('rides').select('status').in('status', ['completed', 'cancelled'])
        .gte('pickup_time', ninetyAgo.toISOString()).lte('pickup_time', now.toISOString()).limit(50000),
    ]);
    if (hosp.error) return res.status(500).json({ error: 'Could not load facilities' });

    const activeIds = {};
    (hosp.data || []).forEach((h) => { if (h.active !== false) activeIds[h.id] = true; });

    let mrr = 0, paying = 0;
    (bill.error ? [] : bill.data || []).forEach((b) => {
      if (!activeIds[b.hospital_id]) return;
      if (b.subscription_status && DEAD_STATUSES.indexOf(b.subscription_status) >= 0) return;
      let cents = b.monthly_price_cents || 0;
      (b.addons || []).forEach((a) => { cents += ADDON_CENTS[a] || 0; });
      if (cents > 0) { mrr += cents; paying += 1; }
    });

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      months.push({ key: d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'), label: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }), rides: 0 });
    }
    (rides.data || []).forEach((r) => {
      const t = new Date(r.pickup_time);
      const key = t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0');
      const m = months.filter((x) => x.key === key)[0];
      if (m) m.rides += 1;
    });

    let done = 0, cancelled = 0;
    (closed.data || []).forEach((r) => { if (r.status === 'completed') done++; else cancelled++; });
    const completion = done + cancelled ? Math.round((done / (done + cancelled)) * 100) : null;

    return res.status(200).json({
      mrr_cents: mrr, paying_facilities: paying, months,
      completion_rate: completion, completed_90d: done, cancelled_90d: cancelled,
      partial: !!(bill.error || rides.error || closed.error),
    });
  } catch (e) {
    console.error('billing/metrics', e.message);
    return res.status(500).json({ error: 'Could not load metrics' });
  }
};
