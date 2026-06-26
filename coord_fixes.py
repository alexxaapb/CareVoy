import os, subprocess

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')
results = []

# 1. Normalize phone in reminders/send.js
rf = os.path.join(REPO, 'api-server', 'api', 'reminders', 'send.js')
rc = open(rf).read()
if 'normalizedPhone' not in rc:
    old = "    const contactPhone = ride.contact_phone;"
    new = """    var rawPhone = ride.contact_phone || '';
    var digits = String(rawPhone).replace(/\\D/g, '');
    if (digits.length === 10) digits = '1' + digits;
    const contactPhone = digits ? '+' + digits : '';"""
    if old in rc:
        rc = rc.replace(old, new)
        open(rf, 'w').write(rc)
        results.append("1. reminders/send.js normalizes phone")
    else:
        results.append("1. FAILED - reminders contactPhone line not found")
else:
    results.append("1. reminders already normalizes phone")

# 2. Phone placeholders - remove +1
cf = os.path.join(PP, 'coordinator.html')
cc = open(cf).read()
cc = cc.replace('placeholder="+1 (555) 000-0000"', 'placeholder="(555) 000-0000"')
results.append("2. Phone placeholders changed to (555) 000-0000 (no +1)")

# 3. Add Cancel button to coordinator rides
# The action button currently is just Remind for pending rides. Add Cancel next to it.
old_action = "    ? '<button class=\"btn btn-navy\" onclick=\"sendReminder(event,\\'' + r.id + '\\')\">Remind</button>'"
new_action = "    ? '<button class=\"btn btn-navy\" onclick=\"sendReminder(event,\\'' + r.id + '\\')\">Remind</button> <button class=\"btn btn-ghost\" style=\"color:#EF4444;border:1px solid #FECACA\" onclick=\"cancelRide(event,\\'' + r.id + '\\')\">Cancel</button>'"
if old_action in cc:
    cc = cc.replace(old_action, new_action)
    results.append("3a. Cancel button added next to Remind")
else:
    results.append("3a. FAILED - Remind button pattern not found")

# Also add cancel to the alerts section button
old_alert = "      '<button class=\"btn btn-navy\" onclick=\"sendReminder(event,\\'' + r.id + '\\')\">Send Reminder</button>' +"
new_alert = "      '<button class=\"btn btn-navy\" onclick=\"sendReminder(event,\\'' + r.id + '\\')\">Send Reminder</button> <button class=\"btn btn-ghost\" style=\"color:#EF4444;border:1px solid #FECACA\" onclick=\"cancelRide(event,\\'' + r.id + '\\')\">Cancel</button>' +"
if old_alert in cc:
    cc = cc.replace(old_alert, new_alert)
    results.append("3b. Cancel button added to alerts section")
else:
    results.append("3b. Alerts Send Reminder pattern not found (skipped)")

# 4. Add cancelRide function after sendReminder
old_fn = """async function sendReminder(evt, rideId) {
  evt.stopPropagation();
  try {
    await fetch(API + '/api/reminders/send', {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ride_id: rideId })
    });
  } catch(e) {}
  showToast('Reminder sent', 'ok');
  await loadRides();
}"""
new_fn = old_fn + """

async function cancelRide(evt, rideId) {
  evt.stopPropagation();
  if (!confirm('Cancel this ride? This will remove the invite.')) return;
  try {
    await fetch(SUPA + '/rest/v1/rides?id=eq.' + rideId, {
      method: 'PATCH',
      headers: { ...H, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'cancelled' })
    });
    showToast('Ride cancelled', 'ok');
  } catch(e) { showToast('Could not cancel', 'err'); }
  await loadRides();
  renderPatientTable();
}"""
if old_fn in cc:
    cc = cc.replace(old_fn, new_fn)
    results.append("4. cancelRide function added")
else:
    results.append("4. FAILED - sendReminder function not found for insertion")

open(cf, 'w').write(cc)

# 5. Facility form - check for insurance-related field to remove (facility_type insurance)
ff = os.path.join(PP, 'facility-signup.html')
fc = open(ff).read()
# Already removed payment insurance; check facility_type for insurance option
before = fc.count('insurance')
results.append(f"5. Facility form 'insurance' references remaining: {before} (insurance/ is the doc upload path, keep that)")

cmds = [
    'rm -f coord_fixes.py',
    'git add api-server/api/reminders/send.js partners-portal/coordinator.html',
    'git commit -m "fix: reminder phone normalize, remove +1 placeholder, add cancel ride button"',
    'git push origin main',
]
for r in results:
    print(r)
for cmd in cmds:
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((res.stdout or res.stderr).strip()[:200])
