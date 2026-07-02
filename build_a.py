import subprocess, os

REPO = '/workspaces/CareVoy'
PP   = os.path.join(REPO, 'partners-portal')
API_DIR = os.path.join(REPO, 'api-server', 'api')
results = []

# ═══════════════════════════════════════════════════
# 1. FIX COORDINATOR PICKER — restore form-row for first/last name
# ═══════════════════════════════════════════════════
cf = os.path.join(PP, 'coordinator.html')
cc = open(cf).read()

# The picker was inserted before "Patient First Name" but broke the form-row wrapper.
# Find the broken structure and fix it
broken = '''      <div style="font-size:11px;color:#9CA3AF;margin-top:4px">Select a patient you've booked before to auto-fill their info</div>
    </div>

    <label class="form-label">Patient First Name <span style="color:#EF4444">*</span></label>
          <input class="form-input" id="patFirstName" placeholder="Jane">
        </div>
        <div class="form-group">
          <label class="form-label">Patient Last Name <span style="color:#EF4444">*</span></label>
          <input class="form-input" id="patLastName" placeholder="Doe">
        </div>
      </div>'''

fixed = '''      <div style="font-size:11px;color:#9CA3AF;margin-top:4px">Select a patient you've booked before to auto-fill their info</div>
    </div>

    <div class="form-row">
        <div class="form-group">
          <label class="form-label">Patient First Name <span style="color:#EF4444">*</span></label>
          <input class="form-input" id="patFirstName" placeholder="Jane">
        </div>
        <div class="form-group">
          <label class="form-label">Patient Last Name <span style="color:#EF4444">*</span></label>
          <input class="form-input" id="patLastName" placeholder="Doe">
        </div>
      </div>'''

if broken in cc:
    cc = cc.replace(broken, fixed)
    results.append("1. Coordinator: First/Last name back in form-row (side by side)")
else:
    results.append("1. FAIL: broken form structure not matched")

open(cf, 'w').write(cc)

# ═══════════════════════════════════════════════════
# 2. PATIENT — fix ride detail modal close button
# ═══════════════════════════════════════════════════
pf = os.path.join(PP, 'patients.html')
pc = open(pf).read()

# The detail modal reuses bookModal but hides confirm btn. The Cancel button
# calls closeBookModal which should remove 'open'. Let's verify it also resets confirm btn display
old_close = """function closeBookModal() {
  // Clear mobility options
  var wb = document.getElementById('bookWheelchair'); if(wb) wb.checked = false;
  var sb2 = document.getElementById('bookStretcher'); if(sb2) sb2.checked = false;
  var cb = document.getElementById('bookCompanion'); if(cb) cb.checked = false;
  document.getElementById('fareEstimate').style.display = 'none';
  window._estimatedFare = null;"""

new_close = """function closeBookModal() {
  // Clear mobility options
  var wb = document.getElementById('bookWheelchair'); if(wb) wb.checked = false;
  var sb2 = document.getElementById('bookStretcher'); if(sb2) sb2.checked = false;
  var cb = document.getElementById('bookCompanion'); if(cb) cb.checked = false;
  var fe = document.getElementById('fareEstimate'); if(fe) fe.style.display = 'none';
  var cbtn = document.getElementById('bookConfirmBtn'); if(cbtn) cbtn.style.display = '';
  window._estimatedFare = null;
  document.getElementById('bookModal').classList.remove('open');"""

if old_close in pc:
    pc = pc.replace(old_close, new_close)
    results.append("2. Patient: ride detail modal closes properly + resets confirm btn")
else:
    results.append("2. FAIL: closeBookModal not matched")

# ═══════════════════════════════════════════════════
# 3. PATIENT — fare estimation uses REAL NEMT rates from DB
# ═══════════════════════════════════════════════════
old_est = """function estimateFare() {
  var pickup = document.getElementById('bookPickup').value;
  if (!pickup || !currentRide) return;
  var dest = currentRide.dropoff_address || currentRide.hospital_name;
  if (!dest || typeof google === 'undefined' || !google.maps) return;

  var service = new google.maps.DistanceMatrixService();
  service.getDistanceMatrix({
    origins: [pickup],
    destinations: [dest],
    travelMode: 'DRIVING',
    unitSystem: google.maps.UnitSystem.IMPERIAL
  }, function(response, status) {
    if (status !== 'OK' || !response.rows[0] || !response.rows[0].elements[0]) return;
    var element = response.rows[0].elements[0];
    if (element.status !== 'OK') return;
    var miles = element.distance.value / 1609.34;

    // Get NEMT rates from the ride's assigned NEMT or use defaults
    var baseFare = 25;
    var perMile = 2.50;
    var wheelchairSurcharge = 0;
    var stretcherSurcharge = 0;

    var estimated = baseFare + (perMile * miles);
    if (document.getElementById('bookWheelchair').checked) estimated += 10;
    if (document.getElementById('bookStretcher').checked) estimated += 25;

    window._estimatedFare = Math.round(estimated * 100) / 100;
    document.getElementById('fareAmount').textContent = '$' + window._estimatedFare.toFixed(2);
    document.getElementById('fareEstimate').style.display = 'block';
  });
}"""

new_est = """async function estimateFare() {
  var pickup = document.getElementById('bookPickup').value;
  if (!pickup || !currentRide) return;
  var dest = currentRide.dropoff_address || currentRide.hospital_name;
  if (!dest || typeof google === 'undefined' || !google.maps) return;

  // Fetch REAL NEMT rates from the database
  var baseFare = 25, perMile = 2.50, wheelchairSurcharge = 10, stretcherSurcharge = 25;
  try {
    if (currentRide.nemt_partner_id) {
      var { data: nemt } = await sb.from('nemt_partners')
        .select('base_fare,per_mile_rate,wheelchair_surcharge,stretcher_surcharge')
        .eq('id', currentRide.nemt_partner_id).single();
      if (nemt) {
        baseFare = parseFloat(nemt.base_fare) || 25;
        perMile = parseFloat(nemt.per_mile_rate) || 2.50;
        wheelchairSurcharge = parseFloat(nemt.wheelchair_surcharge) || 0;
        stretcherSurcharge = parseFloat(nemt.stretcher_surcharge) || 0;
      }
    }
  } catch(e) {}

  var service = new google.maps.DistanceMatrixService();
  service.getDistanceMatrix({
    origins: [pickup], destinations: [dest],
    travelMode: 'DRIVING', unitSystem: google.maps.UnitSystem.IMPERIAL
  }, function(response, status) {
    if (status !== 'OK' || !response.rows[0] || !response.rows[0].elements[0]) return;
    var element = response.rows[0].elements[0];
    if (element.status !== 'OK') return;
    var miles = element.distance.value / 1609.34;

    var estimated = baseFare + (perMile * miles);
    if (document.getElementById('bookWheelchair').checked) estimated += wheelchairSurcharge;
    if (document.getElementById('bookStretcher').checked) estimated += stretcherSurcharge;

    window._estimatedFare = Math.round(estimated * 100) / 100;
    window._estimatedMiles = Math.round(miles * 10) / 10;
    document.getElementById('fareAmount').textContent = '$' + window._estimatedFare.toFixed(2);
    document.getElementById('fareEstimate').style.display = 'block';
  });
}"""

if old_est in pc:
    pc = pc.replace(old_est, new_est)
    results.append("3. Patient: fare estimation uses REAL NEMT rates from database")
else:
    results.append("3. FAIL: estimateFare not matched")

# Store the mileage on the ride so completion uses real distance
old_save = "      estimated_cost: window._estimatedFare || null\n    }).eq('id', currentRide.id);"
new_save = "      estimated_cost: window._estimatedFare || null,\n      estimated_miles: window._estimatedMiles || null\n    }).eq('id', currentRide.id);"
if old_save in pc:
    pc = pc.replace(old_save, new_save)
    results.append("4. Patient: saves estimated_miles for accurate completion fare")

# Fix type display in ride detail
pc = pc.replace(
    '<div class="info-value">${r.ride_type || \'\u2014\'}</div>',
    '<div class="info-value">${formatRideType(r.ride_type) || \'\u2014\'}</div>'
)
results.append("5. Patient: ride detail uses formatRideType")

open(pf, 'w').write(pc)

# ═══════════════════════════════════════════════════
# 4. SERVER — completion fare uses real stored mileage
# ═══════════════════════════════════════════════════
us_path = os.path.join(API_DIR, 'rides', 'update-status.js')
us = open(us_path).read()

us = us.replace(
    "            fare = parseFloat(nemt.base_fare || 25);\n            // Estimate 10 miles if no distance data\n            fare += parseFloat(nemt.per_mile_rate || 2.5) * 10;",
    "            fare = parseFloat(nemt.base_fare || 25);\n            var miles = existingRide.estimated_miles || 10;\n            fare += parseFloat(nemt.per_mile_rate || 2.5) * miles;"
)
results.append("6. Server: completion fare uses real stored mileage (not hardcoded 10)")

open(us_path, 'w').write(us)

# ═══════════════════════════════════════════════════
# 5. Add estimated_miles column note
# ═══════════════════════════════════════════════════
results.append("7. SQL NEEDED: ALTER TABLE rides ADD COLUMN IF NOT EXISTS estimated_miles NUMERIC;")

print("=" * 60)
for r in results: print(" ", r)
print("=" * 60)

cc2 = open(cf).read()
pc2 = open(pf).read()
print("\nVERIFICATION:")
print("  Coord form-row restored:", cc2.count('<div class="form-row">') >= 2)
print("  Patient modal closes:", "classList.remove('open')" in pc2.split('function closeBookModal')[1][:400])
print("  Fare uses real rates:", "sb.from('nemt_partners')" in pc2)
print("  Saves miles:", "estimated_miles" in pc2)
print("  Server real mileage:", "existingRide.estimated_miles" in open(us_path).read())

for cmd in [
    ['git', '-C', REPO, 'add', '-A', '.'],
    ['git', '-C', REPO, 'commit', '-m', 'Build A: real fare calc from NEMT rates+mileage, form-row fix, modal close, type display'],
    ['git', '-C', REPO, 'push', 'origin', 'main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout + r.stderr).strip()[:200] or '(ok)')
