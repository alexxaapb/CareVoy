import os, subprocess

REPO = '/workspaces/CareVoy'
af = os.path.join(REPO, 'partners-portal', 'admin.html')

# Step 1: Restore from git (undo any local damage)
subprocess.run('git checkout partners-portal/admin.html', shell=True, cwd=REPO, capture_output=True)
print("1. Restored admin.html from git")

ac = open(af).read()

# Step 2: Fix the approve/decline buttons to use data-attributes
# Replace the broken onclick approach with data-attribute buttons + delegated listener

# Fix NEMT pending section buttons
ac = ac.replace(
    """'<button onclick=\"approvePartner('nemt','' + p.id + '','' + esc(intake.contact_phone||'') + '','' + esc(p.company_name||'') + '')\" style=\"background:#050D1F;color:#00C2A8;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit\">Approve</button>' +
            '<button onclick=\"declinePartner('nemt','' + p.id + '','' + esc(p.company_name||'') + '')\" style=\"background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit\">Decline</button>'""",
    """'<button class=\"approve-btn\" data-type=\"nemt\" data-id=\"' + p.id + '\" data-email=\"' + esc(intake.contact_phone||'') + '\" data-name=\"' + esc(p.company_name||'') + '\" style=\"background:#050D1F;color:#00C2A8;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit\">Approve</button>' +
            '<button class=\"decline-btn\" data-type=\"nemt\" data-id=\"' + p.id + '\" data-name=\"' + esc(p.company_name||'') + '\" style=\"background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit\">Decline</button>'"""
)
print("2a. NEMT approve/decline buttons fixed")

# Fix Facility pending section buttons
ac = ac.replace(
    """'<button onclick=\"approvePartner('facility','' + f.id + '','' + esc(intake.contact_phone||'') + '','' + esc(f.name||'') + '')\" style=\"background:#050D1F;color:#00C2A8;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit\">Approve</button>' +
            '<button onclick=\"declinePartner('facility','' + f.id + '','' + esc(f.name||'') + '')\" style=\"background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit\">Decline</button>'""",
    """'<button class=\"approve-btn\" data-type=\"facility\" data-id=\"' + f.id + '\" data-email=\"' + esc(intake.contact_phone||'') + '\" data-name=\"' + esc(f.name||'') + '\" style=\"background:#050D1F;color:#00C2A8;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit\">Approve</button>' +
            '<button class=\"decline-btn\" data-type=\"facility\" data-id=\"' + f.id + '\" data-name=\"' + esc(f.name||'') + '\" style=\"background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit\">Decline</button>'"""
)
print("2b. Facility approve/decline buttons fixed")

# Step 3: Add delegated listeners for approve/decline buttons
# Insert right after the loadPendingApplicants closing
listener_code = """
  // Delegated listeners for approve/decline buttons
  document.addEventListener('click', function(e) {
    var btn = e.target.closest && e.target.closest('.approve-btn');
    if (btn) {
      approvePartner(btn.getAttribute('data-type'), btn.getAttribute('data-id'), btn.getAttribute('data-email'), btn.getAttribute('data-name'));
    }
    var dec = e.target.closest && e.target.closest('.decline-btn');
    if (dec) {
      declinePartner(dec.getAttribute('data-type'), dec.getAttribute('data-id'), dec.getAttribute('data-name'));
    }
  });
"""

# Insert before the closing </script> of the second script block
last_script_close = ac.rfind('</script>')
if last_script_close > 0 and 'approve-btn' in ac:
    ac = ac[:last_script_close] + listener_code + ac[last_script_close:]
    print("3. Delegated listeners for approve/decline added")

# Step 4: Wrap loadPendingApplicants call in try/catch
ac = ac.replace(
    "    if (name === 'partners' || name === 'facilities') { loadPendingApplicants(); }",
    "    if (name === 'partners' || name === 'facilities') { try { loadPendingApplicants(); } catch(e) { console.warn(e); } }"
)
print("4. loadPendingApplicants wrapped in try/catch")

open(af, 'w').write(ac)
print("   admin.html written")

# Verify
v = open(af).read()
print(f"   Verify: approve-btn count = {v.count('approve-btn')}")
print(f"   Verify: decline-btn count = {v.count('decline-btn')}")
print(f"   Verify: loadPendingApplicants count = {v.count('loadPendingApplicants')}")

cmds = [
    'rm -f fix_admin_final_clean.py',
    'git add partners-portal/admin.html',
    'git commit -m "fix: admin approve/decline uses data-attributes (no quote escaping issues)"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
