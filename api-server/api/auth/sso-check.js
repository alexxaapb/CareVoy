'use strict';
// POST /api/auth/sso-check   (Authorization: Bearer <token from a Google or Microsoft sign-in>)
// Decides whether a single-sign-on login may enter the coordinator portal.
// Allowed ONLY when ALL of these are true:
//   1. the provider says the email address is verified,
//   2. that email already belongs to a facility coordinator account (matched by account id),
//   3. the account is not an admin or NEMT account (those keep password login).
// Anyone else is refused, and an account that this sign-in just created for a stranger is removed.
const { getCaller, adminClient } = require('../../lib/security');

const SSO_PROVIDERS = ['google', 'azure'];

function emailVerified(user) {
  const meta = user.user_metadata || {};
  const idn = (user.identities || []).find((i) => SSO_PROVIDERS.includes(i.provider));
  const idVerified = idn && idn.identity_data && idn.identity_data.email_verified;
  // Fail closed: need the provider's own "verified" flag as well as Supabase's confirmation.
  return !!(user.email_confirmed_at && (idVerified === true || meta.email_verified === true));
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const refuse = (msg) => res.status(403).json({ ok: false, error: msg });
  try {
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const user = caller.user;
    const sb = adminClient();

    const providers = (user.identities || []).map((i) => i.provider);
    if (!providers.some((p) => SSO_PROVIDERS.includes(p))) return refuse('This sign-in method is not allowed.');

    if (!emailVerified(user)) {
      return refuse('Your email address could not be verified by ' + (providers.includes('azure') ? 'Microsoft' : 'Google') + '. Please sign in with your password.');
    }

    if (caller.isAdmin || (caller.staff && caller.staff.role)) {
      return refuse('This account must sign in with a password.');
    }

    if (caller.coordinator && caller.coordinator.hospital_id) {
      await sb.from('audit_log').insert({ actor_id: user.id, actor_role: 'coordinator', action: 'auth.sso_login', entity_type: 'user', entity_id: user.id, new_value: { provider: providers.find((p) => SSO_PROVIDERS.includes(p)) } }).then(() => {}, () => {});
      return res.status(200).json({ ok: true, role: 'coordinator' });
    }

    // Not a coordinator. If this very sign-in just created an empty account for them, remove it.
    try {
      const ageMs = Date.now() - new Date(user.created_at).getTime();
      if (ageMs < 5 * 60 * 1000) {
        const { data: pat } = await sb.from('patients').select('id').eq('id', user.id).maybeSingle();
        if (!pat) await sb.auth.admin.deleteUser(user.id);
      }
    } catch (e) { /* best effort */ }
    return refuse('There is no CareVoy facility account for this email. Ask your CareVoy contact to invite you.');
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'Something went wrong' });
  }
};
