'use strict';
// POST /api/public/estimator-submit
// Public (no login). A facility submits the counts from partners.carevoy.co/estimator.
// body: { appointments, pct_commercial, pct_medicare, pct_medicaid, pct_selfpay, pct_need_ride,
//         facility_name, visit_types, contact_name, contact_email, website }
// Counts only, no patient data. Emails the numbers to partners@carevoy.co (reply goes to the
// facility) and sends the facility a copy. No database table, so no SQL to run.
// "website" is a hidden trap field: real people leave it empty.

const { escHtml, adminClient } = require('../../lib/security');
const { hit, clientIp } = require('../../lib/ratelimit');
const { upsertLead } = require('../../lib/estimator-leads');

// A facility "qualifies" at this many likely rides per year (about 10 a month).
// Keep in sync with QUALIFY_RIDES in partners-portal/estimator.html.
const QUALIFY_RIDES = 120;

function pct(v) { const n = parseFloat(v); return isFinite(n) ? Math.min(Math.max(n, 0), 100) : 0; }
function clean(v, max) { return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max); }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const b = req.body || {};
    if (b.website) return res.status(200).json({ success: true }); // bot trap: pretend it worked

    if (await hit(adminClient(), 'ip:' + clientIp(req), 'estimator_submit', 5, 3600000)) {
      return res.status(429).json({ error: 'Too many submissions. Please try again later or email partners@carevoy.co.' });
    }

    const email = clean(b.contact_email, 120);
    if (!/^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email so we can send your snapshot.' });
    }
    const appts = Math.min(Math.max(Math.round(parseFloat(b.appointments) || 0), 0), 100000000);
    if (appts <= 0) return res.status(400).json({ error: 'Please enter your appointments per year.' });

    const p = [pct(b.pct_commercial), pct(b.pct_medicare), pct(b.pct_medicaid), pct(b.pct_selfpay)];
    const sum = p[0] + p[1] + p[2] + p[3];
    if (sum <= 0) return res.status(400).json({ error: 'Please enter the share of appointments paid by each source.' });
    const shares = p.map(v => v / sum * 100);
    const need = pct(b.pct_need_ride);
    const rides = Math.round(appts * need / 100);
    const oop = Math.round(rides * shares[3] / 100);
    const qualifies = rides >= QUALIFY_RIDES;

    const name = clean(b.contact_name, 80), facility = clean(b.facility_name, 100), visits = clean(b.visit_types, 120);
    const r1 = n => (Math.round(n * 10) / 10) + '%';
    const rows = [
      ['Facility', facility || '(not given)'], ['Contact', (name || '(not given)') + ' <' + email + '>'],
      ['Appointments per year', appts.toLocaleString('en-US')],
      ['Commercial', r1(shares[0])], ['Medicare', r1(shares[1])], ['Medicaid', r1(shares[2])], ['Self-pay', r1(shares[3])],
      ['Needing a ride', r1(need)], ['Likely rides per year', rides.toLocaleString('en-US')],
      ['Out-of-pocket rides per year', oop.toLocaleString('en-US')], ['Common visit types', visits || '(not given)'],
      ['Meets ' + QUALIFY_RIDES + '-ride threshold', qualifies ? 'YES' : 'No'],
    ];
    const table = '<table style="border-collapse:collapse;font-size:14px;width:100%">' + rows.map(r =>
      '<tr><td style="padding:6px 10px;border-bottom:1px solid #E4E4E7;color:#4B5563">' + escHtml(r[0]) + '</td><td style="padding:6px 10px;border-bottom:1px solid #E4E4E7;font-weight:600;color:#060D1F">' + escHtml(r[1]) + '</td></tr>').join('') + '</table>';
    const shell = (title, inner) => '<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><div style="background:#060D1F;padding:20px;border-radius:12px 12px 0 0"><span style="color:#00C2A8;font-weight:700;font-size:18px">CareVoy</span></div><div style="background:#fff;border:1px solid #E2E8F0;padding:24px;border-radius:0 0 12px 12px"><h2 style="color:#060D1F;font-size:18px;margin:0 0 14px">' + title + '</h2>' + inner + '</div></div>';

    if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Could not send right now. Please email partners@carevoy.co.' });
    const send = body => fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ from: 'CareVoy <partners@carevoy.co>' }, body)),
    });

    const adminRes = await send({
      to: ['partners@carevoy.co'], reply_to: email,
      subject: (qualifies ? 'QUALIFIED lead: ' : 'Estimator submission: ') + (facility || email),
      html: shell('New estimator submission', table),
    });
    if (!adminRes.ok) return res.status(500).json({ error: 'Could not send right now. Please email partners@carevoy.co.' });

    // Copy to the facility (best effort)
    await send({
      to: [email], reply_to: 'partners@carevoy.co',
      subject: 'Your CareVoy Ride Opportunity Snapshot',
      html: shell('We received your numbers', '<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 14px">Thank you. Here is what you sent. We will follow up within two business days.</p>' + table +
        '<p style="color:#9CA3AF;font-size:12px;margin-top:18px">Questions? Reply to this email or write partners@carevoy.co</p>'),
    }).catch(() => {});

    // Mark them as sent so no reminder goes out (best effort: ignored if the leads table is not set up yet).
    await upsertLead(adminClient(), email, { appointments: appts, pct_commercial: p[0], pct_medicare: p[1], pct_medicaid: p[2], pct_selfpay: p[3], pct_need_ride: need, contact_name: name, facility_name: facility, visit_types: visits }, true).catch(() => {});

    return res.status(200).json({ success: true, qualifies, rides, out_of_pocket_rides: oop });
  } catch (e) {
    return res.status(500).json({ error: 'Could not send right now. Please email partners@carevoy.co.' });
  }
};
