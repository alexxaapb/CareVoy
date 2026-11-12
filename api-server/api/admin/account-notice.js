'use strict';
// Admin-only. Emails a facility or transport partner when its account is deactivated or deleted.
//  POST { action:'lookup', type:'facility'|'nemt', ids:[...] }               -> { recipients:[{name,email}] }
//  POST { action:'send', type, kind:'deactivated'|'deleted', recipients:[{name,email}] } -> { sent }
// The admin page looks contacts up BEFORE the change (a deleted row has no contact left),
// then sends after the change succeeded. Nothing here changes any account.
const { getCaller, adminClient, escHtml } = require('../../lib/security');

const EMAIL_RE = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;

function html(name, kind) {
  const what = kind === 'deleted' ? 'has been removed from CareVoy' : 'has been deactivated';
  const next = kind === 'deleted'
    ? 'You will no longer be able to sign in, and rides can no longer be booked for this account.'
    : 'You will not be able to receive new rides or book new rides until it is turned back on. Existing records are kept.';
  return '<div style="font-family:sans-serif;max-width:520px;margin:0 auto">' +
    '<div style="background:#050D1F;padding:20px 24px;border-radius:14px 14px 0 0"><span style="color:#fff;font-size:18px;font-weight:700">CareVoy</span></div>' +
    '<div style="background:#fff;border-radius:0 0 14px 14px;padding:28px;border:1px solid #E2E8F0;border-top:none">' +
    '<h1 style="font-size:19px;color:#050D1F;margin:0 0 12px">Account update</h1>' +
    '<p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px">Hi ' + escHtml(name || 'there') + ',<br><br>Your CareVoy account ' + what + '. ' + next + '</p>' +
    '<p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 16px">If you think this is a mistake or have questions, reply to this email or write to <a href="mailto:support@carevoy.co" style="color:#00C2A8;text-decoration:none">support@carevoy.co</a>.</p>' +
    '<div style="margin-top:24px;padding-top:18px;border-top:1px solid #F0F4F8;font-size:11px;color:#B0B7C3">This is an automated message from CareVoy.</div></div></div>';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });
    if (!caller.isAdmin) return res.status(403).json({ error: 'Forbidden' });
    const b = req.body || {};
    const type = b.type === 'nemt' ? 'nemt' : b.type === 'facility' ? 'facility' : null;
    if (!type) return res.status(400).json({ error: 'Bad type' });

    if (b.action === 'lookup') {
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter((i) => ID_RE.test(i)).slice(0, 200);
      if (!ids.length) return res.status(200).json({ recipients: [] });
      const sb = adminClient();
      const out = new Map();
      const add = (name, email) => { const e = String(email || '').trim().toLowerCase(); if (EMAIL_RE.test(e) && !out.has(e)) out.set(e, { name: name || '', email: e }); };
      if (type === 'facility') {
        const { data: hs } = await sb.from('hospitals').select('id, name, contact_email').in('id', ids);
        (hs || []).forEach((h) => add(h.name, h.contact_email));
        const { data: cs } = await sb.from('hospital_coordinators').select('hospital_id, full_name, email').in('hospital_id', ids);
        (cs || []).forEach((c) => add(c.full_name, c.email));
      } else {
        const { data: ps } = await sb.from('nemt_partners').select('id, company_name, contact_email').in('id', ids);
        (ps || []).forEach((p) => add(p.company_name, p.contact_email));
      }
      return res.status(200).json({ recipients: Array.from(out.values()) });
    }

    if (b.action === 'send') {
      const kind = b.kind === 'deleted' ? 'deleted' : b.kind === 'deactivated' ? 'deactivated' : null;
      if (!kind) return res.status(400).json({ error: 'Bad kind' });
      const list = (Array.isArray(b.recipients) ? b.recipients : []).slice(0, 100)
        .filter((r) => r && EMAIL_RE.test(String(r.email || '')));
      if (!list.length || !process.env.RESEND_API_KEY) return res.status(200).json({ sent: 0 });
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      let sent = 0;
      for (const r of list) {
        try {
          const o = await resend.emails.send({
            from: 'CareVoy <partners@carevoy.co>', to: [String(r.email)],
            subject: kind === 'deleted' ? 'Your CareVoy account has been removed' : 'Your CareVoy account has been deactivated',
            html: html(String(r.name || '').slice(0, 120), kind),
          });
          if (!(o && o.error)) sent++;
        } catch (_) {}
      }
      return res.status(200).json({ sent });
    }
    return res.status(400).json({ error: 'Bad action' });
  } catch (e) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
};
