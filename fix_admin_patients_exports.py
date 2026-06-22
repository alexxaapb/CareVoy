import os, subprocess

REPO = '/workspaces/CareVoy'
f = os.path.join(REPO, 'partners-portal', 'admin.html')
c = open(f).read()
orig = c

# ════════════════════════════════════════════════════════════════
# FIX 1: loadPatients — use RPC function to bypass RLS
# ════════════════════════════════════════════════════════════════
old_fetch = "      var r = await fetch(SUPA_URL + '/rest/v1/patients?select=id,full_name,phone,email,created_at&order=created_at.desc&limit=200', { headers: h });"
new_fetch = "      var r = await fetch(SUPA_URL + '/rest/v1/rpc/admin_list_patients', { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: '{}' });"

if old_fetch in c:
    c = c.replace(old_fetch, new_fetch)
    print("1. loadPatients now uses RPC (bypasses RLS)")
else:
    print("1. FAILED to find loadPatients fetch")

# ════════════════════════════════════════════════════════════════
# FIX 2: Add Export CSV to Facilities tab
# ════════════════════════════════════════════════════════════════
old_fac = '''  <div class="page-title">Facilities</div>
  <div class="page-sub">All onboarded facility partners</div>'''
new_fac = '''  <div style="display:flex;justify-content:space-between;align-items:center">
    <div><div class="page-title">Facilities</div>
    <div class="page-sub">All onboarded facility partners</div></div>
    <button onclick="exportCSV('facilities')" style="background:#050D1F;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Export CSV</button>
  </div>'''
if old_fac in c:
    c = c.replace(old_fac, new_fac)
    print("2a. Export button added to Facilities")

# ════════════════════════════════════════════════════════════════
# FIX 3: Add Export CSV to NEMT Partners tab
# ════════════════════════════════════════════════════════════════
old_nemt = '''  <div class="page-title">NEMT Partners</div>
  <div class="page-sub">All transport partners in your network</div>'''
new_nemt = '''  <div style="display:flex;justify-content:space-between;align-items:center">
    <div><div class="page-title">NEMT Partners</div>
    <div class="page-sub">All transport partners in your network</div></div>
    <button onclick="exportCSV('partners')" style="background:#050D1F;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Export CSV</button>
  </div>'''
if old_nemt in c:
    c = c.replace(old_nemt, new_nemt)
    print("2b. Export button added to NEMT Partners")

# ════════════════════════════════════════════════════════════════
# FIX 4: Add Export CSV to Revenue tab
# ════════════════════════════════════════════════════════════════
old_rev = '''<div id="sec-revenue" style="display:none" class="page-overlay">'''
new_rev = '''<div id="sec-revenue" style="display:none" class="page-overlay">
  <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
    <button onclick="exportCSV('revenue')" style="background:#050D1F;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Export CSV</button>
  </div>'''
if old_rev in c:
    c = c.replace(old_rev, new_rev, 1)
    print("2c. Export button added to Revenue")

# ════════════════════════════════════════════════════════════════
# FIX 5: Extend exportCSV to handle facilities, partners, revenue
# ════════════════════════════════════════════════════════════════
old_export_end = """    } else {
      url = SUPA_URL + '/rest/v1/patients?select=id,full_name,phone,email,created_at&order=created_at.desc&limit=1000';
      filename = 'carevoy_patients_' + new Date().toISOString().slice(0,10) + '.csv';
      fields = ['id','full_name','phone','email','created_at'];
    }"""

new_export_end = """    } else if (type === 'patients') {
      url = SUPA_URL + '/rest/v1/rpc/admin_list_patients';
      isRpc = true;
      filename = 'carevoy_patients_' + new Date().toISOString().slice(0,10) + '.csv';
      fields = ['id','full_name','phone','email','created_at'];
    } else if (type === 'facilities') {
      url = SUPA_URL + '/rest/v1/hospitals?select=id,name,city,state,active,facility_type,created_at&order=name.asc&limit=1000';
      filename = 'carevoy_facilities_' + new Date().toISOString().slice(0,10) + '.csv';
      fields = ['id','name','city','state','active','facility_type','created_at'];
    } else if (type === 'partners') {
      url = SUPA_URL + '/rest/v1/nemt_partners?select=id,company_name,city,service_states,vehicle_types,active,created_at&order=company_name.asc&limit=1000';
      filename = 'carevoy_nemt_partners_' + new Date().toISOString().slice(0,10) + '.csv';
      fields = ['id','company_name','city','service_states','vehicle_types','active','created_at'];
    } else if (type === 'revenue') {
      url = SUPA_URL + '/rest/v1/payments?select=id,amount,patient_id,ride_id,payment_method,created_at&order=created_at.desc&limit=1000';
      filename = 'carevoy_revenue_' + new Date().toISOString().slice(0,10) + '.csv';
      fields = ['id','amount','patient_id','ride_id','payment_method','created_at'];
    }"""

if old_export_end in c:
    c = c.replace(old_export_end, new_export_end)
    print("3a. exportCSV extended for facilities, partners, revenue")

# Add isRpc handling to the fetch call
old_export_fetch = "    var r = await fetch(url, { headers: h2 });"
new_export_fetch = "    var r = isRpc ? await fetch(url, { method: 'POST', headers: { ...h2, 'Content-Type': 'application/json' }, body: '{}' }) : await fetch(url, { headers: h2 });"
if old_export_fetch in c:
    c = c.replace(old_export_fetch, new_export_fetch)
    print("3b. Export fetch handles RPC for patients")

# Add isRpc variable initialization
old_export_vars = "    var url, filename, fields;"
new_export_vars = "    var url, filename, fields, isRpc = false;"
if old_export_vars in c:
    c = c.replace(old_export_vars, new_export_vars)
    print("3c. isRpc variable added")

if c != orig:
    open(f, 'w').write(c)
    print("   admin.html written")

cmds = [
    'rm -f fix_admin_patients_exports.py',
    'git add partners-portal/admin.html',
    'git commit -m "fix: admin patients via RPC (bypass RLS) + export CSV on all tabs"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
