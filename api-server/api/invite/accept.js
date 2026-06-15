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
    const { invite_token, role, uid, full_name, email, password, hospital_id, nemt_partner_id, company_name, city, state, job_title } = req.body;
    if (!invite_token || !role || !email) return res.status(400).json({ error: 'Missing required fields' });

    let finalUid = uid;
    if (!finalUid) {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
      if (createErr) return res.status(400).json({ error: createErr.message });
      finalUid = newUser.user.id;
    }

    const { data: invite, error: inviteErr } = await supabase.from('invites').select('*').eq('token', invite_token).single();
    if (inviteErr || !invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.used) return res.status(400).json({ error: 'Invite already used' });

    const diffDays = (Date.now() - new Date(invite.created_at)) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) return res.status(400).json({ error: 'Invite expired' });

    if (role === 'nemt') {
      let partnerId = nemt_partner_id || invite.nemt_partner_id;
      if (!partnerId && company_name) {
        const { data: newPartner } = await supabase.from('nemt_partners').insert({ company_name, city: city || null, active: true }).select().single();
        if (newPartner) partnerId = newPartner.id;
      }
      await supabase.from('staff').upsert({ id: finalUid, role: 'nemt', full_name, email, nemt_partner_id: partnerId || null });
    } else {
      // Look up or create hospital from facility_name
      let resolvedHospitalId = hospital_id || invite.hospital_id || null;
      const facility_name = req.body.facility_name;
      if (!resolvedHospitalId && facility_name) {
        // Try fuzzy match on hospitals table
        const { data: matches } = await supabase.from('hospitals').select('id, name').ilike('name', '%' + facility_name.split(' ').slice(0, 3).join('%') + '%').limit(1);
        if (matches && matches.length > 0) {
          resolvedHospitalId = matches[0].id;
        } else {
          // Create new hospital record
          const { data: newHosp } = await supabase.from('hospitals').insert({ name: facility_name, city: city || state || null }).select().single();
          if (newHosp) resolvedHospitalId = newHosp.id;
        }
      }
      await supabase.from('hospital_coordinators').upsert({ id: finalUid, full_name, email, hospital_id: resolvedHospitalId, job_title: job_title || null });
    }

    await supabase.from('invites').update({ used: true, used_at: new Date().toISOString(), used_by: finalUid }).eq('token', invite_token);
    try { await supabase.from('audit_log').insert({ actor_id: finalUid, actor_role: role, action: 'partner.signup', entity_type: role === 'nemt' ? 'staff' : 'hospital_coordinators', entity_id: finalUid, new_value: { full_name, email, role } }); } catch(_) {}

    // Send welcome email
    try {
      await fetch('https://care-voy-api-server.vercel.app/api/notify/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'welcome', to: email, data: { full_name, role } })
      });
    } catch(_) {}

    return res.status(200).json({ success: true, role });
  } catch(e) {
    console.error('Invite accept error:', e);
    return res.status(500).json({ error: e.message });
  }
};
