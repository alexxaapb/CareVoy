import os, subprocess, json

REPO = '/workspaces/CareVoy'
APP = os.path.join(REPO, 'artifacts', 'carevoy')

br = os.path.join(APP, 'app', 'book-ride.tsx')
bc = open(br).read()

old_val = '''    if (!surgeryTime) return "Please select time";'''
new_val = '''    if (!surgeryTime) return "Please select time";
    // If today is selected, block past times
    const nowCheck = new Date();
    const todayStr = nowCheck.toISOString().slice(0, 10);
    const selectedDateStr = surgeryDate.toISOString().slice(0, 10);
    if (selectedDateStr === todayStr) {
      const combined = combineDateTime(surgeryDate, surgeryTime);
      if (combined <= nowCheck) return "Please select a future time for today\\'s ride";
    }'''

if old_val in bc:
    bc = bc.replace(old_val, new_val)
    open(br, 'w').write(bc)
    print("1. Time validation added - blocks past times when today is selected")
else:
    print("1. FAILED to find time validation anchor")

# Build 66
aj = os.path.join(APP, 'app.json')
a = json.load(open(aj))
a['expo']['ios']['buildNumber'] = '66'
json.dump(a, open(aj, 'w'), indent=2)
print("2. Build -> 66")

cmds = [
    'rm -f fix_time_validation.py',
    'git add artifacts/carevoy/app/book-ride.tsx artifacts/carevoy/app.json',
    'git commit -m "fix: block past times when today is selected in book-ride, build 66"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:150])
