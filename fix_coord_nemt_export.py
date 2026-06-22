import os, subprocess

REPO = '/workspaces/CareVoy'

# ════════════════════════════════════════════════════════════════
# COORDINATOR: add export to rides tab
# ════════════════════════════════════════════════════════════════
cf = os.path.join(REPO, 'partners-portal', 'coordinator.html')
cc = open(cf).read()
ccorig = cc

# Add exportCSV function to coordinator
export_fn_coord = '''
  function exportCoordCSV() {
    var rows = document.querySelectorAll('#ridesTableBody .rides-table-row, #ridesTableBody .row');
    if (!rows.length) { alert('No rides to export'); return; }
    // Export from the loaded rides data directly
    fetch(SUPA + '/rest/v1/rides?hospital_id=eq.' + coordInfo.hospital_id + '&select=id,patient_name,contact_phone,status,pickup_time,pickup_address,dropoff_address,ride_type,procedure_type,created_at&order=pickup_time.desc&limit=500', { headers: H })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (!data.length) { alert('No data to export'); return; }
      var fields = ['id','patient_name','contact_phone','status','pickup_time','pickup_address','dropoff_address','ride_type','procedure_type','created_at'];
      var csv = fields.join(',') + '\\n' + data.map(function(row){
        return fields.map(function(f){ var v = row[f]==null?'':String(row[f]); return '"'+v.replace(/"/g,'""')+'"'; }).join(',');
      }).join('\\n');
      var blob = new Blob([csv],{type:'text/csv'});
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'carevoy_facility_rides_' + new Date().toISOString().slice(0,10) + '.csv';
      a.click();
    });
  }

'''

# Find a good anchor in coordinator - before the first function or near loadRides
coord_anchor = '  async function loadRides() {'
if coord_anchor in cc:
    cc = cc.replace(coord_anchor, export_fn_coord + coord_anchor, 1)
    print("1a. exportCoordCSV() added to coordinator")

# Add export button near rides section header
rides_header = '<div class="page-title">Ride Management</div>'
if rides_header in cc:
    cc = cc.replace(rides_header, 
        '<div style="display:flex;justify-content:space-between;align-items:center"><div class="page-title">Ride Management</div>'
        '<button onclick="exportCoordCSV()" style="background:#050D1F;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Export CSV</button></div>')
    print("1b. Export button added to coordinator rides")

if cc != ccorig:
    open(cf, 'w').write(cc)
    print("   coordinator.html written")

# ════════════════════════════════════════════════════════════════
# NEMT/DRIVER: add export to ride history + scheduled tabs
# ════════════════════════════════════════════════════════════════
df = os.path.join(REPO, 'partners-portal', 'driver.html')
dd = open(df).read()
ddorig = dd

export_fn_nemt = '''
  function exportNemtCSV(type) {
    var status = type === 'history' ? 'completed' : 'assigned,en_route,arrived';
    var url = SUPA + '/rest/v1/rides?nemt_partner_id=eq.' + partnerId + '&status=in.(' + status + ')&select=id,patient_name,contact_phone,hospital_name,hospital_state,status,pickup_time,pickup_address,dropoff_address,ride_type,created_at&order=pickup_time.desc&limit=500';
    fetch(url, { headers: H })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (!data || !data.length) { alert('No data to export'); return; }
      var fields = ['id','patient_name','contact_phone','hospital_name','hospital_state','status','pickup_time','pickup_address','dropoff_address','ride_type','created_at'];
      var csv = fields.join(',') + '\\n' + data.map(function(row){
        return fields.map(function(f){ var v = row[f]==null?'':String(row[f]); return '"'+v.replace(/"/g,'""')+'"'; }).join(',');
      }).join('\\n');
      var blob = new Blob([csv],{type:'text/csv'});
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'carevoy_nemt_' + type + '_' + new Date().toISOString().slice(0,10) + '.csv';
      a.click();
    });
  }

'''

# Find anchor in driver.html
nemt_anchor = '  async function loadAvailableRides'
if nemt_anchor in dd:
    dd = dd.replace(nemt_anchor, export_fn_nemt + nemt_anchor, 1)
    print("2a. exportNemtCSV() added to driver")
else:
    # Try alternate anchor
    nemt_anchor2 = '  function loadAvailableRides'
    if nemt_anchor2 in dd:
        dd = dd.replace(nemt_anchor2, export_fn_nemt + nemt_anchor2, 1)
        print("2a. exportNemtCSV() added to driver (alt anchor)")
    else:
        print("2a. FAILED to find anchor in driver.html")

# Add export button to history section
hist_title = '<div style="font-size:13px;color:#6B7280;margin-bottom:22px">All completed rides</div>'
if hist_title in dd:
    dd = dd.replace(hist_title,
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px">'
        '<div style="font-size:13px;color:#6B7280">All completed rides</div>'
        '<button onclick="exportNemtCSV(\'history\')" style="background:#050D1F;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Export CSV</button></div>')
    print("2b. Export button added to NEMT history")

if dd != ddorig:
    open(df, 'w').write(dd)
    print("   driver.html written")

cmds = [
    'rm -f fix_coord_nemt_export.py',
    'git add partners-portal/coordinator.html partners-portal/driver.html',
    'git commit -m "feat: CSV export on coordinator rides + NEMT ride history dashboards"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
