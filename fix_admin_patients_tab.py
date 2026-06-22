import os, subprocess

REPO = '/workspaces/CareVoy'
f = os.path.join(REPO, 'partners-portal', 'admin.html')
c = open(f).read()
orig = c

# ════════════════════════════════════════════════════════════════
# FIX 1: Replace the empty placeholder in sec-patients with a
# real table that loadPatients() will populate.
# ════════════════════════════════════════════════════════════════
old_sec = '''<div id="sec-patients" style="display:none" class="page-overlay">
  <div class="page-title">All Patients</div>
  <div class="page-sub">All registered patients across facilities</div>
  <div style="background:#fff;border-radius:14px;border:1px solid #E2E8F0;padding:40px;text-align:center;color:#9CA3AF;font-size:13px">
    Patient list will appear here once patients register through the app.
  </div>
</div>'''

new_sec = '''<div id="sec-patients" style="display:none" class="page-overlay">
  <div class="page-title">All Patients</div>
  <div class="page-sub">All registered patients across facilities</div>
  <div style="background:#fff;border-radius:14px;border:1px solid #E2E8F0">
    <div class="rides-table-head" style="grid-template-columns:1.6fr 1.4fr 1fr 0.8fr">
      <div class="th">Name</div>
      <div class="th">Phone</div>
      <div class="th">Email</div>
      <div class="th">Joined</div>
    </div>
    <div id="patientsBody">
      <div style="padding:40px;text-align:center;color:#9CA3AF;font-size:13px">Loading...</div>
    </div>
  </div>
</div>'''

if old_sec in c:
    c = c.replace(old_sec, new_sec)
    print("1. Patients section replaced with real table")
else:
    print("1. FAILED to find patients section placeholder")

# ════════════════════════════════════════════════════════════════
# FIX 2: Add loadPatients() function and wire it into showSection
# ════════════════════════════════════════════════════════════════

# 2a. Add loadPatients before the closing </script> or near other load functions
load_fn = '''
  // ── Load all registered patients ──
  async function loadPatients() {
    var body = document.getElementById('patientsBody');
    if (!body) return;
    body.innerHTML = '<div style="padding:40px;text-align:center;color:#9CA3AF;font-size:13px">Loading...</div>';
    try {
      var r = await fetch(SUPA_URL + '/rest/v1/patients?select=id,full_name,phone,email,created_at&order=created_at.desc&limit=200', { headers: h });
      var rows = await r.json();
      if (!rows || rows.length === 0) {
        body.innerHTML = '<div style="padding:40px;text-align:center;color:#9CA3AF;font-size:13px">No patients registered yet.</div>';
        return;
      }
      body.innerHTML = rows.map(function(p, i) {
        var joined = p.created_at ? new Date(p.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—';
        var phone = p.phone || '—';
        var email = p.email || '—';
        var bg = i % 2 === 0 ? '#fff' : '#F9FAFB';
        return '<div class="rides-table-row" style="grid-template-columns:1.6fr 1.4fr 1fr 0.8fr;background:' + bg + '">' +
          '<div class="td"><strong>' + esc(p.full_name || 'Unknown') + '</strong></div>' +
          '<div class="td">' + esc(phone) + '</div>' +
          '<div class="td" style="font-size:11px">' + esc(email) + '</div>' +
          '<div class="td" style="font-size:11px;color:#6B7280">' + esc(joined) + '</div>' +
        '</div>';
      }).join('');
    } catch(e) {
      body.innerHTML = '<div style="padding:40px;text-align:center;color:#ef4444;font-size:13px">Error loading patients: ' + esc(e.message) + '</div>';
    }
  }

'''

# Insert before showSection function
anchor = '    var sections = [\'overview\',\'patients\',\'rides\',\'facilities\',\'partners\',\'revenue\',\'settings\'];'
if anchor in c:
    c = c.replace(anchor, load_fn + '    ' + anchor.strip())
    print("2a. loadPatients() function added")
else:
    print("2a. FAILED to find anchor for loadPatients")

# 2b. Wire loadPatients into showSection when patients tab is clicked
old_show = "    if (name === 'revenue') {"
new_show = """    // Load data when switching to the patients tab
    if (name === 'patients') { loadPatients(); }
    if (name === 'revenue') {"""
if old_show in c:
    c = c.replace(old_show, new_show, 1)
    print("2b. loadPatients() wired into showSection")
else:
    print("2b. FAILED to find showSection revenue block")

if c != orig:
    open(f, 'w').write(c)
    print("   admin.html written")

cmds = [
    'rm -f fix_admin_patients_tab.py',
    'git add partners-portal/admin.html',
    'git commit -m "fix: admin Patients tab now loads and displays all registered patients"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
