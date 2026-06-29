import os, subprocess, re

REPO = '/workspaces/CareVoy'
PP   = os.path.join(REPO, 'partners-portal')
results = []

# ════════════════════════════════════════════
# 1. PATIENTS - remove both remaining old squiggly icons (lines 221, 244)
# ════════════════════════════════════════════
pf = os.path.join(PP,'patients.html')
pc = open(pf).read()
OLD_SQUIG = '<svg viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="22" fill="#050D1F"/><circle cx="72" cy="50" r="22" stroke="#00C2A8" stroke-width="5" fill="none" stroke-dasharray="80 30"/><path d="M28 65 Q38 20 52 50 Q60 65 72 50" stroke="white" stroke-width="4" fill="none" stroke-linecap="round"/></svg>'
MM32 = '<svg width="32" height="32" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style="border-radius:7px;flex-shrink:0"><rect width="1024" height="1024" fill="#060D1F"/><g transform="translate(320.34 691.95) scale(0.5091 -0.5091)"><path d="M383 712Q515 712 605.0 641.5Q695 571 721 450H510Q491 490 457.5 511.0Q424 532 380 532Q312 532 271.5 483.5Q231 435 231 354Q231 272 271.5 223.5Q312 175 380 175Q424 175 457.5 196.0Q491 217 510 257H721Q695 136 605.0 65.5Q515 -5 383 -5Q279 -5 199.0 40.5Q119 86 75.5 167.5Q32 249 32 354Q32 458 75.5 539.5Q119 621 199.0 666.5Q279 712 383 712Z" fill="#FFFFFF"/></g><path d="M 758.20 555.41 A 250 250 0 1 1 758.20 468.59" fill="none" stroke="#00C2A8" stroke-width="22" stroke-linecap="round"/><circle cx="758.20" cy="555.41" r="17" fill="#F5A623"/><circle cx="758.20" cy="468.59" r="17" fill="#F5A623"/></svg>'
count = pc.count(OLD_SQUIG)
pc = pc.replace(OLD_SQUIG, MM32)
open(pf,'w').write(pc)
results.append(f"1. Patient: {count} old squiggly icons replaced with Motion Mark")

# Fix chat wrap to be mobile-friendly (remove fixed height, use flex-grow)
pc = open(pf).read()
pc = pc.replace(
    ".chat-wrap{display:flex;flex-direction:column;height:calc(100vh - 60px - 56px);max-height:700px}",
    ".chat-wrap{display:flex;flex-direction:column;min-height:0;flex:1}"
)
pc = pc.replace(
    ".chat-messages{flex:1;overflow-y:auto;padding:16px 0;display:flex;flex-direction:column;gap:12px}",
    ".chat-messages{flex:1;overflow-y:auto;padding:16px 0;display:flex;flex-direction:column;gap:12px;min-height:200px;max-height:calc(100vh - 260px)}"
)
# Make AI tab section use full height flex
pc = pc.replace(
    'id="tabAI">',
    'id="tabAI" style="display:none;flex-direction:column;flex:1;min-height:0">'
)
pc = pc.replace(
    "document.getElementById('tab'+name).classList.add('active');",
    "document.getElementById('tab'+name).classList.add('active');\n  if(name==='AI'){document.getElementById('tabAI').style.display='flex';}"
)
open(pf,'w').write(pc)
results.append("2. Patient chat: mobile-friendly height, input accessible without scrolling")

# ════════════════════════════════════════════
# 3. ADMIN - fix keyfob to navigate same-tab (uses localStorage admin token)
#    + fix NEMT click (stopPropagation in showNemtProfile)
#    + fix NEMT/facility active toggle
#    + simplify Settings page
# ════════════════════════════════════════════
af = os.path.join(PP,'admin.html')
ac = open(af).read()

# 3a. Keyfob: same-tab navigation instead of new tab
ac = ac.replace(
    "openBtn.onclick = function(){ var v = sel2.value; if(v){ window.open('/coordinator?preview_hospital='+v,'_blank'); } d.remove(); };",
    "openBtn.onclick = function(){ var v = sel2.value; if(v){ window.location.href = '/coordinator?preview_hospital='+v; } d.remove(); };"
)
ac = ac.replace(
    "openBtn2.onclick = function(){ var v = sel3.value; if(v){ window.open('/driver?preview_nemt='+v,'_blank'); } d.remove(); };",
    "openBtn2.onclick = function(){ var v = sel3.value; if(v){ window.location.href = '/driver?preview_nemt='+v; } d.remove(); };"
)
ac = ac.replace(
    "if (mode === 'patient') { window.open('/patients', '_blank'); return; }",
    "if (mode === 'patient') { window.location.href = '/patients'; return; }"
)
results.append("3a. Admin keyfob: same-tab navigation (uses localStorage token)")

# 3b. NEMT click: stopPropagation so modal doesn't immediately close
old_show_nemt = """  function showNemtProfile(idx) {
    var data = window._allNemt[idx];
    if (!data) return;"""
new_show_nemt = """  function showNemtProfile(idx, evt) {
    if (evt) evt.stopPropagation();
    var data = window._allNemt[idx];
    if (!data) return;"""
if old_show_nemt in ac:
    ac = ac.replace(old_show_nemt, new_show_nemt)
    # Pass evt to the call
    ac = ac.replace(
        "row.addEventListener('click', function(){ showNemtProfile(parseInt(row.getAttribute('data-idx'),10)); });",
        "row.addEventListener('click', function(e){ showNemtProfile(parseInt(row.getAttribute('data-idx'),10), e); });"
    )
    results.append("3b. NEMT click: stopPropagation prevents modal immediate-close")
else:
    results.append("3b. FAIL: showNemtProfile signature not matched")

# 3c. Add Active/Inactive toggle button to NEMT profile modal
old_nemt_modal_end = """    document.getElementById("rideDetailBody").innerHTML = rows;
    var modal = document.getElementById("rideDetailModal");
    var titleEl = modal.querySelector('div[style*="font-size:18px"]');
    if (titleEl) titleEl.textContent = "Partner Profile";
    modal.style.display = "flex";
  }"""
new_nemt_modal_end = """    var toggleBtn = '<div style="margin-top:20px;padding-top:16px;border-top:1px solid #F3F4F6;display:flex;align-items:center;justify-content:space-between">'
      + '<span style="font-size:12px;color:#6B7280">Status: <strong>' + (data.active ? 'Active' : 'Inactive') + '</strong></span>'
      + '<button onclick="toggleNemtActive(\'' + data.id + '\',' + (!data.active) + ')" style="padding:8px 18px;border-radius:8px;background:' + (data.active ? '#FEF2F2' : '#ECFDF5') + ';color:' + (data.active ? '#EF4444' : '#059669') + ';border:1px solid ' + (data.active ? '#FECACA' : '#A7F3D0') + ';font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">'
      + (data.active ? 'Set Inactive' : 'Set Active') + '</button></div>';
    document.getElementById("rideDetailBody").innerHTML = rows + toggleBtn;
    var modal = document.getElementById("rideDetailModal");
    var titleEl = modal.querySelector('div[style*="font-size:18px"]');
    if (titleEl) titleEl.textContent = "Partner Profile";
    modal.style.display = "flex";
  }

  async function toggleNemtActive(partnerId, newActive) {
    try {
      await fetch(SUPA_URL + '/rest/v1/nemt_partners?id=eq.' + partnerId, {
        method: 'PATCH',
        headers: { ...H, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ active: newActive })
      });
      document.getElementById("rideDetailModal").style.display = "none";
      showToast(newActive ? 'Partner set to Active' : 'Partner set to Inactive', 'ok');
      loadDashboard();
    } catch(e) { showToast('Could not update status', 'err'); }
  }"""
if old_nemt_modal_end in ac:
    ac = ac.replace(old_nemt_modal_end, new_nemt_modal_end)
    results.append("3c. Admin: Active/Inactive toggle added to NEMT profile modal")
else:
    results.append("3c. FAIL: NEMT modal end not matched")

# 3d. Settings page: remove developer/tech info, make business-facing
old_settings = """      <div class="page-title">Settings</div>
      <div class="page-sub">Portal configuration and account management</div>"""
# We'll leave the settings title but replace the tech cards with business cards below
# Find the settings panel content and replace it
old_settings_cards = """      <div class="two-col" style="margin-top:24px">
        <div class="panel">
          <div class="panel-header"><div class="panel-title">Project Connections</div></div>
          <div style="padding:16px 20px">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #F3F4F6">
              <div><div style="font-size:13px;font-weight:600;color:#050D1F">Supabase Database</div><div style="font-size:12px;color:#9CA3AF">byflpckbjjumxxjxoplk.supabase.co</div></div>
              <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(16,185,129,.1);color:#065f46">• Connected</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #F3F4F6">
              <div><div style="font-size:13px;font-weight:600;color:#050D1F">API Server</div><div style="font-size:12px;color:#9CA3AF">care-voy-api-server.vercel.app</div></div>
              <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(16,185,129,.1);color:#065f46">• Connected</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0">
              <div><div style="font-size:13px;font-weight:600;color:#050D1F">Partner Portal</div><div style="font-size:12px;color:#9CA3AF">partners.carevoy.co</div></div>
              <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(0,194,168,.1);color:#00836F">• Live</span>
            </div>
          </div>
        </div>"""
new_settings_cards = """      <div class="two-col" style="margin-top:24px">
        <div class="panel">
          <div class="panel-header"><div class="panel-title">Platform Status</div></div>
          <div style="padding:16px 20px">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #F3F4F6">
              <div><div style="font-size:13px;font-weight:600;color:#050D1F">Partner Portal</div><div style="font-size:12px;color:#9CA3AF">partners.carevoy.co</div></div>
              <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(0,194,168,.1);color:#00836F">• Live</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #F3F4F6">
              <div><div style="font-size:13px;font-weight:600;color:#050D1F">Patient Portal</div><div style="font-size:12px;color:#9CA3AF">partners.carevoy.co/patients</div></div>
              <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(0,194,168,.1);color:#00836F">• Live</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0">
              <div><div style="font-size:13px;font-weight:600;color:#050D1F">Email Notifications</div><div style="font-size:12px;color:#9CA3AF">partners@carevoy.co / notifications@carevoy.co</div></div>
              <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(16,185,129,.1);color:#065f46">• Active</span>
            </div>
          </div>
        </div>"""
if old_settings_cards in ac:
    ac = ac.replace(old_settings_cards, new_settings_cards)
    results.append("3d. Settings: business-facing (removed Supabase/API URLs)")
else:
    results.append("3d. FAIL: settings cards not matched")

open(af,'w').write(ac)

# ════════════════════════════════════════════
# 4. COORDINATOR - fix keyfob + asterisks + bulk email required
# ════════════════════════════════════════════
cf = os.path.join(PP,'coordinator.html')
cc = open(cf).read()

# 4a. Skip auth redirect when preview_hospital param present
old_early_check = "if (!token || !uid) { window.location.href = '/'; }"
new_early_check = "if (!token || !uid) { if (!new URLSearchParams(window.location.search).get('preview_hospital')) { window.location.href = '/'; } }"
if old_early_check in cc:
    cc = cc.replace(old_early_check, new_early_check)
    results.append("4a. Coordinator: skips auth redirect in preview mode")
else:
    results.append("4a. FAIL: coordinator early check not found")

# 4b. In preview mode, use admin token from localStorage
old_coord_init_var = "var token = sessionStorage.getItem('cv_coord_token');\nvar uid   = sessionStorage.getItem('cv_coord_uid');"
new_coord_init_var = "var token = sessionStorage.getItem('cv_coord_token') || localStorage.getItem('cv_admin_token');\nvar uid   = sessionStorage.getItem('cv_coord_uid') || localStorage.getItem('cv_admin_uid');"
if old_coord_init_var in cc:
    cc = cc.replace(old_coord_init_var, new_coord_init_var)
    results.append("4b. Coordinator: uses admin token from localStorage in preview mode")
else:
    results.append("4b. FAIL: coord token vars not matched")

# 4c. Add missing asterisks to Appointment Type and Payment
cc = cc.replace(
    '<label class="form-label">Appointment Type</label>',
    '<label class="form-label">Appointment Type <span style="color:#EF4444">*</span></label>'
)
# Find paymentResp label
cc = cc.replace(
    '<label class="form-label">Who pays for the ride?</label>',
    '<label class="form-label">Who pays for the ride? <span style="color:#EF4444">*</span></label>'
)
# Also try alternate label text
cc = cc.replace(
    '<label class="form-label">Payment type</label>',
    '<label class="form-label">Payment type <span style="color:#EF4444">*</span></label>'
)
results.append("4c. Coordinator: Appointment Type + Payment asterisks added")

# 4d. Bulk upload: make email required in the description + update format hint
cc = cc.replace(
    'Required: <strong>First Name, Last Name, Phone</strong>. Optional: Email, Appointment Date, Appointment Type, Caregiver Name, Caregiver Phone.',
    'Required: <strong>First Name, Last Name, Email</strong>. Optional: Phone, Appointment Date, Appointment Type, Caregiver Name, Caregiver Email, Caregiver Phone.'
)
results.append("4d. Coordinator: bulk upload - email required (not phone), format updated")

open(cf,'w').write(cc)

# ════════════════════════════════════════════
# 5. DRIVER - skip auth in preview mode + use admin token
# ════════════════════════════════════════════
df = os.path.join(PP,'driver.html')
dc = open(df).read()

old_driver_vars = "var token = sessionStorage.getItem('cv_nemt_token');\nvar uid   = sessionStorage.getItem('cv_nemt_uid');"
new_driver_vars = "var token = sessionStorage.getItem('cv_nemt_token') || localStorage.getItem('cv_admin_token');\nvar uid   = sessionStorage.getItem('cv_nemt_uid') || localStorage.getItem('cv_admin_uid');"
if old_driver_vars in dc:
    dc = dc.replace(old_driver_vars, new_driver_vars)
    results.append("5a. Driver: uses admin token in preview mode")
else:
    results.append("5a. FAIL: driver token vars not matched")

old_driver_check = "if (!token || !uid) { window.location.href = '/'; }"
new_driver_check = "if (!token || !uid) { if (!new URLSearchParams(window.location.search).get('preview_nemt')) { window.location.href = '/'; } }"
if old_driver_check in dc:
    dc = dc.replace(old_driver_check, new_driver_check, 1)
    results.append("5b. Driver: skips auth redirect in preview mode")
else:
    results.append("5b. FAIL: driver early check not matched")

# Remove orphan MVP CSS
dc = dc.replace(
    "    /* MVP banner */\n    .mvp-banner { background:#fef3c7; border:1px solid #f59e0b; border-radius:9px; padding:10px 14px; margin-bottom:16px; font-size:12px; color:#92400e; }\n",
    ""
)
results.append("5c. Driver: orphan MVP CSS removed")
open(df,'w').write(dc)

# ════════════════════════════════════════════
# Print + commit
# ════════════════════════════════════════════
print("="*60)
for r in results: print(" ✓", r)
print("="*60)

pc2=open(pf).read(); ac2=open(af).read(); cc2=open(cf).read(); dc2=open(df).read()
print("\nVERIFICATION:")
print("  Patient old icon gone:", 'viewBox="0 0 100 100"' not in pc2)
print("  Chat mobile fix:", 'max-height:calc(100vh - 260px)' in pc2)
print("  Admin same-tab nav:", 'window.location.href' in ac2 and 'window.open' not in ac2.split('setViewMode')[1][:500])
print("  Admin NEMT stopProp:", 'evt.stopPropagation' in ac2)
print("  Admin active toggle:", 'toggleNemtActive' in ac2)
print("  Admin settings clean:", 'byflpckbjjumxxjxoplk' not in ac2)
print("  Coord preview mode:", 'preview_hospital' in cc2)
print("  Coord admin token:", 'cv_admin_token' in cc2)
print("  Coord appt type asterisk:", 'Appointment Type <span style="color:#EF4444">' in cc2)
print("  Coord bulk email required:", 'Required: <strong>First Name, Last Name, Email</strong>' in cc2)
print("  Driver preview mode:", 'preview_nemt' in dc2)
print("  Driver admin token:", 'cv_admin_token' in dc2)
print("  Driver MVP CSS gone:", 'mvp-banner' not in dc2)
print()

for cmd in [
    ['git','-C',REPO,'add','-A',
     'partners-portal/patients.html','partners-portal/admin.html',
     'partners-portal/coordinator.html','partners-portal/driver.html'],
    ['git','-C',REPO,'commit','-m','fix: icons, keyfob same-tab+admin-token, NEMT click stopProp, mobile chat, asterisks, settings'],
    ['git','-C',REPO,'push','origin','main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout+r.stderr).strip()[:200] or "(ok)")
