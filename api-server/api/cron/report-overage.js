'use strict';
// Hourly. Reports overage rides to Stripe so Essential and Professional facilities are billed
// $5 / $4 per ride over their plan limit on their next invoice. CRON_SECRET bearer auth.
//
// Overage is reported only during the LAST 24 HOURS of each billing period, so rides cancelled earlier in
// the month are already out of the count and nothing needs refunding. It still runs hourly through that
// window (and sends only the new overage since the last report), so a ride added late is still caught
// before Stripe closes the invoice about an hour after the period ends. Anything reported after the
// period ends would land on the next invoice, which is why the window is a full day.
// A ride cancelled inside that final day can be credited by hand in Stripe (credit note).
const REPORT_WINDOW_SECONDS = 24 * 3600;
const Stripe = require('stripe');
const { adminClient } = require('../../lib/security');
const { PLANS, METER_EVENT_NAME } = require('../../lib/plans');
const { COUNTED_STATUSES } = require('../../lib/billing');

function periodOf(sub) {
  const item = sub.items && sub.items.data && sub.items.data[0];
  const start = sub.current_period_start || (item && item.current_period_start);
  const end = sub.current_period_end || (item && item.current_period_end);
  return start && end ? { start, end } : null;
}

module.exports = async function handler(req, res) {
  const auth = req.headers['authorization'] || '';
  if (!process.env.CRON_SECRET || auth !== 'Bearer ' + process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(200).json({ success: true, skipped: 'no stripe key' });
  try {
    const sb = adminClient();
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { data: rows, error } = await sb.from('facility_billing')
      .select('hospital_id, stripe_customer_id, plan, overage_period_start, overage_reported')
      .in('plan', ['essential', 'professional']).not('stripe_customer_id', 'is', null);
    if (error) return res.status(500).json({ error: 'Query failed. Has the plan checkout SQL been run?' });

    let reported = 0, checked = 0;
    for (const row of rows || []) {
      try {
        const plan = PLANS[row.plan];
        const overagePrice = plan && process.env[plan.overage_env];
        if (!plan || !overagePrice) continue;
        const subs = await stripe.subscriptions.list({ customer: row.stripe_customer_id, status: 'active', limit: 5 });
        const sub = subs.data.find((x) => x.items.data.some((i) => i.price && i.price.id === overagePrice));
        if (!sub) continue;
        const period = periodOf(sub);
        if (!period) continue;
        // Not the last day of the period yet: nothing to report.
        if (Math.floor(Date.now() / 1000) < period.end - REPORT_WINDOW_SECONDS) continue;
        checked++;
        const startIso = new Date(period.start * 1000).toISOString();
        const endIso = new Date(period.end * 1000).toISOString();
        const { count } = await sb.from('rides').select('id', { count: 'exact', head: true })
          .eq('hospital_id', row.hospital_id).in('status', COUNTED_STATUSES).gte('pickup_time', startIso).lt('pickup_time', endIso);
        const over = Math.max(0, (count || 0) - plan.rides);
        const sameMonth = row.overage_period_start && new Date(row.overage_period_start).toISOString() === startIso;
        const already = sameMonth ? (row.overage_reported || 0) : 0;
        const delta = over - already;
        if (delta > 0) {
          await stripe.billing.meterEvents.create({
            event_name: METER_EVENT_NAME,
            payload: { stripe_customer_id: row.stripe_customer_id, value: String(delta) },
            identifier: 'ov-' + row.hospital_id + '-' + period.start + '-' + over,
          });
          reported += delta;
        }
        if (delta > 0 || !sameMonth) {
          await sb.from('facility_billing').update({ overage_period_start: startIso, overage_reported: Math.max(over, already) }).eq('hospital_id', row.hospital_id);
        }
      } catch (e) { console.error('report-overage', row.hospital_id, e.message); }
    }
    return res.status(200).json({ success: true, checked, reported_rides: reported });
  } catch (e) {
    console.error('report-overage', e.message);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};
