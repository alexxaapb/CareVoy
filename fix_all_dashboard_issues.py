import os, subprocess

REPO = '/workspaces/CareVoy'

# ════════════════════════════════════════════════════════════════
# ADMIN: weekEnd never defined — add it before the Promise.all
# ════════════════════════════════════════════════════════════════
af = os.path.join(REPO, 'partners-portal', 'admin.html')
ac = open(af).read()

old_today = "      var today = todayStr();"
new_today = """      var today = todayStr();
      var weekEndDate = new Date(); weekEndDate.setDate(weekEndDate.getDate() + 7);
      var weekEnd = weekEndDate.toISOString().slice(0, 10);"""
if 'var weekEnd' not in ac and old_today in ac:
    ac = ac.replace(old_today, new_today, 1)
    print("A1. Added weekEnd variable (was missing, broke admin loading)")
else:
    print("A1. weekEnd already defined or anchor missing")

open(af, 'w').write(ac)
print("   admin.html written")

# ════════════════════════════════════════════════════════════════
# COORDINATOR: add export to Rides tab (was missing)
# ════════════════════════════════════════════════════════════════
cf = os.path.join(REPO, 'partners-portal', 'coordinator.html')
cc = open(cf).read()

# Check if export already exists on Rides tab
old_rides_sec = '<div class="page" id="sec-rides" style="display:none">'
if 'exportCoordCSV' not in cc.split('sec-rides')[1].split('sec-alerts')[0] if 'sec-rides' in cc and 'sec-alerts' in cc else True:
    new_rides_sec = '''<div class="page" id="sec-rides" style="display:none">
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button onclick="exportCoordCSV()" style="background:#050D1F;color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">Export CSV</button>
    </div>'''
    if old_rides_sec in cc:
        cc = cc.replace(old_rides_sec, new_rides_sec, 1)
        print("C1. Export button added to coordinator Rides tab")
else:
    print("C1. Export already on Rides tab")

open(cf, 'w').write(cc)
print("   coordinator.html written")

# ════════════════════════════════════════════════════════════════
# NEMT: Available Rides shows "loading" instead of "no rides"
# The loadAvailableRides function might not handle empty results
# ════════════════════════════════════════════════════════════════
df = os.path.join(REPO, 'partners-portal', 'driver.html')
dc = open(df).read()

# Check the available rides render - does it handle empty?
if 'No available rides' not in dc and 'no rides' not in dc.lower().split('sec-available')[1].split('sec-schedule')[0] if 'sec-available' in dc else True:
    # Find the availableBody rendering and add empty state
    old_avail_body = "document.getElementById('availableBody').innerHTML = html || '<div style=\"padding:30px;text-align:center;color:#9CA3AF;font-size:13px\">Loading...</div>';"
    new_avail_body = "document.getElementById('availableBody').innerHTML = html || '<div style=\"padding:30px;text-align:center;color:#9CA3AF;font-size:13px\">No available rides in your area right now.</div>';"
    if old_avail_body in dc:
        dc = dc.replace(old_avail_body, new_avail_body)
        print("N1. Available rides shows 'no rides' instead of 'loading' when empty")
    else:
        # Try alternate pattern
        if "Loading..." in dc and 'availableBody' in dc:
            dc = dc.replace(
                "Loading...</div>';",
                "No available rides in your area right now.</div>';",
                1
            )
            print("N1. (alt) Fixed loading message for empty available rides")
        else:
            print("N1. Could not find available rides empty state")

open(df, 'w').write(dc)
print("   driver.html written")

# ════════════════════════════════════════════════════════════════
# COMMIT
# ════════════════════════════════════════════════════════════════
cmds = [
    'rm -f fix_all_dashboard_issues.py',
    'git add partners-portal/admin.html partners-portal/coordinator.html partners-portal/driver.html',
    'git commit -m "fix: admin weekEnd undefined crash, coordinator rides export, NEMT empty state"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
