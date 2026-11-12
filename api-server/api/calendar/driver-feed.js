'use strict';
// Calendar feed of a transport company's accepted rides (shows on drivers' own calendars).
//   GET  /api/calendar/driver-feed?token=SECRET   -> .ics calendar (what Google/Apple/Outlook subscribe to)
//   POST /api/calendar/driver-feed  { reset?: true }   (signed-in NEMT staff) -> { url }  creates or returns the secret link;
//        reset:true makes a new link and stops the old one working.
// The feed holds only a time, the pickup address and the drop-off address. No patient names.
const crypto = require('crypto');
const { getCaller, adminClient } = require('../../lib/security');

const LIVE = ['assigned', 'en_route', 'in_progress', 'arrived'];
const BASE = 'https://care-voy-api-server.vercel.app/api/calendar/driver-feed';

function esc(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function fold(line) {
  const out = []; let s = line;
  while (Buffer.byteLength(s) > 74) {
    let cut = 74; while (Buffer.byteLength(s.slice(0, cut)) > 74) cut--;
    out.push(s.slice(0, cut)); s = ' ' + s.slice(cut);
  }
  out.push(s); return out.join('\r\n');
}
function stamp(d) { return new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }

function buildIcs(rides) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CareVoy//Driver rides//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:CareVoy rides', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
  const now = stamp(Date.now());
  rides.forEach((r) => {
    const start = new Date(r.pickup_time);
    if (isNaN(start)) return;
    const end = new Date(start.getTime() + 60 * 60000);
    lines.push('BEGIN:VEVENT', 'UID:' + r.id + '@carevoy.co', 'DTSTAMP:' + now,
      'DTSTART:' + stamp(start), 'DTEND:' + stamp(end), 'SUMMARY:' + esc('CareVoy pickup'));
    if (r.pickup_address) lines.push('LOCATION:' + esc(r.pickup_address));
    lines.push('DESCRIPTION:' + esc('Drop-off: ' + (r.dropoff_address || 'see the CareVoy driver app') + '\nOpen the CareVoy driver app for details.'));
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const sb = adminClient();

    if (req.method === 'GET') {
      const token = String((req.query && req.query.token) || '');
      if (!/^[0-9a-f]{48}$/.test(token)) return res.status(404).send('Not found');
      const { data: t } = await sb.from('nemt_calendar_tokens').select('nemt_partner_id').eq('token', token).maybeSingle();
      if (!t) return res.status(404).send('Not found');
      const from = new Date(Date.now() - 86400000).toISOString();
      const to = new Date(Date.now() + 60 * 86400000).toISOString();
      const { data: rides } = await sb.from('rides').select('id, pickup_time, pickup_address, dropoff_address')
        .eq('nemt_partner_id', t.nemt_partner_id).in('status', LIVE)
        .gte('pickup_time', from).lte('pickup_time', to).order('pickup_time', { ascending: true }).limit(500);
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Cache-Control', 'private, max-age=300');
      return res.status(200).send(buildIcs(rides || []));
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });
    const pid = caller.staff && caller.staff.nemt_partner_id;
    if (!pid) return res.status(403).json({ error: 'Only transport company staff can use this' });
    const reset = !!(req.body && req.body.reset === true);

    let token = null;
    if (!reset) {
      const { data: ex } = await sb.from('nemt_calendar_tokens').select('token').eq('nemt_partner_id', pid).maybeSingle();
      token = ex && ex.token;
    }
    if (!token) {
      token = crypto.randomBytes(24).toString('hex');
      const { error } = await sb.from('nemt_calendar_tokens').upsert({ nemt_partner_id: pid, token, created_at: new Date().toISOString() }, { onConflict: 'nemt_partner_id' });
      if (error) return res.status(500).json({ error: 'Could not create the calendar link. Has the calendar SQL been run?' });
    }
    return res.status(200).json({ url: BASE + '?token=' + token });
  } catch (e) {
    console.error('calendar/driver-feed', e.message);
    return res.status(500).json({ error: 'Could not load the calendar' });
  }
};
