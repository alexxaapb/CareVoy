import os, subprocess

REPO = '/workspaces/CareVoy'
np = os.path.join(REPO, 'api-server', 'api', 'notify', 'new-partner.js')
nc = open(np).read()

# Remove "once approved you can log in at" from confirmation email
old_text = '<p style=\\"color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px\\">Thank you for applying to join CareVoy. We have received your application and will be in touch as soon as possible.</p><p style=\\"color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px\\">Once approved you can log in at:</p><a href=\\"https://partners.carevoy.co\\" style=\\"display:inline-block;background:#050D1F;color:#00C2A8;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none\\">partners.carevoy.co</a>'
new_text = '<p style=\\"color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px\\">Thank you for applying to join CareVoy. We have received your application and will be in touch as soon as possible.</p>'

if old_text in nc:
    nc = nc.replace(old_text, new_text)
    open(np, 'w').write(nc)
    print("1. Removed login link from confirmation email")
else:
    # Try without escapes since it's a JS string
    nc2 = nc.replace(
        'We have received your application and will be in touch as soon as possible.</p><p style=\\"color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px\\">Once approved you can log in at:</p><a href=\\"https://partners.carevoy.co\\" style=\\"display:inline-block;background:#050D1F;color:#00C2A8;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none\\">partners.carevoy.co</a>',
        'We have received your application and will be in touch as soon as possible.</p>'
    )
    if nc2 != nc:
        open(np, 'w').write(nc2)
        print("1. Removed login link from confirmation email (alt)")
    else:
        print("1. FAILED - checking file content")
        # Find the line
        for i, line in enumerate(nc.split('\n')):
            if 'Once approved' in line or 'partners.carevoy.co' in line:
                print(f"  Line {i+1}: {line[:100]}")

cmds = [
    'rm -f fix_confirmation_email.py',
    'git add api-server/api/notify/new-partner.js',
    'git commit -m "fix: remove login link from applicant confirmation email"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
