const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing auth' });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return res.status(401).json({ error: 'Invalid auth' });

    const { data: staff } = await supabase.from('staff').select('role').eq('id', user.id).single();
    if (!staff || staff.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    const { ride_id, nemt_partner_id } = req.body;
    if (!ride_id || !nemt_partner_id) return res.status(400).json({ error: 'Missing ride_id or nemt_partner_id' });

    const { data: oldRide } = await supabase.from('rides').select('status, nemt_partner_id').eq('id', ride_id).single();

    const { error: updateErr } = await supabase.from('rides').update({ nemt_partner_id, status: 'confirmed', assigned_by: user.id, assigned_at: new Date().toISOString() }).eq('id', ride_id);
    if (updateErr) throw updateErr;

    await supabase.from('audit_log').insert({ actor_id: user.id, actor_role: 'admin', action: 'ride.nemt_assigned', entity_type: 'rides', entity_id: ride_id, old_value: { status: oldRide && oldRide.status }, new_value: { status: 'confirmed', nemt_partner_id } });

    // Send email notification to the facility coordinator
    try {
      const { data: rideFull } = await supabase.from('rides').select('patient_name, pickup_time, hospital_id').eq('id', ride_id).single();
      if (rideFull && rideFull.hospital_id) {
        const { data: coords } = await supabase.from('hospital_coordinators').select('email').eq('hospital_id', rideFull.hospital_id);
        const dateStr = rideFull.pickup_time ? new Date(rideFull.pickup_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'the scheduled date';
        if (coords && coords.length) {
          for (const coord of coords) {
            if (coord.email) {
              await fetch('https://care-voy-api-server.vercel.app/api/notify/send', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'ride_confirmed', to: coord.email, data: { patient_name: rideFull.patient_name, date: dateStr } })
              });
            }
          }
        }
      }
      // Notify the NEMT driver(s)
      const { data: drivers } = await supabase.from('staff').select('email').eq('nemt_partner_id', nemt_partner_id).eq('role', 'nemt');
      const { data: rideForDriver } = await supabase.from('rides').select('patient_name, pickup_time').eq('id', ride_id).single();
      const driverDate = rideForDriver && rideForDriver.pickup_time ? new Date(rideForDriver.pickup_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'the scheduled date';
      if (drivers && drivers.length) {
        for (const drv of drivers) {
          if (drv.email) {
            await fetch('https://care-voy-api-server.vercel.app/api/notify/send', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'ride_assigned_driver', to: drv.email, data: { patient_name: rideForDriver.patient_name, date: driverDate } })
            });
          }
        }
      }
    } catch(_) {}

    return res.status(200).json({ success: true, ride_id, nemt_partner_id, status: 'confirmed' });
  } catch(e) {
    console.error('Ride assign error:', e);
    return res.status(500).json({ error: e.message });
  }
};
