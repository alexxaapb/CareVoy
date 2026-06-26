import os, subprocess

REPO = '/workspaces/CareVoy'

# 1. Update facility form volume thresholds to match pricing tiers
ff = os.path.join(REPO, 'partners-portal', 'facility-signup.html')
fc = open(ff).read()

old_vol = '''      <option value="">Select range</option>
      <option value="under_25">Under 25 patients</option>
      <option value="25_50">25-50 patients</option>
      <option value="50_100">50-100 patients</option>
      <option value="100_250">100-250 patients</option>
      <option value="250_plus">250+ patients</option>'''
new_vol = '''      <option value="">Select range</option>
      <option value="under_50">Under 50 rides/month</option>
      <option value="50_100">50-100 rides/month</option>
      <option value="100_250">100-250 rides/month</option>
      <option value="250_plus">250+ rides/month</option>'''
if old_vol in fc:
    fc = fc.replace(old_vol, new_vol)
    print("1. Facility volume thresholds updated to match pricing (under 50, 50-100, 100-250, 250+)")
else:
    print("1. FAILED - volume options not found")

# Also update the label to say "rides" not "patients"
fc = fc.replace(
    'Estimated patients needing transport per month *',
    'Estimated rides needed per month *'
)
open(ff, 'w').write(fc)

# 2. Fix admin auto-login: use localStorage instead of sessionStorage
af = os.path.join(REPO, 'partners-portal', 'admin.html')
ac = open(af).read()
# Admin reads token from sessionStorage - change to check both
old_token = "const token = sessionStorage.getItem('cv_admin_token');"
new_token = "const token = localStorage.getItem('cv_admin_token') || sessionStorage.getItem('cv_admin_token');"
if old_token in ac:
    ac = ac.replace(old_token, new_token)
    print("2. Admin reads token from localStorage (persists across tabs)")
open(af, 'w').write(ac)

# Also update the second script block that uses sessionStorage
ac2 = open(af).read()
ac2 = ac2.replace(
    "var tk = sessionStorage.getItem('cv_admin_token');",
    "var tk = localStorage.getItem('cv_admin_token') || sessionStorage.getItem('cv_admin_token');"
)
open(af, 'w').write(ac2)
print("   Isolated script block also uses localStorage")

# 3. Login page: save admin token to BOTH localStorage and sessionStorage
idx = os.path.join(REPO, 'partners-portal', 'index.html')
ic = open(idx).read()
old_save = "sessionStorage.setItem('cv_admin_token', token);\n          sessionStorage.setItem('cv_admin_uid',   uid);"
new_save = "sessionStorage.setItem('cv_admin_token', token);\n          sessionStorage.setItem('cv_admin_uid',   uid);\n          localStorage.setItem('cv_admin_token', token);\n          localStorage.setItem('cv_admin_uid',   uid);"
if old_save in ic:
    ic = ic.replace(old_save, new_save)
    print("3. Login saves admin token to localStorage too")
open(idx, 'w').write(ic)

cmds = [
    'rm -f fix_volume_and_autologin.py',
    'git add partners-portal/facility-signup.html partners-portal/admin.html partners-portal/index.html',
    'git commit -m "fix: ride volume thresholds match pricing, admin token persists across tabs for email link"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
