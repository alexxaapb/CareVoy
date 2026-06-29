import os, subprocess

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')

# ── Aster exact colors from screenshot ──
ASTER_BG   = '#F5F2EB'  # warm cream outer bg
ASTER_CARD = '#FFFFFF'  # white cards
ASTER_BORDER = '#E8E4DC' # warm border
ASTER_MUTED  = '#6B6560'
ASTER_TEXT   = '#1A1714'

INLINE_SVG_28 = '<svg width="28" height="28" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style="border-radius:6px;flex-shrink:0"><rect width="1024" height="1024" fill="#060D1F"/><g transform="translate(320.34 691.95) scale(0.5091 -0.5091)"><path d="M383 712Q515 712 605.0 641.5Q695 571 721 450H510Q491 490 457.5 511.0Q424 532 380 532Q312 532 271.5 483.5Q231 435 231 354Q231 272 271.5 223.5Q312 175 380 175Q424 175 457.5 196.0Q491 217 510 257H721Q695 136 605.0 65.5Q515 -5 383 -5Q279 -5 199.0 40.5Q119 86 75.5 167.5Q32 249 32 354Q32 458 75.5 539.5Q119 621 199.0 666.5Q279 712 383 712Z" fill="#FFFFFF"/></g><path d="M 758.20 555.41 A 250 250 0 1 1 758.20 468.59" fill="none" stroke="#00C2A8" stroke-width="22" stroke-linecap="round"/><circle cx="758.20" cy="555.41" r="17" fill="#F5A623"/><circle cx="758.20" cy="468.59" r="17" fill="#F5A623"/></svg>'
INLINE_SVG_32 = INLINE_SVG_28.replace('width="28" height="28"','width="32" height="32"')

LOGO_B64 = 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDI0IDEwMjQiPjxyZWN0IHdpZHRoPSIxMDI0IiBoZWlnaHQ9IjEwMjQiIGZpbGw9IiMwNjBEMUYiLz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgzMjAuMzQgNjkxLjk1KSBzY2FsZSgwLjUwOTEgLTAuNTA5MSkiPjxwYXRoIGQ9Ik0zODMgNzEyUTUxNSA3MTIgNjA1LjAgNjQxLjVRNjk1IDU3MSA3MjEgNDUwSDUxMFE0OTEgNDkwIDQ1Ny41IDUxMS4wUTQyNCA1MzIgMzgwIDUzMlEzMTIgNTMyIDI3MS41IDQ4My41UTIzMSA0MzUgMjMxIDM1NFEyMzEgMjcyIDI3MS41IDIyMy41UTMxMiAxNzUgMzgwIDE3NVE0MjQgMTc1IDQ1Ny41IDE5Ni4wUTQ5MSAyMTcgNTEwIDI1N0g3MjFRNjk1IDEzNiA2MDUuMCA2NS41UTUxNSAtNSAzODMgLTVRMjc5IC01IDE5OS4wIDQwLjVRMTE5IDg2IDc1LjUgMTY3LjVRMzIgMjQ5IDMyIDM1NFEzMiA0NTggNzUuNSA1MzkuNVExMTkgNjIxIDE5OS4wIDY2Ni41UTI3OSA3MTIgMzgzIDcxMloiIGZpbGw9IiNGRkZGRkYiLz48L2c+PHBhdGggZD0iTSA3NTguMjAgNTU1LjQxIEEgMjUwIDI1MCAwIDEgMSA3NTguMjAgNDY4LjU5IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMEMyQTgiIHN0cm9rZS13aWR0aD0iMjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxjaXJjbGUgY3g9Ijc1OC4yMCIgY3k9IjU1NS40MSIgcj0iMTciIGZpbGw9IiNGNUE2MjMiLz48Y2lyY2xlIGN4PSI3NTguMjAiIGN5PSI0NjguNTkiIHI9IjE3IiBmaWxsPSIjRjVBNjIzIi8+PC9zdmc+'

def aster(c):
    # Font
    c = c.replace('Poppins:wght@400;500;600;700', 'Inter:wght@400;500;600;700')
    c = c.replace("family='Poppins'", "family='Inter'")
    c = c.replace("'Poppins'", "'Inter'").replace('"Poppins"', '"Inter"')
    # Backgrounds
    for old in ['#F0F4F8','#F3F4F6','#F7F8FA','#F8FAFC','#F5F4F0']:
        c = c.replace(old, ASTER_BG)
    # Borders
    for old in ['#E2E8F0','#E5E7EB','#E2DDD6']:
        c = c.replace(old, ASTER_BORDER)
    return c

results = []

# ═══════════════════════════════════════════════
# 1. ADMIN - font, bg, logo, VIEW AS buttons
# ═══════════════════════════════════════════════
af = os.path.join(PP,'admin.html')
ac = open(af).read()
ac = aster(ac)

# Logo: img b64 → inline SVG
ac = ac.replace(
    f'<img src="data:image/svg+xml;base64,{LOGO_B64}" width="32" height="32" style="border-radius:7px;flex-shrink:0">',
    INLINE_SVG_32
)
results.append("1a. Admin: Inter + #F5F2EB bg + warm borders + inline logo")

# VIEW AS buttons in topbar HTML
old_tb = '''  <div class="topbar">
    <div class="topbar-left">
      <div class="live-dot"></div>
      <span class="live-label">Live</span>'''
new_tb = '''  <div class="topbar">
    <div class="topbar-left">
      <div class="live-dot"></div>
      <span class="live-label">Live</span>
      <div style="margin-left:20px;display:flex;align-items:center;gap:6px">
        <span style="color:#6B7280;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase">View as</span>
        <button id="modeAdmin" onclick="setViewMode('admin')" style="padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;border:none;cursor:pointer;font-family:inherit;background:rgba(0,194,168,.2);color:#00C2A8">Admin</button>
        <button id="modeCoordinator" onclick="setViewMode('coordinator')" style="padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;border:none;cursor:pointer;font-family:inherit;background:rgba(255,255,255,.07);color:#9CA3AF">Coordinator</button>
        <button id="modeDriver" onclick="setViewMode('driver')" style="padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;border:none;cursor:pointer;font-family:inherit;background:rgba(255,255,255,.07);color:#9CA3AF">Driver</button>
        <button id="modePatient" onclick="setViewMode('patient')" style="padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;border:none;cursor:pointer;font-family:inherit;background:rgba(255,255,255,.07);color:#9CA3AF">Patient</button>
      </div>'''
if old_tb in ac:
    ac = ac.replace(old_tb, new_tb)
    results.append("1b. Admin: VIEW AS buttons in topbar HTML")
else:
    # Try without leading spaces
    old_tb2 = '<div class="topbar">\n    <div class="topbar-left">\n      <div class="live-dot"></div>\n      <span class="live-label">Live</span>'
    if old_tb2 in ac:
        ac = ac.replace(old_tb2, new_tb.strip())
        results.append("1b. Admin: VIEW AS buttons (alt pattern)")
    else:
        results.append("1b. Admin: VIEW AS buttons - pattern not matched, check manually")

open(af,'w').write(ac)

# ═══════════════════════════════════════════════
# 2. COORDINATOR - font, bg, logo, caregiver email
# ═══════════════════════════════════════════════
cf = os.path.join(PP,'coordinator.html')
cc = open(cf).read()
cc = aster(cc)

# Logo: img → inline SVG
cc = cc.replace(
    f'<img src="data:image/svg+xml;base64,{LOGO_B64}" width="28" height="28" style="border-radius:6px;flex-shrink:0">',
    INLINE_SVG_28
)
results.append("2a. Coordinator: Inter + #F5F2EB bg + inline logo")

# Caregiver section: add email, all required, email before phone
old_cg = '''        <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Caregiver (receives SMS invite)</div>
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Caregiver Name</label>
            <input class="form-input" id="cgName" placeholder="John Doe">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Caregiver Phone</label>
            <input class="form-input" id="cgPhone" type="tel" placeholder="(555) 000-0000">
          </div>
        </div>'''
new_cg = '''        <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Caregiver Info</div>
        <div class="form-group" style="margin-bottom:10px">
          <label class="form-label">Caregiver Name <span style="color:#EF4444">*</span></label>
          <input class="form-input" id="cgName" placeholder="John Doe" required>
        </div>
        <div class="form-group" style="margin-bottom:10px">
          <label class="form-label">Caregiver Email <span style="color:#EF4444">*</span></label>
          <input class="form-input" id="cgEmail" type="email" placeholder="caregiver@email.com" required>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Caregiver Phone <span style="color:#EF4444">*</span></label>
          <input class="form-input" id="cgPhone" type="tel" placeholder="(555) 000-0000" required>
        </div>'''
if old_cg in cc:
    cc = cc.replace(old_cg, new_cg)
    results.append("2b. Caregiver: name + email + phone fields, all required, email before phone")
else:
    results.append("2b. Caregiver: section pattern not matched (may already be updated or format differs)")

# Caregiver validation
old_cgv = """    var cgN    = document.getElementById('cgName').value.trim();
    var cgP    = document.getElementById('cgPhone').value.trim();
    if (!pFirst || !pLast) { showErr('Please enter patient name.'); return; }
    if (!cgN || !cgP) { showErr('Please enter caregiver name and phone.'); return; }
    patientName = pFirst + ' ' + pLast;
    caregiverName = cgN;
    contactPhone = cgP;"""
new_cgv = """    var cgN    = document.getElementById('cgName').value.trim();
    var cgP    = document.getElementById('cgPhone').value.trim();
    var cgEmail = document.getElementById('cgEmail') ? document.getElementById('cgEmail').value.trim() : '';
    if (!pFirst || !pLast) { showErr('Please enter patient name.'); return; }
    if (!cgN) { showErr('Please enter caregiver name.'); return; }
    if (!cgEmail || !cgEmail.includes('@')) { showErr('Please enter caregiver email address.'); return; }
    if (!cgP || cgP.replace(/\\D/g,'').length < 10) { showErr('Please enter a valid caregiver phone number.'); return; }
    patientName = pFirst + ' ' + pLast;
    caregiverName = cgN;
    contactPhone = cgP;
    patEmail = cgEmail;"""
if old_cgv in cc:
    cc = cc.replace(old_cgv, new_cgv)
    results.append("2c. Caregiver validation: name + email + phone all required")
else:
    results.append("2c. Caregiver validation: pattern not matched")

open(cf,'w').write(cc)

# ═══════════════════════════════════════════════
# 3. DRIVER - font, bg, logo
# ═══════════════════════════════════════════════
df = os.path.join(PP,'driver.html')
dc = open(df).read()
dc = aster(dc)
dc = dc.replace(
    f'<img src="data:image/svg+xml;base64,{LOGO_B64}" width="28" height="28" style="border-radius:6px;flex-shrink:0">',
    INLINE_SVG_28
)
open(df,'w').write(dc)
results.append("3. Driver: Inter + #F5F2EB bg + inline logo")

# ═══════════════════════════════════════════════
# 4. PATIENTS - font, bg, Supabase key fix
# ═══════════════════════════════════════════════
pf = os.path.join(PP,'patients.html')
pc = open(pf).read()
pc = aster(pc)
pc = pc.replace(
    "const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5ZmxwY2tiampdifQ.placeholder';",
    "const KEY  = 'sb_publishable_mwR5uT4W3C2M-K5LbBag4g_GdN0plrT';"
)
pc = pc.replace(
    "const sb = createClient(SUPA, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5ZmxwY2tiamptdXh4anF4b3BsayIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzM2NDQ1MDc5LCJleHAiOjIwNTIwMjEwNzl9.P-XF-fO8ERnQjKR4bdyEXBKNLSXc_z9-vD6c90X3vXY');",
    "const sb = createClient(SUPA, KEY);"
)
# Fix chat proxy
pc = pc.replace(
    "headers: { 'Content-Type': 'application/json', 'x-api-key': '', 'anthropic-version': '2023-06-01' },",
    "headers: { 'Content-Type': 'application/json' },"
)
pc = pc.replace(
    "const res  = await fetch('https://api.anthropic.com/v1/messages', {",
    "const res  = await fetch(API + '/api/chat', {"
)
open(pf,'w').write(pc)
results.append("4. Patients: Inter + #F5F2EB bg + Supabase key fixed + chat proxy")

# ═══════════════════════════════════════════════
# 5. REMINDERS/SEND.JS - add email via Resend
# ═══════════════════════════════════════════════
rf = os.path.join(REPO,'api-server','api','reminders','send.js')
rc = open(rf).read()
old_ret = "    return res.status(200).json({ success: true, sms_sent: smsSent });"
new_ret = """    let emailSent = false;
    const contactEmail = ride.contact_email || null;
    if (contactEmail && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const apptStr = ride.pickup_time ? new Date(ride.pickup_time).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'your upcoming appointment';
        const patName = ride.patient_name || 'there';
        const facName = ride.hospital_name || 'your healthcare facility';
        await resend.emails.send({
          from: 'CareVoy <notifications@carevoy.co>',
          to: contactEmail,
          subject: 'Reminder: Your ride is waiting to be scheduled',
          html: '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px"><div style="background:#050D1F;padding:20px 24px;border-radius:12px 12px 0 0;text-align:center"><span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:1px">CareVoy</span></div><div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px"><p style="color:#1A1714;font-size:16px;font-weight:600;margin:0 0 12px">Hi ' + patName + ',</p><p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px"><strong>' + facName + '</strong> has arranged a medical ride for you on <strong>' + apptStr + '</strong>.</p><p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px">Please visit your patient portal to schedule your pickup time and confirm your ride.</p><a href="https://partners.carevoy.co/patients" style="display:inline-block;background:#050D1F;color:#fff;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">Schedule My Ride</a><p style="color:#9CA3AF;font-size:12px;margin:24px 0 0">Automated reminder from CareVoy on behalf of ' + facName + '</p></div></div>'
        });
        emailSent = true;
      } catch(e){ console.warn('Reminder email error:', e.message); }
    }
    return res.status(200).json({ success: true, sms_sent: smsSent, email_sent: emailSent });"""
if old_ret in rc:
    rc = rc.replace(old_ret, new_ret)
    open(rf,'w').write(rc)
    results.append("5. reminders/send.js: email via Resend added")
else:
    results.append("5. reminders: return pattern not matched")

# ═══════════════════════════════════════════════
# 6. /api/chat.js
# ═══════════════════════════════════════════════
chat_path = os.path.join(REPO,'api-server','api','chat.js')
if not os.path.exists(chat_path):
    open(chat_path,'w').write("""const Anthropic = require('@anthropic-ai/sdk');
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try {
    const {message,context} = req.body;
    if(!message) return res.status(400).json({error:'Missing message'});
    const system = context==='patient'
      ? "You are CareVoy's AI care coordinator. Help patients with medical rides, HSA/FSA reimbursement, and receipts. Be brief and warm. If asked about specific rides, tell them to check the Rides tab."
      : "You are CareVoy's assistant for healthcare coordinators. Help with ride coordination and platform questions. Be concise.";
    const client = new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY});
    const r = await client.messages.create({model:'claude-sonnet-4-6',max_tokens:600,system,messages:[{role:'user',content:message}]});
    return res.status(200).json({success:true,reply:r.content?.[0]?.text||''});
  } catch(e){ return res.status(500).json({error:e.message}); }
};
""")
    results.append("6. /api/chat.js created")
else:
    results.append("6. /api/chat.js already exists")

print("="*55)
for r in results: print(" ✓", r)
print("="*55)

# Verify
ac2=open(af).read(); cc2=open(cf).read()
print("\nVERIFICATION:")
print("  Admin Inter:", "'Inter'" in ac2)
print("  Admin bg:", ASTER_BG in ac2)
print("  Admin VIEW AS HTML:", 'View as' in ac2)
print("  Admin inline logo:", LOGO_B64 not in ac2)
print("  Coord Inter:", "'Inter'" in cc2)
print("  Coord bg:", ASTER_BG in cc2)
print("  Coord caregiver email field:", 'cgEmail' in cc2)
print("  Coord caregiver phone required:", 'caregiver phone number' in cc2)
print("  Reminder email:", 'emailSent' in open(rf).read())
print("  Chat proxy:", 'api/chat' in open(pf).read())
print("  Patients key:", 'sb_publishable' in open(pf).read())
print()

for cmd in [
    ['git','-C',REPO,'add','-A',
     'partners-portal/admin.html',
     'partners-portal/coordinator.html',
     'partners-portal/driver.html',
     'partners-portal/patients.html',
     'api-server/api/reminders/send.js',
     'api-server/api/chat.js'],
    ['git','-C',REPO,'commit','-m','fix: Aster design all dashboards, caregiver email+phone required, reminder email, chat proxy'],
    ['git','-C',REPO,'push','origin','main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout+r.stderr).strip()[:200] or "(ok)")
