import os, subprocess

REPO = '/workspaces/CareVoy'

# 1. Fix email footer in send.js - put each contact on its own line
sf = os.path.join(REPO, 'api-server', 'api', 'notify', 'send.js')
sc = open(sf).read()

old_footer = """          <span style="white-space:nowrap">Account changes: <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a></span> &nbsp;·&nbsp; <span style="white-space:nowrap">Billing: <a href="mailto:billing@carevoy.co" style="color:#00C2A8;text-decoration:none">billing@carevoy.co</a></span> &nbsp;·&nbsp; <span style="white-space:nowrap">Help: <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a></span>"""

new_footer = """          <div style="margin-bottom:4px">Account changes: <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a></div>
          <div style="margin-bottom:4px">Billing: <a href="mailto:billing@carevoy.co" style="color:#00C2A8;text-decoration:none">billing@carevoy.co</a></div>
          <div>Help: <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a></div>"""

if old_footer in sc:
    sc = sc.replace(old_footer, new_footer)
    open(sf, 'w').write(sc)
    print("1. Email footer fixed - each contact on own line")
else:
    print("1. FAILED - footer pattern not found")

# 2. Fix admin notification email - "Review in Dashboard" should go to dashboard directly
nf = os.path.join(REPO, 'api-server', 'api', 'notify', 'new-partner.js')
nc = open(nf).read()
old_link = '<a href="https://partners.carevoy.co" style="display:inline-block;background:#050D1F;color:#00C2A8;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">Review in Dashboard</a>'
new_link = '<a href="https://partners.carevoy.co/admin" style="display:inline-block;background:#050D1F;color:#00C2A8;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">Review in Dashboard</a>'
if old_link in nc:
    nc = nc.replace(old_link, new_link)
    open(nf, 'w').write(nc)
    print("2. Dashboard link goes to /admin directly")
else:
    print("2. FAILED - link pattern not found")

# 3. Check admin approve button - does it have data-email?
af = os.path.join(REPO, 'partners-portal', 'admin.html')
ac = open(af).read()
approve_email = ac.count('data-email')
print(f"3. data-email attributes in admin: {approve_email} (need 2 - one on approve, one on decline)")

# Check the decline button has data-email too
decline_has_email = 'cv-decline" data-type=\'" + type + \'" data-id=\'" + data.id + \'" data-name=\'" + nm + \'" data-email=\'' in ac or 'cv-decline" data-type="' in ac
print(f"   Decline button data-email check: looking...")
for line in ac.split('\n'):
    if 'cv-decline' in line and 'data-email' in line:
        print(f"   FOUND: {line.strip()[:100]}")
        break
    elif 'cv-decline' in line:
        print(f"   MISSING data-email on: {line.strip()[:100]}")
        break

cmds = [
    'rm -f fix_email_footer_and_flow.py',
    'git add api-server/api/notify/send.js api-server/api/notify/new-partner.js',
    'git commit -m "fix: email footer line breaks, dashboard link goes to /admin"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
