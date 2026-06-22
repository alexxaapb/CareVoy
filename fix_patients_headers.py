import os, subprocess

REPO = '/workspaces/CareVoy'
f = os.path.join(REPO, 'partners-portal', 'admin.html')
c = open(f).read()

old = "      var r = await fetch(SUPA_URL + '/rest/v1/patients?select=id,full_name,phone,email,created_at&order=created_at.desc&limit=200', { headers: h });"
new = "      var h = authHeaders();\n      var r = await fetch(SUPA_URL + '/rest/v1/patients?select=id,full_name,phone,email,created_at&order=created_at.desc&limit=200', { headers: h });"

if old in c:
    c = c.replace(old, new)
    open(f, 'w').write(c)
    print("Fixed: authHeaders() now called inside loadPatients()")
else:
    print("FAILED to find the fetch line")

cmds = [
    'rm -f fix_patients_headers.py',
    'git add partners-portal/admin.html',
    'git commit -m "fix: admin patients tab - call authHeaders() locally (h was not global)"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:150])
