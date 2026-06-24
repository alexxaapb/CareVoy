import os, subprocess

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')

for fname in ['nemt-signup.html', 'facility-signup.html']:
    fpath = os.path.join(PP, fname)
    c = open(fpath).read()
    c = c.replace('Washington DC', 'District of Columbia')
    open(fpath, 'w').write(c)
    print(f"Fixed DC label in {fname}")

cmds = [
    'rm -f fix_dc_label.py',
    'git add partners-portal/nemt-signup.html partners-portal/facility-signup.html',
    'git commit -m "fix: DC label changed to District of Columbia in both signup forms"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:150])
