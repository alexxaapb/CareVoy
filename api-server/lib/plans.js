'use strict';
// CareVoy plans, priced by monthly ride volume. Prices live in Stripe: create one recurring
// monthly price per plan and put its id in the Vercel setting named in price_env.
// Enterprise (800+ rides a month) is custom and is never sold online.
const PLANS = {
  starter:      { label: 'Starter',      rides: 75,  cents: 89900,  price_label: '$899',   price_env: 'STRIPE_PRICE_STARTER',      best_for: 'Independent practices, occasional coordination' },
  essential:    { label: 'Essential',    rides: 300, cents: 199900, price_label: '$1,999', price_env: 'STRIPE_PRICE_ESSENTIAL',    best_for: 'Growing facilities, multi-provider practices' },
  professional: { label: 'Professional', rides: 800, cents: 449900, price_label: '$4,499', price_env: 'STRIPE_PRICE_PROFESSIONAL', best_for: 'High-volume facilities: dialysis, larger assisted living' },
};
// The ride-volume choice on the signup form -> the plan that fits.
function tierForBand(band) {
  if (band === 'up_to_75') return 'starter';
  if (band === '75_300') return 'essential';
  if (band === '300_800') return 'professional';
  if (band === '800_2000' || band === '2000_plus') return 'enterprise';
  return 'starter';
}
module.exports = { PLANS, tierForBand };
