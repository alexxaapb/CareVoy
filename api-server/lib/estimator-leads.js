'use strict';
// Shared helpers for the estimator follow-up (save, resume, unsubscribe, reminder).
const FIELDS = ['contact_name', 'facility_name', 'visit_types'];
function pct(v) { const n = parseFloat(v); return isFinite(n) ? Math.min(Math.max(n, 0), 100) : null; }
function clean(v, max) { return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max); }
function validEmail(e) { return /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/.test(String(e || '')); }
function row(b) {
  const a = parseFloat(b.appointments);
  return {
    contact_name: clean(b.contact_name, 80), facility_name: clean(b.facility_name, 100), visit_types: clean(b.visit_types, 120),
    appointments: isFinite(a) ? Math.min(Math.max(Math.round(a), 0), 100000000) : null,
    pct_commercial: pct(b.pct_commercial), pct_medicare: pct(b.pct_medicare), pct_medicaid: pct(b.pct_medicaid),
    pct_selfpay: pct(b.pct_selfpay), pct_need_ride: pct(b.pct_need_ride),
  };
}
// Save or update the lead for this email. Never moves a 'sent' lead back to 'started'.
async function upsertLead(sb, email, b, sent) {
  const e = clean(email, 120).toLowerCase();
  const { data: ex, error } = await sb.from('estimator_leads').select('id, status').ilike('email', e).maybeSingle();
  if (error) return null;
  const now = new Date().toISOString();
  const vals = Object.assign(row(b), { updated_at: now });
  if (sent) { vals.status = 'sent'; vals.sent_at = now; }
  if (ex) {
    if (ex.status === 'sent' && !sent) delete vals.status;
    const { data } = await sb.from('estimator_leads').update(vals).eq('id', ex.id).select('token').maybeSingle();
    return data;
  }
  const { data } = await sb.from('estimator_leads').insert(Object.assign({ email: e }, vals)).select('token').maybeSingle();
  return data;
}
module.exports = { upsertLead, validEmail, clean };
