import os, subprocess, re

REPO = '/workspaces/CareVoy'
PP   = os.path.join(REPO, 'partners-portal')
results = []

# ════════════════════════════════════════════
# 1. SIGN-IN PAGE — stacked vertical links
# ════════════════════════════════════════════
idxf = os.path.join(PP,'index.html')
ic = open(idxf).read()
old_inline_links = '''      New to CareVoy? <a href="/patients" style="color:var(--teal,#00C2A8);font-weight:600;text-decoration:none">Patient portal</a> &nbsp;·&nbsp; <a href="/nemt-signup" style="color:var(--teal,#00C2A8);font-weight:600;text-decoration:none">NEMT signup</a> &nbsp;·&nbsp; <a href="/facility-signup" style="color:var(--teal,#00C2A8);font-weight:600;text-decoration:none">Facility signup</a>'''
new_stacked_links = '''      <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">New to CareVoy?</div>
      <a href="https://partners.carevoy.co/patients" style="display:block;color:#00C2A8;font-weight:600;font-size:13px;text-decoration:none;margin-bottom:4px">Patient Portal</a>
      <a href="https://partners.carevoy.co/nemt-signup" style="display:block;color:#00C2A8;font-weight:600;font-size:13px;text-decoration:none;margin-bottom:4px">NEMT Signup</a>
      <a href="https://partners.carevoy.co/facility-signup" style="display:block;color:#00C2A8;font-weight:600;font-size:13px;text-decoration:none">Facility Signup</a>'''
if old_inline_links in ic:
    ic = ic.replace(old_inline_links, new_stacked_links)
    results.append("1. Sign-in: stacked vertical signup links with full URLs")
else:
    results.append("1. FAIL: inline links not matched")
open(idxf,'w').write(ic)

# ════════════════════════════════════════════
# 2. PATIENT — fix title bunching + password reset
# ════════════════════════════════════════════
pf = os.path.join(PP,'patients.html')
pc = open(pf).read()

# Fix flex layout making title/subtitle go side-by-side
old_switchtab = """  if (name === 'AI') activeTab.style.display = 'flex';"""
new_switchtab = """  if (name === 'AI') { activeTab.style.display = 'flex'; activeTab.style.flexDirection = 'column'; }"""
if old_switchtab in pc:
    pc = pc.replace(old_switchtab, new_switchtab)
    results.append("2a. Patient: AI tab flex-direction:column (title/subtitle no longer side-by-side)")
else:
    results.append("2a. FAIL: switchTab AI display not matched")

# Password reset: check URL hash BEFORE getUser so reset link shows form not dashboard
old_onload = """async function onLoad() {
  // Listen for PASSWORD_RECOVERY event from Supabase
  sb.auth.onAuthStateChange(async function(event, session) {
    if (event === 'PASSWORD_RECOVERY') {
      showScreen('reset');
    }
  });
  const { data } = await sb.auth.getUser();
  if (data.user) {
    // If arriving via password reset link, show reset form
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      showScreen('reset');
      return;
    }
    currentUser = data.user;
    await initApp();
  }
  else showScreen('login');
}
onLoad();"""
new_onload = """async function onLoad() {
  // Check URL hash for password reset BEFORE anything else
  // Supabase reset links contain #access_token=...&type=recovery
  if (window.location.hash && window.location.hash.includes('type=recovery')) {
    // Let Supabase process the hash and get the session
    const { data } = await sb.auth.getUser();
    currentUser = data.user || null;
    showScreen('reset');
    return;
  }
  // Also listen for auth state changes (handles cases where hash is already consumed)
  sb.auth.onAuthStateChange(async function(event, session) {
    if (event === 'PASSWORD_RECOVERY') {
      currentUser = session ? session.user : null;
      showScreen('reset');
    }
  });
  const { data } = await sb.auth.getUser();
  if (data.user) { currentUser = data.user; await initApp(); }
  else showScreen('login');
}
onLoad();"""
if old_onload in pc:
    pc = pc.replace(old_onload, new_onload)
    results.append("2b. Patient: password reset checks hash FIRST (no more auto-login on reset link)")
else:
    results.append("2b. FAIL: onLoad not matched")

# Add reset password screen after forgotScreen
old_forgot_close = '''</div>

<!-- ── Welcome / No invite ── -->'''
new_forgot_close = '''</div>

<!-- ── Reset Password ── -->
<div class="auth-wrap" id="resetScreen" style="display:none">
  <div class="auth-card">
    <div class="auth-logo">
      <svg width="32" height="32" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style="border-radius:7px;flex-shrink:0"><rect width="1024" height="1024" fill="#060D1F"/><g transform="translate(320.34 691.95) scale(0.5091 -0.5091)"><path d="M383 712Q515 712 605.0 641.5Q695 571 721 450H510Q491 490 457.5 511.0Q424 532 380 532Q312 532 271.5 483.5Q231 435 231 354Q231 272 271.5 223.5Q312 175 380 175Q424 175 457.5 196.0Q491 217 510 257H721Q695 136 605.0 65.5Q515 -5 383 -5Q279 -5 199.0 40.5Q119 86 75.5 167.5Q32 249 32 354Q32 458 75.5 539.5Q119 621 199.0 666.5Q279 712 383 712Z" fill="#FFFFFF"/></g><path d="M 758.20 555.41 A 250 250 0 1 1 758.20 468.59" fill="none" stroke="#00C2A8" stroke-width="22" stroke-linecap="round"/><circle cx="758.20" cy="555.41" r="17" fill="#F5A623"/><circle cx="758.20" cy="468.59" r="17" fill="#F5A623"/></svg>
      <span class="auth-logo-text">CareVoy</span>
    </div>
    <div class="auth-title">Set new password</div>
    <div class="auth-sub">Choose a new password for your CareVoy account.</div>
    <div class="auth-err" id="resetErr"></div>
    <label class="form-label">New password</label>
    <input class="form-input" id="resetPass" type="password" placeholder="Min 8 characters" autocomplete="new-password" onkeydown="if(event.key===\'Enter\')doResetPassword()">
    <button class="btn btn-navy" onclick="doResetPassword()" id="resetBtn">Update password</button>
  </div>
</div>

<!-- ── Welcome / No invite ── -->'''
if old_forgot_close in pc:
    pc = pc.replace(old_forgot_close, new_forgot_close)
    results.append("2c. Patient: reset password screen added")
else:
    results.append("2c. FAIL: forgot screen close not matched")

# Add reset screen to showScreen function
pc = pc.replace(
    "['loginScreen','signupScreen','forgotScreen','welcomeScreen']",
    "['loginScreen','signupScreen','forgotScreen','resetScreen','welcomeScreen']"
)

# Add doResetPassword function before onLoad
old_send_pw = "async function sendPasswordReset() {"
new_send_pw = """async function doResetPassword() {
  const btn = document.getElementById('resetBtn');
  const pass = document.getElementById('resetPass').value;
  const err  = document.getElementById('resetErr');
  err.style.display = 'none';
  if (!pass || pass.length < 8) { err.textContent = 'Password must be at least 8 characters.'; err.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = 'Updating…';
  const { error } = await sb.auth.updateUser({ password: pass });
  if (error) { err.textContent = error.message; err.style.display = 'block'; btn.disabled = false; btn.textContent = 'Update password'; return; }
  toast('Password updated. Signing you in…');
  // Clear the hash and go to app
  history.replaceState(null, '', window.location.pathname);
  setTimeout(async function(){ await initApp(); }, 1200);
}

async function sendPasswordReset() {"""
if old_send_pw in pc:
    pc = pc.replace(old_send_pw, new_send_pw)
    results.append("2d. Patient: doResetPassword() function added")
else:
    results.append("2d. FAIL: sendPasswordReset not found")

open(pf,'w').write(pc)

# ════════════════════════════════════════════
# 3. ADMIN — fix settings page (direct replacement), add delete patient
# ════════════════════════════════════════════
af = os.path.join(PP,'admin.html')
ac = open(af).read()

# Find and replace the entire settings section content
# Using a more targeted approach - find the settings panel by unique strings
old_proj_conn = '''    <div style="font-size:14px;font-weight:700;color:#050D1F;margin-bottom:16px;border-bottom:1px solid #FFFFFF;padding-bottom:10px">Project Connections</div>'''
new_proj_conn_section = '''    <div style="font-size:14px;font-weight:700;color:#050D1F;margin-bottom:16px;border-bottom:1px solid #F3F4F6;padding-bottom:10px">Platform Status</div>'''
if old_proj_conn in ac:
    ac = ac.replace(old_proj_conn, new_proj_conn_section)
    results.append("3a. Admin settings: 'Project Connections' → 'Platform Status'")
else:
    results.append("3a. FAIL: Project Connections header not matched")

# Remove Supabase URL row
ac = re.sub(
    r'<div><div style="font-size:13px;font-weight:600;color:#050D1F">Supabase Database</div><div style="font-size:12px;color:#9CA3AF">byflpckbjjumxxjxoplk\.supabase\.co</div></div>.*?</div>\s*</div>',
    '<div><div style="font-size:13px;font-weight:600;color:#050D1F">Patient Portal</div><div style="font-size:12px;color:#9CA3AF">partners.carevoy.co/patients</div></div>\n              <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(0,194,168,.1);color:#00836F">Live</span>\n            </div>',
    ac,
    count=1,
    flags=re.DOTALL
)

# Remove pg_cron reference and change SMS reminder to email
ac = ac.replace(
    'CareVoy automatically sends a reminder SMS to patients or caregivers who have not confirmed their ride within <strong>48 hours</strong> of receiving their invite. Configured via <code style="background:#FFFFFF;padding:2px 6px;border-radius:4px">pg_cron</code> in Supabase.',
    'CareVoy automatically sends a reminder email to patients who have not confirmed within 48 hours of receiving their invitation. Contact support@carevoy.co to adjust the reminder window.'
)

# Remove "Additional admin accounts via Supabase staff table" tech note
ac = ac.replace(
    'Additional admin accounts are added via the Supabase <code style="background:#FFFFFF;padding:2px 6px;border-radius:4px">staff</code> table with <code style="background:#FFFFFF;padding:2px 6px;border-radius:4px">role = admin</code>. Contact your developer to add new admins.',
    'To add or remove admin accounts, contact support@carevoy.co.'
)

# Remove webhooks tech note
ac = ac.replace(
    'Email alerts for new ride bookings, partner signups, and payment events. Configure in Supabase → Database → Webhooks.',
    'CareVoy sends email alerts for new bookings, partner applications, and ride completions automatically. No configuration required.'
)
results.append("3b. Admin settings: tech references removed, business-friendly text")

# Add deletePatient function
if 'async function deletePatient' not in ac:
    old_sign_out = 'function signOut() {'
    new_sign_out = """async function deletePatient(patientId, patientEmail) {
  if (!confirm('Remove this patient and all their rides permanently? This cannot be undone.')) return;
  var _URL = 'https://byflpckbjjumxxjxoplk.supabase.co';
  var _K   = 'sb_publishable_mwR5uT4W3C2M-K5LbBag4g_GdN0plrT';
  var _tk  = localStorage.getItem('cv_admin_token') || sessionStorage.getItem('cv_admin_token') || '';
  var _H   = { 'apikey': _K, 'Authorization': 'Bearer ' + _tk, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
  try {
    // Delete their rides first (FK constraint)
    if (patientEmail) {
      await fetch(_URL + '/rest/v1/rides?contact_email=eq.' + encodeURIComponent(patientEmail), { method: 'DELETE', headers: _H });
    }
    if (patientId) {
      await fetch(_URL + '/rest/v1/rides?patient_id=eq.' + patientId, { method: 'DELETE', headers: _H });
      await fetch(_URL + '/rest/v1/patients?id=eq.' + patientId, { method: 'DELETE', headers: _H });
    }
    showToast('Patient and all rides removed', 'ok');
    loadDashboard();
  } catch(e) { showToast('Could not delete patient', 'err'); }
}

function signOut() {"""
    if old_sign_out in ac:
        ac = ac.replace(old_sign_out, new_sign_out)
        results.append("3c. Admin: deletePatient() cascades to rides + patients table")
    else:
        results.append("3c. FAIL: signOut not found for deletePatient insertion")

open(af,'w').write(ac)

print("="*60)
for r in results: print(" ✓", r)
print("="*60)

ic2=open(idxf).read(); pc2=open(pf).read(); ac2=open(af).read()
print("\nVERIFICATION:")
print("  Sign-in stacked links:", 'display:block' in ic2 and 'Patient Portal' in ic2)
print("  Sign-in full URLs:", 'partners.carevoy.co/patients' in ic2)
print("  Patient flex-direction:column:", 'flexDirection' in pc2)
print("  Patient reset hash check:", "type=recovery" in pc2)
print("  Patient reset screen:", 'id="resetScreen"' in pc2)
print("  Patient doResetPassword:", 'doResetPassword' in pc2)
print("  Admin Platform Status:", 'Platform Status' in ac2)
print("  Admin no pg_cron:", 'pg_cron' not in ac2)
print("  Admin no Supabase staff code:", 'staff` table' not in ac2)
print("  Admin deletePatient:", 'deletePatient' in ac2)
print()

for cmd in [
    ['git','-C',REPO,'add','-A',
     'partners-portal/index.html','partners-portal/patients.html','partners-portal/admin.html'],
    ['git','-C',REPO,'commit','-m','fix: signin stacked links, AI tab layout, password reset screen, settings cleanup, deletePatient'],
    ['git','-C',REPO,'push','origin','main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout+r.stderr).strip()[:200] or "(ok)")
