'use strict';
// Billing helpers: what plan a facility is on, what it has used this month,
// which add-ons it has, and whether a feature is unlocked.
//
// Nothing here changes behavior until the facility_billing table exists, and
// add-on locking stays OFF until ENFORCE_ADDONS=true is set in Vercel.

const { adminClient } = require('./security');

const TIER_LABELS = { starter: 'Starter', essential: 'Essential', professional: 'Professional' };

// Add-ons a facility can buy. price_env names the Vercel setting that holds the
// Stripe price id; with no price id set, the add-on cannot be bought online.
const ADDONS = {
  ehr_sync: {
    label: 'Native EHR Sync',
    blurb: 'Find patients in your EHR and book rides without retyping.',
    price_label: '$199/mo',
    price_env: 'STRIPE_PRICE_EHR_SYNC',
  },
  calendar_sync: {
    label: 'Calendar Sync',
    blurb: 'Spot appointments on your calendar that need a ride and book them in one click.',
    price_label: null,
    price_env: 'STRIPE_PRICE_CALENDAR_SYNC',
  },
};

// Statuses that count as a real ride toward the monthly limit.
const COUNTED_STATUSES = ['confirmed', 'assigned', 'en_route', 'arrived', 'in_progress', 'completed'];
const ACTIVE_SUB_STATUSES = ['active', 'trialing', 'past_due'];

function enforcementOn() {
  return process.env.ENFORCE_ADDONS === 'true';
}

function monthRangeUTC(now) {
  const d = now || new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

async function loadBilling(sb, hospitalId) {
  const client = sb || adminClient();
  const [hospRes, billRes] = await Promise.all([
    client.from('hospitals').select('name, tier').eq('id', hospitalId).maybeSingle(),
    client.from('facility_billing').select('*').eq('hospital_id', hospitalId).maybeSingle(),
  ]);
  const hospital = hospRes.data || {};
  // If the table has not been created yet, billRes.error is set: treat as "not set up".
  const bill = billRes.error ? null : (billRes.data || null);

  const { start, end } = monthRangeUTC();
  let used = null;
  try {
    const { count } = await client
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .eq('hospital_id', hospitalId)
      .in('status', COUNTED_STATUSES)
      .gte('pickup_time', start)
      .lt('pickup_time', end);
    used = typeof count === 'number' ? count : null;
  } catch (e) { used = null; }

  const owned = (bill && bill.addons) || [];
  const hasCustomer = !!(bill && bill.stripe_customer_id);
  const addons = Object.keys(ADDONS).map((key) => ({
    key,
    label: ADDONS[key].label,
    blurb: ADDONS[key].blurb,
    price_label: ADDONS[key].price_label,
    active: owned.includes(key),
    can_buy_online: hasCustomer && !!process.env[ADDONS[key].price_env] && !owned.includes(key),
  }));

  const tier = hospital.tier || 'starter';
  return {
    facility: hospital.name || '',
    plan: { tier, label: TIER_LABELS[tier] || (tier.charAt(0).toUpperCase() + tier.slice(1)) },
    subscription_status: bill ? bill.subscription_status || null : null,
    renews_on: bill ? bill.current_period_end || null : null,
    rides_this_month: used,
    ride_limit: bill ? bill.ride_limit || null : null,
    contract: bill ? {
      start: bill.contract_start || null,
      end: bill.contract_end || null,
      monthly_price_cents: bill.monthly_price_cents || null,
    } : null,
    addons,
    billing_set_up: hasCustomer,
    enforcement_on: enforcementOn(),
  };
}

// Is this add-on unlocked for the caller's facility?
// Admins always pass. While ENFORCE_ADDONS is not "true", everyone passes.
async function requireAddon(caller, addonKey) {
  if (!enforcementOn()) return { ok: true };
  if (caller && caller.isAdmin) return { ok: true };
  const hid = caller && caller.coordinator && caller.coordinator.hospital_id;
  if (!hid) return { ok: false };
  const b = await loadBilling(null, hid);
  const a = b.addons.find((x) => x.key === addonKey);
  return { ok: !!(a && a.active) };
}

// Which EHR (and practice) a facility is connected to. Empty values mean "not connected".
async function loadEhrConfig(hospitalId) {
  const { data, error } = await adminClient()
    .from('facility_billing').select('ehr_system, ehr_practice_id').eq('hospital_id', hospitalId).maybeSingle();
  if (error || !data) return { system: null, practiceId: null };
  return { system: data.ehr_system || null, practiceId: data.ehr_practice_id || null };
}

module.exports = { ADDONS, TIER_LABELS, ACTIVE_SUB_STATUSES, enforcementOn, loadBilling, loadEhrConfig, requireAddon, monthRangeUTC };
