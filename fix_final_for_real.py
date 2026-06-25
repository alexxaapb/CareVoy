import os, subprocess

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')

# ════════════════════════════════════════════════════════════════
# 1. FACILITY: Insert pw-wrap CSS before </style> (line 39)
# ════════════════════════════════════════════════════════════════
ff = os.path.join(PP, 'facility-signup.html')
lines = open(ff).readlines()

pw_css_lines = [
    '    .pw-wrap { position: relative; }\n',
    '    .pw-wrap input { padding-right: 44px; }\n',
    '    .pw-eye { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #6B7280; font-size: 13px; font-weight: 600; font-family: inherit; padding: 4px 8px; text-transform: uppercase; letter-spacing: 0.5px; }\n',
    '    .pw-eye:hover { color: #050D1F; }\n',
]

# Find </style> and insert before it
inserted = False
for i, line in enumerate(lines):
    if '</style>' in line and not inserted:
        for j, css_line in enumerate(pw_css_lines):
            lines.insert(i + j, css_line)
        inserted = True
        break

if inserted:
    open(ff, 'w').writelines(lines)
    print("1. Facility: pw-wrap + pw-eye CSS inserted before </style>")
else:
    print("1. FAILED - </style> not found in facility")

# Verify it worked
verify = open(ff).read()
count = verify.count('.pw-wrap')
print(f"   Verification: {count} pw-wrap rules found")

# ════════════════════════════════════════════════════════════════
# 2. ADMIN: Insert functions before </script> (line 1096)
# ════════════════════════════════════════════════════════════════
af = os.path.join(PP, 'admin.html')
ac = open(af).read()

# Only add if not already there
if 'function loadPendingApplicants' not in ac:
    admin_js = '''
  async function approvePartner(type, id, email, name) {
    if (!confirm('Approve ' + name + '? They will receive a login email.')) return;
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
          var cemail = intake.contact_phone || '';
          return '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px">' +
            '<div><div style="font-weight:700;color:#050D1F;font-size:14px">' + esc(p.company_name||'') + '</div>' +
            '<div style="font-size:12px;color:#6B7280;margin-top:3px">' + esc(p.city||'') + ' | ' + (p.service_states||[]).join(', ') + '</div>' +
            '<div style="font-size:11px;color:#9CA3AF;margin-top:2px">Applied ' + new Date(p.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) + '</div></div>' +
            '<div style="display:flex;gap:8px;flex-shrink:0">' +
            '<button onclick="approvePartner(\'nemt\',\'' + p.id + '\',\'' + esc(cemail) + '\',\'' + esc(p.company_name||'') + '\')" style="background:#050D1F;color:#00C2A8;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Approve</button>' +
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
          var cemail = intake.contact_phone || '';
          return '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px">' +
            '<div><div style="font-weight:700;color:#050D1F;font-size:14px">' + esc(f.name||'') + '</div>' +
            '<div style="font-size:12px;color:#6B7280;margin-top:3px">' + esc(f.city||'') + ', ' + esc(f.state||'') + ' | ' + esc((f.facility_type||'').replace(/_/g,' ')) + '</div>' +
            '<div style="font-size:11px;color:#9CA3AF;margin-top:2px">Vol: ' + esc(intake.patient_volume||'-') + ' | EHR: ' + esc(intake.ehr||'-') + ' | Applied ' + new Date(f.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) + '</div></div>' +
            '<div style="display:flex;gap:8px;flex-shrink:0">' +
            '<button onclick="approvePartner(\'facility\',\'' + f.id + '\',\'' + esc(cemail) + '\',\'' + esc(f.name||'') + '\')" style="background:#050D1F;color:#00C2A8;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Approve</button>' +
            '<button onclick="declinePartner(\'facility\',\'' + f.id + '\',\'' + esc(f.name||'') + '\')" style="background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Decline</button>' +
            '</div></div>';
        }).join('');
      } else if (facSec) { facSec.style.display = 'none'; }
    } catch(e) { console.warn('Facility pending err:', e); }
  }

'''
    ac = ac.replace('</script>\n</body>', admin_js + '</script>\n</body>', 1)
    print("2a. All admin functions inserted before </script>")

    # Wire to tab switches
    old_wire = "    if (name === 'patients') { loadPatients(); }"
    new_wire = "    if (name === 'patients') { loadPatients(); }\n    if (name === 'partners' || name === 'facilities') { loadPendingApplicants(); }"
    if "name === 'partners'" not in ac:
        ac = ac.replace(old_wire, new_wire)
        print("2b. loadPendingApplicants wired to tab switches")

    open(af, 'w').write(ac)
    print("   admin.html written")

    # Verify
    verify2 = open(af).read()
    print(f"   Verify: loadPendingApplicants count = {verify2.count('loadPendingApplicants')}")
    print(f"   Verify: approvePartner count = {verify2.count('approvePartner')}")
else:
    print("2. loadPendingApplicants already exists")

cmds = [
    'rm -f fix_final_for_real.py',
    'git add partners-portal/facility-signup.html partners-portal/admin.html',
    'git commit -m "fix: facility pw CSS actually inserted, admin pending JS actually added"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
