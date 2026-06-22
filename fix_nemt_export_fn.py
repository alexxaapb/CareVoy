import os, subprocess

REPO = '/workspaces/CareVoy'
df = os.path.join(REPO, 'partners-portal', 'driver.html')
dd = open(df).read()

# Check if exportNemtCSV already exists (button was added but function wasn't)
if 'function exportNemtCSV' in dd:
    print("exportNemtCSV already exists - skipping")
else:
    export_fn = '''
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
    anchor = 'async function loadAvailableRides() {'
    if anchor in dd:
        dd = dd.replace(anchor, export_fn + anchor, 1)
        open(df, 'w').write(dd)
        print("1. exportNemtCSV() function added to driver.html")
    else:
        print("1. FAILED - anchor still not found")

cmds = [
    'rm -f fix_nemt_export_fn.py',
    'git add partners-portal/driver.html',
    'git commit -m "fix: add missing exportNemtCSV function to NEMT dashboard"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:150])
