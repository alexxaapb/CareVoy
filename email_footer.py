import subprocess, os

REPO = '/workspaces/CareVoy'
np = os.path.join(REPO, 'api-server', 'api', 'notify', 'send.js')
c = open(np).read()

# Find the existing footer line and add the automated message + copyright below it
old_footer = '''        <div style="margin-top:24px;padding-top:18px;border-top:1px solid #F0F4F8;font-size:12px;color:#9CA3AF">
          Account questions: <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a> &nbsp;·&nbsp; Help: <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a>
        </div>'''

new_footer = '''        <div style="margin-top:24px;padding-top:18px;border-top:1px solid #F0F4F8;font-size:12px;color:#9CA3AF;line-height:1.6">
          Account questions: <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a> &nbsp;·&nbsp; Help: <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a>
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid #F0F4F8;font-size:11px;color:#B0B7C3;line-height:1.7">
            This is an automated message from CareVoy. Please do not reply to this email.<br>
            If you need assistance, contact us at <a href="mailto:contact@carevoy.co" style="color:#9CA3AF;text-decoration:none">contact@carevoy.co</a>.<br>
            &copy; 2026 CareVoy. All rights reserved.
          </div>
        </div>'''

if old_footer in c:
    c = c.replace(old_footer, new_footer)
    open(np, 'w').write(c)
    print('Footer added with automated message + copyright')
else:
    print('Footer pattern not found - checking for alternate...')
    # Try the original partners-only footer
    alt = 'Questions? Contact <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a>'
    if alt in c:
        c = c.replace(alt,
            'Account questions: <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a> &nbsp;·&nbsp; Help: <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a><br><br><span style="font-size:11px;color:#B0B7C3;line-height:1.7">This is an automated message from CareVoy. Please do not reply to this email. If you need assistance, contact us at contact@carevoy.co.<br>&copy; 2026 CareVoy. All rights reserved.</span>'
        )
        open(np, 'w').write(c)
        print('Alternate footer updated')
    else:
        print('NO footer pattern matched - manual check needed')

for cmd in [
    'git add api-server/api/notify/send.js',
    'git commit -m "feat: add automated message and copyright to email footer"',
    'git push origin main'
]:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print(r.stdout.strip() or r.stderr.strip())
