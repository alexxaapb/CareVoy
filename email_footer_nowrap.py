import subprocess, os

REPO = '/workspaces/CareVoy'
np = os.path.join(REPO, 'api-server', 'api', 'notify', 'send.js')
c = open(np).read()

# Wrap each label+email pair in a nowrap span so they don't break across lines
old = 'Account changes: <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a> &nbsp;·&nbsp; Billing: <a href="mailto:billing@carevoy.co" style="color:#00C2A8;text-decoration:none">billing@carevoy.co</a> &nbsp;·&nbsp; Help: <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a>'

new = '<span style="white-space:nowrap">Account changes: <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a></span> &nbsp;·&nbsp; <span style="white-space:nowrap">Billing: <a href="mailto:billing@carevoy.co" style="color:#00C2A8;text-decoration:none">billing@carevoy.co</a></span> &nbsp;·&nbsp; <span style="white-space:nowrap">Help: <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a></span>'

if old in c:
    c = c.replace(old, new)
    print('footer: nowrap spans added')
else:
    print('footer pattern NOT found')

open(np, 'w').write(c)

for cmd in [
    'git add api-server/api/notify/send.js',
    'git commit -m "fix: keep email label and address on same line in welcome footer"',
    'git push origin main'
]:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print(r.stdout.strip() or r.stderr.strip())

print('DONE')
