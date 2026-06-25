import os, subprocess

REPO = '/workspaces/CareVoy'
af = os.path.join(REPO, 'partners-portal', 'admin.html')
ac = open(af).read()

old = "    alert(nm2 + ' declined.');"
new = """    alert(nm2 + ' declined.');
    fetch('https://care-voy-api-server.vercel.app/api/notify/partner-declined', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: db.getAttribute('data-email')||'', name: nm2, type: t2})
    }).catch(function(){});"""

if old in ac:
    ac = ac.replace(old, new)
    open(af, 'w').write(ac)
    print("1. Decline email wired in admin")
else:
    print("FAILED - pattern not found")
    print([l.strip() for l in ac.split('\n') if 'declined' in l])

cmds = [
    'rm -f fix_decline_wire.py',
    'git add partners-portal/admin.html',
    'git commit -m "feat: decline email fires when admin declines a partner"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
