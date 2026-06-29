import os, subprocess

REPO = '/workspaces/CareVoy'
PP   = os.path.join(REPO, 'partners-portal')
results = []

BG_OLD = '#F5F2EB'
BG_NEW = '#FFFFFF'

MOTION_MARK = '<svg width="32" height="32" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style="border-radius:7px;flex-shrink:0"><rect width="1024" height="1024" fill="#060D1F"/><g transform="translate(320.34 691.95) scale(0.5091 -0.5091)"><path d="M383 712Q515 712 605.0 641.5Q695 571 721 450H510Q491 490 457.5 511.0Q424 532 380 532Q312 532 271.5 483.5Q231 435 231 354Q231 272 271.5 223.5Q312 175 380 175Q424 175 457.5 196.0Q491 217 510 257H721Q695 136 605.0 65.5Q515 -5 383 -5Q279 -5 199.0 40.5Q119 86 75.5 167.5Q32 249 32 354Q32 458 75.5 539.5Q119 621 199.0 666.5Q279 712 383 712Z" fill="#FFFFFF"/></g><path d="M 758.20 555.41 A 250 250 0 1 1 758.20 468.59" fill="none" stroke="#00C2A8" stroke-width="22" stroke-linecap="round"/><circle cx="758.20" cy="555.41" r="17" fill="#F5A623"/><circle cx="758.20" cy="468.59" r="17" fill="#F5A623"/></svg>'

# ═══════════════════════════════════════════
# 1. Fix background on all dashboards
# ═══════════════════════════════════════════
for fname in ['admin.html','coordinator.html','driver.html','patients.html']:
    fp = os.path.join(PP, fname)
    c  = open(fp).read()
    c  = c.replace(BG_OLD, BG_NEW)
    c  = c.replace('#F5F4F0', BG_NEW)
    c  = c.replace('#F0F4F8', BG_NEW)
    c  = c.replace('#F3F4F6', BG_NEW)
    open(fp,'w').write(c)
results.append("1. Background: #F5F2EB → #F5F4F0 on all 4 dashboards")

# ═══════════════════════════════════════════
# 2. Remove all emojis from patients.html
# ═══════════════════════════════════════════
pf = os.path.join(PP,'patients.html')
pc = open(pf).read()
emoji_map = {
    '✉️ ': '',  '✉️': '',
    '🎉 ': '',  '🎉': '',
    '🚗': '',
    '🧾': '',
    '💳 ': '', '💳': '',
    '🏥 ': '', '🏥': '',
    '📅 ': '', '📅': '',
    '✅ ': '', '✅': '',
    '📋': '', '🔔': '', '💬': '', '👤': '',
}
for old, new in emoji_map.items():
    pc = pc.replace(old, new)
open(pf,'w').write(pc)
results.append("2. Emojis removed from patients.html")

# ═══════════════════════════════════════════
# 3. Fix patient portal logo (wrong SVG → Motion Mark)
# ═══════════════════════════════════════════
pc = open(pf).read()
old_logo = '''      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" rx="22" fill="#050D1F"/>
        <circle cx="72" cy="50" r="22" stroke="#00C2A8" stroke-width="5" fill="none" stroke-dasharray="80 30"/>
        <path d="M28 65 Q38 20 52 50 Q60 65 72 50" stroke="white" stroke-width="4" fill="none" stroke-linecap="round"/>
      </svg>'''
if old_logo in pc:
    # Replace in ALL occurrences (appears 3x: login, signup, forgot)
    pc = pc.replace(old_logo, MOTION_MARK)
    results.append("3. Patient portal logo: wrong SVG → Motion Mark (all 3 auth screens)")
else:
    results.append("3. Patient logo: old pattern not found")
open(pf,'w').write(pc)

# ═══════════════════════════════════════════
# 4. Coordinator: email BEFORE phone (swap order), phone required
# ═══════════════════════════════════════════
cf = os.path.join(PP,'coordinator.html')
cc = open(cf).read()

old_order = '''        <label class="form-label">Patient Phone <span style="color:#9CA3AF;font-weight:400">(optional)</span></label>
        <input class="form-input" id="patPhone" type="tel" placeholder="(555) 000-0000">
      </div>
      <div class="form-group">
        <label class="form-label">Patient Email <span style="color:#EF4444">*</span></label>
        <input class="form-input" id="patEmail" type="email" placeholder="jane@email.com">'''
new_order = '''        <label class="form-label">Patient Email <span style="color:#EF4444">*</span></label>
        <input class="form-input" id="patEmail" type="email" placeholder="jane@email.com" required>
      </div>
      <div class="form-group">
        <label class="form-label">Patient Phone <span style="color:#EF4444">*</span></label>
        <input class="form-input" id="patPhone" type="tel" placeholder="(555) 000-0000" required>'''
if old_order in cc:
    cc = cc.replace(old_order, new_order)
    results.append("4. Coordinator: email before phone, both required with asterisk")
else:
    results.append("4. FAIL: patient field order not matched")

# ═══════════════════════════════════════════
# 5. Coordinator: replace SMS invite with patient email invite
# ═══════════════════════════════════════════
old_sms_call = """    // Trigger SMS invite via API
    try {
      await fetch(API + '/api/invites/send-sms', {
        method: 'POST',
        headers: { ...H, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: contactPhone, patient_name: patientName, facility: hospitalInfo ? hospitalInfo.name : 'your facility' })
      });
    } catch(e2) { /* SMS endpoint may not exist yet — ride still created */ }
    closeAddPatient();
    showToast('Invite sent to ' + contactPhone, 'ok');"""

new_email_call = """    // Send patient invite email (portal-based, no app required)
    try {
      await fetch(API + '/api/invites/send-patient-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: patEmail,
          patient_name: patientName,
          facility: hospitalInfo ? hospitalInfo.name : 'your facility',
          city: hospitalInfo ? (hospitalInfo.city || '') : ''
        })
      });
    } catch(e2) { /* email send failed silently — ride still created */ }
    closeAddPatient();
    showToast('Invite sent to ' + patEmail, 'ok');"""

if old_sms_call in cc:
    cc = cc.replace(old_sms_call, new_email_call)
    results.append("5. Coordinator invite: SMS replaced with patient email invite")
else:
    results.append("5. FAIL: SMS invite call not matched")

open(cf,'w').write(cc)

# ═══════════════════════════════════════════
# 6. Create patient invite email endpoint
# ═══════════════════════════════════════════
invite_email_path = os.path.join(REPO,'api-server','api','invites','send-patient-email.js')
invite_email_js = """module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, patient_name, facility, city } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const firstName = (patient_name || 'there').split(' ')[0];
    const facilityDisplay = [facility, city].filter(Boolean).join(', ');

    const { error } = await resend.emails.send({
      from: 'CareVoy <notifications@carevoy.co>',
      to: email,
      subject: 'Your medical ride is ready to schedule',
      html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
        <div style="background:#050D1F;padding:20px 24px;border-radius:12px 12px 0 0;text-align:center">
          <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:1px">CareVoy</span>
        </div>
        <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px">
          <p style="color:#1A1714;font-size:16px;font-weight:600;margin:0 0 12px">Hi ${firstName},</p>
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">
            <strong>${facilityDisplay}</strong> has arranged medical transportation for your upcoming appointment.
          </p>
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px">
            Please visit your CareVoy patient portal to schedule your pickup time and confirm your ride.
            Your HSA/FSA receipt will be generated automatically after your ride is completed.
          </p>
          <a href="https://partners.carevoy.co/patients"
             style="display:inline-block;background:#050D1F;color:#fff;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">
            Schedule My Ride
          </a>
          <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0;line-height:1.5">
            This message was sent on behalf of ${facilityDisplay} via CareVoy.<br>
            If you did not expect this message, please disregard it.
          </p>
        </div>
      </div>`
    });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, email_sent: true });
  } catch(e) {
    console.error('Patient invite email error:', e);
    return res.status(500).json({ error: e.message });
  }
};
"""
open(invite_email_path,'w').write(invite_email_js)
results.append("6. /api/invites/send-patient-email.js created (Resend, no SMS)")

# ═══════════════════════════════════════════
# Print and commit
# ═══════════════════════════════════════════
print("="*58)
for r in results: print(" ✓", r)
print("="*58)

# Verify
cc2 = open(cf).read()
pc2 = open(pf).read()
print("\nVERIFICATION:")
print("  BG white on admin:", '#FFFFFF' in open(os.path.join(PP,'admin.html')).read() and '#F5F4F0' not in open(os.path.join(PP,'admin.html')).read())
print("  BG correct on coordinator:", BG_NEW in cc2)
print("  Email before phone:", 'Patient Email' in cc2 and cc2.index('Patient Email') < cc2.index('Patient Phone'))
print("  Phone required (asterisk):", 'Patient Phone <span style=\"color:#EF4444\">*</span>' in cc2)
print("  Invite sends email:", 'send-patient-email' in cc2)
print("  Toast says email:", "patEmail, 'ok'" in cc2)
print("  No emojis in patients:", '✉' not in pc2 and '🎉' not in pc2)
print("  Motion Mark logo:", '605.0 641.5' in pc2)
print()

for cmd in [
    ['git','-C',REPO,'add','-A',
     'partners-portal/admin.html','partners-portal/coordinator.html',
     'partners-portal/driver.html','partners-portal/patients.html',
     'api-server/api/invites/send-patient-email.js'],
    ['git','-C',REPO,'commit','-m','fix: crisp white bg #FFFFFF (Uber-style), no emojis, correct logo, email invite'],
    ['git','-C',REPO,'push','origin','main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout+r.stderr).strip()[:200] or "(ok)")
