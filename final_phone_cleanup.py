import os, subprocess

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')
results = []

# Remove +1 from signup form placeholders
nf = os.path.join(PP, 'nemt-signup.html')
nc = open(nf).read()
nc = nc.replace('placeholder="+1 (614) 555-0000"', 'placeholder="(614) 555-0000"')
nc = nc.replace('placeholder="+1 (614) 555-0001"', 'placeholder="(614) 555-0001"')
open(nf, 'w').write(nc)
results.append("1. NEMT signup phone placeholders cleaned (no +1)")

ff = os.path.join(PP, 'facility-signup.html')
fc = open(ff).read()
fc = fc.replace('placeholder="+1 (614) 555-0000"', 'placeholder="(614) 555-0000"')
# Also remove insurance facility_type option fully
if '<option value="insurance_medicaid">Insurance / Medicaid</option>' in fc:
    fc = fc.replace('\n      <option value="insurance_medicaid">Insurance / Medicaid</option>', '')
    results.append("2. Removed insurance from facility form (any remaining)")
open(ff, 'w').write(fc)
results.append("1b. Facility signup phone placeholder cleaned (no +1)")

cmds = [
    'rm -f final_phone_cleanup.py',
    'git add partners-portal/nemt-signup.html partners-portal/facility-signup.html',
    'git commit -m "fix: remove +1 from signup phone placeholders, ensure insurance fully gone"',
    'git push origin main',
]
for r in results:
    print(r)
for cmd in cmds:
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((res.stdout or res.stderr).strip()[:200])
