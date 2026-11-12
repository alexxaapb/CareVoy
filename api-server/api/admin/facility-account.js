'use strict';
// Admin only.
//   GET  /api/admin/facility-account?hospital_id=...   one facility's account: plan, usage, rides, contacts, invoices, notes
//   POST /api/admin/facility-account  { hospital_id, notes }   save private admin notes
const { getCaller, adminClient } = require('../../lib/security');
const { COUNTED_STATUSES, TIER_LABELS, monthRangeUTC } = require('../../lib/billing');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });
    if (!caller.isAdmin) return res.status(403).json({ error: 'Admin access required' });

    const src = req.method === 'GET' ? (req.query || {}) : (req.body || {});
    const hid = String(src.hospital_id || '');
    if (!UUID.test(hid)) return res.status(400).json({ error: 'Missing or invalid hospital_id' });
    const sb = adminClient();

    if (req.method === 'POST') {
      const notes = String(src.notes == null ? '' : src.notes).slice(0, 5000);
      const { error } = await sb.from('facility_billing')
        .upsert({ hospital_id: hid, admin_notes: notes, updated_at: new Date().toISOString() }, { onConflict: 'hospital_id' });
      if (error) return res.status(500).json({ error: 'Could not save notes. Has the admin-notes SQL been run?' });
      return res.status(200).json({ success: true });
    }

    const { start, end } = monthRangeUTC();
    const [hosp, bill, coords, recent, statuses, month] = await Promise.all([
      sb.from('hospitals').select('id, name, city, state, active, tier, contact_email, contact_phone, created_at').eq('id', hid).maybeSingle(),
      sb.from('facility_billing').select('*').eq('hospital_id', hid).maybeSingle(),
      sb.from('hospital_coordinators').select('full_name, email, phone').eq('hospital_id', hid).limit(50),
      sb.from('rides').select('id, patient_name, pickup_time, status, actual_cost, estimated_cost')
        .eq('hospital_id', hid).order('pickup_time', { ascending: false }).limit(8),
      sb.from('rides').select('status').eq('hospital_id', hid).limit(20000),
      sb.from('rides').select('id', { count: 'exact', head: true })
        .eq('hospital_id', hid).in('status', COUNTED_STATUSES).gte('pickup_time', start).lt('pickup_time', end),
    ]);
    if (!hosp.data) return res.status(404).json({ error: 'Facility not found' });
    const b = bill.data || null;
    const h = hosp.data;

    const byStatus = {};
    (statuses.data || []).forEach((r) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });

    let invoices = [], invoices_note = null;
    if (b && b.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const list = await stripe.invoices.list({ customer: b.stripe_customer_id, limit: 6 });
        invoices = list.data.map((i) => ({
          number: i.number, date: i.created ? new Date(i.created * 1000).toISOString() : null,
          amount_cents: i.amount_due, status: i.status, url: i.hosted_invoice_url || null,
        }));
      } catch (e) { invoices_note = 'Could not load invoices from Stripe'; }
    } else if (!b || !b.stripe_customer_id) {
      invoices_note = 'No Stripe customer linked yet';
    }

    return res.status(200).json({
      facility: { id: h.id, name: h.name, city: h.city, state: h.state, active: h.active !== false, contact_email: h.contact_email, contact_phone: h.contact_phone, since: h.created_at },
      plan: {
        label: TIER_LABELS[h.tier] || h.tier || 'Starter',
        subscription_status: b ? b.subscription_status || null : null,
        renews_on: b ? b.current_period_end || null : null,
        monthly_price_cents: b ? b.monthly_price_cents || null : null,
        ride_limit: b ? b.ride_limit || null : null,
        rides_this_month: month.count || 0,
        addons: b ? b.addons || [] : [],
        contract_start: b ? b.contract_start || null : null,
        contract_end: b ? b.contract_end || null : null,
      },
      rides: { by_status: byStatus, recent: recent.data || [] },
      contacts: coords.data || [],
      invoices, invoices_note,
      notes: b ? b.admin_notes || '' : '',
    });
  } catch (e) {
    console.error('admin/facility-account', e.message);
    return res.status(500).json({ error: 'Could not load facility account' });
  }
};
