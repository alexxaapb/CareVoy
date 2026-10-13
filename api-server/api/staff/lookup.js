const { getCaller, adminClient } = require('../../lib/security');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });

    const { uid, nemt_partner_id } = req.body || {};
    const sb = adminClient();

    let staff;
    if (nemt_partner_id) {
      // Admin preview mode: admins only
      if (!caller.isAdmin) return res.status(403).json({ error: 'Forbidden' });
      const { data } = await sb.from('staff').select('*').eq('nemt_partner_id', nemt_partner_id).eq('role', 'nemt').limit(1);
      staff = data && data[0];
    } else if (uid) {
      // Your own record, or any record if you are an admin
      if (uid !== caller.user.id && !caller.isAdmin) return res.status(403).json({ error: 'Forbidden' });
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
