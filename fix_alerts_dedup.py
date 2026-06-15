import subprocess, os

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')

cp = os.path.join(PP, 'coordinator.html')
c = open(cp).read()

# ═══════════════════════════════════════════════════════
# FIX 1: renderAlerts filter must match the "needs action" badge filter
# ═══════════════════════════════════════════════════════
old_alerts = "  var alerts = allRides.filter(function(r){ return ['no_response','reminder_sent'].includes(r.status); });"
new_alerts = "  var alerts = allRides.filter(function(r){ return ['invited','reminder_sent','no_response','pending'].includes(r.status); });"

if old_alerts in c:
    c = c.replace(old_alerts, new_alerts)
    print('1. renderAlerts filter fixed to match badge count')
else:
    print('1. renderAlerts pattern NOT found')

# ═══════════════════════════════════════════════════════
# FIX 2: dedup check before creating a new ride
# ═══════════════════════════════════════════════════════
old_marker = "  var pickupISO = new Date(apptDate + 'T' + (apptTime || '08:00')).toISOString();"

new_block = """  // Check for an existing active ride with this phone — avoid duplicates on resend
  var dupCheck = await fetch(SUPA + '/rest/v1/rides?hospital_id=eq.' + coordInfo.hospital_id + '&contact_phone=eq.' + encodeURIComponent(contactPhone) + '&status=in.(invited,reminder_sent,no_response,pending,confirmed,assigned,en_route,arrived)&select=id,status', { headers: H });
  var dupRides = await dupCheck.json();
  if (Array.isArray(dupRides) && dupRides.length > 0) {
    btn.disabled = true; btn.textContent = 'Resending\\u2026';
    var existingId = dupRides[0].id;
    await fetch(SUPA + '/rest/v1/rides?id=eq.' + existingId, {
      method: 'PATCH',
      headers: { ...H, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'invited', invited_at: new Date().toISOString(), reminder_sent: false })
    });
    try {
      await fetch(API + '/api/invites/send-sms', {
        method: 'POST',
        headers: { ...H, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: contactPhone, patient_name: patientName, facility: hospitalInfo ? hospitalInfo.name : 'your facility' })
      });
    } catch(e2) {}
    closeAddPatient();
    showToast('Invite re-sent to ' + contactPhone, 'ok');
    await loadRides();
    renderPatientTable();
    btn.disabled = false; btn.textContent = 'Send Invite \\u2192';
    return;
  }

  var pickupISO = new Date(apptDate + 'T' + (apptTime || '08:00')).toISOString();"""

if old_marker in c:
    c = c.replace(old_marker, new_block)
    print('2. dedup check added before ride creation')
else:
    print('2. pickupISO marker NOT found')

open(cp, 'w').write(c)

for cmd in [
    'git add partners-portal/coordinator.html',
    'git commit -m "fix: alerts tab filter matches badge count, dedup ride invites by phone"',
    'git push origin main'
]:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print(r.stdout.strip() or r.stderr.strip())

print('')
print('Run this SQL to clean up the existing duplicate:')
print("select id, patient_name, contact_phone, status, created_at from rides where hospital_id = '64568220-e667-4513-84e3-de4baefe7a99' order by created_at;")
print('Then delete the older duplicate by its id.')
