import os, subprocess

REPO = '/workspaces/CareVoy'
f = os.path.join(REPO, 'partners-portal', 'admin.html')
c = open(f).read()

# The rows use "rides-table-row" but the CSS class is "rides-row"
c = c.replace(
    'rides-table-row" style="grid-template-columns:1.6fr 1.4fr 1fr 0.8fr',
    'rides-row" style="grid-template-columns:1.6fr 1.4fr 1fr 0.8fr'
)
print("1. Fixed: rides-table-row -> rides-row (CSS class match)")

open(f, 'w').write(c)

cmds = [
    'rm -f fix_patients_ui.py',
    'git add partners-portal/admin.html',
    'git commit -m "fix: patients table grid layout (wrong CSS class name)"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:150])
