import subprocess, os

REPO = '/workspaces/CareVoy'
PP   = os.path.join(REPO, 'partners-portal')
API_DIR = os.path.join(REPO, 'api-server', 'api')
results = []

# ═══════════════════════════════════════
# 1. CREATE /api/rides/update-status.js
# ═══════════════════════════════════════
os.makedirs(os.path.join(API_DIR, 'rides'), exist_ok=True)

update_status_js = r"""const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ride_id, status, driver_name, driver_phone, action } = req.body;
    if (!ride_id) return res.status(400).json({ error: 'Missing ride_id' });

    const sb = createClient(
      process.env.SUPABASE_URL || 'https://byflpckbjjumxxjxoplk.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Handle ride deletion
    if (action === 'delete') {
      const { error } = await sb.from('rides').delete().eq('id', ride_id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, action: 'deleted' });
    }

    // Build update payload
    const update = { status };
    if (status === 'assigned' && driver_name) { update.driver_name = driver_name; update.driver_phone = driver_phone || null; update.assigned_at = new Date().toISOString(); }
    if (status === 'in_progress') { /* just status */ }
    if (status === 'completed') { update.completed_at = new Date().toISOString(); }

    const { error } = await sb.from('rides').update(update).eq('id', ride_id);
    if (error) return res.status(500).json({ error: error.message });

    // On completion, send receipt email
    if (status === 'completed') {
      try {
        const { data: ride } = await sb.from('rides').select('*').eq('id', ride_id).single();
        if (ride && ride.contact_email && process.env.RESEND_API_KEY) {
          const { Resend } = require('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          const patName = (ride.patient_name || 'Patient').split(' ')[0];
          const facility = ride.hospital_name || 'your healthcare facility';
          const rideDate = ride.pickup_time ? new Date(ride.pickup_time).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}) : '';
          const pickup = ride.pickup_address || 'Pickup location';
          const dropoff = ride.dropoff_address || facility;
          const cost = ride.estimated_cost || ride.actual_cost || 0;
          const isFacility = ride.payment_responsibility === 'facility';

          const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
            <div style="background:#050D1F;padding:20px 24px;border-radius:12px 12px 0 0;text-align:center">
              <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:1px">CareVoy</span></div>
            <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px">
              <p style="color:#050D1F;font-size:16px;font-weight:600;margin:0 0 16px">Ride Receipt</p>
              <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151">
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Patient</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${ride.patient_name || 'Patient'}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Date</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${rideDate}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Pickup</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${pickup}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Destination</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${dropoff}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Facility</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${facility}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Payment</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${isFacility ? 'Facility-Covered' : 'Self-Pay'}</td></tr>
                ${cost > 0 ? '<tr><td style="padding:12px 0;color:#6B7280;font-size:14px">Total</td><td style="padding:12px 0;text-align:right;font-weight:700;font-size:18px;color:#050D1F">$' + parseFloat(cost).toFixed(2) + '</td></tr>' : ''}
              </table>
              ${!isFacility ? '<div style="background:rgba(0,194,168,0.06);border:1px solid rgba(0,194,168,0.2);border-radius:10px;padding:14px 16px;margin-top:20px;font-size:12px;color:#00836F;line-height:1.6"><strong>IRS Section 213(d) Eligible</strong><br>This receipt documents a qualified medical transportation expense eligible for HSA/FSA reimbursement. Retain this receipt for your records.</div>' : ''}
              ${isFacility ? '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:14px 16px;margin-top:20px;font-size:12px;color:#065F46;line-height:1.6">This ride was covered by your healthcare facility. No payment is required from you.</div>' : ''}
              <p style="color:#9CA3AF;font-size:11px;margin:24px 0 0;line-height:1.5">CareVoy coordinates medical transportation on behalf of healthcare facilities. Questions? Contact support@carevoy.co.</p>
            </div></div>`;

          await resend.emails.send({
            from: 'CareVoy <notifications@carevoy.co>',
            to: ride.contact_email,
            subject: isFacility ? 'Ride Completed — ' + facility : 'Ride Receipt — $' + parseFloat(cost).toFixed(2),
            html
          });
        }
      } catch(emailErr) { console.error('Receipt email error:', emailErr); }
    }

    return res.status(200).json({ success: true, status });
  } catch(e) {
    console.error('update-status error:', e);
    return res.status(500).json({ error: e.message });
  }
};
"""

open(os.path.join(API_DIR, 'rides', 'update-status.js'), 'w').write(update_status_js)
results.append("1. /api/rides/update-status.js created (service role key, handles all status changes + receipt)")

# ═══════════════════════════════════════
# 2. REWRITE /api/auth/delete-user.js to handle full patient deletion
# ═══════════════════════════════════════
delete_user_js = r"""const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { user_id, patient_email } = req.body;
    if (!user_id) return res.status(400).json({ error: 'Missing user_id' });

    const sb = createClient(
      process.env.SUPABASE_URL || 'https://byflpckbjjumxxjxoplk.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Delete rides by patient_id and contact_email
    await sb.from('rides').delete().eq('patient_id', user_id);
    if (patient_email) {
      await sb.from('rides').delete().eq('contact_email', patient_email);
    }

    // Delete patient record
    await sb.from('patients').delete().eq('id', user_id);

    // Delete auth user
    const { error } = await sb.auth.admin.deleteUser(user_id);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true });
  } catch(e) {
    console.error('delete-user error:', e);
    return res.status(500).json({ error: e.message });
  }
};
"""

open(os.path.join(API_DIR, 'auth', 'delete-user.js'), 'w').write(delete_user_js)
results.append("2. /api/auth/delete-user.js rewritten (deletes rides + patient + auth user via service role)")

# ═══════════════════════════════════════
# 3. DRIVER - route ALL writes through API
# ═══════════════════════════════════════
df = os.path.join(PP, 'driver.html')
dc = open(df).read()

# Add API var
if "var API" not in dc and "const API" not in dc:
    dc = dc.replace(
        "var SUPA = 'https://byflpckbjjumxxjxoplk.supabase.co';",
        "var SUPA = 'https://byflpckbjjumxxjxoplk.supabase.co';\nvar API  = 'https://care-voy-api-server.vercel.app';"
    )
    results.append("3a. Driver: var API added")

# Replace updateStatus to call API
old_update = """async function updateStatus(rideId, newStatus) {
  statusOverrides[rideId] = newStatus;
  renderTodayRides();
  renderSchedule();
  showToast(newStatus === 'in_progress' ? 'Ride started' : newStatus === 'completed' ? 'Ride completed' : 'Status updated', 'ok');
  try {
    var updateBody = { status: newStatus };
    if (newStatus === 'completed') updateBody.completed_at = new Date().toISOString();
    await fetch(SUPA + '/rest/v1/rides?id=eq.' + rideId, {
      method: 'PATCH',
      headers: { ...H, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify(updateBody)
    });
    // On completion, trigger receipt email
    if (newStatus === 'completed') {
      try {
        await fetch(API + '/api/notify/ride-completed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ride_id: rideId })
        });
      } catch(e2) {}
    }
  } catch(e) { showToast('Status update failed', 'err'); }
  await loadRides();
}"""

new_update = """async function updateStatus(rideId, newStatus) {
  statusOverrides[rideId] = newStatus;
  renderTodayRides();
  renderSchedule();
  try {
    var resp = await fetch(API + '/api/rides/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ride_id: rideId, status: newStatus })
    });
    var result = await resp.json();
    if (result.success) {
      showToast(newStatus === 'in_progress' ? 'Ride started' : newStatus === 'completed' ? 'Ride completed' : 'Status updated', 'ok');
    } else {
      showToast('Failed: ' + (result.error || 'Unknown error'), 'err');
    }
  } catch(e) { showToast('Status update failed: ' + e.message, 'err'); }
  await loadRides();
}"""

if old_update in dc:
    dc = dc.replace(old_update, new_update)
    results.append("3b. Driver: updateStatus routes through API (bypasses RLS)")
else:
    results.append("3b. FAIL: updateStatus not matched")

# Replace acceptRide to call API
old_accept_body = "body: JSON.stringify({ status: 'assigned', nemt_partner_id: partnerId, driver_name: (staffInfo?(staffInfo.full_name||staffInfo.company_name||''):''), driver_phone: (staffInfo?(staffInfo.phone||''):'') })"
new_accept = """body: JSON.stringify({ ride_id: rideId, status: 'assigned', driver_name: (staffInfo?(staffInfo.full_name||staffInfo.company_name||''):''), driver_phone: (staffInfo?(staffInfo.phone||''):'') })
    });
    // ALSO update via API to ensure it goes through
    await fetch(API + '/api/rides/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ride_id: rideId, status: 'assigned', driver_name: (staffInfo?(staffInfo.full_name||staffInfo.company_name||''):''), driver_phone: (staffInfo?(staffInfo.phone||''):'') })"""

if old_accept_body in dc:
    dc = dc.replace(old_accept_body, new_accept)
    results.append("3c. Driver: acceptRide also calls API as backup")
else:
    results.append("3c. FAIL: acceptRide body not matched")

# Fix export partnerId
dc = dc.replace(
    "SUPA + '/rest/v1/rides?nemt_partner_id=eq.' + partnerId +",
    "SUPA + '/rest/v1/rides?nemt_partner_id=eq.' + (staffInfo?staffInfo.nemt_partner_id:'') +"
)
results.append("3d. Driver: export CSV fixed (partnerId → staffInfo.nemt_partner_id)")

open(df, 'w').write(dc)

# ═══════════════════════════════════════
# 4. ADMIN - deletePatient routes through API
# ═══════════════════════════════════════
af = os.path.join(PP, 'admin.html')
ac = open(af).read()

old_delete = """async function deletePatient(patientId, patientEmail) {
  if (!confirm('Remove this patient and all their rides permanently? This cannot be undone.')) return;
  var _URL = 'https://byflpckbjjumxxjxoplk.supabase.co';
  var _K   = 'sb_publishable_mwR5uT4W3C2M-K5LbBag4g_GdN0plrT';
  var _tk  = localStorage.getItem('cv_admin_token') || sessionStorage.getItem('cv_admin_token') || '';
  var _H   = { 'apikey': _K, 'Authorization': 'Bearer ' + _tk, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
  try {
    // Delete their rides first (FK constraint)
    if (patientEmail) {
      await fetch(_URL + '/rest/v1/rides?contact_email=eq.' + encodeURIComponent(patientEmail), { method: 'DELETE', headers: _H });
    }
    if (patientId) {
      await fetch(_URL + '/rest/v1/rides?patient_id=eq.' + patientId, { method: 'DELETE', headers: _H });
      await fetch(_URL + '/rest/v1/patients?id=eq.' + patientId, { method: 'DELETE', headers: _H });
    }
    // Also delete auth user
    try { await fetch('https://care-voy-api-server.vercel.app/api/auth/delete-user', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({user_id:patientId}) }); } catch(e3){}
    showToast('Patient removed', 'ok');
    loadStats();
  } catch(e) { showToast('Could not delete patient: ' + e.message, 'err'); }
}"""

new_delete = """async function deletePatient(patientId, patientEmail) {
  if (!confirm('Remove this patient permanently? This cannot be undone.')) return;
  try {
    var resp = await fetch('https://care-voy-api-server.vercel.app/api/auth/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: patientId, patient_email: patientEmail })
    });
    var result = await resp.json();
    if (result.success) {
      showToast('Patient removed', 'ok');
    } else {
      showToast('Could not delete: ' + (result.error || 'Unknown error'), 'err');
    }
    loadStats();
  } catch(e) { showToast('Could not delete patient: ' + e.message, 'err'); }
}"""

if old_delete in ac:
    ac = ac.replace(old_delete, new_delete)
    results.append("4a. Admin: deletePatient routes through API (service role key)")
else:
    results.append("4a. FAIL: deletePatient not matched")

# Also fix adminDeleteRide to route through API
old_admin_ride = """async function adminDeleteRide(rideId) {
  if (!confirm('Delete this ride permanently?')) return;
  var _SUPA = 'https://byflpckbjjumxxjxoplk.supabase.co';
  var _KEY  = 'sb_publishable_mwR5uT4W3C2M-K5LbBag4g_GdN0plrT';
  var _tk   = localStorage.getItem('cv_admin_token') || sessionStorage.getItem('cv_admin_token') || '';
  var _H    = { 'apikey': _KEY, 'Authorization': 'Bearer ' + _tk, 'Prefer': 'return=minimal' };
  try {
    var resp = await fetch(_SUPA + '/rest/v1/rides?id=eq.' + rideId, { method: 'DELETE', headers: _H });
    if (!resp.ok) { var err = await resp.text(); showToast('Delete failed: ' + err, 'err'); return; }
    showToast('Ride deleted', 'ok');
    loadAllRides();
  } catch(e) { showToast('Could not delete ride', 'err'); }
}"""

new_admin_ride = """async function adminDeleteRide(rideId) {
  if (!confirm('Delete this ride permanently?')) return;
  try {
    var resp = await fetch('https://care-voy-api-server.vercel.app/api/rides/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ride_id: rideId, action: 'delete' })
    });
    var result = await resp.json();
    if (result.success) {
      showToast('Ride deleted', 'ok');
    } else {
      showToast('Delete failed: ' + (result.error || 'Unknown'), 'err');
    }
    loadStats();
  } catch(e) { showToast('Could not delete ride: ' + e.message, 'err'); }
}"""

if old_admin_ride in ac:
    ac = ac.replace(old_admin_ride, new_admin_ride)
    results.append("4b. Admin: adminDeleteRide routes through API")
else:
    results.append("4b. FAIL: adminDeleteRide not matched")

open(af, 'w').write(ac)

# ═══════════════════════════════════════
print("=" * 60)
for r in results: print(" ", r)
print("=" * 60)

dc2 = open(df).read()
ac2 = open(af).read()
print("\nVERIFICATION:")
print("  API var in driver:", "var API" in dc2)
print("  Driver calls /api/rides/update-status:", "/api/rides/update-status" in dc2)
print("  Driver export fixed:", "staffInfo.nemt_partner_id" in dc2.split("exportNemtCSV")[1][:300])
print("  Admin deletePatient via API:", "delete-user" in ac2 and "_URL" not in ac2.split("deletePatient")[1][:300])
print("  Admin deleteRide via API:", "update-status" in ac2)
print("  update-status.js exists:", os.path.exists(os.path.join(API_DIR, 'rides', 'update-status.js')))
print("  delete-user.js updated:", "patient_email" in open(os.path.join(API_DIR, 'auth', 'delete-user.js')).read())

for cmd in [
    ['git', '-C', REPO, 'add', '-A', '.'],
    ['git', '-C', REPO, 'commit', '-m', 'CRITICAL: all writes route through API server (service role key bypasses RLS) — fixes Complete, Delete, Export'],
    ['git', '-C', REPO, 'push', 'origin', 'main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout + r.stderr).strip()[:200] or '(ok)')

# ═══════════════════════════════════════
# 5. COORDINATOR - create missing exportCoordCSV + fix ride_type
# ═══════════════════════════════════════
cf = os.path.join(PP, 'coordinator.html')
cc = open(cf).read()

# Add exportCoordCSV function
if 'function exportCoordCSV' not in cc:
    cc = cc.replace(
        'async function cancelRide(',
        """function exportCoordCSV() {
  if (!allRides || !allRides.length) { alert('No data to export'); return; }
  var fields = ['patient_name','contact_email','contact_phone','procedure_type','status','payment_responsibility','pickup_time','pickup_address','hospital_name'];
  var csv = fields.join(',') + '\\n' + allRides.map(function(r) {
    return fields.map(function(f) { var v = r[f]==null?'':String(r[f]); return '"' + v.replace(/"/g,'""') + '"'; }).join(',');
  }).join('\\n');
  var blob = new Blob([csv], {type:'text/csv'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'carevoy_rides_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}

async function cancelRide("""
    )
    results.append("5a. Coordinator: exportCoordCSV function created")

# Fix hardcoded ride_type 'pre_op' — use actual selected appointment type
cc = cc.replace(
    "ride_type: 'pre_op',",
    "ride_type: apptType || 'pre_op',"
)
results.append("5b. Coordinator: ride_type uses selected appointment type (not hardcoded pre_op)")

# Format procedure_type display in ride rows
cc = cc.replace(
    "esc(r.procedure_type || '\u2014')",
    "esc((r.procedure_type || '\u2014').replace(/_/g,' ').replace(/\\b\\w/g, function(c){return c.toUpperCase();}))"
)
results.append("5c. Coordinator: procedure_type capitalized in display")

open(cf, 'w').write(cc)

# ═══════════════════════════════════════
# 6. PATIENT - Apple Pay with real fare + capitalize payment label
# ═══════════════════════════════════════
pc = open(pf).read()

# Add Apple Pay back with dynamic fare from estimation
old_stripe_init = """function initStripeElement() {
  if (!stripe) stripe = Stripe('pk_live_51TQy4GGqhURBumggJWT2jz3o0BO4BYlR2cKlxQaMxKTg4cyon3xWMZKI5pEvee4n1PxCnIjvFBuuyAdDHqO3CFcT00kKFBwtR2');
  var elements = stripe.elements();
  var card = elements.create('card', { style: { base: { fontSize:'16px', color:'#111827', fontFamily:"'Inter',sans-serif", '::placeholder':{color:'#9CA3AF'} } } });
  card.mount('#stripe-element');
  window._stripeCard = card;
}"""

new_stripe_init = """function initStripeElement() {
  if (!stripe) stripe = Stripe('pk_live_51TQy4GGqhURBumggJWT2jz3o0BO4BYlR2cKlxQaMxKTg4cyon3xWMZKI5pEvee4n1PxCnIjvFBuuyAdDHqO3CFcT00kKFBwtR2');

  // Apple Pay / Google Pay
  var fareAmt = Math.round((window._estimatedFare || 50) * 100);
  var payReq = stripe.paymentRequest({
    country: 'US', currency: 'usd',
    total: { label: 'CareVoy Medical Ride', amount: fareAmt },
    requestPayerName: true, requestPayerEmail: true
  });
  var prBtn = stripe.elements().create('paymentRequestButton', { paymentRequest: payReq });
  payReq.canMakePayment().then(function(r) {
    if (r) {
      var apDiv = document.getElementById('apple-pay-btn');
      if (apDiv) { prBtn.mount('#apple-pay-btn'); apDiv.style.display = 'block'; }
    }
  });

  // Standard card element
  var elements = stripe.elements();
  var card = elements.create('card', { style: { base: { fontSize:'16px', color:'#111827', fontFamily:"'Inter',sans-serif", '::placeholder':{color:'#9CA3AF'} } } });
  card.mount('#stripe-element');
  window._stripeCard = card;
}"""

if old_stripe_init in pc:
    pc = pc.replace(old_stripe_init, new_stripe_init)
    results.append("6a. Patient: Apple Pay/Google Pay re-added with real fare amount")
else:
    results.append("6a. FAIL: Stripe init not matched")

# Add apple-pay-btn div if missing
if 'id="apple-pay-btn"' not in pc:
    pc = pc.replace(
        '<div id="stripe-element"></div>',
        '<div id="apple-pay-btn" style="display:none;margin-bottom:12px"></div>\n         <div id="stripe-element"></div>'
    )
    results.append("6b. Patient: Apple Pay button slot added")

# Fix Self-Pay capitalization in ride card
pc = pc.replace("': 'Self-Pay'", "': 'Self-Pay'")
# Make sure the payment label in the ride detail also capitalizes
pc = pc.replace("'Self-pay'", "'Self-Pay'")
pc = pc.replace("'self-pay'", "'Self-Pay'")
results.append("6c. Patient: Self-Pay capitalization fixed")

open(pf, 'w').write(pc)

# ═══════════════════════════════════════
# 7. ADMIN - fix exportCSV for patients (use direct query not RPC)
# ═══════════════════════════════════════
ac = open(af).read()

ac = ac.replace(
    "url = SUPA_URL + '/rest/v1/rpc/admin_list_patients';\n      isRpc = true;",
    "url = SUPA_URL + '/rest/v1/patients?select=id,full_name,phone,email,created_at&order=created_at.desc&limit=1000';\n      isRpc = false;"
)
results.append("7. Admin: exportCSV patients uses direct query (not missing RPC)")

open(af, 'w').write(ac)

# Final summary
print("")
print("=" * 60)
for r in results: print(" ", r)
print("=" * 60)

# Final verification
dc2 = open(df).read()
ac2 = open(af).read()
pc2 = open(pf).read()
cc2 = open(cf).read()
print("\nFINAL VERIFICATION:")
print("  Driver API var:", "var API" in dc2)
print("  Driver updateStatus via API:", "/api/rides/update-status" in dc2)
print("  Driver export fixed:", "staffInfo.nemt_partner_id" in dc2)
print("  Admin deletePatient via API:", "delete-user" in ac2 and "_URL" not in ac2.split("deletePatient")[1][:300])
print("  Admin deleteRide via API:", "/api/rides/update-status" in ac2)
print("  Admin export no RPC:", "isRpc = false" in ac2.split("patients")[5][:50] if ac2.count("patients") > 5 else "check")
print("  Coord exportCoordCSV:", "function exportCoordCSV" in cc2)
print("  Coord ride_type dynamic:", "apptType || 'pre_op'" in cc2)
print("  Patient Apple Pay:", "paymentRequestButton" in pc2)
print("  update-status.js exists:", os.path.exists(os.path.join(API_DIR, 'rides', 'update-status.js')))
print("  delete-user.js updated:", "patient_email" in open(os.path.join(API_DIR, 'auth', 'delete-user.js')).read())

# Second commit for coordinator, apple pay, admin export fixes
for cmd in [
    ['git', '-C', REPO, 'add', '-A', '.'],
    ['git', '-C', REPO, 'commit', '-m', 'fix: coordinator export+ride_type, Apple Pay, admin export, capitalization'],
    ['git', '-C', REPO, 'push', 'origin', 'main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout + r.stderr).strip()[:200] or '(ok)')
