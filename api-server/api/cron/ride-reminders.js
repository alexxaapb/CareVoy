// Runs every hour (see vercel.json). Texts the person who booked the ride:
//   - "day before": rides starting in 12-30 hours, sent only between 8am and 9pm local time
//   - "hour before": rides starting in 15-90 minutes
// Each ride gets each text once (reminder_day_sent_at / reminder_hour_sent_at).
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { sendSms, tzForState, localTime, localDay, localHour } = require('../../lib/sms');

const ELIGIBLE = ['assigned', 'confirmed'];
const COLS = 'id, pickup_time, contact_phone, hospital_state, status, reminder_day_sent_at, reminder_hour_sent_at';

module.exports = async function handler(req, res) {
  const authHeader = req.headers['authorization'] || '';
  if (!process.env.CRON_SECRET || authHeader !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { realtime: { transport: ws } });
  const now = Date.now();
  const iso = function (ms) { return new Date(now + ms).toISOString(); };
  const out = { day: 0, hour: 0 };

  try {
    // Day before
    const { data: dayRides, error: e1 } = await sb.from('rides').select(COLS)
      .in('status', ELIGIBLE).is('reminder_day_sent_at', null)
      .gte('pickup_time', iso(12 * 3600e3)).lte('pickup_time', iso(30 * 3600e3));
    if (e1) throw e1;
    for (const r of dayRides || []) {
      const tz = tzForState(r.hospital_state);
      const h = localHour(now, tz);
      if (h < 8 || h >= 21) continue; // quiet hours; a later run will pick it up
      if (!r.contact_phone) continue;
      const ok = await sendSms(r.contact_phone,
        'CareVoy: your ride is scheduled for ' + localDay(r.pickup_time, tz) + ' at ' + localTime(r.pickup_time, tz) + '. Reply STOP to opt out.');
      if (ok) { await sb.from('rides').update({ reminder_day_sent_at: new Date().toISOString() }).eq('id', r.id); out.day++; }
    }

    // Hour before
    const { data: hourRides, error: e2 } = await sb.from('rides').select(COLS)
      .in('status', ELIGIBLE).is('reminder_hour_sent_at', null)
      .gte('pickup_time', iso(15 * 60e3)).lte('pickup_time', iso(90 * 60e3));
    if (e2) throw e2;
    for (const r of hourRides || []) {
      const tz = tzForState(r.hospital_state);
      if (!r.contact_phone) continue;
      const ok = await sendSms(r.contact_phone,
        'CareVoy: your ride pickup is at ' + localTime(r.pickup_time, tz) + ' today. Please be ready. Reply STOP to opt out.');
      if (ok) { await sb.from('rides').update({ reminder_hour_sent_at: new Date().toISOString() }).eq('id', r.id); out.hour++; }
    }
    return res.status(200).json({ success: true, sent: out });
  } catch (e) {
    console.error('Ride reminder cron error:', e);
    return res.status(500).json({ error: 'Could not run ride reminders' });
  }
};
