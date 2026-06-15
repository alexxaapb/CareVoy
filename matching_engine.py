import subprocess, os, re

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')
API = os.path.join(REPO, 'api-server', 'api')

# ═══════════════════════════════════════════════════════
# 1. INVITE.HTML — Add state + vehicle checkboxes to NEMT form
# ═══════════════════════════════════════════════════════
ip = os.path.join(PP, 'invite.html')
c = open(ip).read()

# Find the NEMT state field and add service states + vehicle types after it
old_state = '''      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div class="field-label">CITY</div><input type="text" id="nemtCity" placeholder="Columbus"></div>
        <div><div class="field-label">STATE</div><input type="text" id="nemtState" placeholder="OH"></div>
      </div>'''

new_state = '''      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div class="field-label">CITY</div><input type="text" id="nemtCity" placeholder="Columbus"></div>
        <div><div class="field-label">STATE</div><input type="text" id="nemtState" placeholder="OH"></div>
      </div>

      <div class="field-label" style="margin-top:16px">STATES YOU SERVE</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px" id="stateCheckboxes">
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;color:#374151;cursor:pointer"><input type="checkbox" value="OH" class="svc-state"> Ohio</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;color:#374151;cursor:pointer"><input type="checkbox" value="FL" class="svc-state"> Florida</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;color:#374151;cursor:pointer"><input type="checkbox" value="NY" class="svc-state"> New York</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;color:#374151;cursor:pointer"><input type="checkbox" value="NJ" class="svc-state"> New Jersey</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;color:#374151;cursor:pointer"><input type="checkbox" value="PA" class="svc-state"> Pennsylvania</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;color:#374151;cursor:pointer"><input type="checkbox" value="NC" class="svc-state"> North Carolina</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;color:#374151;cursor:pointer"><input type="checkbox" value="GA" class="svc-state"> Georgia</label>
      </div>

      <div class="field-label">VEHICLE TYPES</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px" id="vehicleCheckboxes">
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;color:#374151;cursor:pointer"><input type="checkbox" value="ambulatory" class="veh-type"> Ambulatory</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;color:#374151;cursor:pointer"><input type="checkbox" value="wheelchair" class="veh-type"> Wheelchair</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;color:#374151;cursor:pointer"><input type="checkbox" value="stretcher" class="veh-type"> Stretcher/Gurney</label>
        <label style="display:flex;align-items:center;gap:4px;font-size:13px;color:#374151;cursor:pointer"><input type="checkbox" value="bariatric" class="veh-type"> Bariatric</label>
      </div>'''

if old_state in c:
    c = c.replace(old_state, new_state)
    print('1a. invite.html: state + vehicle checkboxes added')
else:
    print('1a. invite.html: state field pattern NOT found')

# Add the checkbox values to extraData
old_extra = "extraData = { company_name: company, city: city, state: state };"
new_extra = """var serviceStates = Array.from(document.querySelectorAll('.svc-state:checked')).map(function(cb){ return cb.value; });
    var vehicleTypes = Array.from(document.querySelectorAll('.veh-type:checked')).map(function(cb){ return cb.value; });
    extraData = { company_name: company, city: city, state: state, service_states: serviceStates, vehicle_types: vehicleTypes };"""

if old_extra in c:
    c = c.replace(old_extra, new_extra)
    print('1b. invite.html: extraData includes service_states + vehicle_types')
else:
    print('1b. invite.html: extraData pattern NOT found')

open(ip, 'w').write(c)

# ═══════════════════════════════════════════════════════
# 2. ACCEPT.JS — Store service_states + vehicle_types on nemt_partners
# ═══════════════════════════════════════════════════════
ap = os.path.join(API, 'invite', 'accept.js')
c = open(ap).read()

old_nemt = "await supabase.from('staff').upsert({ id: finalUid, role: 'nemt', full_name, email, nemt_partner_id: partnerId || null });"
new_nemt = """// Update NEMT partner with service coverage
      const service_states = req.body.service_states;
      const vehicle_types = req.body.vehicle_types;
      if (partnerId && (service_states || vehicle_types)) {
        const updates = {};
        if (service_states && service_states.length) updates.service_states = service_states;
        if (vehicle_types && vehicle_types.length) updates.vehicle_types = vehicle_types;
        await supabase.from('nemt_partners').update(updates).eq('id', partnerId);
      }
      await supabase.from('staff').upsert({ id: finalUid, role: 'nemt', full_name, email, nemt_partner_id: partnerId || null });"""

if old_nemt in c:
    c = c.replace(old_nemt, new_nemt)
    print('2. accept.js: stores service_states + vehicle_types on nemt_partners')
else:
    print('2. accept.js: staff upsert pattern NOT found')

open(ap, 'w').write(c)

# ═══════════════════════════════════════════════════════
# 3. ADMIN.HTML — Fix All Rides + Add Assign NEMT modal with matching
# ═══════════════════════════════════════════════════════
adp = os.path.join(PP, 'admin.html')
c = open(adp).read()

# Replace the broken All Rides copy logic with a proper ride loader
old_rides_copy = """    if (name === 'rides') {
      var src3 = document.getElementById('liveRidesBody');
      var dst3 = document.getElementById('allRidesBody');
      if (src3 && dst3) dst3.innerHTML = src3.innerHTML;
    }"""

new_rides_loader = """    if (name === 'rides') {
      loadAllRides();
    }"""

if old_rides_copy in c:
    c = c.replace(old_rides_copy, new_rides_loader)
    print('3a. admin.html: All Rides now loads independently')
else:
    print('3a. admin.html: rides copy pattern NOT found')

# Add the NEMT assignment modal HTML before the invite modal
assign_modal = """
<!-- NEMT Assignment modal -->
<div class="modal-scrim" id="assignModal">
  <div class="modal-card" style="max-width:440px">
    <div class="modal-title">Assign NEMT Partner</div>
    <div style="margin-bottom:12px;font-size:13px;color:#6B7280" id="assignRideInfo"></div>
    <div id="assignMatchList" style="margin-bottom:16px"></div>
    <div class="modal-foot">
      <button class="modal-btn close" onclick="closeAssignModal()">Cancel</button>
      <button class="modal-btn copy" id="confirmAssignBtn" onclick="confirmAssign()" disabled>Assign</button>
    </div>
  </div>
</div>
"""

if 'assignModal' not in c:
    c = c.replace('<!-- Invite modal -->', assign_modal + '\n<!-- Invite modal -->')
    print('3b. admin.html: assign modal added')
else:
    print('3b. admin.html: assign modal already exists')

# Add loadAllRides + matching functions before loadStats()
assign_js = """
  var allNemtPartners = [];
  var selectedAssignPartnerId = null;
  var assigningRideId = null;

  async function loadAllRides() {
    var body = document.getElementById('allRidesBody');
    try {
      var res = await fetch(SUPA_URL + '/rest/v1/rides?select=*,hospitals(name,city,state)&order=created_at.desc&limit=50', { headers: h });
      var rides = await res.json();
      if (!rides || !rides.length) {
        body.innerHTML = '<div style="padding:40px;text-align:center;color:#9CA3AF;font-size:13px">No rides yet</div>';
        return;
      }
      body.innerHTML = rides.map(function(r) {
        var t = r.pickup_time ? new Date(r.pickup_time) : null;
        var tStr = t ? t.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' ' + t.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—';
        var badge = statusBadge(r.status);
        var hospName = (r.hospitals && r.hospitals.name) || '—';
        var actionBtn = '';
        if (['invited','pending','confirmed'].includes(r.status) && !r.nemt_partner_id) {
          actionBtn = '<button onclick="openAssignModal(\\'' + r.id + '\\',\\'' + esc(r.patient_name||'Patient') + '\\',\\'' + esc(hospName) + '\\',\\'' + ((r.hospitals&&r.hospitals.state)||'') + '\\')" style="background:#00C2A8;color:#050D1F;border:none;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Assign NEMT</button>';
        } else if (r.nemt_partner_id) {
          actionBtn = '<span style="font-size:11px;color:#9CA3AF">Assigned</span>';
        }
        return '<div class="rides-row" style="grid-template-columns:1.4fr 1.2fr 1fr 1fr 0.8fr 0.8fr">' +
          '<div class="td">' + esc(r.patient_name || 'Patient') + '</div>' +
          '<div class="td muted" style="font-size:12px">' + esc(hospName) + '</div>' +
          '<div class="td muted" style="font-size:12px">—</div>' +
          '<div class="td">' + badge + '</div>' +
          '<div class="td muted" style="font-size:12px">' + tStr + '</div>' +
          '<div class="td">' + actionBtn + '</div></div>';
      }).join('');
    } catch(e) { body.innerHTML = '<div style="padding:40px;text-align:center;color:#9CA3AF;font-size:13px">Error loading rides</div>'; }
  }

  async function openAssignModal(rideId, patientName, hospName, hospState) {
    assigningRideId = rideId;
    selectedAssignPartnerId = null;
    document.getElementById('confirmAssignBtn').disabled = true;
    document.getElementById('assignRideInfo').innerHTML = '<strong>' + patientName + '</strong> at ' + hospName + (hospState ? ' (' + hospState + ')' : '');

    // Fetch NEMT partners and filter by state match
    var res = await fetch(SUPA_URL + '/rest/v1/nemt_partners?active=eq.true&select=id,company_name,city,service_states,vehicle_types,wheelchair_accessible', { headers: h });
    var partners = await res.json();

    // Filter: partners whose service_states includes the hospital state
    var matched = partners;
    if (hospState) {
      var stateMatched = partners.filter(function(p) {
        return p.service_states && p.service_states.includes(hospState);
      });
      if (stateMatched.length > 0) matched = stateMatched;
      // If no state match, show all with a note
    }

    var listEl = document.getElementById('assignMatchList');
    if (!matched.length) {
      listEl.innerHTML = '<div style="padding:16px;text-align:center;color:#9CA3AF;font-size:13px">No NEMT partners available. Invite one first.</div>';
      document.getElementById('assignModal').classList.add('open');
      return;
    }

    listEl.innerHTML = matched.map(function(p) {
      var tags = '';
      if (p.vehicle_types && p.vehicle_types.length) tags += p.vehicle_types.map(function(v){return '<span style="background:#E0F7F5;color:#0a9a87;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:4px">'+v+'</span>';}).join('');
      if (p.service_states && p.service_states.length) tags += ' <span style="font-size:10px;color:#9CA3AF">(' + p.service_states.join(', ') + ')</span>';
      var stateMatch = hospState && p.service_states && p.service_states.includes(hospState);
      return '<div onclick="selectAssignPartner(\\'' + p.id + '\\',this)" style="padding:12px 14px;border:2px solid #E2E8F0;border-radius:10px;margin-bottom:8px;cursor:pointer;transition:border-color 0.15s" class="assign-option">' +
        '<div style="font-weight:600;font-size:14px;color:#050D1F">' + esc(p.company_name) + (stateMatch ? ' <span style="color:#00C2A8;font-size:10px;font-weight:700">STATE MATCH</span>' : '') + '</div>' +
        '<div style="font-size:12px;color:#6B7280">' + esc(p.city || '') + tags + '</div>' +
        '</div>';
    }).join('');

    document.getElementById('assignModal').classList.add('open');
  }

  function selectAssignPartner(partnerId, el) {
    selectedAssignPartnerId = partnerId;
    document.querySelectorAll('.assign-option').forEach(function(e) { e.style.borderColor = '#E2E8F0'; });
    el.style.borderColor = '#00C2A8';
    document.getElementById('confirmAssignBtn').disabled = false;
  }

  async function confirmAssign() {
    if (!assigningRideId || !selectedAssignPartnerId) return;
    document.getElementById('confirmAssignBtn').textContent = 'Assigning…';
    document.getElementById('confirmAssignBtn').disabled = true;
    try {
      var token = sessionStorage.getItem('cv_admin_token');
      var res = await fetch(API_URL + '/api/rides/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ ride_id: assigningRideId, nemt_partner_id: selectedAssignPartnerId })
      });
      var data = await res.json();
      if (data.success) {
        showToast('NEMT partner assigned — emails sent');
        closeAssignModal();
        loadAllRides();
        loadStats();
      } else {
        showToast('Error: ' + (data.error || 'Assignment failed'));
      }
    } catch(e) { showToast('Assignment failed'); }
    document.getElementById('confirmAssignBtn').textContent = 'Assign';
    document.getElementById('confirmAssignBtn').disabled = false;
  }

  function closeAssignModal() {
    document.getElementById('assignModal').classList.remove('open');
    assigningRideId = null;
    selectedAssignPartnerId = null;
  }

  document.getElementById('assignModal').addEventListener('click', function(e) {
    if (e.target === this) closeAssignModal();
  });

"""

# Insert before loadStats()
if 'async function loadAllRides' not in c:
    c = c.replace('  loadStats();\n  setInterval(loadStats, 30000);', assign_js + '\n  loadStats();\n  setInterval(loadStats, 30000);')
    print('3c. admin.html: loadAllRides + assign modal functions added')
else:
    print('3c. admin.html: functions already exist')

# Add API_URL constant near SUPA_URL
if 'API_URL' not in c:
    c = c.replace(
        "var SUPA_URL = 'https://byflpckbjjumxxjxoplk.supabase.co';",
        "var SUPA_URL = 'https://byflpckbjjumxxjxoplk.supabase.co';\n  var API_URL = 'https://care-voy-api-server.vercel.app';"
    )
    print('3d. admin.html: API_URL constant added')

open(adp, 'w').write(c)

# ═══════════════════════════════════════════════════════
# COMMIT
# ═══════════════════════════════════════════════════════
for cmd in [
    'git add partners-portal/ api-server/',
    'git commit -m "feat: matching engine — NEMT state/vehicle signup, admin assign modal with smart matching"',
    'git push origin main'
]:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print(r.stdout.strip() or r.stderr.strip())

print('')
print('DONE. Now run this SQL in Supabase:')
print("""
alter table nemt_partners add column if not exists service_states text[];
alter table nemt_partners add column if not exists vehicle_types text[];

-- Update your existing test NEMT partner with coverage
update nemt_partners 
set service_states = '{OH,FL,NY}', 
    vehicle_types = '{ambulatory,wheelchair}'
where company_name = 'HT Transport';

-- Add RLS policy so admin can read nemt_partners
drop policy if exists "Anyone can read active partners" on nemt_partners;
create policy "Anyone can read active partners" on nemt_partners for select to authenticated using (true);

-- Rides need select policy for admin
drop policy if exists "Authenticated can read rides" on rides;
create policy "Authenticated can read rides" on rides for select to authenticated using (true);

-- Hospitals need select policy
drop policy if exists "Authenticated can read hospitals" on hospitals;
create policy "Authenticated can read hospitals" on hospitals for select to authenticated using (true);

notify pgrst, 'reload schema';
""")
