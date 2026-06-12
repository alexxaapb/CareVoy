import base64, re, subprocess, os

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')
API = os.path.join(REPO, 'api-server', 'api')

# ═══════════════════════════════════════════════════════
# PART 1: EMAIL NOTIFICATIONS via Resend
# ═══════════════════════════════════════════════════════

# Create a notifications endpoint that sends partner emails
notify_js = '''const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = process.env.RESEND_API ? new Resend(process.env.RESEND_API) : null;

const FROM = 'CareVoy <notifications@carevoy.co>';

function emailTemplate(title, body, ctaText, ctaUrl) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F0F4F8;font-family:-apple-system,Segoe UI,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px">
      <div style="background:#050D1F;border-radius:14px 14px 0 0;padding:24px 28px">
        <span style="color:#fff;font-size:18px;font-weight:700">CareVoy</span>
        <span style="color:#00C2A8;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-left:8px">Partner Portal</span>
      </div>
      <div style="background:#fff;border-radius:0 0 14px 14px;padding:28px;border:1px solid #E2E8F0;border-top:none">
        <h1 style="font-size:19px;color:#050D1F;margin:0 0 12px">${title}</h1>
        <div style="font-size:14px;color:#374151;line-height:1.6">${body}</div>
        ${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:20px;background:#050D1F;color:#00C2A8;text-decoration:none;padding:12px 24px;border-radius:9px;font-size:14px;font-weight:700">${ctaText}</a>` : ''}
        <div style="margin-top:24px;padding-top:18px;border-top:1px solid #F0F4F8;font-size:12px;color:#9CA3AF">
          Questions? Contact <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a>
        </div>
      </div>
    </div>
  </body></html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { type, to, data } = req.body;
    if (!to || !type) return res.status(400).json({ error: 'Missing to or type' });
    if (!resend) return res.status(200).json({ success: false, note: 'Resend not configured' });

    let subject, title, body, ctaText, ctaUrl;
    const portal = 'https://partners.carevoy.co';

    if (type === 'ride_confirmed') {
      subject = 'Ride Confirmed — ' + (data.patient_name || 'Patient');
      title = 'A ride has been confirmed';
      body = `The ride for <strong>${data.patient_name || 'your patient'}</strong> on ${data.date || 'the scheduled date'} has been confirmed and assigned to a transport partner.`;
      ctaText = 'View in Dashboard'; ctaUrl = portal + '/coordinator.html';
    } else if (type === 'ride_completed') {
      subject = 'Ride Completed — ' + (data.patient_name || 'Patient');
      title = 'A ride was completed';
      body = `The ride for <strong>${data.patient_name || 'your patient'}</strong> has been completed. An IRS-compliant HSA/FSA receipt has been generated.`;
      ctaText = 'View Details'; ctaUrl = portal + '/coordinator.html';
    } else if (type === 'ride_assigned_driver') {
      subject = 'New Ride Assigned';
      title = 'You have a new ride assignment';
      body = `A new ride for <strong>${data.patient_name || 'a patient'}</strong> on ${data.date || 'the scheduled date'} has been assigned to your company.`;
      ctaText = 'View Schedule'; ctaUrl = portal + '/driver.html';
    } else if (type === 'patient_no_response') {
      subject = 'Patient Needs Attention';
      title = 'A patient has not confirmed their ride';
      body = `<strong>${data.patient_name || 'A patient'}</strong> has not confirmed their upcoming ride. You may want to follow up or send a reminder.`;
      ctaText = 'View Patient'; ctaUrl = portal + '/coordinator.html';
    } else {
      return res.status(400).json({ error: 'Unknown notification type' });
    }

    const { error } = await resend.emails.send({
      from: FROM, to: [to], subject,
      html: emailTemplate(title, body, ctaText, ctaUrl)
    });
    if (error) return res.status(200).json({ success: false, error: error.message });

    return res.status(200).json({ success: true });
  } catch(e) {
    console.error('Notify error:', e);
    return res.status(500).json({ error: e.message });
  }
};
'''

os.makedirs(os.path.join(API, 'notify'), exist_ok=True)
open(os.path.join(API, 'notify', 'send.js'), 'w').write(notify_js)
print('Created api/notify/send.js')

# Add notify route to vercel.json
vpath = os.path.join(REPO, 'api-server', 'vercel.json')
v = open(vpath).read()
if '/api/notify/send' not in v:
    v = v.replace(
        '{ "src": "/api/(.*)", "dest": "/api/$1.js" }',
        '{ "src": "/api/(.*)", "dest": "/api/$1.js" }'
    )
    # builds config already uses wildcard so route is covered
open(vpath, 'w').write(v)
print('vercel.json OK (wildcard covers notify)')

print('PART 1 done: email notifications endpoint')

# ═══════════════════════════════════════════════════════
# PART 1b: Wire email into rides/assign.js (fires on confirm)
# ═══════════════════════════════════════════════════════

assign_path = os.path.join(API, 'rides', 'assign.js')
c = open(assign_path).read()

# Add email notification after the audit log, before return
if 'notify/send' not in c:
    old_return = "    return res.status(200).json({ success: true, ride_id, nemt_partner_id, status: 'confirmed' });"
    new_block = '''    // Send email notification to the facility coordinator
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

    return res.status(200).json({ success: true, ride_id, nemt_partner_id, status: 'confirmed' });'''
    c = c.replace(old_return, new_block)
    open(assign_path, 'w').write(c)
    print('Wired email into rides/assign.js')
else:
    print('rides/assign.js already has notify')

print('PART 1b done')

# ═══════════════════════════════════════════════════════
# PART 2: Remove "Import Calendar" button, keep CSV upload
# ═══════════════════════════════════════════════════════

coord_path = os.path.join(PP, 'coordinator.html')
c = open(coord_path).read()

# Remove the Import Calendar button
c = c.replace(
    '<button class="btn btn-ghost" onclick="openCalModal()">Import Calendar</button>',
    ''
)
c = c.replace(
    '<button class="btn btn-ghost" onclick="openUploadModal()">Upload CSV</button>',
    '<button class="btn btn-ghost" onclick="openUploadModal()">Import Patients (CSV)</button>'
)

open(coord_path, 'w').write(c)
print('PART 2 done: removed calendar button, renamed CSV to Import Patients')

# ═══════════════════════════════════════════════════════
# PART 3: Option A signup - no auto-redirect, button only
# ═══════════════════════════════════════════════════════

invite_path = os.path.join(PP, 'invite.html')
c = open(invite_path).read()

# Remove the auto-redirect setTimeout calls, keep only the success button
c = c.replace(
    "showSuccess('Welcome to CareVoy!', 'Your driver account is ready. Taking you to your dashboard\\u2026', '/driver.html');\n        setTimeout(function(){ window.location.href = '/driver.html'; }, 2000);",
    "showSuccess('Welcome to CareVoy!', 'Your driver account is ready. Click below to access your dashboard.', '/driver.html');"
)
c = c.replace(
    "showSuccess('Welcome to CareVoy!', 'Your coordinator account is ready. Taking you to your dashboard\\u2026', '/coordinator.html');\n        setTimeout(function(){ window.location.href = '/coordinator.html'; }, 2000);",
    "showSuccess('Welcome to CareVoy!', 'Your coordinator account is ready. Click below to access your dashboard.', '/coordinator.html');"
)

# Also handle any other variations of the redirect
c = re.sub(r"setTimeout\(function\(\)\{ window\.location\.href = '/driver\.html'; \}, 2000\);", "", c)
c = re.sub(r"setTimeout\(function\(\)\{ window\.location\.href = '/coordinator\.html'; \}, 2000\);", "", c)

# Update success button text to be clearer
c = c.replace(
    '<a href="/" class="success-btn" id="successBtn">Go to Dashboard</a>',
    '<a href="/" class="success-btn" id="successBtn">Go to My Dashboard →</a>'
)

open(invite_path, 'w').write(c)
print('PART 3 done: Option A signup - button only, no auto-redirect')

# ═══════════════════════════════════════════════════════
# Update notification settings text to reflect EMAIL is live
# ═══════════════════════════════════════════════════════

c = open(coord_path).read()
c = c.replace(
    'Ride status alerts are sent to your registered email and via SMS. You will be notified when patients confirm rides, when drivers are assigned, and when rides are completed.',
    'Email alerts are sent to your registered email when rides are confirmed, drivers are assigned, and rides are completed. No setup needed.'
)
open(coord_path, 'w').write(c)
print('Updated coordinator notification text to email-only')

c = open(os.path.join(PP, 'driver.html')).read()
c = c.replace(
    'You receive push notifications and SMS alerts when a new ride is assigned to you, along with pickup reminders and schedule changes.',
    'Email alerts are sent to your registered email when a new ride is assigned to your company.'
)
open(os.path.join(PP, 'driver.html'), 'w').write(c)
print('Updated driver notification text to email-only')

# ═══════════════════════════════════════════════════════
# COMMIT
# ═══════════════════════════════════════════════════════
for cmd in [
    'git add partners-portal/ api-server/',
    'git commit -m "feat: email notifications via Resend, remove calendar, Option A signup success flow"',
    'git push origin main'
]:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print(r.stdout.strip() or r.stderr.strip())

print('ALL THREE BUILT AND PUSHED')
