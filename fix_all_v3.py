import os, subprocess

REPO = '/workspaces/CareVoy'
PP   = os.path.join(REPO, 'partners-portal')
results = []

# ═══════════════════════════════════════════════════════
# 1. PATIENT WELCOME EMAIL endpoint
# ═══════════════════════════════════════════════════════
welcome_js = """module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try {
    const {name, email} = req.body;
    if(!email) return res.status(400).json({error:'Missing email'});
    const firstName = (name||'there').split(' ')[0];
    const {Resend} = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const {error} = await resend.emails.send({
      from: 'CareVoy <notifications@carevoy.co>',
      to: email,
      subject: 'Welcome to CareVoy',
      html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
        <div style="background:#050D1F;padding:20px 24px;border-radius:12px 12px 0 0;text-align:center">
          <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:1px">CareVoy</span>
        </div>
        <div style="background:#fff;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px">
          <p style="color:#050D1F;font-size:16px;font-weight:600;margin:0 0 12px">Welcome, ${firstName}.</p>
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">
            Your CareVoy account is ready. Your healthcare facility has arranged medical transportation for you — your upcoming ride will appear automatically in your portal.
          </p>
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px">
            Once your ride is scheduled, an IRS Section 213(d) compliant receipt will be emailed to you automatically for HSA/FSA reimbursement.
          </p>
          <a href="https://partners.carevoy.co/patients"
             style="display:inline-block;background:#050D1F;color:#fff;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">
            Go to My Portal
          </a>
          <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0;line-height:1.5">
            CareVoy coordinates medical transportation on behalf of your healthcare facility.<br>
            Questions? Reply to this email or visit partners.carevoy.co/patients.
          </p>
        </div>
      </div>`
    });
    if(error) return res.status(500).json({error: error.message});
    return res.status(200).json({success:true, email_sent:true});
  } catch(e) { return res.status(500).json({error:e.message}); }
};
"""
wp = os.path.join(REPO,'api-server','api','notify','patient-welcome.js')
open(wp,'w').write(welcome_js)
results.append("1. /api/notify/patient-welcome.js created")

# ═══════════════════════════════════════════════════════
# 2. ADMIN KEYFOB - coordinator/driver load via override param
# ═══════════════════════════════════════════════════════
# Add ?preview_hospital=ID or ?preview_nemt=ID param loading to coordinator + driver
# And update the admin setViewMode to show a picker

af = os.path.join(PP,'admin.html')
ac = open(af).read()

# Replace setViewMode with a picker version
old_vm = """  function setViewMode(mode) {
    var modes = ['admin','coordinator','driver','patient'];
    modes.forEach(function(m) {
      var btn = document.getElementById('mode' + m.charAt(0).toUpperCase() + m.slice(1));
      if (btn) { btn.style.background = 'rgba(255,255,255,.08)'; btn.style.color = '#9CA3AF'; }
    });
    var active = document.getElementById('mode' + mode.charAt(0).toUpperCase() + mode.slice(1));
    if (active) { active.style.background = 'rgba(0,194,168,.2)'; active.style.color = '#00C2A8'; }
    if (mode === 'coordinator') { window.open('/coordinator', '_blank'); }
    else if (mode === 'driver') { window.open('/driver', '_blank'); }
    else if (mode === 'patient') { window.open('/patients', '_blank'); }
    // admin = stay here
    setTimeout(function(){ 
      var adminBtn = document.getElementById('modeAdmin');
      if(adminBtn){ adminBtn.style.background='rgba(0,194,168,.2)'; adminBtn.style.color='#00C2A8'; }
    }, 100);
  }"""

new_vm = """  function setViewMode(mode) {
    if (mode === 'admin') return;
    if (mode === 'patient') { window.open('/patients', '_blank'); return; }
    if (mode === 'coordinator') {
      // Pick a facility to preview as
      var opts = '<option value="">-- Select Facility --</option>';
      if (window._allHospitals) {
        window._allHospitals.forEach(function(h) {
          opts += '<option value="' + h.id + '">' + esc(h.name||h.id) + '</option>';
        });
      }
      var sel = '<div style="padding:16px"><div style="font-size:13px;font-weight:700;color:#050D1F;margin-bottom:10px">View as Coordinator — select a facility:</div><select id="previewFacSel" style="width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:inherit;margin-bottom:12px">' + opts + '</select><button onclick="var v=document.getElementById(\'previewFacSel\').value;if(v)window.open(\'/coordinator?preview_hospital=\'+v,\'_blank\');document.getElementById(\'previewPicker\').remove();" style="padding:10px 20px;background:#050D1F;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Open</button> <button onclick="document.getElementById(\'previewPicker\').remove();" style="padding:10px 20px;background:#F3F4F6;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit;margin-left:8px">Cancel</button></div>';
      var d = document.createElement('div');
      d.id = 'previewPicker';
      d.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);background:#fff;border-radius:12px;border:1px solid #E2E8F0;box-shadow:0 8px 32px rgba(0,0,0,0.12);z-index:999;min-width:340px;';
      d.innerHTML = sel;
      document.body.appendChild(d);
    }
    if (mode === 'driver') {
      var opts = '<option value="">-- Select NEMT Partner --</option>';
      if (window._allNemt) {
        window._allNemt.forEach(function(n) {
          opts += '<option value="' + n.id + '">' + esc(n.company_name||n.id) + '</option>';
        });
      }
      var sel = '<div style="padding:16px"><div style="font-size:13px;font-weight:700;color:#050D1F;margin-bottom:10px">View as Driver — select a NEMT partner:</div><select id="previewNemtSel" style="width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:inherit;margin-bottom:12px">' + opts + '</select><button onclick="var v=document.getElementById(\'previewNemtSel\').value;if(v)window.open(\'/driver?preview_nemt=\'+v,\'_blank\');document.getElementById(\'previewPicker\').remove();" style="padding:10px 20px;background:#050D1F;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Open</button> <button onclick="document.getElementById(\'previewPicker\').remove();" style="padding:10px 20px;background:#F3F4F6;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit;margin-left:8px">Cancel</button></div>';
      var d = document.createElement('div');
      d.id = 'previewPicker';
      d.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);background:#fff;border-radius:12px;border:1px solid #E2E8F0;box-shadow:0 8px 32px rgba(0,0,0,0.12);z-index:999;min-width:340px;';
      d.innerHTML = sel;
      document.body.appendChild(d);
    }
  }"""

if old_vm in ac:
    ac = ac.replace(old_vm, new_vm)
    results.append("2. Admin keyfob: coordinator/driver picker to select any account")
else:
    results.append("2. FAIL: setViewMode not matched")
open(af,'w').write(ac)

# ═══════════════════════════════════════════════════════
# 3. COORDINATOR - read preview_hospital param (landlord key)
# ═══════════════════════════════════════════════════════
cf = os.path.join(PP,'coordinator.html')
cc = open(cf).read()
old_coord_init = "  async function init() {\n    var session = await getSession();\n    if (!session) { window.location.href = '/'; return; }"
new_coord_init = """  async function init() {
    var session = await getSession();
    // Admin keyfob: if preview_hospital param present, use it directly
    var urlParams = new URLSearchParams(window.location.search);
    var previewHospital = urlParams.get('preview_hospital');
    if (!session && !previewHospital) { window.location.href = '/'; return; }
    if (!session) { window.location.href = '/'; return; }"""
if old_coord_init in cc:
    cc = cc.replace(old_coord_init, new_coord_init)
    results.append("3a. Coordinator: reads preview_hospital param")
else:
    results.append("3a. FAIL: coordinator init not matched")

# Also make coordinator use preview_hospital for coordInfo lookup
old_coord_lookup = "    var staffRes = await fetch(SUPA + '/rest/v1/hospital_coordinators?email=eq.' + encodeURIComponent(session.user.email) + '&select=*', { headers: H });"
new_coord_lookup = """    var urlParams2 = new URLSearchParams(window.location.search);
    var previewH = urlParams2.get('preview_hospital');
    var staffRes;
    if (previewH) {
      // Admin preview mode - load coordinator for this hospital directly
      staffRes = await fetch(SUPA + '/rest/v1/hospital_coordinators?hospital_id=eq.' + previewH + '&select=*&limit=1', { headers: H });
    } else {
      staffRes = await fetch(SUPA + '/rest/v1/hospital_coordinators?email=eq.' + encodeURIComponent(session.user.email) + '&select=*', { headers: H });
    }"""
if old_coord_lookup in cc:
    cc = cc.replace(old_coord_lookup, new_coord_lookup)
    results.append("3b. Coordinator: admin keyfob loads any facility's coordinator view")
else:
    results.append("3b. FAIL: coordinator lookup not matched")
open(cf,'w').write(cc)

# ═══════════════════════════════════════════════════════
# 4. DRIVER - read preview_nemt param (landlord key)
# ═══════════════════════════════════════════════════════
df = os.path.join(PP,'driver.html')
dc = open(df).read()
old_driver_lookup = "    var staffRes = await fetch(SUPA + '/rest/v1/staff?email=eq.' + encodeURIComponent(session.user.email) + '&select=*', { headers: H });"
new_driver_lookup = """    var urlParamsD = new URLSearchParams(window.location.search);
    var previewNemt = urlParamsD.get('preview_nemt');
    var staffRes;
    if (previewNemt) {
      staffRes = await fetch(SUPA + '/rest/v1/staff?nemt_partner_id=eq.' + previewNemt + '&role=eq.nemt&select=*&limit=1', { headers: H });
    } else {
      staffRes = await fetch(SUPA + '/rest/v1/staff?email=eq.' + encodeURIComponent(session.user.email) + '&select=*', { headers: H });
    }"""
if old_driver_lookup in dc:
    dc = dc.replace(old_driver_lookup, new_driver_lookup)
    results.append("4. Driver: admin keyfob loads any NEMT's driver view")
else:
    results.append("4. FAIL: driver lookup not matched")
open(df,'w').write(dc)

# ═══════════════════════════════════════════════════════
# 5. FORM AESTHETICS - index, nemt-signup, facility-signup
#    Inter font, white bg, cleaner inputs
# ═══════════════════════════════════════════════════════
form_fixes = {
    'index.html': [
        ("family=Poppins:wght@400;500;600;700", "family=Inter:wght@400;500;600;700"),
        ("'Poppins'", "'Inter'"),
        ("background: #F0F4F8", "background: #FFFFFF"),
        ("background:#F0F4F8", "background:#FFFFFF"),
        ("background: #F8FAFC", "background: #FFFFFF"),
        ("background:#F8FAFC", "background:#FFFFFF"),
        ("#E2E8F0", "#E8ECF2"),
    ],
    'nemt-signup.html': [
        ("family=Poppins:wght@400;500;600;700", "family=Inter:wght@400;500;600;700"),
        ("'Poppins'", "'Inter'"),
        ("background:#F0F4F8", "background:#FFFFFF"),
        ("background: #F0F4F8", "background:#FFFFFF"),
        ("background:#F8FAFC", "background:#FFFFFF"),
        ("background: #F8FAFC", "background:#FFFFFF"),
        ("#E2E8F0", "#E8ECF2"),
    ],
    'facility-signup.html': [
        ("family=Poppins:wght@400;500;600;700", "family=Inter:wght@400;500;600;700"),
        ("'Poppins'", "'Inter'"),
        ("background:#F0F4F8", "background:#FFFFFF"),
        ("background: #F0F4F8", "background:#FFFFFF"),
        ("background:#F8FAFC", "background:#FFFFFF"),
        ("background: #F8FAFC", "background:#FFFFFF"),
        ("#E2E8F0", "#E8ECF2"),
    ],
}
for fname, replacements in form_fixes.items():
    fp = os.path.join(PP, fname)
    c  = open(fp).read()
    for old, new in replacements:
        c = c.replace(old, new)
    open(fp,'w').write(c)
results.append("5. Forms (index, nemt-signup, facility-signup): Inter + white bg")

# ═══════════════════════════════════════════════════════
# 6. ENTER KEY on patient login
# ═══════════════════════════════════════════════════════
pf = os.path.join(PP,'patients.html')
pc = open(pf).read()
old_pass = '<input class="form-input" id="loginPass" type="password" placeholder="••••••••" autocomplete="current-password">'
new_pass = '<input class="form-input" id="loginPass" type="password" placeholder="••••••••" autocomplete="current-password" onkeydown="if(event.key===\'Enter\')doLogin()">'
if old_pass in pc:
    pc = pc.replace(old_pass, new_pass)
    results.append("6. Patient login: Enter key submits form")
else:
    results.append("6. FAIL: login pass input not matched")

# Also add Enter on email field
old_email_login = '<input class="form-input" id="loginEmail" type="email" placeholder="you@email.com" autocomplete="email">'
new_email_login = '<input class="form-input" id="loginEmail" type="email" placeholder="you@email.com" autocomplete="email" onkeydown="if(event.key===\'Enter\')doLogin()">'
if old_email_login in pc:
    pc = pc.replace(old_email_login, new_email_login)
open(pf,'w').write(pc)

print("="*58)
for r in results: print(" ✓", r)
print("="*58)

# Verify
print("\nVERIFICATION:")
print("  patient-welcome.js exists:", os.path.exists(wp))
print("  Admin keyfob picker:", 'Select Facility' in open(af).read())
print("  Coordinator reads preview_hospital:", 'preview_hospital' in open(cf).read())
print("  Driver reads preview_nemt:", 'preview_nemt' in open(df).read())
print("  index.html Inter:", "'Inter'" in open(os.path.join(PP,'index.html')).read())
print("  nemt-signup Inter:", "'Inter'" in open(os.path.join(PP,'nemt-signup.html')).read())
print("  Enter key on login:", "onkeydown" in open(pf).read())
print()

for cmd in [
    ['git','-C',REPO,'add','-A',
     'partners-portal/admin.html','partners-portal/coordinator.html',
     'partners-portal/driver.html','partners-portal/patients.html',
     'partners-portal/index.html','partners-portal/nemt-signup.html',
     'partners-portal/facility-signup.html',
     'api-server/api/notify/patient-welcome.js'],
    ['git','-C',REPO,'commit','-m','feat: keyfob admin preview, patient welcome email, form aesthetics, enter key login'],
    ['git','-C',REPO,'push','origin','main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout+r.stderr).strip()[:200] or "(ok)")
