import re, subprocess, os

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')

# The EXACT working logo from index.html (login page)
LOGO_URI = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDI0IDEwMjQiPjxyZWN0IHdpZHRoPSIxMDI0IiBoZWlnaHQ9IjEwMjQiIGZpbGw9IiMwNjBEMUYiLz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgzMjAuMzQgNjkxLjk1KSBzY2FsZSgwLjUwOTEgLTAuNTA5MSkiPjxwYXRoIGQ9Ik0zODMgNzEyUTUxNSA3MTIgNjA1LjAgNjQxLjVRNjk1IDU3MSA3MjEgNDUwSDUxMFE0OTEgNDkwIDQ1Ny41IDUxMS4wUTQyNCA1MzIgMzgwIDUzMlEzMTIgNTMyIDI3MS41IDQ4My41UTIzMSA0MzUgMjMxIDM1NFEyMzEgMjcyIDI3MS41IDIyMy41UTMxMiAxNzUgMzgwIDE3NVE0MjQgMTc1IDQ1Ny41IDE5Ni4wUTQ5MSAyMTcgNTEwIDI1N0g3MjFRNjk1IDEzNiA2MDUuMCA2NS41UTUxNSAtNSAzODMgLTVRMjc5IC01IDE5OS4wIDQwLjVRMTE5IDg2IDc1LjUgMTY3LjVRMzIgMjQ5IDMyIDM1NFEzMiA0NTggNzUuNSA1MzkuNVExMTkgNjIxIDE5OS4wIDY2Ni41UTI3OSA3MTIgMzgzIDcxMloiIGZpbGw9IiNGRkZGRkYiLz48L2c+PHBhdGggZD0iTSA3NTguMjAgNTU1LjQxIEEgMjUwIDI1MCAwIDEgMSA3NTguMjAgNDY4LjU5IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMEMyQTgiIHN0cm9rZS13aWR0aD0iMjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxjaXJjbGUgY3g9Ijc1OC4yMCIgY3k9IjU1NS40MSIgcj0iMTciIGZpbGw9IiNGNUE2MjMiLz48Y2lyY2xlIGN4PSI3NTguMjAiIGN5PSI0NjguNTkiIHI9IjE3IiBmaWxsPSIjRjVBNjIzIi8+PC9zdmc+"

# ── Fix ALL files: logo + email ──
for fname in ['invite.html', 'admin.html', 'coordinator.html', 'driver.html', 'index.html']:
    path = os.path.join(PP, fname)
    if not os.path.exists(path): continue
    c = open(path).read()
    # Replace every img with svg+xml base64 with the correct one
    c = re.sub(r'<img src="data:image/svg\+xml;base64,[A-Za-z0-9+/=]*"', f'<img src="{LOGO_URI}"', c)
    # Replace admin@ email
    c = c.replace('admin@carevoy.co', 'partners@carevoy.co')
    open(path, 'w').write(c)
    print(f'{fname}: logo + email fixed')

# ── COORDINATOR: CSV text + edit button ──
cp = os.path.join(PP, 'coordinator.html')
c = open(cp).read()

# CSV text update
c = c.replace(
    'Upload a CSV exported from your scheduling system. Required columns: <strong>first_name, last_name, phone, appt_date, appt_type</strong>. Optional: email, caregiver_name, caregiver_phone.',
    'Upload a CSV from your scheduling system. Required: <strong>First Name, Last Name, Phone</strong>. Optional: Email, Appointment Date, Appointment Type, Caregiver Name, Caregiver Phone. You can add patients without appointments and send ride invites later.'
)
# Also catch any plain-text version
c = c.replace(
    'Required columns: first_name, last_name, phone, appt_date, appt_type. Optional: email, caregiver_name, caregiver_phone.',
    'Required: First Name, Last Name, Phone. Optional: Email, Appointment Date, Appointment Type, Caregiver Name, Caregiver Phone.'
)

# Edit button on Point of Contact
old_poc = '''      <div class="settings-title">Point of Contact</div>
      <div class="settings-row"><span class="settings-key">Name</span><span class="settings-val" id="setPocName">—</span></div>
      <div class="settings-row"><span class="settings-key">Email</span><span class="settings-val" id="setPocEmail">—</span></div>'''
new_poc = '''      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #F0F4F8;padding-bottom:10px">
        <div class="settings-title" style="margin:0;border:none;padding:0">Point of Contact</div>
        <button id="editPocBtn" onclick="toggleEditPoc()" style="background:#F0F4F8;border:1px solid #E2E8F0;color:#050D1F;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer">Edit</button>
      </div>
      <div class="settings-row"><span class="settings-key">Name</span><span class="settings-val" id="setPocName">—</span><input class="form-input" id="editPocName" style="display:none;max-width:55%;padding:6px 10px"></div>
      <div class="settings-row"><span class="settings-key">Email</span><span class="settings-val" id="setPocEmail">—</span><input class="form-input" id="editPocEmail" type="email" style="display:none;max-width:55%;padding:6px 10px"></div>'''

if old_poc in c:
    c = c.replace(old_poc, new_poc)
    # Add save button after the city row
    c = c.replace(
        '<div class="settings-row"><span class="settings-key">City</span><span class="settings-val" id="setPocCity">—</span></div>\n    </div>',
        '<div class="settings-row"><span class="settings-key">City</span><span class="settings-val" id="setPocCity">—</span></div>\n      <div id="editPocActions" style="display:none;margin-top:12px;justify-content:flex-end"><button onclick="saveEditPoc()" style="background:#00C2A8;color:#050D1F;border:none;padding:8px 18px;border-radius:8px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer">Save Changes</button></div>\n      <div style="font-size:11px;color:#9CA3AF;margin-top:10px">To update facility name or city, contact <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a></div>\n    </div>'
    )
    print('coordinator: edit button added')
else:
    print('coordinator: POC pattern NOT found')

# Add edit JS functions
edit_js = '''
function toggleEditPoc() {
  var editing = document.getElementById('editPocName').style.display !== 'none';
  if (editing) { cancelEditPoc(); return; }
  document.getElementById('setPocName').style.display = 'none';
  document.getElementById('setPocEmail').style.display = 'none';
  document.getElementById('editPocName').style.display = 'block';
  document.getElementById('editPocEmail').style.display = 'block';
  document.getElementById('editPocName').value = coordInfo.full_name || '';
  document.getElementById('editPocEmail').value = coordInfo.email || '';
  document.getElementById('editPocActions').style.display = 'flex';
  document.getElementById('editPocBtn').textContent = 'Cancel';
}
function cancelEditPoc() {
  document.getElementById('setPocName').style.display = '';
  document.getElementById('setPocEmail').style.display = '';
  document.getElementById('editPocName').style.display = 'none';
  document.getElementById('editPocEmail').style.display = 'none';
  document.getElementById('editPocActions').style.display = 'none';
  document.getElementById('editPocBtn').textContent = 'Edit';
}
async function saveEditPoc() {
  var newName = document.getElementById('editPocName').value.trim();
  var newEmail = document.getElementById('editPocEmail').value.trim();
  if (!newName || !newEmail) { showToast('Name and email required', 'err'); return; }
  try {
    await fetch(SUPA + '/rest/v1/hospital_coordinators?id=eq.' + uid, {
      method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ full_name: newName, email: newEmail })
    });
    coordInfo.full_name = newName; coordInfo.email = newEmail;
    document.getElementById('setPocName').textContent = newName;
    document.getElementById('setPocEmail').textContent = newEmail;
    cancelEditPoc(); showToast('Profile updated', 'ok');
  } catch(e) { showToast('Update failed', 'err'); }
}
'''
if 'function toggleEditPoc' not in c:
    c = c.replace('init();\nsetInterval(loadAll, 30000);', edit_js + '\ninit();\nsetInterval(loadAll, 30000);')
    print('coordinator: edit JS added')

open(cp, 'w').write(c)

# ── DRIVER: edit button + notifications ──
dp = os.path.join(PP, 'driver.html')
c = open(dp).read()

c = c.replace('You receive push notifications (coming soon) and SMS alerts when a new ride is assigned to you.',
    'Email alerts are sent to your registered email when a new ride is assigned to your company.')
c = c.replace('(coming soon)', '')

old_acct = '''      <div class="settings-title">Account</div>
      <div class="settings-row"><span class="settings-key">Name</span><span class="settings-val" id="setName">—</span></div>'''
new_acct = '''      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid #F0F4F8;padding-bottom:10px">
        <div class="settings-title" style="margin:0;border:none;padding:0">Account</div>
        <button id="editAcctBtn" onclick="toggleEditAcct()" style="background:#F0F4F8;border:1px solid #E2E8F0;color:#050D1F;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer">Edit</button>
      </div>
      <div class="settings-row"><span class="settings-key">Name</span><span class="settings-val" id="setName">—</span><input class="form-input" id="editName" style="display:none;max-width:55%;padding:6px 10px"></div>'''

if old_acct in c:
    c = c.replace(old_acct, new_acct)
    c = c.replace(
        '<div class="settings-row"><span class="settings-key">Role</span><span class="settings-val">Driver</span></div>\n    </div>',
        '<div class="settings-row"><span class="settings-key">Role</span><span class="settings-val">Driver</span></div>\n      <div id="editAcctActions" style="display:none;margin-top:12px;justify-content:flex-end"><button onclick="saveEditAcct()" style="background:#00C2A8;color:#050D1F;border:none;padding:8px 18px;border-radius:8px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer">Save Changes</button></div>\n    </div>'
    )
    print('driver: edit button added')
else:
    print('driver: Account pattern NOT found')

driver_js = '''
function toggleEditAcct() {
  var editing = document.getElementById('editName').style.display !== 'none';
  if (editing) { cancelEditAcct(); return; }
  document.getElementById('setName').style.display = 'none';
  document.getElementById('editName').style.display = 'block';
  document.getElementById('editName').value = staffInfo.full_name || '';
  document.getElementById('editAcctActions').style.display = 'flex';
  document.getElementById('editAcctBtn').textContent = 'Cancel';
}
function cancelEditAcct() {
  document.getElementById('setName').style.display = '';
  document.getElementById('editName').style.display = 'none';
  document.getElementById('editAcctActions').style.display = 'none';
  document.getElementById('editAcctBtn').textContent = 'Edit';
}
async function saveEditAcct() {
  var newName = document.getElementById('editName').value.trim();
  if (!newName) { showToast('Name required', 'err'); return; }
  try {
    await fetch(SUPA + '/rest/v1/staff?id=eq.' + uid, {
      method: 'PATCH', headers: { ...H, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ full_name: newName })
    });
    staffInfo.full_name = newName;
    document.getElementById('setName').textContent = newName;
    cancelEditAcct(); showToast('Profile updated', 'ok');
  } catch(e) { showToast('Update failed', 'err'); }
}
'''
if 'function toggleEditAcct' not in c:
    c = c.replace('init();\nsetInterval(loadRides, 30000);', driver_js + '\ninit();\nsetInterval(loadRides, 30000);')
    print('driver: edit JS added')

open(dp, 'w').write(c)

# ── COMMIT ──
for cmd in [
    'git add partners-portal/',
    'git commit -m "fix: logo match, partners email, CSV text, settings edit buttons, email notifications text"',
    'git push origin main'
]:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print(r.stdout.strip() or r.stderr.strip())

print('DONE')

# ═══════════════════════════════════════════════════════
# FACILITY METRICS UPGRADE — coordinator dashboard
# ═══════════════════════════════════════════════════════
cp = os.path.join(PP, 'coordinator.html')
c = open(cp).read()

# Replace the stats block with hero metrics + operational metrics
old_stats = '''    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total Patients</div>
        <div class="stat-value" id="statTotal">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Rides Confirmed</div>
        <div class="stat-value teal" id="statConfirmed">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Needs Action</div>
        <div class="stat-value gold" id="statAction">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">This Month</div>
        <div class="stat-value" id="statMonth">—</div>
      </div>
    </div>'''

new_stats = '''    <!-- Hero metrics: the numbers a facility shows their boss -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="stat-card" style="background:linear-gradient(135deg,#050D1F 0%,#0a1a3a 100%);border:none">
        <div class="stat-label" style="color:#9CA3AF">Appointments Kept</div>
        <div class="stat-value" style="color:#00C2A8;font-size:32px" id="statKept">—</div>
        <div style="color:#6B7280;font-size:11px;margin-top:2px">Completed rides = appointments your patients made</div>
      </div>
      <div class="stat-card" style="background:linear-gradient(135deg,#050D1F 0%,#0a1a3a 100%);border:none">
        <div class="stat-label" style="color:#9CA3AF">Patient HSA/FSA Savings</div>
        <div class="stat-value" style="color:#F5A623;font-size:32px" id="statSavings">—</div>
        <div style="color:#6B7280;font-size:11px;margin-top:2px">Est. tax savings via IRS 213(d) receipts</div>
      </div>
    </div>

    <!-- Operational metrics -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total Patients</div>
        <div class="stat-value" id="statTotal">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Rides Confirmed</div>
        <div class="stat-value teal" id="statConfirmed">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Needs Action</div>
        <div class="stat-value gold" id="statAction">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Upcoming This Week</div>
        <div class="stat-value" id="statUpcoming">—</div>
      </div>
    </div>'''

if old_stats in c:
    c = c.replace(old_stats, new_stats)
    print('coordinator: hero metrics added')
else:
    print('coordinator: stats block NOT found')

# Update the updateStats function to calculate the new metrics
old_calc = '''  document.getElementById('statTotal').textContent = allRides.length;
  document.getElementById('statConfirmed').textContent = confirmed.length;
  document.getElementById('statAction').textContent = action.length;
  document.getElementById('statMonth').textContent = month.length;'''

new_calc = '''  // Hero metrics
  var completed = allRides.filter(function(r){ return r.status === 'completed'; });
  var SAVINGS_PER_RIDE = 14; // ~30% of avg $46 ride saved via HSA/FSA pre-tax
  document.getElementById('statKept').textContent = completed.length;
  document.getElementById('statSavings').textContent = '$' + (completed.length * SAVINGS_PER_RIDE).toLocaleString();

  // Upcoming this week
  var weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  var upcoming = allRides.filter(function(r){
    return r.pickup_time && new Date(r.pickup_time) >= new Date() && new Date(r.pickup_time) <= weekEnd && !['completed','cancelled'].includes(r.status);
  });

  // Operational metrics
  document.getElementById('statTotal').textContent = allRides.length;
  document.getElementById('statConfirmed').textContent = confirmed.length;
  document.getElementById('statAction').textContent = action.length;
  document.getElementById('statUpcoming').textContent = upcoming.length;'''

if old_calc in c:
    c = c.replace(old_calc, new_calc)
    print('coordinator: metrics calc updated')
else:
    print('coordinator: calc block NOT found')

open(cp, 'w').write(c)

# Re-commit with metrics included
for cmd in [
    'git add partners-portal/coordinator.html',
    'git commit -m "feat: facility hero metrics - appointments kept and patient HSA savings"',
    'git push origin main'
]:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print(r.stdout.strip() or r.stderr.strip())

print('METRICS ADDED')
