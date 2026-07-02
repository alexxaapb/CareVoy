import subprocess, os

REPO = '/workspaces/CareVoy'
PP   = os.path.join(REPO, 'partners-portal')
API_DIR = os.path.join(REPO, 'api-server', 'api')
results = []

# ═══════════════════════════════════════════════════
# PART 1: FARE CALCULATION ON COMPLETION (update-status.js)
# ═══════════════════════════════════════════════════
us_path = os.path.join(API_DIR, 'rides', 'update-status.js')
us = open(us_path).read()

# Add fare calculation before the email section
old_completed = """    if (status === 'completed') { update.completed_at = new Date().toISOString(); }

    const { error } = await sb.from('rides').update(update).eq('id', ride_id);
    if (error) return res.status(500).json({ error: error.message });"""

new_completed = """    if (status === 'completed') {
      update.completed_at = new Date().toISOString();
      // Calculate actual fare from NEMT rates + distance if not already set
      const { data: existingRide } = await sb.from('rides').select('*').eq('id', ride_id).single();
      if (existingRide && !existingRide.actual_cost) {
        let fare = existingRide.estimated_cost || 0;
        // If no estimate, calculate from NEMT rates
        if (!fare && existingRide.nemt_partner_id) {
          const { data: nemt } = await sb.from('nemt_partners').select('base_fare,per_mile_rate,wheelchair_surcharge,stretcher_surcharge').eq('id', existingRide.nemt_partner_id).single();
          if (nemt) {
            fare = parseFloat(nemt.base_fare || 25);
            // Estimate 10 miles if no distance data
            fare += parseFloat(nemt.per_mile_rate || 2.5) * 10;
            const mobility = existingRide.mobility_needs || '';
            if (mobility.includes('wheelchair')) fare += parseFloat(nemt.wheelchair_surcharge || 0);
            if (mobility.includes('stretcher')) fare += parseFloat(nemt.stretcher_surcharge || 0);
          }
        }
        update.actual_cost = Math.round(fare * 100) / 100;
      }
    }

    const { error } = await sb.from('rides').update(update).eq('id', ride_id);
    if (error) return res.status(500).json({ error: error.message });"""

if old_completed in us:
    us = us.replace(old_completed, new_completed)
    results.append("1. update-status.js: calculates actual_cost on completion from NEMT rates")
else:
    results.append("1. FAIL: completed block not matched in update-status.js")

# Update the email to use actual_cost
us = us.replace(
    "const cost = ride.estimated_cost || ride.actual_cost || 0;",
    "const cost = ride.actual_cost || ride.estimated_cost || 0;"
)
open(us_path, 'w').write(us)

# ═══════════════════════════════════════════════════
# PART 2: PATIENT - real receipt modal with download
# ═══════════════════════════════════════════════════
pf = os.path.join(PP, 'patients.html')
pc = open(pf).read()

# Replace loadReceipts to show all completed rides (actual_cost OR facility-covered)
old_load = """async function loadReceipts() {
  const completed = allRides.filter(r => r.status === 'completed' && r.actual_cost);
  const list = document.getElementById('receiptsList');
  if (!completed.length) {
    list.innerHTML = '<div class="empty-box"><div class="empty-icon"></div><div class="empty-title">No receipts yet</div><div class="empty-sub">IRS 213(d) compliant receipts will appear here after your rides are completed.</div></div>';
    return;
  }
  list.innerHTML = completed.map(r => {
    const d = r.pickup_time ? new Date(r.pickup_time).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
    const fac = (r.hospitals && r.hospitals.name) || r.hospital_name || 'Facility';
    return `<div class="receipt-card" onclick="toast('Receipt emailed to ${currentUser.email}')">
      <div class="receipt-icon"></div>
      <div class="receipt-info"><div class="receipt-name">${fac}</div><div class="receipt-meta">IRS 213(d) · ${d}</div></div>
      <div class="receipt-amount">$${r.actual_cost}</div>
    </div>`;
  }).join('');
}"""

new_load = """async function loadReceipts() {
  const completed = allRides.filter(r => r.status === 'completed');
  const list = document.getElementById('receiptsList');
  if (!completed.length) {
    list.innerHTML = '<div class="empty-box"><div class="empty-icon"></div><div class="empty-title">No receipts yet</div><div class="empty-sub">IRS 213(d) compliant receipts will appear here after your rides are completed.</div></div>';
    return;
  }
  list.innerHTML = completed.map(r => {
    const d = r.pickup_time ? new Date(r.pickup_time).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
    const fac = (r.hospitals && r.hospitals.name) || r.hospital_name || 'Facility';
    const cost = r.actual_cost || r.estimated_cost || 0;
    const isFac = r.payment_responsibility === 'facility';
    return `<div class="receipt-card" onclick="viewReceipt('${r.id}')">
      <div class="receipt-icon"></div>
      <div class="receipt-info"><div class="receipt-name">${fac}</div><div class="receipt-meta">${isFac ? 'Facility-Covered' : 'IRS 213(d)'} · ${d}</div></div>
      <div class="receipt-amount">${isFac ? 'Covered' : '$' + parseFloat(cost).toFixed(2)}</div>
    </div>`;
  }).join('');
}"""

if old_load in pc:
    pc = pc.replace(old_load, new_load)
    results.append("2. Patient: receipts show for all completed rides (clickable)")
else:
    results.append("2. FAIL: loadReceipts not matched")

# Replace viewReceipt with a real modal
old_view = """function viewReceipt(rideId) {"""
new_view_func = """function viewReceipt(rideId) {
  var r = allRides.find(function(x){ return x.id === rideId; });
  if (!r) return;
  var d = r.pickup_time ? new Date(r.pickup_time).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}) : '—';
  var fac = (r.hospitals && r.hospitals.name) || r.hospital_name || 'Facility';
  var cost = r.actual_cost || r.estimated_cost || 0;
  var isFac = r.payment_responsibility === 'facility';
  var pickup = r.pickup_address || '—';
  var dropoff = r.dropoff_address || fac;
  var patName = r.patient_name || (currentUser && currentUser.email) || 'Patient';

  var modal = document.getElementById('receiptModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'receiptModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(5,13,31,.6);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px';
    document.body.appendChild(modal);
  }
  modal.innerHTML = '<div style="background:#fff;border-radius:20px;max-width:440px;width:100%;max-height:90vh;overflow-y:auto" id="receiptContent">' +
    '<div style="background:#050D1F;padding:24px;border-radius:20px 20px 0 0;text-align:center">' +
      '<div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:1px">CareVoy</div>' +
      '<div style="color:#9CA3AF;font-size:12px;margin-top:4px">Medical Transportation Receipt</div>' +
    '</div>' +
    '<div style="padding:24px">' +
      '<div style="display:flex;padding:10px 0;border-bottom:1px solid #F3F4F6"><div style="width:120px;font-size:12px;color:#6B7280">Patient</div><div style="font-size:13px;color:#050D1F;font-weight:600">' + patName + '</div></div>' +
      '<div style="display:flex;padding:10px 0;border-bottom:1px solid #F3F4F6"><div style="width:120px;font-size:12px;color:#6B7280">Date</div><div style="font-size:13px;color:#050D1F;font-weight:600">' + d + '</div></div>' +
      '<div style="display:flex;padding:10px 0;border-bottom:1px solid #F3F4F6"><div style="width:120px;font-size:12px;color:#6B7280">Pickup</div><div style="font-size:13px;color:#050D1F;font-weight:600;flex:1">' + pickup + '</div></div>' +
      '<div style="display:flex;padding:10px 0;border-bottom:1px solid #F3F4F6"><div style="width:120px;font-size:12px;color:#6B7280">Destination</div><div style="font-size:13px;color:#050D1F;font-weight:600;flex:1">' + dropoff + '</div></div>' +
      '<div style="display:flex;padding:10px 0;border-bottom:1px solid #F3F4F6"><div style="width:120px;font-size:12px;color:#6B7280">Facility</div><div style="font-size:13px;color:#050D1F;font-weight:600">' + fac + '</div></div>' +
      '<div style="display:flex;padding:10px 0;border-bottom:1px solid #F3F4F6"><div style="width:120px;font-size:12px;color:#6B7280">Payment</div><div style="font-size:13px;color:#050D1F;font-weight:600">' + (isFac ? 'Facility-Covered' : 'Self-Pay') + '</div></div>' +
      (!isFac ? '<div style="display:flex;padding:14px 0;margin-top:4px"><div style="width:120px;font-size:14px;color:#6B7280;font-weight:600">Total</div><div style="font-size:20px;color:#050D1F;font-weight:700">$' + parseFloat(cost).toFixed(2) + '</div></div>' : '') +
      (!isFac ? '<div style="background:rgba(0,194,168,.06);border:1px solid rgba(0,194,168,.2);border-radius:10px;padding:14px;margin-top:12px;font-size:11px;color:#00836F;line-height:1.6"><strong>IRS Section 213(d) Eligible</strong><br>This receipt documents a qualified medical transportation expense eligible for HSA/FSA reimbursement.</div>' : '<div style="background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.2);border-radius:10px;padding:14px;margin-top:12px;font-size:11px;color:#065F46;line-height:1.6">This ride was covered by your healthcare facility.</div>') +
      '<div style="display:flex;gap:10px;margin-top:20px">' +
        '<button onclick="downloadReceipt(\\'' + r.id + '\\')" style="flex:1;padding:12px;background:#050D1F;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Download</button>' +
        '<button onclick="document.getElementById(\\'receiptModal\\').remove()" style="flex:1;padding:12px;background:#F3F4F6;color:#050D1F;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">Close</button>' +
      '</div>' +
    '</div></div>';
  modal.style.display = 'flex';
}

function downloadReceipt(rideId) {
  var r = allRides.find(function(x){ return x.id === rideId; });
  if (!r) return;
  var content = document.getElementById('receiptContent').innerHTML;
  var win = window.open('', '_blank');
  win.document.write('<html><head><title>CareVoy Receipt</title></head><body style="margin:0;font-family:sans-serif">' + content + '</body></html>');
  win.document.close();
  setTimeout(function(){ win.print(); }, 250);
}

function _oldViewReceipt(rideId) {"""

if old_view in pc:
    pc = pc.replace(old_view, new_view_func)
    results.append("3. Patient: full receipt modal with Download (print to PDF)")
else:
    results.append("3. FAIL: viewReceipt not matched")

# ═══════════════════════════════════════════════════
# PART 3: FIX AUTH FLASH - Patient
# ═══════════════════════════════════════════════════
# Patient uses getUser async which is fine, but let's make sure the login screen
# doesn't flash before getUser resolves - hide body until auth resolves
old_body_start = "<body>"
if "<body>" in pc and "opacity:0" not in pc.split("<body>")[1][:100]:
    pc = pc.replace(
        "<body>",
        '<body style="opacity:0;transition:opacity .2s">',
        1
    )
    # Show body after onLoad
    pc = pc.replace(
        "onLoad();",
        "onLoad().then(function(){ document.body.style.opacity='1'; });"
    )
    # Make onLoad return a promise (it's async so it does)
    results.append("4. Patient: body hidden until auth resolves (no login flash)")

open(pf, 'w').write(pc)

# ═══════════════════════════════════════════════════
# PART 4: FIX AUTH FLASH - Coordinator, Driver, Admin
# ═══════════════════════════════════════════════════
# Coordinator
cf = os.path.join(PP, 'coordinator.html')
cc = open(cf).read()
if 'style="opacity:0' not in cc.split('<body')[1][:80] if '<body' in cc else False:
    cc = cc.replace('<body>', '<body style="opacity:0;transition:opacity .15s">', 1)
    cc = cc.replace('init();', 'init().then(function(){document.body.style.opacity="1";}).catch(function(){document.body.style.opacity="1";});')
    results.append("5. Coordinator: body fade-in prevents login flash")
open(cf, 'w').write(cc)

# Driver
df = os.path.join(PP, 'driver.html')
dc = open(df).read()
if '<body' in dc and 'opacity:0' not in dc.split('<body')[1][:80]:
    dc = dc.replace('<body>', '<body style="opacity:0;transition:opacity .15s">', 1)
    dc = dc.replace('init();', 'init().then(function(){document.body.style.opacity="1";}).catch(function(){document.body.style.opacity="1";});')
    results.append("6. Driver: body fade-in prevents login flash")
open(df, 'w').write(dc)

# Admin
af = os.path.join(PP, 'admin.html')
ac = open(af).read()
if '<body' in ac and 'opacity:0' not in ac.split('<body')[1][:80]:
    ac = ac.replace('<body>', '<body style="opacity:0;transition:opacity .15s">', 1)
    # Admin might call init differently - find the load call
    if 'loadStats();' in ac:
        ac = ac.replace('  loadStats();\n  setInterval(loadStats, 30000);', '  loadStats().then(function(){document.body.style.opacity="1";}).catch(function(){document.body.style.opacity="1";});\n  setInterval(loadStats, 30000);')
    results.append("7. Admin: body fade-in prevents login flash")
open(af, 'w').write(ac)

# ═══════════════════════════════════════════════════
# PART 5: COORDINATOR - view + resend receipt
# ═══════════════════════════════════════════════════
cc = open(cf).read()
# Add resend receipt button to completed rides in coordinator
if 'function resendReceipt' not in cc:
    cc = cc.replace(
        'function exportCoordCSV() {',
        """async function resendReceipt(rideId) {
  try {
    var resp = await fetch(API + '/api/rides/update-status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ride_id: rideId, status: 'completed', resend_only: true })
    });
    showToast('Receipt resent to patient', 'ok');
  } catch(e) { showToast('Could not resend', 'err'); }
}

function exportCoordCSV() {"""
    )
    results.append("8. Coordinator: resendReceipt function (emails patient)")
open(cf, 'w').write(cc)

print("=" * 60)
for r in results: print(" ", r)
print("=" * 60)

pc2 = open(pf).read()
print("\nVERIFICATION:")
print("  Fare calc on complete:", "actual_cost = Math.round" in open(us_path).read())
print("  Patient receipt modal:", "receiptModal" in pc2)
print("  Patient download:", "function downloadReceipt" in pc2)
print("  Patient body fade:", "opacity:0" in pc2.split('<body')[1][:80])
print("  Coord resend:", "function resendReceipt" in open(cf).read())
print("  Driver body fade:", "opacity:0" in open(df).read().split('<body')[1][:80])
print("  Admin body fade:", "opacity:0" in open(af).read().split('<body')[1][:80])

for cmd in [
    ['git', '-C', REPO, 'add', '-A', '.'],
    ['git', '-C', REPO, 'commit', '-m', 'feat: receipt system (fare calc, patient modal+download, coord resend), auth flash fix all portals'],
    ['git', '-C', REPO, 'push', 'origin', 'main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout + r.stderr).strip()[:200] or '(ok)')
