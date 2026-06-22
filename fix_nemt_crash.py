import os, subprocess

REPO = '/workspaces/CareVoy'
f = os.path.join(REPO, 'partners-portal', 'driver.html')
c = open(f).read()

# Replace all instances of allR (wrong) with allRides (correct)
count = c.count('allR.')
c = c.replace('allR.filter', 'allRides.filter')
print(f"1. Replaced {count} instances of allR -> allRides")

open(f, 'w').write(c)

cmds = [
    'rm -f fix_nemt_crash.py',
    'git add partners-portal/driver.html',
    'git commit -m "fix: NEMT dashboard crash - allR should be allRides"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:150])
