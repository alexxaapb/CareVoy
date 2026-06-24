import os, subprocess

REPO = '/workspaces/CareVoy'
idx = os.path.join(REPO, 'artifacts', 'carevoy', 'app', '(tabs)', 'index.tsx')
ic = open(idx).read()

# Remove invited from the active rides query entirely
old_statuses = '.in("status", ["pending", "confirmed", "assigned", "en_route", "arrived"])'
# Already correct - invited should not show to patient at all

# Fix the label map - remove invited, pending shows "Confirmed"
old = '  invited: "Confirmed",\n  confirmed: "Confirmed",'
new = '  confirmed: "Confirmed",'
if old in ic:
    ic = ic.replace(old, new)
    open(idx, 'w').write(ic)
    print("Removed 'invited' from status labels - patients never see it")
    cmds = [
        'rm -f fix_invited_status.py',
        'git add "artifacts/carevoy/app/(tabs)/index.tsx"',
        'git commit -m "fix: remove invited status label - patients never see internal statuses"',
        'git push origin main',
    ]
    for cmd in cmds:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
        print((r.stdout or r.stderr).strip()[:150])
else:
    print("Pattern not found - run build65 first then this")
