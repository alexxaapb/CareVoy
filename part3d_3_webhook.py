import os, subprocess

REPO = '/workspaces/CareVoy'
v1dir = os.path.join(REPO, 'api-server', 'api', 'v1')
os.makedirs(v1dir, exist_ok=True)

webhook = r'''// POST /api/v1/ride-trigger
// The public webhook any scheduling system can call to drop an appointment
// into CareVoy's auto-invite pipeline. Same destination as the coordinator
// form: the scheduled_appointments table. The auto-invite engine handles
// the rest (invites ~7 days before, or immediately if sooner).
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: 'Missing x-api-key' });

    const { data: keyRow } = await supabase
      .from('facility_api_keys')
      .select('hospital_id, active')
      .eq('api_key', apiKey)
      .single();

    if (!keyRow || !keyRow.active) {
      return res.status(401).json({ error: 'Invalid or inactive API key' });
    }

    const { patient_name, contact_phone, contact_email, appointment_at, procedure_type, caregiver_name } = req.body || {};
    if (!patient_name || !contact_phone || !appointment_at) {
      return res.status(400).json({ error: 'Required: patient_name, contact_phone, appointment_at (ISO 8601)' });
    }

    const apptDate = new Date(appointment_at);
    if (isNaN(apptDate.getTime())) {
      return res.status(400).json({ error: 'appointment_at must be a valid ISO 8601 datetime' });
    }

    let phone = String(contact_phone).replace(/[^\d+]/g, '');
    if (!phone.startsWith('+')) {
      if (phone.length === 11 && phone.startsWith('1')) phone = '+' + phone;
      else if (phone.length === 10) phone = '+1' + phone;
      else phone = '+1' + phone;
    }

    const { data: inserted, error: insErr } = await supabase
      .from('scheduled_appointments')
      .insert({
        hospital_id: keyRow.hospital_id,
        patient_name,
        caregiver_name: caregiver_name || null,
        contact_phone: phone,
        contact_email: contact_email || null,
        appointment_at: apptDate.toISOString(),
        procedure_type: procedure_type || null,
        source: 'webhook'
      })
      .select('id')
      .single();

    if (insErr) throw insErr;

    return res.status(201).json({
      success: true,
      scheduled_appointment_id: inserted.id,
      message: 'Appointment received. CareVoy will auto-invite the patient ~7 days before the appointment.'
    });
  } catch (e) {
    console.error('ride-trigger error:', e);
    return res.status(500).json({ error: e.message });
  }
};
'''

path = os.path.join(v1dir, 'ride-trigger.js')
open(path, 'w').write(webhook)
print("1. Created api-server/api/v1/ride-trigger.js")

cmds = [
    'rm -f part3d_3_webhook.py',
    'git add api-server/api/v1/ride-trigger.js',
    'git commit -m "feat: POST /api/v1/ride-trigger webhook - external systems push appointments (Part 3D)"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
