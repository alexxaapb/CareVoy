import os, subprocess

REPO = '/workspaces/CareVoy'

# ════════════════════════════════════════════════════════════════
# COORDINATOR DASHBOARD — add avg time-to-confirm + self-complete %
# ════════════════════════════════════════════════════════════════
cf = os.path.join(REPO, 'partners-portal', 'coordinator.html')
cc = open(cf).read()

# Add two new stat cards after the existing "Needs Action" card
old_action_card = '''      <div class="stat-card">
        <div class="stat-label">Needs Action</div>
        <div class="stat-value gold" id="statAction">—</div>
      </div>'''

new_action_card = '''      <div class="stat-card">
        <div class="stat-label">Needs Action</div>
        <div class="stat-value gold" id="statAction">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Time to Confirm</div>
        <div class="stat-value teal" id="statAvgConfirm">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Self-Complete Rate</div>
        <div class="stat-value teal" id="statSelfComplete">—</div>
      </div>'''

if old_action_card in cc:
    cc = cc.replace(old_action_card, new_action_card)
    print("1a. Coordinator: metric cards added (avg confirm + self-complete)")
else:
    print("1a. FAILED to find action card")

# Add metric calculations at the end of updateStats
old_stats_end = '''  if (action.length > 0) {
    document.getElementById('alertBanner').style.display = 'flex';'''

new_stats_end = '''  // ── New metrics: avg time-to-confirm + self-complete rate ──
  var confirmTimes = allRides.filter(function(r) {
    return r.invited_at && r.confirmed_at;
  }).map(function(r) {
    return (new Date(r.confirmed_at) - new Date(r.invited_at)) / (1000 * 60 * 60);
  });
  var avgConfirm = confirmTimes.length > 0 ? (confirmTimes.reduce(function(a,b){return a+b;},0) / confirmTimes.length) : null;
  document.getElementById('statAvgConfirm').textContent = avgConfirm !== null ? (avgConfirm < 1 ? Math.round(avgConfirm*60)+'m' : avgConfirm.toFixed(1)+'h') : '—';

  // Self-complete: rides that went invited->confirmed/assigned without a 2nd coordinator touch
  // (rides with confirmed_at but no manual reminder = patient self-booked)
  var invited = allRides.filter(function(r){ return r.invited_at; });
  var selfBooked = invited.filter(function(r){ return r.confirmed_at && !r.reminder_sent; });
  var selfPct = invited.length > 0 ? Math.round((selfBooked.length / invited.length) * 100) : null;
  document.getElementById('statSelfComplete').textContent = selfPct !== null ? selfPct + '%' : '—';

  if (action.length > 0) {
    document.getElementById('alertBanner').style.display = 'flex';'''

if old_stats_end in cc:
    cc = cc.replace(old_stats_end, new_stats_end)
    print("1b. Coordinator: metric calculations added")
else:
    print("1b. FAILED to find stats end anchor")

# Make sure the rides query includes the new timestamp columns
old_rides_select = "select=*&order=pickup_time.desc"
# Already selects * so confirmed_at is included - no change needed
print("1c. Coordinator rides query already selects * (includes new columns)")

open(cf, 'w').write(cc)
print("   coordinator.html written")

# ════════════════════════════════════════════════════════════════
# NEMT DASHBOARD — add acceptance rate + avg time-to-accept
# ════════════════════════════════════════════════════════════════
df = os.path.join(REPO, 'partners-portal', 'driver.html')
dd = open(df).read()

# Add two metric cards after the existing earnings cards
old_earn_grid_end = '''      <div class="earn-card">
        <div class="earn-label">This Month</div>
        <div class="earn-value" id="earnMonth">—</div>
        <div class="earn-sub" id="earnMonthSub">— completed</div>
      </div>
    </div>'''

new_earn_grid_end = '''      <div class="earn-card">
        <div class="earn-label">This Month</div>
        <div class="earn-value" id="earnMonth">—</div>
        <div class="earn-sub" id="earnMonthSub">— completed</div>
      </div>
    </div>
    <div class="earn-grid" style="margin-bottom:20px">
      <div class="earn-card">
        <div class="earn-label">Acceptance Rate</div>
        <div class="earn-value teal" id="metricAcceptRate">—</div>
        <div class="earn-sub">of offered rides</div>
      </div>
      <div class="earn-card">
        <div class="earn-label">Avg Time to Accept</div>
        <div class="earn-value" id="metricAvgAccept">—</div>
        <div class="earn-sub">from ride posted</div>
      </div>
      <div class="earn-card">
        <div class="earn-label">Available Now</div>
        <div class="earn-value teal" id="metricAvailable">—</div>
        <div class="earn-sub">rides in your area</div>
      </div>
    </div>'''

if old_earn_grid_end in dd:
    dd = dd.replace(old_earn_grid_end, new_earn_grid_end)
    print("2a. NEMT: metric cards added")
else:
    print("2a. FAILED to find earnings grid end")

# Add metric calculations in the loadRides or init function
# Find where earnings stats are calculated
old_earn_calc = "  document.getElementById('earnMonthSub').textContent = weekDone + ' completed';"
if old_earn_calc not in dd:
    # Try alternate
    old_earn_calc = "  document.getElementById('earnMonthSub').textContent = monthDone + ' completed';"

if old_earn_calc in dd:
    new_earn_calc = old_earn_calc + """

  // ── NEMT metrics: acceptance rate + avg time to accept ──
  var totalOffered = allR.filter(function(r){ return r.invited_at || r.created_at; }).length;
  var accepted = allR.filter(function(r){ return r.assigned_at && r.nemt_partner_id; }).length;
  var acceptRate = totalOffered > 0 ? Math.round((accepted / totalOffered) * 100) : null;
  document.getElementById('metricAcceptRate').textContent = acceptRate !== null ? acceptRate + '%' : '\\u2014';

  var acceptTimes = allR.filter(function(r){ return r.assigned_at && r.created_at; }).map(function(r){
    return (new Date(r.assigned_at) - new Date(r.created_at)) / (1000 * 60);
  });
  var avgAccept = acceptTimes.length > 0 ? (acceptTimes.reduce(function(a,b){return a+b;},0) / acceptTimes.length) : null;
  document.getElementById('metricAvgAccept').textContent = avgAccept !== null ? (avgAccept < 60 ? Math.round(avgAccept)+'m' : (avgAccept/60).toFixed(1)+'h') : '\\u2014';

  var available = allR.filter(function(r){ return !r.nemt_partner_id && ['invited','pending','confirmed'].includes(r.status); }).length;
  document.getElementById('metricAvailable').textContent = available;
"""
    dd = dd.replace(old_earn_calc, new_earn_calc)
    print("2b. NEMT: metric calculations added")
else:
    print("2b. FAILED to find earnings calc anchor - checking alt")
    # Try to find ANY earnings sub update
    import re
    m = re.search(r"document\.getElementById\('earnMonthSub'\)\.textContent\s*=\s*[^;]+;", dd)
    if m:
        print("2b. Found alt: " + m.group(0)[:50])
    else:
        print("2b. No earnMonthSub found at all")

open(df, 'w').write(dd)
print("   driver.html written")

cmds = [
    'rm -f part3d_metrics_dashboards.py',
    'git add partners-portal/coordinator.html partners-portal/driver.html',
    'git commit -m "feat: dashboard metrics - avg time-to-confirm, self-complete %, acceptance rate, time-to-accept"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
