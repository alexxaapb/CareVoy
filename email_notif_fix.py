import re, subprocess, os

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')
API = os.path.join(REPO, 'api-server', 'api')

# ═══════════════════════════════════════════════════════
# COORDINATOR: merge two notification sections into one + add contact@
# ═══════════════════════════════════════════════════════
cp = os.path.join(PP, 'coordinator.html')
c = open(cp).read()

# Remove the standalone "Automatic Reminders" section entirely
c = c.replace(
    '''      <div class="settings-title">Automatic Reminders</div>
      <div style="font-size:13px;color:#374151;line-height:1.6">CareVoy automatically sends a reminder SMS to patients or caregivers who have not confirmed their ride within <strong>48 hours</strong> of receiving their invite. No action needed from you.</div>
    </div>

    <div class="settings-section">
''',
    ''
)

# Replace the Notifications section text with a clean combined version
c = c.replace(
    '''      <div class="settings-title">Notifications</div>
      <div style="font-size:13px;color:#6B7280;line-height:1.6">Ride status alerts are sent to your registered email. Contact your CareVoy admin to update notification preferences.</div>''',
    '''      <div class="settings-title">Notifications</div>
      <div style="font-size:13px;color:#374151;line-height:1.6">Email alerts are sent to your registered email when rides are confirmed, drivers are assigned, and rides are completed. CareVoy also automatically sends an SMS reminder to patients who haven't confirmed within <strong>48 hours</strong> — no action needed from you. Technical issue? Contact <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a>.</div>'''
)

open(cp, 'w').write(c)
print('coordinator: merged notification sections + added contact@')

# ═══════════════════════════════════════════════════════
# DRIVER: add contact@ for technical issues
# ═══════════════════════════════════════════════════════
dp = os.path.join(PP, 'driver.html')
c = open(dp).read()

# Find the Assignment section and add contact line
c = c.replace(
    'To update your NEMT company assignment or vehicle type, contact your CareVoy admin at <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a>.',
    'To update your NEMT company assignment or vehicle type, contact <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a>. Technical issue? <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a>.'
)
# Catch any other partners@ reference in driver settings that should mention contact
open(dp, 'w').write(c)
print('driver: added contact@ for technical')

# ═══════════════════════════════════════════════════════
# WELCOME EMAIL: ensure footer has all three contacts
# ═══════════════════════════════════════════════════════
np = os.path.join(API, 'notify', 'send.js')
c = open(np).read()

# Update footer to show contact split clearly
c = re.sub(
    r'Account questions:.*?contact@carevoy\.co</a>',
    'Account changes: <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a> &nbsp;·&nbsp; Billing: <a href="mailto:billing@carevoy.co" style="color:#00C2A8;text-decoration:none">billing@carevoy.co</a> &nbsp;·&nbsp; Help: <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a>',
    c
)
# Also handle the original single-contact footer if still present
c = c.replace(
    'Questions? Contact <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a>',
    'Account changes: <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a> &nbsp;·&nbsp; Billing: <a href="mailto:billing@carevoy.co" style="color:#00C2A8;text-decoration:none">billing@carevoy.co</a> &nbsp;·&nbsp; Help: <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a>'
)
open(np, 'w').write(c)
print('notify: footer updated with all 3 contacts')

# ═══════════════════════════════════════════════════════
# COMMIT
# ═══════════════════════════════════════════════════════
for cmd in [
    'git add partners-portal/ api-server/',
    'git commit -m "fix: merge coordinator notification sections, add contact@ for tech, update email footer contacts"',
    'git push origin main'
]:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print(r.stdout.strip() or r.stderr.strip())

print('DONE')
