'use strict';
// Daily check: rides in the next 48 hours where the patient still has not confirmed.
// Sends one coordinator alert per ride (Slack / Teams / email, whichever the facility set up).
// The alert has no patient details. CRON_SECRET bearer auth, same as the other crons.
const { adminClient } = require('../../lib/security');
const { notifyFacility } = require('../../lib/alerts');

module.exports = async function handler(req, res) {
  const auth = req.headers['authorization'] || '';
  if (!process.env.CRON_SECRET || auth !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const sb = adminClient();
    const now = new Date();
    const { data: rides, error } = await sb.from('rides')
      .select('id, hospital_id, pickup_time')
      .in('status', ['invited', 'reminder_sent', 'no_response'])
      .is('no_response_alert_sent_at', null)
      .not('hospital_id', 'is', null)
      .gte('pickup_time', now.toISOString())
      .lte('pickup_time', new Date(now.getTime() + 48 * 3600 * 1000).toISOString())
      .limit(500);
    if (error) return res.status(500).json({ error: 'Query failed' });
    let alerted = 0;
    for (const r of rides || []) {
      // Mark first so a slow or failing channel can never cause a repeat alert.
      await sb.from('rides').update({ no_response_alert_sent_at: new Date().toISOString() }).eq('id', r.id);
      await notifyFacility(r.hospital_id, 'patient_no_response', r);
      alerted++;
    }
    return res.status(200).json({ success: true, alerted });
  } catch (e) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
};
