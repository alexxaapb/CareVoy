'use strict';
// POST /api/feedback/feature-request   body: { message, page }
// A logged-in coordinator, NEMT partner or admin sends a feature idea from the
// portal. It is emailed to partners@carevoy.co (reply goes to the sender) and
// saved in the audit log, so no new database table is needed.
// Limit: 5 requests per person per 24 hours.

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { getCaller, escHtml } = require('../../lib/security');

const MAX_LEN = 2000;
const DAILY_LIMIT = 5;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });

    const message = String((req.body && req.body.message) || '').trim();
    const page = String((req.body && req.body.page) || '').slice(0, 60);
    if (message.length < 5) return res.status(400).json({ error: 'Please write a few words about the feature.' });
    if (message.length > MAX_LEN) return res.status(400).json({ error: 'Please keep it under ' + MAX_LEN + ' characters.' });

    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { realtime: { transport: ws } }
    );

    // Simple per-person daily limit so the box cannot be used to flood your inbox.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await sb
      .from('audit_log')
      .select('id', { count: 'exact', head: true })
      .eq('actor_id', caller.user.id)
      .eq('action', 'feedback.feature_request')
      .gte('created_at', since);
    if ((count || 0) >= DAILY_LIMIT) {
      return res.status(429).json({ error: 'You have sent several requests today. Please try again tomorrow, or email partners@carevoy.co.' });
    }

    // Who is sending it
    let role = caller.isAdmin ? 'Admin' : (caller.staff && caller.staff.role === 'nemt' ? 'NEMT partner' : (caller.coordinator ? 'Facility coordinator' : 'User'));
    let org = '';
    try {
      if (caller.coordinator && caller.coordinator.hospital_id) {
        const { data: h } = await sb.from('hospitals').select('name').eq('id', caller.coordinator.hospital_id).maybeSingle();
        org = h ? h.name : '';
      } else if (caller.staff && caller.staff.nemt_partner_id) {
        const { data: p } = await sb.from('nemt_partners').select('company_name').eq('id', caller.staff.nemt_partner_id).maybeSingle();
        org = p ? p.company_name : '';
      }
    } catch (e) { /* org name is a nice-to-have */ }
    const email = caller.user.email || '';

    let sent = false;
    if (process.env.RESEND_API_KEY) {
      const html = '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">' +
        '<h2 style="color:#050D1F;font-size:18px;margin:0 0 12px">New feature request</h2>' +
        '<p style="color:#374151;font-size:14px;margin:0 0 4px"><strong>From:</strong> ' + escHtml(email) + ' (' + escHtml(role) + (org ? ', ' + escHtml(org) : '') + ')</p>' +
        '<p style="color:#374151;font-size:14px;margin:0 0 16px"><strong>Page:</strong> ' + escHtml(page || 'not given') + '</p>' +
        '<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;color:#050D1F;font-size:14px;line-height:1.6;white-space:pre-wrap">' + escHtml(message) + '</div>' +
        '</div>';
      const body = {
        from: 'CareVoy Portal <notifications@carevoy.co>',
        to: ['partners@carevoy.co'],
        subject: 'Feature request' + (org ? ' from ' + org : ''),
        html,
      };
      if (email) body.reply_to = email;
      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        sent = r.ok;
      } catch (e) { console.warn('feature request email failed:', e.message); }
    }

    // Always keep a record, even if the email did not go out.
    await sb.from('audit_log').insert({
      actor_id: caller.user.id,
      actor_role: role,
      action: 'feedback.feature_request',
      entity_type: 'feedback',
      new_value: { message, page, org, email_sent: sent },
    });

    return res.status(200).json({ success: true, emailed: sent });
  } catch (e) {
    console.error('feature-request error:', e);
    return res.status(500).json({ error: 'Could not send. Please email partners@carevoy.co.' });
  }
};
