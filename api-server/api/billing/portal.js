'use strict';
// POST /api/billing/portal
// Opens the Stripe Customer Portal so a facility can update its card, see
// invoices, and upgrade or downgrade (plans offered are whatever you enable
// in Stripe > Settings > Billing > Customer portal).
const Stripe = require('stripe');
const { getCaller, adminClient } = require('../../lib/security');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const caller = await getCaller(req);
    const hid = caller && caller.coordinator && caller.coordinator.hospital_id;
    if (!hid) return res.status(403).json({ error: 'Only facility coordinators can manage billing' });
    if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Billing is not set up yet. Please email partners@carevoy.co.' });

    const { data: bill, error } = await adminClient()
      .from('facility_billing').select('stripe_customer_id').eq('hospital_id', hid).maybeSingle();
    if (error || !bill || !bill.stripe_customer_id) {
      return res.status(409).json({ error: 'Your billing account is not linked yet. Please email partners@carevoy.co.' });
    }
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({
      customer: bill.stripe_customer_id,
      return_url: 'https://partners.carevoy.co/coordinator.html#billing',
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('billing/portal', e.message);
    return res.status(500).json({ error: 'Could not open billing portal' });
  }
};
