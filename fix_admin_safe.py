import os, subprocess

REPO = '/workspaces/CareVoy'
af = os.path.join(REPO, 'partners-portal', 'admin.html')
ac = open(af).read()

# STEP 1: Remove the broken functions I inserted into the main script block
# Find and remove everything between setInterval and </script>
# by restoring the original pattern
import re

# Remove my inserted functions - keep loadStats() and setInterval, then close script
old_section = re.search(
    r'(  loadStats\(\);\n  setInterval\(loadStats, 30000\);\n).*?(</script>)',
    ac, re.DOTALL
)
if old_section:
    ac = ac[:old_section.start()] + old_section.group(1) + old_section.group(2) + ac[old_section.end():]
    print("1. Removed broken inserted functions from main script block")

# STEP 2: Add a clean, separate script block before </body>
# This way it CAN'T break the existing code
new_script = '''
<script>
  async function approvePartner(type, id, email, name) {
    if (!confirm('Approve ' + name + '?')) return;
    var h2 = authHeaders();
    var table = type === 'nemt' ? 'nemt_partners' : 'hospitals';
    var r = await fetch(SUPA_URL + '/rest/v1/' + table + '?id=eq.' + id, {
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
            '<div style="font-size:11px;color:#9CA3AF;margin-top:2px">Applied ' + new Date(p.created_at).toLocaleDateString() + '</div></div>' +
            '<div style="display:flex;gap:8px;flex-shrink:0">' +
            '<button onclick="approvePartner(\'nemt\',\'' + p.id + '\',\'' + esc(intake.contact_phone||'') + '\',\'' + esc(p.company_name||'') + '\')" style="background:#050D1F;color:#00C2A8;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Approve</button>' +
            '<button onclick="declinePartner(\'nemt\',\'' + p.id + '\',\'' + esc(p.company_name||'') + '\')" style="background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Decline</button>' +
            '</div></div>';
        }).join('');
      }
    } catch(e) {}
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
            '<div style="font-size:11px;color:#9CA3AF;margin-top:2px">Vol: ' + esc(intake.patient_volume||'-') + ' | EHR: ' + esc(intake.ehr||'-') + '</div></div>' +
            '<div style="display:flex;gap:8px;flex-shrink:0">' +
            '<button onclick="approvePartner(\'facility\',\'' + f.id + '\',\'' + esc(intake.contact_phone||'') + '\',\'' + esc(f.name||'') + '\')" style="background:#050D1F;color:#00C2A8;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Approve</button>' +
            '<button onclick="declinePartner(\'facility\',\'' + f.id + '\',\'' + esc(f.name||'') + '\')" style="background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Decline</button>' +
            '</div></div>';
        }).join('');
      }
    } catch(e) {}
  }
</script>
'''

# Insert before </body>
if 'function loadPendingApplicants' not in ac:
    ac = ac.replace('</body>', new_script + '</body>', 1)
    print("2. Separate script block added before </body>")

# Make sure tab switch is wired
old_wire = "    if (name === 'patients') { loadPatients(); }"
new_wire = "    if (name === 'patients') { loadPatients(); }\n    if (name === 'partners' || name === 'facilities') { loadPendingApplicants(); }"
if "name === 'partners' || name === 'facilities'" not in ac and old_wire in ac:
    ac = ac.replace(old_wire, new_wire)
    print("3. Tab switch wired")

open(af, 'w').write(ac)

# Verify
v = open(af).read()
print(f"Verify: <script> tags = {v.count('<script>')}")
print(f"Verify: </script> tags = {v.count('</script>')}")
print(f"Verify: loadPendingApplicants = {v.count('loadPendingApplicants')}")
print(f"Verify: approvePartner = {v.count('approvePartner')}")

cmds = [
    'rm -f fix_admin_safe.py',
    'git add partners-portal/admin.html',
    'git commit -m "fix: admin approve/decline in separate script block (does not touch existing code)"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
