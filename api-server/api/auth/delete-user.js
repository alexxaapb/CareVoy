const { getCaller, adminClient } = require('../../lib/security');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Must be logged in. A user may delete only their own account; admins may delete patients.
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });

    const { user_id, patient_email } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    const isSelf = caller.user.id === user_id;
    if (!isSelf && !caller.isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const sb = adminClient();

    // Admins can remove patients, but never other staff accounts from here.
    if (!isSelf) {
      const { data: targetStaff } = await sb.from('staff').select('id').eq('id', user_id).maybeSingle();
      if (targetStaff) return res.status(403).json({ error: 'Staff accounts cannot be deleted here' });
    }

    // Delete rides by patient_id
    await sb.from('rides').delete().eq('patient_id', user_id);

    // Delete rides by contact_email only for admins, or when it is the caller's own email
    const ownEmail = (caller.user.email || '').toLowerCase();
    if (patient_email && (caller.isAdmin || (ownEmail && String(patient_email).toLowerCase() === ownEmail))) {
      await sb.from('rides').delete().eq('contact_email', patient_email);
    }

    // Delete patient record
    await sb.from('patients').delete().eq('id', user_id);

    // Delete auth user
    const { error } = await sb.auth.admin.deleteUser(user_id);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true });
  } catch(e) {
    console.error('delete-user error:', e);
    return res.status(500).json({ error: e.message });
  }
};
