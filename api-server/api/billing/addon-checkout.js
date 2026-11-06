'use strict';
// POST /api/billing/addon-checkout   body: { addon: 'ehr_sync' | 'calendar_sync' }
// Starts a Stripe Checkout subscription for one add-on. The add-on turns on
// when Stripe tells us (webhook) that the subscription is active.
const Stripe = require('stripe');
const { getCaller, adminClient } = require('../../lib/security');
const { ADDONS } = require('../../lib/billing');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const caller = await getCaller(req);
    const hid = caller && caller.coordinator && caller.coordinator.hospital_id;
    if (!hid) return res.status(403).json({ error: 'Only facility coordinators can add features' });

    const key = req.body && req.body.addon;
    const addon = ADDONS[key];
    if (!addon) return res.status(400).json({ error: 'Unknown add-on' });
    const priceId = process.env[addon.price_env];
    if (!process.env.STRIPE_SECRET_KEY || !priceId) {
      return res.status(503).json({ error: addon.label + ' is not available to order online yet. Please email partners@carevoy.co.' });
    }
    const sb = adminClient();
    const { data: bill } = await sb.from('facility_billing')
      .select('stripe_customer_id, addons').eq('hospital_id', hid).maybeSingle();
    if (!bill || !bill.stripe_customer_id) {
      return res.status(409).json({ error: 'Your billing account is not linked yet. Please email partners@carevoy.co.' });
    }
    if ((bill.addons || []).includes(key)) return res.status(409).json({ error: 'Already active' });

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const meta = { hospital_id: hid, addon: key, kind: 'addon' };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: bill.stripe_customer_id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: meta },
      metadata: meta,
      success_url: 'https://partners.carevoy.co/coordinator.html?addon=success#billing',
      cancel_url: 'https://partners.carevoy.co/coordinator.html#billing',
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('billing/addon-checkout', e.message);
    return res.status(500).json({ error: 'Could not start checkout' });
  }
};
