const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { user_id, patient_email } = req.body;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    const sb = createClient(
      process.env.SUPABASE_URL || 'https://byflpckbjjumxxjxoplk.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Delete rides by patient_id and contact_email
    await sb.from('rides').delete().eq('patient_id', user_id);
    if (patient_email) {
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
