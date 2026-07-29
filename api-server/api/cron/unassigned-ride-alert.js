const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
, { realtime: { transport: ws } });

async function checkTier(now, hoursOut, columnName, label) {
  const cutoff = new Date(now.getTime() + hoursOut * 60 * 60 * 1000);
  const { data: rides, error } = await supabase
    .from('rides')
    .select('id, patient_name, pickup_time, hospital_name')
    .eq('status', 'confirmed')
    .is('nemt_partner_id', null)
    .lte('pickup_time', cutoff.toISOString())
    .gte('pickup_time', now.toISOString())
    .is(columnName, null);

  if (error || !rides || !rides.length) return { rides: [], label };

  const ids = rides.map(r => r.id);
  await supabase.from('rides').update({ [columnName]: new Date().toISOString() }).in('id', ids);
  return { rides, label };
}

module.exports = async function handler(req, res) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();
    const tiers = await Promise.all([
      checkTier(now, 12, 'alert_12h_sent_at', 'Heads up'),
      checkTier(now, 8, 'alert_8h_sent_at', 'Attention needed'),
      checkTier(now, 4, 'alert_4h_sent_at', 'URGENT'),
    ]);

    const nonEmpty = tiers.filter(t => t.rides.length > 0);
    if (!nonEmpty.length) return res.status(200).json({ success: true, alerted: 0 });

    if (process.env.RESEND_API_KEY) {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      for (const tier of nonEmpty) {
        const rideListHtml = tier.rides.map(r => {
          const t = r.pickup_time ? new Date(r.pickup_time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Unknown time';
          return '<li><strong>' + (r.patient_name || 'Patient') + '</strong> — ' + (r.hospital_name || 'Facility') + ' — pickup: ' + t + '</li>';
        }).join('');

        await resend.emails.send({
          from: 'CareVoy Alerts <notifications@carevoy.co>',
          to: 'support@carevoy.co',
          subject: '[' + tier.label + '] ' + tier.rides.length + ' unassigned ride(s)',
          html: '<div style="font-family:sans-serif;padding:20px"><h2 style="color:#050D1F">' + tier.label + ': Unassigned Ride Alert</h2><p>The following confirmed rides have no NEMT driver assigned:</p><ul>' + rideListHtml + '</ul></div>',
        });
      }
    }

    return res.status(200).json({ success: true, tiers: nonEmpty.map(t => ({ label: t.label, count: t.rides.length })) });
  } catch (e) {
    console.error('Unassigned-ride alert cron error:', e);
    return res.status(500).json({ error: e.message });
  }
};
