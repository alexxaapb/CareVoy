import os, subprocess

REPO = '/workspaces/CareVoy'

# Fix 1: partner-approved.js - replace curly apostrophe with straight one
pf = os.path.join(REPO, 'api-server', 'api', 'notify', 'partner-approved.js')
pc = open(pf, encoding='utf-8').read()
pc = pc.replace('\u2019re approved', "\\'re approved")
open(pf, 'w', encoding='utf-8').write(pc)
print("1. Curly apostrophe fixed in partner-approved.js")
print(f"   Verify: {[l.strip()[:80] for l in pc.split(chr(10)) if 'approved' in l.lower() and 'you' in l.lower()]}")

# Fix 2: new-partner.js - remove "Once approved you can log in at" + link
nf = os.path.join(REPO, 'api-server', 'api', 'notify', 'new-partner.js')
nc = open(nf, encoding='utf-8').read()

# Remove the two elements: the <p> tag and the <a> tag
nc = nc.replace(
    '<p style=\\"color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px\\">Once approved you can log in at:</p>',
    ''
)
nc = nc.replace(
    '<a href=\\"https://partners.carevoy.co\\" style=\\"display:inline-block;background:#050D1F;color:#00C2A8;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none\\">partners.carevoy.co</a>',
    ''
)

# Try without escapes too
nc = nc.replace(
    '<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px">Once approved you can log in at:</p>',
    ''
)
nc = nc.replace(
    '<a href="https://partners.carevoy.co" style="display:inline-block;background:#050D1F;color:#00C2A8;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">partners.carevoy.co</a>',
    ''
)

if 'Once approved' not in nc:
    open(nf, 'w', encoding='utf-8').write(nc)
    print("2. 'Once approved' login link removed from confirmation email")
else:
    print("2. FAILED - still present, trying regex")
    import re
    nc = re.sub(r'<p[^>]*>Once approved you can log in at:</p><a[^>]*>partners\.carevoy\.co</a>', '', nc)
    if 'Once approved' not in nc:
        open(nf, 'w', encoding='utf-8').write(nc)
        print("2. Removed via regex")
    else:
        print("2. STILL FAILED")

cmds = [
    'rm -f fix_emails_final.py',
    'git add api-server/api/notify/partner-approved.js api-server/api/notify/new-partner.js',
    'git commit -m "fix: curly apostrophe in approval email, remove login link from confirmation"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
