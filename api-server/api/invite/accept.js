const { adminClient, getCaller, internalHeaders } = require('../../lib/security');

const supabase = adminClient();

// Escape % and _ so a name can never act as a wildcard in ilike
function likeSafe(word) {
  return String(word).replace(/[\\%_]/g, '\\$&');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let claimedToken = null;
  try {
    const body = req.body || {};
    const { invite_token, full_name, email, password, company_name, city, state, job_title } = body;
    if (!invite_token || !email) return res.status(400).json({ error: 'Missing required fields' });

    // 1. Validate the invite BEFORE creating anything
    const { data: invite, error: inviteErr } = await supabase.from('invites').select('*').eq('token', invite_token).single();
    if (inviteErr || !invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.used) return res.status(400).json({ error: 'Invite already used' });

    const diffDays = (Date.now() - new Date(invite.created_at)) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) return res.status(400).json({ error: 'Invite expired' });

    // The invite decides the role and the facility/company. The request cannot override them.
    const role = invite.role;
    if (role !== 'nemt' && role !== 'coordinator') return res.status(400).json({ error: 'Invalid invite' });

    // 2. Claim the invite atomically so it cannot be used twice at the same time
    const { data: claimed } = await supabase.from('invites')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('token', invite_token).eq('used', false).select('token').maybeSingle();
    if (!claimed) return res.status(400).json({ error: 'Invite already used' });
    claimedToken = invite_token;

    // 3. Create the auth user (or, if the caller is already logged in as that user, use it)
    let finalUid = null;
    if (body.uid) {
      const caller = await getCaller(req);
      if (!caller || caller.user.id !== body.uid) {
        throw Object.assign(new Error('Not authorized for this account'), { status: 403 });
      }
      finalUid = body.uid;
    } else {
      if (!password) throw Object.assign(new Error('Missing required fields'), { status: 400 });
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
      if (createErr) throw Object.assign(new Error(createErr.message), { status: 400 });
      finalUid = newUser.user.id;
    }

    // Never overwrite an existing admin record
    const { data: existingStaff } = await supabase.from('staff').select('role').eq('id', finalUid).maybeSingle();
    if (existingStaff && existingStaff.role === 'admin') {
      throw Object.assign(new Error('Not authorized for this account'), { status: 403 });
    }

    if (role === 'nemt') {
      let partnerId = invite.nemt_partner_id || null;
      let createdPartner = false;
      const companyName = invite.company_name || company_name;
      if (!partnerId && companyName) {
        const { data: newPartner } = await supabase.from('nemt_partners').insert({ company_name: companyName, city: city || null, active: true }).select().single();
        if (newPartner) { partnerId = newPartner.id; createdPartner = true; }
      }
      // Service coverage from the signup form (only for the partner tied to this invite)
      const service_states = body.service_states;
      const vehicle_types = body.vehicle_types;
      if (partnerId && (service_states || vehicle_types)) {
        const updates = {};
        if (Array.isArray(service_states) && service_states.length) updates.service_states = service_states;
        if (Array.isArray(vehicle_types) && vehicle_types.length) updates.vehicle_types = vehicle_types;
        if (Object.keys(updates).length) await supabase.from('nemt_partners').update(updates).eq('id', partnerId);
      }
      await supabase.from('staff').upsert({ id: finalUid, role: 'nemt', full_name, email, nemt_partner_id: partnerId || null });
    } else {
      let resolvedHospitalId = invite.hospital_id || null;
      // Match an existing facility only by the name the ADMIN put on the invite.
      // A name typed on the public form never attaches someone to an existing facility.
      const inviteFacility = invite.facility_name;
      const typedFacility = body.facility_name;
      if (!resolvedHospitalId && inviteFacility) {
        const pattern = '%' + String(inviteFacility).split(' ').slice(0, 3).map(likeSafe).join('%') + '%';
        const { data: matches } = await supabase.from('hospitals').select('id, name').ilike('name', pattern).limit(1);
        if (matches && matches.length > 0) resolvedHospitalId = matches[0].id;
      }
      if (!resolvedHospitalId && (inviteFacility || typedFacility)) {
        const { data: newHosp } = await supabase.from('hospitals').insert({ name: inviteFacility || typedFacility, city: city || state || null }).select().single();
        if (newHosp) resolvedHospitalId = newHosp.id;
      }
      await supabase.from('hospital_coordinators').upsert({ id: finalUid, full_name, email, hospital_id: resolvedHospitalId, job_title: job_title || null });
    }

    await supabase.from('invites').update({ used_by: finalUid }).eq('token', invite_token);
    try { await supabase.from('audit_log').insert({ actor_id: finalUid, actor_role: role, action: 'partner.signup', entity_type: role === 'nemt' ? 'staff' : 'hospital_coordinators', entity_id: finalUid, new_value: { full_name, email, role } }); } catch(_) {}

    // Send welcome email
    try {
      await fetch('https://care-voy-api-server.vercel.app/api/notify/send', {
        method: 'POST', headers: internalHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ type: 'welcome', to: email, data: { full_name, role } })
      });
    } catch(_) {}

    return res.status(200).json({ success: true, role });
  } catch(e) {
    // If anything failed after the invite was claimed, release it so the person can retry
    if (claimedToken) {
      try { await supabase.from('invites').update({ used: false, used_at: null, used_by: null }).eq('token', claimedToken); } catch(_) {}
    }
    console.error('Invite accept error:', e);
    return res.status(e.status || 500).json({ error: e.message });
  }
};
