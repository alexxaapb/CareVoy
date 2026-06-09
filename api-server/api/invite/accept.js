import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      invite_token, role, uid, full_name, email,
      hospital_id, nemt_partner_id,
      company_name, city, state, job_title
    } = req.body;

    if (!invite_token || !uid || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify invite still valid
    const { data: invite, error: inviteErr } = await supabase
      .from('invites')
      .select('*')
      .eq('token', invite_token)
      .single();

    if (inviteErr || !invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.used) return res.status(400).json({ error: 'Invite already used' });

    const createdAt = new Date(invite.created_at);
    const diffDays = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) return res.status(400).json({ error: 'Invite expired' });

    if (role === 'nemt') {
      // Create or find NEMT partner record
      let partnerId = nemt_partner_id || invite.nemt_partner_id;

      if (!partnerId && company_name) {
        const { data: newPartner } = await supabase
          .from('nemt_partners')
          .insert({ company_name, city: city || null, active: true })
          .select()
          .single();
        if (newPartner) partnerId = newPartner.id;
      }

      // Create staff record for driver
      await supabase.from('staff').upsert({
        id: uid,
        role: 'nemt',
        full_name: full_name,
        email: email,
        nemt_partner_id: partnerId || null,
      });

    } else if (role === 'coordinator') {
      // Resolve hospital
      let resolvedHospitalId = hospital_id || invite.hospital_id;

      // Create hospital_coordinators record
      await supabase.from('hospital_coordinators').upsert({
        id: uid,
        full_name: full_name,
        email: email,
        hospital_id: resolvedHospitalId || null,
        job_title: job_title || null,
      });
    }

    // Mark invite as used
    await supabase
      .from('invites')
      .update({ used: true, used_at: new Date().toISOString(), used_by: uid })
      .eq('token', invite_token);

    // Write audit log entry
    await supabase.from('audit_log').insert({
      actor_id: uid,
      actor_role: role,
      action: 'partner.signup',
      entity_type: role === 'nemt' ? 'staff' : 'hospital_coordinators',
      entity_id: uid,
      new_value: { full_name, email, role },
    }).catch(() => {}); // non-blocking

    return res.status(200).json({ success: true, role });

  } catch(e) {
    console.error('Invite accept error:', e);
    return res.status(500).json({ error: e.message });
  }
}
