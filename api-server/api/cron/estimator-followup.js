'use strict';
// Daily: for estimator visitors who typed their email but never pressed Send.
// Looks at leads saved 24 hours to 14 days ago that are still 'started', not unsubscribed and
// not reminded yet. Sends each one reminder (with a link that reopens their numbers and an
// unsubscribe link), then emails partners@carevoy.co one list. CRON_SECRET bearer auth.
const { adminClient, escHtml } = require('../../lib/security');

module.exports = async function handler(req, res) {
  const auth = req.headers['authorization'] || '';
  if (!process.env.CRON_SECRET || auth !== 'Bearer ' + process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.RESEND_API_KEY) return res.status(200).json({ success: true, skipped: 'no email key' });
  try {
    const sb = adminClient();
    const now = Date.now();
    const { data: leads, error } = await sb.from('estimator_leads').select('*')
      .eq('status', 'started').eq('unsubscribed', false).is('reminded_at', null)
      .lte('updated_at', new Date(now - 24 * 3600 * 1000).toISOString())
      .gte('updated_at', new Date(now - 14 * 86400000).toISOString()).limit(100);
    if (error) return res.status(500).json({ error: 'Query failed' });
    const send = body => fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ from: 'CareVoy <partners@carevoy.co>' }, body)),
    });
    const shell = inner => '<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><div style="background:#060D1F;padding:20px;border-radius:12px 12px 0 0"><span style="color:#00C2A8;font-weight:700;font-size:18px">CareVoy</span></div><div style="background:#fff;border:1px solid #E2E8F0;padding:24px;border-radius:0 0 12px 12px">' + inner + '</div></div>';
    let reminded = 0; const lines = [];
    for (const l of leads || []) {
      // Mark first so a failure can never cause a repeat email.
      await sb.from('estimator_leads').update({ reminded_at: new Date().toISOString() }).eq('id', l.id);
      const resume = 'https://partners.carevoy.co/estimator?r=' + l.token;
      const unsub = 'https://care-voy-api-server.vercel.app/api/public/estimator-unsubscribe?token=' + l.token;
      const r = await send({
        to: [l.email], reply_to: 'partners@carevoy.co', subject: 'Finish your CareVoy Ride Opportunity Snapshot',
        html: shell('<h2 style="color:#060D1F;font-size:18px;margin:0 0 12px">Your snapshot is almost done</h2><p style="color:#374151;font-size:14px;line-height:1.6">You started a Ride Opportunity Snapshot yesterday. Your numbers are saved. Pick up where you left off and press Send, and we will follow up within two business days.</p><a href="' + escHtml(resume) + '" style="display:inline-block;background:#060D1F;color:#00C2A8;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">Finish my snapshot</a><p style="color:#9CA3AF;font-size:12px;margin-top:24px">This is the only reminder we will send. <a href="' + escHtml(unsub) + '" style="color:#9CA3AF">Unsubscribe</a> &middot; CareVoy, partners@carevoy.co</p>'),
      }).catch(() => null);
      if (r && r.ok) reminded++;
      lines.push('<li>' + escHtml(l.facility_name || '(no name)') + ' &middot; ' + escHtml(l.contact_name || '') + ' &lt;' + escHtml(l.email) + '&gt; &middot; ' + (l.appointments || '?') + ' appts/yr</li>');
    }
    if (lines.length) {
      await send({ to: ['partners@carevoy.co'], subject: 'Estimator: ' + lines.length + ' started but did not send',
        html: shell('<h2 style="color:#060D1F;font-size:18px;margin:0 0 12px">Started, never sent</h2><p style="color:#374151;font-size:14px">Each got one reminder email. You can reach out too:</p><ul style="font-size:14px;line-height:1.7">' + lines.join('') + '</ul>') }).catch(() => {});
    }
    return res.status(200).json({ success: true, reminded, found: (leads || []).length });
  } catch (e) { return res.status(500).json({ error: 'Something went wrong' }); }
};
