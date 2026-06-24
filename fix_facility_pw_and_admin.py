import os, subprocess

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')

# ════════════════════════════════════════════════════════════════
# 1. FACILITY: add pw-wrap + pw-eye CSS (copy exactly from NEMT)
# ════════════════════════════════════════════════════════════════
ff = os.path.join(PP, 'facility-signup.html')
fc = open(ff).read()

PW_CSS = '''    .pw-wrap { position: relative; }
    .pw-wrap input { padding-right: 44px; }
    .pw-eye { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #6B7280; font-size: 13px; font-weight: 600; font-family: inherit; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .pw-eye:hover { color: #050D1F; }'''

if 'pw-wrap' not in fc:
    # Add CSS right before closing </style>
    fc = fc.replace('  </style>', PW_CSS + '\n  </style>', 1)
    open(ff, 'w').write(fc)
    print("1. pw-wrap + pw-eye CSS added to facility form")
else:
    print("1. pw-wrap already in facility CSS")

# ════════════════════════════════════════════════════════════════
# 2. ADMIN: Add pending sections + functions using exact anchors
# ════════════════════════════════════════════════════════════════
af = os.path.join(PP, 'admin.html')
ac = open(af).read()

# Add pending div to facilities section
old_fac = '  <div id="facilitiesFullPanel"'
new_fac = '''  <div id="facPendingSection" style="margin-bottom:20px;display:none">
    <div style="font-size:11px;font-weight:700;color:#F5A623;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">&#9679; Pending Review</div>
    <div id="facPendingBody"></div>
  </div>
  <div id="facilitiesFullPanel"'''
if 'facPendingSection' not in ac and old_fac in ac:
    ac = ac.replace(old_fac, new_fac, 1)
    print("2a. Facility pending section added")
else:
    print("2a. facPendingSection already exists or anchor not found")

# Add pending div to NEMT section
old_nemt = '  <div id="nemtFullPanel"'
new_nemt = '''  <div id="nemtPendingSection" style="margin-bottom:20px;display:none">
    <div style="font-size:11px;font-weight:700;color:#F5A623;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">&#9679; Pending Review</div>
    <div id="nemtPendingBody"></div>
  </div>
  <div id="nemtFullPanel"'''
if 'nemtPendingSection' not in ac and old_nemt in ac:
    ac = ac.replace(old_nemt, new_nemt, 1)
    print("2b. NEMT pending section added")
else:
    print("2b. nemtPendingSection already exists or anchor not found")

# Add functions before </script>
fns = '''
  async function approvePartner(type, id, email, name) {
    if (!confirm('Approve ' + name + '? They will receive a login email.')) return;
    var h = authHeaders();
    var table = type === 'nemt' ? 'nemt_partners' : 'hospitals';
    await fetch(SUPA_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'PATCH', headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true, pending_review: false })
    });
    try {
      await fetch('https://care-voy-api-server.vercel.app/api/notify/partner-approved', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, name: name, type: type })
      });
    } catch(e) {}
    alert(name + ' approved. Login email sent.');
    location.reload();
  }

  async function declinePartner(type, id, name) {
    if (!confirm('Decline ' + name + '? This cannot be undone.')) return;
    var h = authHeaders();
    var table = type === 'nemt' ? 'nemt_partners' : 'hospitals';
    await fetch(SUPA_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'PATCH', headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false, pending_review: false })
    });
    alert(name + ' declined.');
    location.reload();
  }

  async function loadPendingApplicants() {
    var h = authHeaders();
    try {
      var nr = await fetch(SUPA_URL + '/rest/v1/nemt_partners?pending_review=eq.true&select=id,company_name,city,service_states,created_at,intake_data', { headers: h });
      var nemt = await nr.json();
      var nemtSec = document.getElementById('nemtPendingSection');
      var nemtBody = document.getElementById('nemtPendingBody');
      if (nemt && nemt.length > 0 && nemtSec) {
        nemtSec.style.display = 'block';
        nemtBody.innerHTML = nemt.map(function(p) {
          var intake = p.intake_data || {};
          return '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px">' +
            '<div><div style="font-weight:700;color:#050D1F;font-size:14px">' + esc(p.company_name||'Unknown') + '</div>' +
            '<div style="font-size:12px;color:#6B7280;margin-top:3px">' + esc(p.city||'') + ' &bull; ' + (p.service_states||[]).join(', ') + '</div>' +
            '<div style="font-size:11px;color:#9CA3AF;margin-top:2px">Applied: ' + new Date(p.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) + '</div></div>' +
            '<div style="display:flex;gap:8px;flex-shrink:0">' +
            '<button onclick="approvePartner(\'nemt\',\'' + p.id + '\',\'' + esc(intake.contact_email||'') + '\',\'' + esc(p.company_name||'') + '\')" style="background:#050D1F;color:#00C2A8;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Approve</button>' +
            '<button onclick="declinePartner(\'nemt\',\'' + p.id + '\',\'' + esc(p.company_name||'') + '\')" style="background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Decline</button>' +
            '</div></div>';
        }).join('');
      }
    } catch(e) { console.warn('NEMT pending:', e); }
    try {
      var fr = await fetch(SUPA_URL + '/rest/v1/hospitals?pending_review=eq.true&select=id,name,city,state,facility_type,created_at,intake_data', { headers: h });
      var facs = await fr.json();
      var facSec = document.getElementById('facPendingSection');
      var facBody = document.getElementById('facPendingBody');
      if (facs && facs.length > 0 && facSec) {
        facSec.style.display = 'block';
        facBody.innerHTML = facs.map(function(f) {
          var intake = f.intake_data || {};
          return '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px">' +
            '<div><div style="font-weight:700;color:#050D1F;font-size:14px">' + esc(f.name||'Unknown') + '</div>' +
            '<div style="font-size:12px;color:#6B7280;margin-top:3px">' + esc(f.city||'') + ', ' + esc(f.state||'') + ' &bull; ' + esc((f.facility_type||'').replace(/_/g,' ')) + '</div>' +
            '<div style="font-size:11px;color:#9CA3AF;margin-top:2px">Vol: ' + esc(intake.patient_volume||'—') + ' &bull; EHR: ' + esc(intake.ehr||'—') + ' &bull; Applied: ' + new Date(f.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) + '</div></div>' +
            '<div style="display:flex;gap:8px;flex-shrink:0">' +
            '<button onclick="approvePartner(\'facility\',\'' + f.id + '\',\'' + esc(intake.contact_email||'') + '\',\'' + esc(f.name||'') + '\')" style="background:#050D1F;color:#00C2A8;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Approve</button>' +
            '<button onclick="declinePartner(\'facility\',\'' + f.id + '\',\'' + esc(f.name||'') + '\')" style="background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Decline</button>' +
            '</div></div>';
        }).join('');
      }
    } catch(e) { console.warn('Facility pending:', e); }
  }

'''

# Insert just before the closing </script> tag
if 'loadPendingApplicants' not in ac:
    ac = ac.replace('</script>\n</body>', fns + '</script>\n</body>', 1)
    print("2c. approve/decline/loadPending functions added")
else:
    print("2c. loadPendingApplicants already in admin")

# Wire to tab switches
old_wire = "    if (name === 'patients') { loadPatients(); }"
new_wire = "    if (name === 'patients') { loadPatients(); }\n    if (name === 'partners' || name === 'facilities') { loadPendingApplicants(); }"
if 'loadPendingApplicants' in ac and "name === 'partners' || name === 'facilities'" not in ac and old_wire in ac:
    ac = ac.replace(old_wire, new_wire)
    print("2d. loadPendingApplicants wired to tab switches")

open(af, 'w').write(ac)
print("   admin.html written")

cmds = [
    'rm -f fix_facility_pw_and_admin.py',
    'git add partners-portal/facility-signup.html partners-portal/admin.html',
    'git commit -m "fix: facility pw-wrap CSS, admin approve/decline pending applicants"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
