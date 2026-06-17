import os, subprocess

REPO = '/workspaces/CareVoy'
admin = os.path.join(REPO, 'partners-portal', 'admin.html')
c = open(admin).read()
orig = c

# ─────────────────────────────────────────────────────────────
# FIX: Assign NEMT button doesn't click when patient/hospital names
# contain apostrophes. esc() only escapes &<> not quotes, so the
# inline onclick string breaks. Switch to data-attributes + a
# delegated click listener (bulletproof against any characters).
# ─────────────────────────────────────────────────────────────

old_btn = '''          actionBtn = '<button onclick="openAssignModal(\\'' + r.id + '\\',\\'' + esc(r.patient_name||'Patient') + '\\',\\'' + esc(hospName) + '\\',\\'' + (r.hospital_state||'') + '\\')" style="background:#00C2A8;color:#050D1F;border:none;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Assign NEMT</button>';'''

new_btn = '''          actionBtn = '<button class="assign-nemt-btn" data-ride-id="' + esc(r.id) + '" data-patient="' + esc(r.patient_name||'Patient') + '" data-hosp="' + esc(hospName) + '" data-state="' + esc(r.hospital_state||'') + '" style="background:#00C2A8;color:#050D1F;border:none;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Assign NEMT</button>';'''

if old_btn in c:
    c = c.replace(old_btn, new_btn)
    print("1. Assign button switched to data-attributes")
else:
    print("1. FAILED to find assign button line - check manually")

# Harden esc() to also escape double quotes (used in attributes now)
old_esc = '''  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }'''
new_esc = '''  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }'''
if old_esc in c:
    c = c.replace(old_esc, new_esc)
    print("2. esc() now escapes quotes too")
else:
    print("2. esc() not found exactly")

# Add a delegated click listener for the new buttons.
# Insert right after the openAssignModal function definition.
anchor = '''  function selectAssignPartner(partnerId, el) {'''
listener = '''  // Delegated listener: opens the assign modal regardless of special chars
  // in patient/hospital names (replaces fragile inline onclick).
  document.addEventListener('click', function(e) {
    var btn = e.target.closest && e.target.closest('.assign-nemt-btn');
    if (!btn) return;
    openAssignModal(
      btn.getAttribute('data-ride-id'),
      btn.getAttribute('data-patient') || 'Patient',
      btn.getAttribute('data-hosp') || '',
      btn.getAttribute('data-state') || ''
    );
  });

  function selectAssignPartner(partnerId, el) {'''
if anchor in c and 'assign-nemt-btn' in new_btn:
    c = c.replace(anchor, listener, 1)
    print("3. Delegated click listener added")
else:
    print("3. Could not add listener - anchor missing")

if c != orig:
    open(admin, 'w').write(c)
    print("   admin.html written")
else:
    print("   NO CHANGES MADE - stopping")

# Commit + push (Vercel auto-deploys partners-portal)
cmds = [
    'rm -f part2_admin_fix.py',
    'git add partners-portal/admin.html',
    'git commit -m "fix: admin Assign NEMT button works with apostrophes in names (data-attrs + delegated listener)"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
