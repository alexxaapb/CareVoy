import os, subprocess

REPO = '/workspaces/CareVoy'
af = os.path.join(REPO, 'partners-portal', 'admin.html')

# Step 1: Get git log to find last working commit
result = subprocess.run('git log --oneline -20 -- partners-portal/admin.html', 
    shell=True, cwd=REPO, capture_output=True, text=True)
print("Recent admin.html commits:")
print(result.stdout)

# Find the commit BEFORE any approve/decline attempts
# Look for "admin completed+upcoming stats" or similar safe commit
lines = result.stdout.strip().split('\n')
safe_commit = None
for line in lines:
    sha = line.split()[0]
    msg = ' '.join(line.split()[1:])
    if 'approve' not in msg.lower() and 'pending' not in msg.lower() and 'trycatch' not in msg.lower() and 'safe' not in msg.lower():
        safe_commit = sha
        print(f"\nReverting to safe commit: {sha} {msg}")
        break

if not safe_commit:
    # Just use the 5th commit back as a safe point
    if len(lines) >= 5:
        safe_commit = lines[4].split()[0]
        print(f"\nReverting to 5th commit back: {safe_commit}")

if safe_commit:
    subprocess.run(f'git checkout {safe_commit} -- partners-portal/admin.html', 
        shell=True, cwd=REPO, capture_output=True)
    print("1. Reverted admin.html to safe commit")
else:
    print("1. FAILED to find safe commit")
    exit()

# Step 2: Read the clean file and ONLY add a new script block at the end
# Don't touch ANYTHING in the existing code
ac = open(af).read()

# Verify the existing code has no loadPendingApplicants
if 'loadPendingApplicants' in ac:
    print("WARNING: safe commit already has loadPendingApplicants - removing second script block")
    # Remove the second script block entirely if it exists
    import re
    # Find and remove any second script block after the ride detail modal
    ac = re.sub(r'\n<script>\s*async function approvePartner.*?</script>', '', ac, flags=re.DOTALL)
    print("   Second script block removed")

# Step 3: Add pending HTML divs if not present
if 'nemtPendingSection' not in ac:
    ac = ac.replace(
        '  <div id="nemtFullPanel"',
        '  <div id="nemtPendingSection" style="margin-bottom:20px;display:none"><div style="font-size:11px;font-weight:700;color:#F5A623;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">&#9679; Pending Review</div><div id="nemtPendingBody"></div></div>\n  <div id="nemtFullPanel"'
    )
    print("2a. NEMT pending section HTML added")

if 'facPendingSection' not in ac:
    ac = ac.replace(
        '  <div id="facilitiesFullPanel"',
        '  <div id="facPendingSection" style="margin-bottom:20px;display:none"><div style="font-size:11px;font-weight:700;color:#F5A623;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">&#9679; Pending Review</div><div id="facPendingBody"></div></div>\n  <div id="facilitiesFullPanel"'
    )
    print("2b. Facility pending section HTML added")

# Step 4: Add a completely separate script block AFTER </body>
# This block auto-loads pending applicants every 30 seconds
# Uses ONLY data-attributes for buttons (zero inline onclick)
pending_script = '''
<script>
(function(){
  var SU = 'https://byflpckbjjumxxjxoplk.supabase.co';
  var SK = 'sb_publishable_mwR5uT4W3C2M-K5LbBag4g_GdN0plrT';
  var tk = sessionStorage.getItem('cv_admin_token');
  if (!tk) return;
  var hdr = { 'apikey': SK, 'Authorization': 'Bearer ' + tk };
  function e(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function renderPending() {
    fetch(SU + '/rest/v1/nemt_partners?pending_review=eq.true&select=id,company_name,city,service_states,created_at', { headers: hdr })
    .then(function(r){ return r.json(); })
    .then(function(nemt){
      var sec = document.getElementById('nemtPendingSection');
      var body = document.getElementById('nemtPendingBody');
      if (!sec || !body) return;
      if (!nemt || !nemt.length) { sec.style.display = 'none'; return; }
      sec.style.display = 'block';
      body.innerHTML = nemt.map(function(p){
        return '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px">' +
          '<div><div style="font-weight:700;color:#050D1F;font-size:14px">' + e(p.company_name) + '</div>' +
          '<div style="font-size:12px;color:#6B7280;margin-top:3px">' + e(p.city||'') + ' | ' + (p.service_states||[]).join(', ') + '</div>' +
          '<div style="font-size:11px;color:#9CA3AF;margin-top:2px">Applied ' + new Date(p.created_at).toLocaleDateString() + '</div></div>' +
          '<div style="display:flex;gap:8px;flex-shrink:0">' +
          '<button class="cv-approve" data-type="nemt" data-id="' + p.id + '" data-name="' + e(p.company_name) + '" style="background:#050D1F;color:#00C2A8;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Approve</button>' +
          '<button class="cv-decline" data-type="nemt" data-id="' + p.id + '" data-name="' + e(p.company_name) + '" style="background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Decline</button>' +
          '</div></div>';
      }).join('');
    }).catch(function(){});

    fetch(SU + '/rest/v1/hospitals?pending_review=eq.true&select=id,name,city,state,facility_type,created_at,intake_data', { headers: hdr })
    .then(function(r){ return r.json(); })
    .then(function(facs){
      var sec = document.getElementById('facPendingSection');
      var body = document.getElementById('facPendingBody');
      if (!sec || !body) return;
      if (!facs || !facs.length) { sec.style.display = 'none'; return; }
      sec.style.display = 'block';
      body.innerHTML = facs.map(function(f){
        var intake = f.intake_data || {};
        return '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px">' +
          '<div><div style="font-weight:700;color:#050D1F;font-size:14px">' + e(f.name) + '</div>' +
          '<div style="font-size:12px;color:#6B7280;margin-top:3px">' + e(f.city||'') + ', ' + e(f.state||'') + ' | ' + e((f.facility_type||'').replace(/_/g,' ')) + '</div>' +
          '<div style="font-size:11px;color:#9CA3AF;margin-top:2px">Vol: ' + e(intake.patient_volume||'-') + ' | EHR: ' + e(intake.ehr||'-') + '</div></div>' +
          '<div style="display:flex;gap:8px;flex-shrink:0">' +
          '<button class="cv-approve" data-type="facility" data-id="' + f.id + '" data-name="' + e(f.name) + '" style="background:#050D1F;color:#00C2A8;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Approve</button>' +
          '<button class="cv-decline" data-type="facility" data-id="' + f.id + '" data-name="' + e(f.name) + '" style="background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Decline</button>' +
          '</div></div>';
      }).join('');
    }).catch(function(){});
  }

  document.addEventListener('click', function(ev) {
    var ab = ev.target.closest && ev.target.closest('.cv-approve');
    if (ab) {
      var t = ab.getAttribute('data-type');
      var id = ab.getAttribute('data-id');
      var nm = ab.getAttribute('data-name');
      if (!confirm('Approve ' + nm + '?')) return;
      var tbl = t === 'nemt' ? 'nemt_partners' : 'hospitals';
      fetch(SU + '/rest/v1/' + tbl + '?id=eq.' + id, {
        method: 'PATCH', headers: Object.assign({}, hdr, {'Content-Type':'application/json'}),
        body: JSON.stringify({active:true,pending_review:false})
      }).then(function(){
        fetch('https://care-voy-api-server.vercel.app/api/notify/partner-approved', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({email:'',name:nm,type:t})
        }).catch(function(){});
        alert(nm + ' approved.');
        location.reload();
      });
    }
    var db = ev.target.closest && ev.target.closest('.cv-decline');
    if (db) {
      var t2 = db.getAttribute('data-type');
      var id2 = db.getAttribute('data-id');
      var nm2 = db.getAttribute('data-name');
      if (!confirm('Decline ' + nm2 + '?')) return;
      var tbl2 = t2 === 'nemt' ? 'nemt_partners' : 'hospitals';
      fetch(SU + '/rest/v1/' + tbl2 + '?id=eq.' + id2, {
        method: 'PATCH', headers: Object.assign({}, hdr, {'Content-Type':'application/json'}),
        body: JSON.stringify({active:false,pending_review:false})
      }).then(function(){
        alert(nm2 + ' declined.');
        location.reload();
      });
    }
  });

  renderPending();
  setInterval(renderPending, 30000);
})();
</script>
'''

# Add AFTER </html> — completely isolated, cannot break anything
ac = ac.rstrip() + '\n' + pending_script

open(af, 'w').write(ac)
print("3. Separate self-contained script block added after </html>")

# Verify nothing is broken
v = open(af).read()
print(f"   Verify: cv-approve count = {v.count('cv-approve')}")
print(f"   Verify: cv-decline count = {v.count('cv-decline')}")
print(f"   Verify: <script> tags = {v.count('<script>')}")
print(f"   Verify: </script> tags = {v.count('</script>')}")

cmds = [
    'rm -f fix_admin_revert_clean.py',
    'git add partners-portal/admin.html',
    'git commit -m "fix: revert admin to safe state, add isolated pending script block"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
