import os, subprocess

REPO = '/workspaces/CareVoy'

# ════════════════════════════════════════════════════════════════
# ADMIN DASHBOARD
# ════════════════════════════════════════════════════════════════
af = os.path.join(REPO, 'partners-portal', 'admin.html')
ac = open(af).read()

# 1a. Add "Completed Rides" + "Upcoming This Week" stat cards
old_alerts_card = '''        <div class="stat-label">Pending Alerts</div>
        <div class="stat-value gold" id="statAlerts">\u2014</div>'''
new_alerts_card = '''        <div class="stat-label">Pending Alerts</div>
        <div class="stat-value gold" id="statAlerts">\u2014</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Completed Rides</div>
        <div class="stat-value teal" id="statCompleted">\u2014</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Upcoming This Week</div>
        <div class="stat-value" id="statUpcoming">\u2014</div>'''
if old_alerts_card in ac:
    ac = ac.replace(old_alerts_card, new_alerts_card)
    print("A1. Added Completed Rides + Upcoming This Week stat cards")

# 1b. Add queries for completed + upcoming in the Promise.all
old_promise_end = "        fetch(SUPA_URL + '/rest/v1/rides?status=in.(pending,confirmed)&select=id', { headers: { ...h, 'Prefer': 'count=exact', 'Range': '0-0' } }),"
new_promise_end = """        fetch(SUPA_URL + '/rest/v1/rides?status=in.(pending,confirmed)&select=id', { headers: { ...h, 'Prefer': 'count=exact', 'Range': '0-0' } }),
        fetch(SUPA_URL + '/rest/v1/rides?status=eq.completed&select=id', { headers: { ...h, 'Prefer': 'count=exact', 'Range': '0-0' } }),
        fetch(SUPA_URL + '/rest/v1/rides?pickup_time=gte.' + today + '&pickup_time=lt.' + weekEnd + '&status=in.(pending,confirmed,assigned,invited)&select=id', { headers: { ...h, 'Prefer': 'count=exact', 'Range': '0-0' } }),"""
if old_promise_end in ac:
    ac = ac.replace(old_promise_end, new_promise_end)
    print("A2. Added completed + upcoming queries to Promise.all")

# 1c. Add weekEnd date calculation (before the Promise.all)
old_today = "      var today = new Date().toISOString().slice(0, 10);"
new_today = """      var today = new Date().toISOString().slice(0, 10);
      var weekEndDate = new Date(); weekEndDate.setDate(weekEndDate.getDate() + 7);
      var weekEnd = weekEndDate.toISOString().slice(0, 10);"""
if old_today in ac and 'weekEnd' not in ac:
    ac = ac.replace(old_today, new_today, 1)
    print("A3. Added weekEnd date calculation")

# 1d. Destructure the new results and set the stat cards
old_destructure = "      var [pRes, aRes, tRes, facRes, nemtRes, revThisRes, revLastRes, revAllRes, liveRidesRes, paymentsAllRes] = await Promise.all(["
new_destructure = "      var [pRes, aRes, tRes, facRes, nemtRes, revThisRes, revLastRes, revAllRes, liveRidesRes, paymentsAllRes, completedRes, upcomingRes] = await Promise.all(["
if old_destructure in ac:
    ac = ac.replace(old_destructure, new_destructure)
    print("A4. Added completedRes + upcomingRes to destructure")

# 1e. Set the new stat values (after existing stat sets)
old_stat_end = "      document.getElementById('statNemt').textContent = activeNemt;"
new_stat_end = """      document.getElementById('statNemt').textContent = activeNemt;

      var completedCount = parseInt((completedRes && completedRes.headers.get('Content-Range') || '').split('/')[1] || '0');
      var upcomingCount = parseInt((upcomingRes && upcomingRes.headers.get('Content-Range') || '').split('/')[1] || '0');
      document.getElementById('statCompleted').textContent = completedCount;
      document.getElementById('statUpcoming').textContent = upcomingCount;"""
if old_stat_end in ac:
    ac = ac.replace(old_stat_end, new_stat_end)
    print("A5. Completed + Upcoming stats populated")

# 1f. Add payment_responsibility to rides CSV export
old_rides_export = "      fields = ['id','patient_name','contact_phone','hospital_name','hospital_state','status','pickup_time','pickup_address','dropoff_address','ride_type','procedure_type','created_at'];"
new_rides_export = "      fields = ['id','patient_name','contact_phone','hospital_name','hospital_state','status','payment_responsibility','pickup_time','pickup_address','dropoff_address','ride_type','procedure_type','driver_name','assigned_at','completed_at','created_at'];"
if old_rides_export in ac:
    ac = ac.replace(old_rides_export, new_rides_export)
    print("A6. Rides CSV export now includes payment_responsibility, driver_name, assigned_at, completed_at")

# Also update the rides export URL to include the new fields
old_rides_url = "url = SUPA_URL + '/rest/v1/rides?select=id,patient_name,contact_phone,hospital_name,hospital_state,status,pickup_time,pickup_address,dropoff_address,ride_type,procedure_type,created_at&order=created_at.desc&limit=1000';"
new_rides_url = "url = SUPA_URL + '/rest/v1/rides?select=id,patient_name,contact_phone,hospital_name,hospital_state,status,payment_responsibility,pickup_time,pickup_address,dropoff_address,ride_type,procedure_type,driver_name,assigned_at,completed_at,created_at&order=created_at.desc&limit=1000';"
if old_rides_url in ac:
    ac = ac.replace(old_rides_url, new_rides_url)
    print("A7. Rides export URL includes new fields")

open(af, 'w').write(ac)
print("   admin.html written")

# ════════════════════════════════════════════════════════════════
# NEMT DASHBOARD - add exports to Available Rides + My Schedule tabs
# ════════════════════════════════════════════════════════════════
df = os.path.join(REPO, 'partners-portal', 'driver.html')
dc = open(df).read()

# Add export to Available Rides tab
old_avail = '<div class="page" id="sec-available" style="display:none">'
new_avail = '''<div class="page" id="sec-available" style="display:none">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-size:14px;font-weight:700;color:#050D1F">Available Rides</div>
      <button onclick="exportNemtCSV('available')" style="background:#050D1F;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Export CSV</button>
    </div>'''
if old_avail in dc:
    dc = dc.replace(old_avail, new_avail, 1)
    print("N1. Export button added to Available Rides")

# Add export to My Schedule tab
old_sched = '<div class="page" id="sec-schedule" style="display:none">'
new_sched = '''<div class="page" id="sec-schedule" style="display:none">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-size:14px;font-weight:700;color:#050D1F">My Schedule</div>
      <button onclick="exportNemtCSV('schedule')" style="background:#050D1F;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Export CSV</button>
    </div>'''
if old_sched in dc:
    dc = dc.replace(old_sched, new_sched, 1)
    print("N2. Export button added to My Schedule")

# Update exportNemtCSV to handle 'available' and 'schedule' types
old_export_fn = "  var status = type === 'history' ? 'completed' : 'assigned,en_route,arrived';"
new_export_fn = """  var status;
  if (type === 'history') status = 'completed';
  else if (type === 'available') status = 'invited,pending,confirmed';
  else if (type === 'schedule') status = 'assigned,en_route,arrived';
  else status = 'assigned,en_route,arrived';
  var urlBase = type === 'available'
    ? SUPA + '/rest/v1/rides?nemt_partner_id=is.null&status=in.(' + status + ')&select=id,patient_name,contact_phone,hospital_name,hospital_state,status,pickup_time,pickup_address,dropoff_address,ride_type,created_at&order=pickup_time.desc&limit=500'
    : SUPA + '/rest/v1/rides?nemt_partner_id=eq.' + partnerId + '&status=in.(' + status + ')&select=id,patient_name,contact_phone,hospital_name,hospital_state,status,pickup_time,pickup_address,dropoff_address,ride_type,created_at&order=pickup_time.desc&limit=500';"""
if old_export_fn in dc:
    dc = dc.replace(old_export_fn, new_export_fn)
    # Also update the fetch URL to use urlBase
    dc = dc.replace(
        "  var url = SUPA + '/rest/v1/rides?nemt_partner_id=eq.' + partnerId + '&status=in.(' + status + ')&select=id,patient_name,contact_phone,hospital_name,hospital_state,status,pickup_time,pickup_address,dropoff_address,ride_type,created_at&order=pickup_time.desc&limit=500';",
        "  var url = urlBase;"
    )
    print("N3. exportNemtCSV handles available + schedule tabs")

# Add export to Earnings tab
old_earn_sec = '<div class="page" id="sec-earnings" style="display:none">'
new_earn_sec = '''<div class="page" id="sec-earnings" style="display:none">
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button onclick="exportNemtCSV('history')" style="background:#050D1F;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Export Earnings CSV</button>
    </div>'''
if old_earn_sec in dc:
    dc = dc.replace(old_earn_sec, new_earn_sec, 1)
    print("N4. Export button added to Earnings")

open(df, 'w').write(dc)
print("   driver.html written")

# ════════════════════════════════════════════════════════════════
# COORDINATOR DASHBOARD - add export to Patients + Alerts tabs
# ════════════════════════════════════════════════════════════════
cf = os.path.join(REPO, 'partners-portal', 'coordinator.html')
cc = open(cf).read()

# Add export to My Patients tab
old_pat_sec = '<div class="page" id="sec-patients" style="display:none">'
new_pat_sec = '''<div class="page" id="sec-patients" style="display:none">
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button onclick="exportCoordCSV()" style="background:#050D1F;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Export CSV</button>
    </div>'''
if old_pat_sec in cc:
    cc = cc.replace(old_pat_sec, new_pat_sec, 1)
    print("C1. Export button added to My Patients")

open(cf, 'w').write(cc)
print("   coordinator.html written")

# ════════════════════════════════════════════════════════════════
# COMMIT
# ════════════════════════════════════════════════════════════════
cmds = [
    'rm -f dashboard_final_batch.py',
    'git add partners-portal/admin.html partners-portal/driver.html partners-portal/coordinator.html',
    'git commit -m "feat: admin completed+upcoming stats, payment_responsibility in export, export on all NEMT+coord tabs"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
