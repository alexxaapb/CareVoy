import subprocess, os

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')

# ═══════════════════════════════════════════════════════
# DRIVER DASHBOARD — Available Rides + Accept
# ═══════════════════════════════════════════════════════
dp = os.path.join(PP, 'driver.html')
c = open(dp).read()

# 1. Add nav button
c = c.replace(
    '<button class="nav-item" onclick="showNav(\'schedule\',this)">My Schedule</button>',
    '<button class="nav-item" onclick="showNav(\'available\',this)">Available Rides</button>\n    <button class="nav-item" onclick="showNav(\'schedule\',this)">My Schedule</button>'
)
print('1. nav button added')

# 2. Add Available Rides section HTML
avail_section = '''
    <!-- Available Rides -->
    <div id="sec-available" style="display:none">
      <div style="font-size:22px;font-weight:700;color:#050D1F;margin-bottom:4px">Available Rides</div>
      <div style="font-size:13px;color:#6B7280;margin-bottom:18px">Rides in your service area ready to accept</div>
      <div id="availableRidesBody"><div style="padding:40px;text-align:center;color:#9CA3AF;font-size:13px">Loading available rides…</div></div>
    </div>

'''
c = c.replace('    <!-- My Schedule -->', avail_section + '    <!-- My Schedule -->')
print('2. Available Rides section added')

# 3. Add 'available' to showNav list
c = c.replace(
    "['overview','schedule','history','earnings','settings'].forEach",
    "['overview','available','schedule','history','earnings','settings'].forEach"
)
c = c.replace(
    "if (name === 'schedule') renderSchedule();",
    "if (name === 'available') loadAvailableRides();\n  if (name === 'schedule') renderSchedule();"
)
print('3. showNav updated')

# 4. Fetch partner service_states
c = c.replace(
    "'/rest/v1/nemt_partners?id=eq.' + staffInfo.nemt_partner_id + '&select=company_name,city'",
    "'/rest/v1/nemt_partners?id=eq.' + staffInfo.nemt_partner_id + '&select=company_name,city,service_states,vehicle_types'"
)
print('4. partner query includes service_states')

# 5. Add loadAvailableRides + acceptRide functions before init()
accept_code = '''
async function loadAvailableRides() {
  var body = document.getElementById('availableRidesBody');
  if (!body || !staffInfo || !staffInfo.nemt_partner_id) return;
  try {
    var r = await fetch(
      SUPA + '/rest/v1/rides?nemt_partner_id=is.null&status=in.(invited,pending,confirmed)&select=*&order=pickup_time.asc',
      { headers: H }
    );
    var rides = await r.json();
    if (!Array.isArray(rides)) rides = [];

    var myStates = (partnerInfo && partnerInfo.service_states) || [];
    if (myStates.length > 0) {
      rides = rides.filter(function(rd) {
        return rd.hospital_state && myStates.includes(rd.hospital_state);
      });
    }

    if (!rides.length) {
      body.innerHTML = '<div style="padding:40px;text-align:center;color:#9CA3AF;font-size:13px">No available rides in your service area right now</div>';
      return;
    }

    body.innerHTML = rides.map(function(rd) {
      var t = rd.pickup_time ? new Date(rd.pickup_time) : null;
      var tStr = t ? t.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) + ' ' + t.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : 'TBD';
      return '<div style="background:#fff;border-radius:12px;border:1px solid #E2E8F0;padding:16px;margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<div>' +
            '<div style="font-weight:700;font-size:14px;color:#050D1F">' + esc(rd.patient_name || 'Patient') + '</div>' +
            '<div style="font-size:12px;color:#6B7280;margin-top:2px">' + esc(rd.hospital_name || 'Facility') + ' · ' + tStr + '</div>' +
            '<div style="font-size:11px;color:#9CA3AF;margin-top:2px">' + esc(rd.pickup_address || 'Pickup TBD') + ' → ' + esc(rd.dropoff_address || 'Dropoff TBD') + '</div>' +
          '</div>' +
          '<button onclick="acceptRide(\\'' + rd.id + '\\')" style="background:#00C2A8;color:#050D1F;border:none;padding:8px 18px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">Accept Ride</button>' +
        '</div></div>';
    }).join('');
  } catch(e) {
    body.innerHTML = '<div style="padding:20px;text-align:center;color:red;font-size:13px">Error: ' + e.message + '</div>';
  }
}

async function acceptRide(rideId) {
  if (!staffInfo || !staffInfo.nemt_partner_id) return;
  try {
    var res = await fetch(SUPA + '/rest/v1/rides?id=eq.' + rideId, {
      method: 'PATCH',
      headers: { ...H, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        nemt_partner_id: staffInfo.nemt_partner_id,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
        driver_name: staffInfo.full_name || null
      })
    });
    if (res.ok) {
      showToast('Ride accepted!', 'ok');
      await loadRides();
    } else {
      showToast('Failed to accept ride', 'err');
    }
  } catch(e) {
    showToast('Error: ' + e.message, 'err');
  }
}

'''

c = c.replace('async function init() {', accept_code + 'async function init() {')
print('5. loadAvailableRides + acceptRide functions added')

# 6. Call loadAvailableRides in loadRides too
c = c.replace(
    '  renderHistory();\n}',
    '  renderHistory();\n  loadAvailableRides();\n}'
)
print('6. loadRides calls loadAvailableRides on refresh')

open(dp, 'w').write(c)

# ═══════════════════════════════════════════════════════
# COORDINATOR — set hospital_state + name on ride creation
# ═══════════════════════════════════════════════════════
cp = os.path.join(PP, 'coordinator.html')
c = open(cp).read()

if 'hospital_state' not in c:
    c = c.replace(
        "status: 'invited',",
        "status: 'invited',\n        hospital_state: hospitalInfo ? (hospitalInfo.state || null) : null,\n        hospital_name: hospitalInfo ? (hospitalInfo.name || null) : null,"
    )
    print('7. coordinator: hospital_state + name set on ride creation')

c = c.replace("select=id,name,city,active", "select=id,name,city,state,active")
print('8. coordinator: hospital query includes state')

open(cp, 'w').write(c)

# ═══════════════════════════════════════════════════════
# COMMIT
# ═══════════════════════════════════════════════════════
for cmd in [
    'git add partners-portal/',
    'git commit -m "feat: NEMT Available Rides + Accept flow, hospital state on ride creation"',
    'git push origin main'
]:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print(r.stdout.strip() or r.stderr.strip())

print('')
print('DONE. Run this SQL in Supabase:')
print('''
-- Allow drivers to update rides (accept)
drop policy if exists "Authenticated can update rides" on rides;
create policy "Authenticated can update rides" on rides for update to authenticated using (true) with check (true);

-- Populate hospital_state on existing rides
update rides r set hospital_state = h.state, hospital_name = h.name
from hospitals h where r.hospital_id = h.id and (r.hospital_state is null or r.hospital_name is null);

-- Make sure HT Transport serves Ohio
update nemt_partners set service_states = '{OH,FL,NY}', vehicle_types = '{ambulatory,wheelchair}' where company_name = 'HT Transport';

notify pgrst, 'reload schema';
''')
