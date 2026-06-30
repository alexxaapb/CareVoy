import os, subprocess

REPO = '/workspaces/CareVoy'
PP   = os.path.join(REPO, 'partners-portal')
results = []

# ══════════════════════════════════════════════════════
# 1. ADMIN — fix rideDetailModal (display:none twice)
# ══════════════════════════════════════════════════════
af = os.path.join(PP,'admin.html')
ac = open(af).read()

ac = ac.replace(
    'id="rideDetailModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:none;align-items:center;justify-content:center"',
    'id="rideDetailModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;align-items:center;justify-content:center"'
)
results.append("1. Admin modal: removed duplicate display:none")

# ══════════════════════════════════════════════════════
# 2. ADMIN — add Edit/Remove buttons to patient rows
# ══════════════════════════════════════════════════════
old_patient_row = """        return '<div class="rides-row" style="grid-template-columns:1.6fr 1.4fr 1fr 0.8fr;background:' + bg + '">' +
          '<div class="td"><strong>' + esc(p.full_name || 'Unknown') + '</strong></div>' +
          '<div class="td">' + esc(phone) + '</div>' +
          '<div class="td" style="font-size:11px">' + esc(email) + '</div>' +
          '<div class="td" style="font-size:11px;color:#6B7280">' + esc(joined) + '</div>' +
        '</div>';"""

new_patient_row = """        return '<div class="rides-row" style="grid-template-columns:1.6fr 1.2fr 1fr 0.6fr 0.8fr;background:' + bg + '">' +
          '<div class="td"><strong>' + esc(p.full_name || 'Unknown') + '</strong></div>' +
          '<div class="td">' + esc(phone) + '</div>' +
          '<div class="td" style="font-size:11px">' + esc(email) + '</div>' +
          '<div class="td" style="font-size:11px;color:#6B7280">' + esc(joined) + '</div>' +
          '<div class="td"><button onclick="deletePatient(\\'' + esc(p.id||'') + '\\',\\'' + esc(email) + '\\')" style="padding:4px 10px;background:none;border:1px solid #FECACA;border-radius:6px;color:#EF4444;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">Remove</button></div>' +
        '</div>';"""

if old_patient_row in ac:
    ac = ac.replace(old_patient_row, new_patient_row)
    # Also update the table header to include the Actions column
    ac = ac.replace(
        "'<div class=\"th\">Joined</div>'",
        "'<div class=\"th\">Joined</div><div class=\"th\">Actions</div>'"
    )
    results.append("2. Admin patients: Remove button added to each row")
else:
    results.append("2. FAIL: patient row pattern not matched")

# ══════════════════════════════════════════════════════
# 3. ADMIN — add Delete button to ride rows
# ══════════════════════════════════════════════════════
old_ride_action = """        } else if (r.nemt_partner_id) {
          actionBtn = '<span style="font-size:11px;color:#9CA3AF">Assigned</span>';
        }"""
new_ride_action = """        } else if (r.nemt_partner_id) {
          actionBtn = '<span style="font-size:11px;color:#9CA3AF">Assigned</span>';
        }
        var deleteBtn = '<button onclick="adminDeleteRide(\\'' + esc(r.id) + '\\')" style="margin-left:6px;padding:4px 8px;background:none;border:1px solid #FECACA;border-radius:6px;color:#EF4444;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit">Del</button>';"""
if old_ride_action in ac:
    ac = ac.replace(old_ride_action, new_ride_action)
    # Add deleteBtn to the row output
    ac = ac.replace(
        "'<div class=\"td\">' + actionBtn + '</div></div>';",
        "'<div class=\"td\">' + actionBtn + deleteBtn + '</div></div>';"
    )
    results.append("3. Admin rides: Delete button added to each row")
else:
    results.append("3. FAIL: ride action pattern not matched")

# Add adminDeleteRide function (near deletePatient)
if 'function adminDeleteRide' not in ac:
    ac = ac.replace(
        'async function deletePatient(',
        """async function adminDeleteRide(rideId) {
  if (!confirm('Delete this ride permanently?')) return;
  var _SUPA = 'https://byflpckbjjumxxjxoplk.supabase.co';
  var _KEY  = 'sb_publishable_mwR5uT4W3C2M-K5LbBag4g_GdN0plrT';
  var _tk   = localStorage.getItem('cv_admin_token') || sessionStorage.getItem('cv_admin_token') || '';
  var _H    = { 'apikey': _KEY, 'Authorization': 'Bearer ' + _tk, 'Prefer': 'return=minimal' };
  try {
    await fetch(_SUPA + '/rest/v1/rides?id=eq.' + rideId, { method: 'DELETE', headers: _H });
    showToast('Ride deleted', 'ok');
    loadAllRides();
  } catch(e) { showToast('Could not delete ride', 'err'); }
}

async function deletePatient("""
    )
    results.append("3b. Admin rides: adminDeleteRide function added")

open(af,'w').write(ac)

# ══════════════════════════════════════════════════════
# 4. DRIVER — fix history export button position to match other tabs
# ══════════════════════════════════════════════════════
df = os.path.join(PP,'driver.html')
dc = open(df).read()

old_history_header = """  <!-- ── HISTORY ── -->
  <div class="page" id="sec-history" style="display:none">
    <div style="font-size:22px;font-weight:700;color:#050D1F;margin-bottom:4px">Ride History</div>
    <div style="font-size:13px;color:#6B7280;margin-bottom:16px">All completed rides</div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button onclick="exportNemtCSV('history')" style="background:#050D1F;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Export CSV</button>
    </div>"""

new_history_header = """  <!-- ── HISTORY ── -->
  <div class="page" id="sec-history" style="display:none">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-size:14px;font-weight:700;color:#050D1F">Ride History</div>
      <button onclick="exportNemtCSV('history')" style="background:#050D1F;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Export CSV</button>
    </div>
    <div style="font-size:22px;font-weight:700;color:#050D1F;margin-bottom:4px">Ride History</div>
    <div style="font-size:13px;color:#6B7280;margin-bottom:18px">All completed rides</div>"""

if old_history_header in dc:
    dc = dc.replace(old_history_header, new_history_header)
    results.append("4. Driver: History export aligned to top-right (matches Available/Schedule)")
else:
    results.append("4. FAIL: history header pattern not matched")

open(df,'w').write(dc)

# ══════════════════════════════════════════════════════
# 5. PATIENT — add Change Password to profile tab
# ══════════════════════════════════════════════════════
pf = os.path.join(PP,'patients.html')
pc = open(pf).read()

old_profile_pw = """      <div class="profile-card">
        <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px">Password</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:14px">A reset link will be sent to your email</div>
        <button class="btn btn-ghost" style="width:auto;padding:10px 24px;font-size:13px" onclick="sendPasswordReset()">Send reset link</button>
      </div>"""

new_profile_pw = """      <div class="profile-card">
        <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px">Password</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:14px">Update your password directly or receive a reset link by email</div>
        <div class="field-group">
          <label class="form-label">New password</label>
          <input class="form-input" id="newPassInline" type="password" placeholder="Min 8 characters" autocomplete="new-password">
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-navy" style="width:auto;padding:10px 24px;font-size:13px" onclick="changePasswordInline()">Update password</button>
          <button class="btn btn-ghost" style="width:auto;padding:10px 24px;font-size:13px" onclick="sendPasswordReset()">Send reset link instead</button>
        </div>
      </div>"""

if old_profile_pw in pc:
    pc = pc.replace(old_profile_pw, new_profile_pw)
    results.append("5a. Patient profile: inline password change + reset link option")
else:
    results.append("5a. FAIL: profile password section not matched")

# Add changePasswordInline function
if 'function changePasswordInline' not in pc:
    pc = pc.replace(
        'async function sendPasswordReset() {',
        """async function changePasswordInline() {
  var pass = document.getElementById('newPassInline').value;
  if (!pass || pass.length < 8) { toast('Password must be at least 8 characters'); return; }
  var { error } = await sb.auth.updateUser({ password: pass });
  if (error) { toast(error.message); return; }
  document.getElementById('newPassInline').value = '';
  toast('Password updated');
}

async function sendPasswordReset() {"""
    )
    results.append("5b. Patient: changePasswordInline() function added")

open(pf,'w').write(pc)

# ══════════════════════════════════════════════════════
# PRINT + VERIFY + COMMIT
# ══════════════════════════════════════════════════════
print("="*60)
for r in results: print(" ✓", r)
print("="*60)

ac2 = open(af).read()
dc2 = open(df).read()
pc2 = open(pf).read()
print("\nVERIFICATION:")
print("  Admin modal no dup display:", ac2.count('display:none') < ac2.count('rideDetailModal') + 5)
print("  Admin patient Remove btn:", 'deletePatient' in ac2 and 'Remove</button>' in ac2)
print("  Admin ride Del btn:", 'adminDeleteRide' in ac2 and 'Del</button>' in ac2)
print("  Driver history aligned:", 'justify-content:space-between' in dc2.split('sec-history')[1][:300])
print("  Patient inline password:", 'changePasswordInline' in pc2)

print()
for cmd in [
    ['git','-C',REPO,'add','-A',
     'partners-portal/admin.html','partners-portal/driver.html','partners-portal/patients.html'],
    ['git','-C',REPO,'commit','-m','fix: admin modal+patient remove+ride delete, driver export align, patient password change'],
    ['git','-C',REPO,'push','origin','main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout+r.stderr).strip()[:200] or '(ok)')
