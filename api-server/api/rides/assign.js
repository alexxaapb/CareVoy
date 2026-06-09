import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
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

    const { data: staff } = await supabase
      .from('staff').select('role').eq('id', user.id).single();
    if (!staff || staff.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { ride_id, nemt_partner_id } = req.body;
    if (!ride_id || !nemt_partner_id) {
      return res.status(400).json({ error: 'Missing ride_id or nemt_partner_id' });
    }

    // Get current ride for audit log
    const { data: oldRide } = await supabase
      .from('rides').select('status, nemt_partner_id').eq('id', ride_id).single();

    // Assign partner and update status to confirmed
    const { error: updateErr } = await supabase
      .from('rides')
      .update({
        nemt_partner_id,
        status: 'confirmed',
        assigned_by: user.id,
        assigned_at: new Date().toISOString(),
      })
      .eq('id', ride_id);

    if (updateErr) throw updateErr;

    // Audit log
    await supabase.from('audit_log').insert({
      actor_id: user.id,
      actor_role: 'admin',
      action: 'ride.nemt_assigned',
      entity_type: 'rides',
      entity_id: ride_id,
      old_value: { status: oldRide?.status, nemt_partner_id: oldRide?.nemt_partner_id },
      new_value: { status: 'confirmed', nemt_partner_id },
    }).catch(() => {});

    return res.status(200).json({ success: true, ride_id, nemt_partner_id, status: 'confirmed' });

  } catch(e) {
    console.error('Ride assign error:', e);
    return res.status(500).json({ error: e.message });
  }
}
