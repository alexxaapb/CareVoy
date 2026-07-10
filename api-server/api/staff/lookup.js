const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { uid, nemt_partner_id } = req.body;
    const sb = createClient(
      process.env.SUPABASE_URL || 'https://byflpckbjjumxxjxoplk.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    , { realtime: { transport: ws } });

    let staff;
    if (nemt_partner_id) {
      // Admin preview mode
      const { data } = await sb.from('staff').select('*').eq('nemt_partner_id', nemt_partner_id).eq('role', 'nemt').limit(1);
      staff = data && data[0];
    } else if (uid) {
      const { data } = await sb.from('staff').select('*').eq('id', uid).limit(1);
      staff = data && data[0];
    }

    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    // Also fetch partner info
    let partner = null;
    if (staff.nemt_partner_id) {
      const { data: pd } = await sb.from('nemt_partners').select('*').eq('id', staff.nemt_partner_id).limit(1);
      partner = pd && pd[0];
    }

    return res.status(200).json({ staff, partner });
  } catch(e) {
    console.error('staff lookup error:', e);
    return res.status(500).json({ error: e.message });
  }
};
