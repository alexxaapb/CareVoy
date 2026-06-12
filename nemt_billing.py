import subprocess, os

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')

dp = os.path.join(PP, 'driver.html')
c = open(dp).read()

# Add a Payments/Billing section after Assignment
old = '''      <div class="settings-title">Assignment</div>
      <div style="font-size:13px;color:#6B7280;line-height:1.6">To update your NEMT company assignment or vehicle type, contact <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a>. Technical issue? <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a>.</div>
    </div>'''

new = '''      <div class="settings-title">Assignment</div>
      <div style="font-size:13px;color:#6B7280;line-height:1.6">To update your NEMT company assignment or vehicle type, contact <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a>. Technical issue? <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a>.</div>
    </div>

    <div class="settings-section">
      <div class="settings-title">Payments & Billing</div>
      <div style="font-size:13px;color:#6B7280;line-height:1.6">Payout statements are sent monthly to your registered email. For payment or billing questions, contact <a href="mailto:billing@carevoy.co" style="color:#00C2A8;text-decoration:none">billing@carevoy.co</a>.</div>
    </div>'''

if old in c:
    c = c.replace(old, new)
    print('driver: billing section added')
else:
    print('driver: assignment pattern NOT found')

open(dp, 'w').write(c)

for cmd in [
    'git add partners-portal/driver.html',
    'git commit -m "feat: add billing section to NEMT driver settings"',
    'git push origin main'
]:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print(r.stdout.strip() or r.stderr.strip())

print('DONE')
