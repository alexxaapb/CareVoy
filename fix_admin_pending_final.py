import os, subprocess

REPO = '/workspaces/CareVoy'
af = os.path.join(REPO, 'partners-portal', 'admin.html')

lines = open(af).readlines()

# Find the FIRST </script> tag
script_end_line = None
for i, line in enumerate(lines):
    if '</script>' in line:
        script_end_line = i
        break

if script_end_line is None:
    print("FAILED: no </script> found")
    exit()

print(f"Found first </script> at line {script_end_line + 1}")

# Insert functions right before that line
fns = '''
  async function approvePartner(type, id, email, name) {
    if (!confirm('Approve ' + name + '?')) return;
    var h2 = authHeaders();
    var table = type === 'nemt' ? 'nemt_partners' : 'hospitals';
    await fetch(SUPA_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'PATCH', headers: { ...h2, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true, pending_review: false })
    });
    try {
      await fetch('https://care-voy-api-server.vercel.app/api/notify/partner-approved', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, name: name, type: type })
      });
    } catch(e) {}
    alert(name + ' approved and notified.');
    location.reload();
  }

  async function declinePartner(type, id, name) {
    if (!confirm('Decline ' + name + '?')) return;
    var h2 = authHeaders();
    var table = type === 'nemt' ? 'nemt_partners' : 'hospitals';
    await fetch(SUPA_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'PATCH', headers: { ...h2, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false, pending_review: false })
    });
    alert(name + ' declined.');
    location.reload();
  }

  async function loadPendingApplicants() {
    var h2 = authHeaders();
    try {
      var nr = await fetch(SUPA_URL + '/rest/v1/nemt_partners?pending_review=eq.true&select=id,company_name,city,service_states,created_at,intake_data', { headers: h2 });
      var nemt = await nr.json();
      var nemtSec = document.getElementById('nemtPendingSection');
      var nemtBody = document.getElementById('nemtPendingBody');
      if (nemt && nemt.length > 0 && nemtSec) {
        nemtSec.style.display = 'block';
        nemtBody.innerHTML = nemt.map(function(p) {
          var intake = p.intake_data || {};
          return '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px">' +
            '<div><div style="font-weight:700;color:#050D1F;font-size:14px">' + esc(p.company_name||'') + '</div>' +
            '<div style="font-size:12px;color:#6B7280;margin-top:3px">' + esc(p.city||'') + ' | ' + (p.service_states||[]).join(', ') + '</div>' +
            '<div style="font-size:11px;color:#9CA3AF;margin-top:2px">Applied ' + new Date(p.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) + '</div></div>' +
            '<div style="display:flex;gap:8px;flex-shrink:0">' +
            '<button onclick="approvePartner(\'nemt\',\'' + p.id + '\',\'' + esc(intake.contact_phone||'') + '\',\'' + esc(p.company_name||'') + '\')" style="background:#050D1F;color:#00C2A8;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Approve</button>' +
            '<button onclick="declinePartner(\'nemt\',\'' + p.id + '\',\'' + esc(p.company_name||'') + '\')" style="background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Decline</button>' +
            '</div></div>';
        }).join('');
      } else if (nemtSec) { nemtSec.style.display = 'none'; }
    } catch(e) { console.warn('NEMT pending err:', e); }
    try {
      var fr = await fetch(SUPA_URL + '/rest/v1/hospitals?pending_review=eq.true&select=id,name,city,state,facility_type,created_at,intake_data', { headers: h2 });
      var facs = await fr.json();
      var facSec = document.getElementById('facPendingSection');
      var facBody = document.getElementById('facPendingBody');
      if (facs && facs.length > 0 && facSec) {
        facSec.style.display = 'block';
        facBody.innerHTML = facs.map(function(f) {
          var intake = f.intake_data || {};
          return '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px">' +
            '<div><div style="font-weight:700;color:#050D1F;font-size:14px">' + esc(f.name||'') + '</div>' +
            '<div style="font-size:12px;color:#6B7280;margin-top:3px">' + esc(f.city||'') + ', ' + esc(f.state||'') + ' | ' + esc((f.facility_type||'').replace(/_/g,' ')) + '</div>' +
            '<div style="font-size:11px;color:#9CA3AF;margin-top:2px">Vol: ' + esc(intake.patient_volume||'-') + ' | EHR: ' + esc(intake.ehr||'-') + ' | Applied ' + new Date(f.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) + '</div></div>' +
            '<div style="display:flex;gap:8px;flex-shrink:0">' +
            '<button onclick="approvePartner(\'facility\',\'' + f.id + '\',\'' + esc(intake.contact_phone||'') + '\',\'' + esc(f.name||'') + '\')" style="background:#050D1F;color:#00C2A8;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Approve</button>' +
            '<button onclick="declinePartner(\'facility\',\'' + f.id + '\',\'' + esc(f.name||'') + '\')" style="background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Decline</button>' +
            '</div></div>';
        }).join('');
      } else if (facSec) { facSec.style.display = 'none'; }
    } catch(e) { console.warn('Fac pending err:', e); }
  }

'''

# Insert function lines before the </script> line
fn_lines = fns.split('\n')
for j, fn_line in enumerate(fn_lines):
    lines.insert(script_end_line + j, fn_line + '\n')

# Now find and wire the tab switch
# Re-read since line numbers shifted
content = ''.join(lines)
old_wire = "    if (name === 'patients') { loadPatients(); }"
new_wire = "    if (name === 'patients') { loadPatients(); }\n    if (name === 'partners' || name === 'facilities') { loadPendingApplicants(); }"
if "loadPendingApplicants" in content and "name === 'partners' || name === 'facilities'" not in content:
    content = content.replace(old_wire, new_wire)
    print("Tab switch wired")

open(af, 'w').write(content)

# Verify
v = open(af).read()
print(f"Verify: loadPendingApplicants = {v.count('loadPendingApplicants')}")
print(f"Verify: approvePartner = {v.count('approvePartner')}")
print(f"Verify: facPendingSection = {v.count('facPendingSection')}")

cmds = [
    'rm -f fix_admin_pending_final.py',
    'git add partners-portal/admin.html',
    'git commit -m "fix: admin approve/decline functions inserted at correct position"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
