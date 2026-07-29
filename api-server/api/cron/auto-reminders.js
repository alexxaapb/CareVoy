const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
, { realtime: { transport: ws } });

module.exports = async function handler(req, res) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

    const { data: rides, error } = await supabase
      .from('rides')
      .select('id')
      .in('status', ['invited', 'reminder_sent', 'no_response'])
      .is('auto_reminder_sent_at', null)
      .gte('pickup_time', windowStart.toISOString())
      .lte('pickup_time', windowEnd.toISOString());

    if (error) return res.status(500).json({ error: error.message });
    if (!rides || !rides.length) return res.status(200).json({ success: true, reminded: 0 });

    const baseUrl = process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://care-voy-api-server.vercel.app';
    let remindedCount = 0;

    for (const ride of rides) {
      try {
        await fetch(baseUrl + '/api/reminders/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ride_id: ride.id }),
        });
        await supabase.from('rides').update({ auto_reminder_sent_at: new Date().toISOString() }).eq('id', ride.id);
        remindedCount++;
      } catch (e) {
        console.error('Auto-reminder failed for ride ' + ride.id + ':', e.message);
      }
    }

    return res.status(200).json({ success: true, reminded: remindedCount, total_found: rides.length });
  } catch (e) {
    console.error('Auto-reminder cron error:', e);
    return res.status(500).json({ error: e.message });
  }
};
