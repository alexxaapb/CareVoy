import os, subprocess

REPO = '/workspaces/CareVoy'
f = os.path.join(REPO, 'partners-portal', 'admin.html')
c = open(f).read()
orig = c

# ════════════════════════════════════════════════════════════════
# FIX 1: "View" button on live rides - open a detail modal
# ════════════════════════════════════════════════════════════════
old_view_btn = "        '<div class=\"td\"><button class=\"view-btn\">View</button></div>' +"
new_view_btn = "        '<div class=\"td\"><button class=\"view-btn\" onclick=\"viewRide(' + JSON.stringify(r).replace(/\"/g,\\'&quot;\\') + ')\" style=\"background:#050D1F;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit\">View</button></div>' +"

if old_view_btn in c:
    c = c.replace(old_view_btn, new_view_btn)
    print("1a. View button wired to viewRide()")
else:
    print("1a. FAILED to find view button")

# Add viewRide function + modal
view_modal = '''
  <!-- Ride Detail Modal -->
  <div id="rideDetailModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:none;align-items:center;justify-content:center">
    <div style="background:#fff;border-radius:16px;padding:32px;max-width:480px;width:90%;max-height:80vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <div style="font-size:18px;font-weight:700;color:#050D1F">Ride Details</div>
        <button onclick="document.getElementById('rideDetailModal').style.display='none'" style="background:none;border:none;font-size:20px;cursor:pointer;color:#9CA3AF">&times;</button>
      </div>
      <div id="rideDetailBody"></div>
    </div>
  </div>

'''

# Insert before closing body tag
old_body_end = '</body>'
if old_body_end in c:
    c = c.replace(old_body_end, view_modal + old_body_end, 1)
    print("1b. Ride detail modal added")

# Add viewRide function before showSection
view_fn = '''
  function viewRide(r) {
    if (typeof r === 'string') { try { r = JSON.parse(r); } catch(e) { return; } }
    var t = r.pickup_time ? new Date(r.pickup_time).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}) : 'TBD';
    var rows = [
      ['Patient', r.patient_name || 'Unknown'],
      ['Contact', r.contact_phone || '—'],
      ['Status', (r.status||'').replace(/_/g,' ').replace(/\\b\\w/g,function(l){return l.toUpperCase();})],
      ['Facility', r.hospital_name || '—'],
      ['State', r.hospital_state || '—'],
      ['NEMT', r.nemt_partner_id ? 'Assigned' : 'Unassigned'],
      ['Pickup', r.pickup_address || '—'],
      ['Dropoff', r.dropoff_address || '—'],
      ['Pickup time', t],
      ['Ride type', r.ride_type || '—'],
      ['Procedure', r.procedure_type || '—'],
    ];
    document.getElementById('rideDetailBody').innerHTML = rows.map(function(row) {
      return '<div style="display:flex;padding:8px 0;border-bottom:1px solid #F3F4F6">' +
        '<div style="width:110px;font-size:12px;color:#6B7280;flex-shrink:0">' + row[0] + '</div>' +
        '<div style="font-size:13px;color:#111827;font-weight:500">' + esc(String(row[1])) + '</div>' +
      '</div>';
    }).join('');
    var modal = document.getElementById('rideDetailModal');
    modal.style.display = 'flex';
  }

'''

anchor = '  function renderLiveRides'
if anchor in c:
    c = c.replace(anchor, view_fn + anchor, 1)
    print("1c. viewRide() function added")
else:
    print("1c. FAILED to find anchor")

# ════════════════════════════════════════════════════════════════
# FIX 2: Export buttons for All Rides + All Patients tabs
# ════════════════════════════════════════════════════════════════
# Add export to All Rides title
old_rides_title = '''  <div class="page-title">All Rides</div>
  <div class="page-sub">Complete ride history across all facilities</div>'''
new_rides_title = '''  <div style="display:flex;justify-content:space-between;align-items:center">
    <div>
      <div class="page-title">All Rides</div>
      <div class="page-sub">Complete ride history across all facilities</div>
    </div>
    <button onclick="exportCSV('rides')" style="background:#050D1F;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Export CSV</button>
  </div>'''
if old_rides_title in c:
    c = c.replace(old_rides_title, new_rides_title)
    print("2a. Export CSV button added to All Rides")

# Add export to All Patients title
old_pat_title = '''  <div class="page-title">All Patients</div>
  <div class="page-sub">All registered patients across facilities</div>'''
new_pat_title = '''  <div style="display:flex;justify-content:space-between;align-items:center">
    <div>
      <div class="page-title">All Patients</div>
      <div class="page-sub">All registered patients across facilities</div>
    </div>
    <button onclick="exportCSV('patients')" style="background:#050D1F;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Export CSV</button>
  </div>'''
if old_pat_title in c:
    c = c.replace(old_pat_title, new_pat_title)
    print("2b. Export CSV button added to All Patients")

# Add exportCSV function
export_fn = '''
  async function exportCSV(type) {
    var h2 = authHeaders();
    var url, filename, fields;
    if (type === 'rides') {
      url = SUPA_URL + '/rest/v1/rides?select=id,patient_name,contact_phone,hospital_name,hospital_state,status,pickup_time,pickup_address,dropoff_address,ride_type,procedure_type,created_at&order=created_at.desc&limit=1000';
      filename = 'carevoy_rides_' + new Date().toISOString().slice(0,10) + '.csv';
      fields = ['id','patient_name','contact_phone','hospital_name','hospital_state','status','pickup_time','pickup_address','dropoff_address','ride_type','procedure_type','created_at'];
    } else {
      url = SUPA_URL + '/rest/v1/patients?select=id,full_name,phone,email,created_at&order=created_at.desc&limit=1000';
      filename = 'carevoy_patients_' + new Date().toISOString().slice(0,10) + '.csv';
      fields = ['id','full_name','phone','email','created_at'];
    }
    var r = await fetch(url, { headers: h2 });
    var rows = await r.json();
    if (!rows || !rows.length) { alert('No data to export'); return; }
    var csv = fields.join(',') + '\\n' + rows.map(function(row) {
      return fields.map(function(f) {
        var v = row[f] == null ? '' : String(row[f]);
        return '"' + v.replace(/"/g,'""') + '"';
      }).join(',');
    }).join('\\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

'''

anchor2 = '  function viewRide'
if anchor2 in c:
    c = c.replace(anchor2, export_fn + anchor2, 1)
    print("2c. exportCSV() function added")

if c != orig:
    open(f, 'w').write(c)
    print("   admin.html written")

cmds = [
    'rm -f fix_admin_view_and_export.py',
    'git add partners-portal/admin.html',
    'git commit -m "feat: admin live rides View button, ride detail modal, CSV export for rides+patients"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
