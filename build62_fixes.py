import os, json, subprocess

REPO = '/workspaces/CareVoy'
APP = os.path.join(REPO, 'artifacts', 'carevoy')

# ════════════════════════════════════════════════════════════════
# FIX 1: Remove Stack.Screen registration for ride/[id] from _layout.tsx
# (expo-router auto-discovers it; manual registration with brackets crashes)
# Instead, set headerShown:false inside the component itself.
# ════════════════════════════════════════════════════════════════
lf = os.path.join(APP, 'app', '_layout.tsx')
lc = open(lf).read()

old_line = '\n        <Stack.Screen name="ride/[id]" options={{ headerShown: false }} />'
if old_line in lc:
    lc = lc.replace(old_line, '')
    open(lf, 'w').write(lc)
    print("1. Removed ride/[id] Stack.Screen from _layout.tsx")
else:
    print("1. ride/[id] line not found in _layout")

# ════════════════════════════════════════════════════════════════
# FIX 2: Add Stack.Screen inline in ride/[id].tsx to hide header
# ════════════════════════════════════════════════════════════════
rf = os.path.join(APP, 'app', 'ride', '[id].tsx')
rc = open(rf).read()

# Add Stack import and inline Screen component
old_import = 'import { useLocalSearchParams, useRouter } from "expo-router";'
new_import = 'import { useLocalSearchParams, useRouter, Stack } from "expo-router";'
if 'Stack' not in rc.split('from "expo-router"')[0]:
    rc = rc.replace(old_import, new_import)
    print("2a. Added Stack import")

# Add <Stack.Screen> at the top of the return
old_return = '    <View style={styles.container}>\n      {/* Header */}'
new_return = '    <View style={styles.container}>\n      <Stack.Screen options={{ headerShown: false }} />\n      {/* Header */}'
if '<Stack.Screen' not in rc:
    rc = rc.replace(old_return, new_return)
    print("2b. Added inline Stack.Screen options")
else:
    print("2b. Stack.Screen already in component")

open(rf, 'w').write(rc)

# ════════════════════════════════════════════════════════════════
# Build 62
# ════════════════════════════════════════════════════════════════
aj = os.path.join(APP, 'app.json')
a = json.load(open(aj))
a['expo']['ios']['buildNumber'] = '62'
json.dump(a, open(aj, 'w'), indent=2)
print("3. Build number -> 62")

cmds = [
    'rm -f build62_fixes.py',
    'git add artifacts/carevoy/app/_layout.tsx "artifacts/carevoy/app/ride/[id].tsx" artifacts/carevoy/app.json',
    'git commit -m "fix: app crash - remove ride/[id] from root Stack (expo-router auto-discovers), build 62"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
