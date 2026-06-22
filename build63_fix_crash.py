import os, json, subprocess, shutil

REPO = '/workspaces/CareVoy'
APP = os.path.join(REPO, 'artifacts', 'carevoy')

# ════════════════════════════════════════════════════════════════
# 1. Read the existing ride/[id].tsx and convert to ride-detail.tsx
#    Change useLocalSearchParams to useLocalSearchParams (works the same
#    for query params), and update the navigation source.
# ════════════════════════════════════════════════════════════════
old_file = os.path.join(APP, 'app', 'ride', '[id].tsx')
new_file = os.path.join(APP, 'app', 'ride-detail.tsx')

if os.path.exists(old_file):
    rc = open(old_file).read()
    open(new_file, 'w').write(rc)
    # Remove the ride/ directory entirely
    shutil.rmtree(os.path.join(APP, 'app', 'ride'))
    print("1. Moved ride/[id].tsx -> ride-detail.tsx and deleted ride/ directory")
else:
    print("1. ride/[id].tsx not found - checking if ride-detail.tsx already exists")
    if os.path.exists(new_file):
        print("   ride-detail.tsx already exists")
    else:
        print("   ERROR: neither file found")

# ════════════════════════════════════════════════════════════════
# 2. Register ride-detail in _layout.tsx
# ════════════════════════════════════════════════════════════════
lf = os.path.join(APP, 'app', '_layout.tsx')
lc = open(lf).read()

if 'ride-detail' not in lc:
    anchor = '        <Stack.Screen name="care/add" options={{ headerShown: false }} />'
    new_line = anchor + '\n        <Stack.Screen name="ride-detail" options={{ headerShown: false }} />'
    if anchor in lc:
        lc = lc.replace(anchor, new_line)
        open(lf, 'w').write(lc)
        print("2. Registered ride-detail route in _layout.tsx")
    else:
        print("2. FAILED to find anchor in _layout.tsx")
else:
    print("2. ride-detail already registered")

# ════════════════════════════════════════════════════════════════
# 3. Update index.tsx navigation from /ride/${id} to /ride-detail?id=${id}
# ════════════════════════════════════════════════════════════════
idx = os.path.join(APP, 'app', '(tabs)', 'index.tsx')
ic = open(idx).read()

old_nav = 'router.push(`/ride/${r.id}`)'
new_nav = 'router.push(`/ride-detail?id=${r.id}`)'
if old_nav in ic:
    ic = ic.replace(old_nav, new_nav)
    open(idx, 'w').write(ic)
    print("3. Updated navigation: /ride/id -> /ride-detail?id=id")
else:
    print("3. Navigation pattern not found")

# ════════════════════════════════════════════════════════════════
# 4. Build 63
# ════════════════════════════════════════════════════════════════
aj = os.path.join(APP, 'app.json')
a = json.load(open(aj))
a['expo']['ios']['buildNumber'] = '63'
json.dump(a, open(aj, 'w'), indent=2)
print("4. Build number -> 63")

cmds = [
    'rm -f build63_fix_crash.py',
    'git add -A artifacts/carevoy/app/',
    'git add artifacts/carevoy/app.json',
    'git commit -m "fix: app crash - move ride detail to flat route (no dynamic dir), build 63"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
