'use strict';
// POST /api/billing/plan-checkout   body: { tier: 'starter'|'essential'|'professional', accept_terms: true }
// For a facility that signed up on its own and has not paid yet. Records that they accepted the
// terms, then starts a Stripe Checkout subscription for the plan. The portal opens when Stripe tells
// us (webhook) that the payment went through.
const Stripe = require('stripe');
const { getCaller, adminClient } = require('../../lib/security');
const { PLANS } = require('../../lib/plans');
const { loadBilling } = require('../../lib/billing');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const caller = await getCaller(req);
    const hid = caller && caller.coordinator && caller.coordinator.hospital_id;
    if (!hid) return res.status(403).json({ error: 'Only facility coordinators can choose a plan' });

    const tier = req.body && req.body.tier;
    const plan = PLANS[tier];
    if (!plan) return res.status(400).json({ error: 'Please choose a plan' });
    if (!(req.body && req.body.accept_terms === true)) return res.status(400).json({ error: 'Please accept the terms to continue' });

    const billing = await loadBilling(null, hid);
    if (!billing.signup || !billing.signup.needs_plan) return res.status(409).json({ error: 'Your plan is already set up' });

    const priceId = process.env[plan.price_env];
    if (!process.env.STRIPE_SECRET_KEY || !priceId) {
      return res.status(503).json({ error: 'Online checkout for this plan is not ready yet. Please email partners@carevoy.co.' });
    }

    const sb = adminClient();
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { data: row } = await sb.from('facility_billing').select('stripe_customer_id').eq('hospital_id', hid).maybeSingle();
    let customerId = row && row.stripe_customer_id;
    if (!customerId) {
      const email = (caller.coordinator && caller.coordinator.email) || (caller.user && caller.user.email) || undefined;
      const c = await stripe.customers.create({ email, name: billing.facility || undefined, metadata: { hospital_id: hid } });
      customerId = c.id;
    }
    const who = (caller.coordinator && caller.coordinator.email) || (caller.user && caller.user.email) || '';
    const { error: upErr } = await sb.from('facility_billing').upsert({
      hospital_id: hid, stripe_customer_id: customerId, plan: tier,
      terms_accepted_at: new Date().toISOString(), terms_accepted_by: who, updated_at: new Date().toISOString(),
    }, { onConflict: 'hospital_id' });
    if (upErr) {
      console.error('billing/plan-checkout upsert', upErr.message);
      return res.status(500).json({ error: 'Could not start checkout. Has the plan checkout SQL been run?' });
    }

    const lineItems = [{ price: priceId, quantity: 1 }];
    // Essential and Professional also get the pay-per-ride overage price (metered, billed in arrears).
    if (plan.overage_env && process.env[plan.overage_env]) lineItems.push({ price: process.env[plan.overage_env] });
    const meta = { hospital_id: hid, tier, kind: 'plan' };
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: lineItems,
      subscription_data: { metadata: meta },
      metadata: meta,
      allow_promotion_codes: true,
      success_url: 'https://partners.carevoy.co/coordinator.html?plan=success',
      cancel_url: 'https://partners.carevoy.co/coordinator.html',
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('billing/plan-checkout', e.message);
    return res.status(500).json({ error: 'Could not start checkout' });
  }
};
