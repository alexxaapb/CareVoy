import re, subprocess, os

REPO = '/workspaces/CareVoy'
API = os.path.join(REPO, 'api-server', 'api')
PP = os.path.join(REPO, 'partners-portal')

# ═══════════════════════════════════════════════════════
# 1. Add 'welcome' type to notify/send.js
# ═══════════════════════════════════════════════════════
np = os.path.join(API, 'notify', 'send.js')
c = open(np).read()

welcome_case = '''    } else if (type === 'welcome') {
      subject = 'Welcome to CareVoy';
      title = 'Your account is ready';
      const roleLabel = data.role === 'nemt' ? 'transport partner' : 'facility coordinator';
      const dashUrl = data.role === 'nemt' ? portal + '/driver.html' : portal + '/coordinator.html';
      body = `Welcome${data.full_name ? ' ' + data.full_name : ''}! Your CareVoy ${roleLabel} account has been created successfully. You can now sign in anytime at <a href="${portal}" style="color:#00C2A8;text-decoration:none">partners.carevoy.co</a> to manage rides and coordinate transportation.<br><br>Need help getting started? Just reply to this email or reach us at the contacts below.`;
      ctaText = 'Go to My Dashboard'; ctaUrl = dashUrl;
'''

if "type === 'welcome'" not in c:
    c = c.replace(
        "    } else {\n      return res.status(400).json({ error: 'Unknown notification type' });",
        welcome_case + "    } else {\n      return res.status(400).json({ error: 'Unknown notification type' });"
    )
    # Update footer to show the right contacts
    c = c.replace(
        'Questions? Contact <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a>',
        'Account questions: <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a> &nbsp;·&nbsp; Help: <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a>'
    )
    open(np, 'w').write(c)
    print('1. notify/send.js: welcome type + footer updated')
else:
    print('1. notify/send.js: already has welcome')

# ═══════════════════════════════════════════════════════
# 2. Wire welcome email into invite/accept.js
# ═══════════════════════════════════════════════════════
ap = os.path.join(API, 'invite', 'accept.js')
c = open(ap).read()

old_return = "    return res.status(200).json({ success: true, role });"
new_block = '''    // Send welcome email
    try {
      await fetch('https://care-voy-api-server.vercel.app/api/notify/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'welcome', to: email, data: { full_name, role } })
      });
    } catch(_) {}

    return res.status(200).json({ success: true, role });'''

if "type: 'welcome'" not in c:
    c = c.replace(old_return, new_block)
    open(ap, 'w').write(c)
    print('2. invite/accept.js: welcome email wired')
else:
    print('2. invite/accept.js: already wired')

# ═══════════════════════════════════════════════════════
# 3. One-time endpoint to resend welcome to existing partners
# ═══════════════════════════════════════════════════════
resend_all = '''const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let sent = 0;
    const results = [];

    // All coordinators
    const { data: coords } = await supabase.from('hospital_coordinators').select('email, full_name');
    if (coords) {
      for (const cd of coords) {
        if (cd.email) {
          try {
            await fetch('https://care-voy-api-server.vercel.app/api/notify/send', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'welcome', to: cd.email, data: { full_name: cd.full_name, role: 'coordinator' } })
            });
            sent++; results.push(cd.email);
          } catch(_) {}
        }
      }
    }

    // All NEMT staff
    const { data: staff } = await supabase.from('staff').select('email, full_name').eq('role', 'nemt');
    if (staff) {
      for (const st of staff) {
        if (st.email) {
          try {
            await fetch('https://care-voy-api-server.vercel.app/api/notify/send', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'welcome', to: st.email, data: { full_name: st.full_name, role: 'nemt' } })
            });
            sent++; results.push(st.email);
          } catch(_) {}
        }
      }
    }

    return res.status(200).json({ success: true, sent, emails: results });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
'''
os.makedirs(os.path.join(API, 'admin'), exist_ok=True)
open(os.path.join(API, 'admin', 'resend-welcome.js'), 'w').write(resend_all)
print('3. admin/resend-welcome.js: one-time resend endpoint created')

# ═══════════════════════════════════════════════════════
# 4. Update dashboard settings emails (contact/partners/billing split)
# ═══════════════════════════════════════════════════════
# COORDINATOR
cp = os.path.join(PP, 'coordinator.html')
c = open(cp).read()
# Contract & Billing -> billing@
c = c.replace(
    'Your facility agreement and pricing tier are on file with CareVoy. Contact <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a> for a copy or to request changes.',
    'Your facility agreement and pricing tier are on file with CareVoy. For billing or contract questions, contact <a href="mailto:billing@carevoy.co" style="color:#00C2A8;text-decoration:none">billing@carevoy.co</a>.'
)
# Notifications section -> mention contact@ for tech help
c = c.replace(
    'Email alerts are sent to your registered email when rides are confirmed, drivers are assigned, and rides are completed. No setup needed.',
    'Email alerts are sent to your registered email when rides are confirmed, drivers are assigned, and rides are completed. No setup needed. Technical issue? Contact <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a>.'
)
open(cp, 'w').write(c)
print('4a. coordinator.html: email mapping updated')

# DRIVER
dp = os.path.join(PP, 'driver.html')
c = open(dp).read()
c = c.replace(
    'To update your NEMT company, contact <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a>.',
    'To update your NEMT company, contact <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a>. Technical issue? <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a>.'
)
open(dp, 'w').write(c)
print('4b. driver.html: email mapping updated')

# ═══════════════════════════════════════════════════════
# COMMIT
# ═══════════════════════════════════════════════════════
for cmd in [
    'git add api-server/ partners-portal/',
    'git commit -m "feat: welcome email, resend endpoint, dashboard email mapping (contact/partners/billing)"',
    'git push origin main'
]:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print(r.stdout.strip() or r.stderr.strip())

print('')
print('DONE. After deploy (~2 min), trigger the one-time resend by visiting:')
print('https://care-voy-api-server.vercel.app/api/admin/resend-welcome')
print('(or POST to it) — it emails all existing partners their welcome email.')
