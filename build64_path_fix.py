import os, json, subprocess

REPO = '/workspaces/CareVoy'
APP = os.path.join(REPO, 'artifacts', 'carevoy')

# Fix the import path in ride-detail.tsx
rf = os.path.join(APP, 'app', 'ride-detail.tsx')
rc = open(rf).read()

old_import = 'import { supabase } from "../../lib/supabase";'
new_import = 'import { supabase } from "../lib/supabase";'

if old_import in rc:
    rc = rc.replace(old_import, new_import)
    open(rf, 'w').write(rc)
    print("1. Fixed import path: ../../lib/supabase -> ../lib/supabase")
else:
    print("1. FAILED - import not found (may already be fixed)")

aj = os.path.join(APP, 'app.json')
a = json.load(open(aj))
a['expo']['ios']['buildNumber'] = '64'
json.dump(a, open(aj, 'w'), indent=2)
print("2. Build number -> 64")

cmds = [
    'rm -f build64_path_fix.py',
    'git add artifacts/carevoy/app/ride-detail.tsx artifacts/carevoy/app.json',
    'git commit -m "fix: correct import path in ride-detail.tsx (was 2 levels, needs 1), build 64"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:150])
