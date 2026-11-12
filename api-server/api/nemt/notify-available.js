const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { toE164, getCaller, canAccessRide } = require('../../lib/security');
const { limited, record, hit } = require('../../lib/ratelimit');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
, { realtime: { transport: ws } });

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Texts every matching transport partner, so only a signed-in person with access to the ride may trigger it.
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });
    const { ride_id } = req.body || {};
    if (!ride_id) return res.status(400).json({ error: 'Missing ride_id' });

    const { data: ride } = await supabase.from('rides').select('*, hospitals(name)').eq('id', ride_id).single();
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (!canAccessRide(caller, ride, { allowPatient: true })) return res.status(403).json({ error: 'Forbidden' });
    // At most 2 broadcasts per ride per hour, and 60 per person per day.
    if (await hit(supabase, 'ride:' + ride_id, 'nemt_broadcast', 2, 3600000)) return res.status(200).json({ success: true, notified: 0, note: 'Already sent recently' });
    if (await limited(supabase, caller.user.id, 'nemt_broadcast_user', 60, 86400000)) return res.status(429).json({ error: 'Too many requests' });
    await record(supabase, caller.user.id, 'user', 'nemt_broadcast_user');

    const { data: partners } = await supabase.from('nemt_partners').select('id, company_name, contact_phone, service_states').eq('active', true);
    if (!partners || !partners.length) return res.status(200).json({ success: true, notified: 0 });

    const matching = partners.filter(p => Array.isArray(p.service_states) && p.service_states.includes(ride.hospital_state));

    const apptDate = ride.pickup_time ? new Date(ride.pickup_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'soon';
    const facilityName = (ride.hospitals && ride.hospitals.name) || ride.hospital_name || 'a partnered facility';
    const message = `New ride available at ${facilityName}, pickup ${apptDate}. View: https://partners.carevoy.co/driver`;

    let sentCount = 0;
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_FROM) {
      for (const partner of matching) {
        const toPhone = toE164(partner.contact_phone);
        if (!toPhone) continue;
        try {
          const twilioRes = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + process.env.TWILIO_ACCOUNT_SID + '/Messages.json', {
            method: 'POST',
            headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ To: toPhone, From: process.env.TWILIO_PHONE_FROM, Body: message }).toString()
          });
          if (twilioRes.ok) sentCount++;
        } catch (e) { console.warn('NEMT text failed for partner ' + partner.id + ':', e.message); }
      }
    }

    return res.status(200).json({ success: true, notified: sentCount, matched: matching.length });
  } catch (e) {
    console.error('NEMT notify error:', e);
    return res.status(500).json({ error: e.message });
  }
};
