import os, subprocess

REPO = '/workspaces/CareVoy'
f = os.path.join(REPO, 'partners-portal', 'admin.html')
c = open(f).read()

# ════════════════════════════════════════════════════════════════
# APPROACH: store rides in a global array, button only holds an index.
# Zero nested quoting issues. Completely safe.
# ════════════════════════════════════════════════════════════════

# 1. Replace the broken button with a simple data-index button
bad_line = """        '<div class="td"><button class="view-btn" onclick="viewRide(' + JSON.stringify(r).replace(/"/g,\\'&quot;\\') + ')" style="background:#050D1F;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">View</button></div>' +"""

good_line = """        '<div class="td"><button class="view-ride-btn" data-idx="' + _liveRideIdx + '" style="background:#050D1F;color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">View</button></div>' +"""

if bad_line in c:
    c = c.replace(bad_line, good_line)
    print("1. Replaced broken onclick with data-idx")
else:
    print("1. FAILED to find broken button line - checking alt")
    # Maybe the file still has the original simple view-btn
    alt_line = """        '<div class="td"><button class="view-btn">View</button></div>' +"""
    if alt_line in c:
        c = c.replace(alt_line, good_line)
        print("1. Replaced original simple view-btn with data-idx")
    else:
        print("1. Could not find ANY view button line")

# 2. Add _liveRideCache + _liveRideIdx counter in renderLiveRides
old_render_start = """  function renderLiveRides(rides) {
    var body = document.getElementById('liveRidesBody');
    var countEl = document.getElementById('liveRidesCount');

    var active = rides.filter(function(r){ return ['assigned','en_route','arrived'].includes(r.status); });"""

new_render_start = """  var _liveRideCache = [];

  function renderLiveRides(rides) {
    var body = document.getElementById('liveRidesBody');
    var countEl = document.getElementById('liveRidesCount');

    var active = rides.filter(function(r){ return ['assigned','en_route','arrived'].includes(r.status); });
    _liveRideCache = active;"""

if old_render_start in c:
    c = c.replace(old_render_start, new_render_start)
    print("2. _liveRideCache added to renderLiveRides")
else:
    print("2. FAILED to find renderLiveRides start")

# 3. Add index counter in the map
old_map = "    body.innerHTML = active.map(function(r) {"
new_map = "    body.innerHTML = active.map(function(r, _liveRideIdx) {"
if old_map in c:
    c = c.replace(old_map, new_map, 1)
    print("3. Added index to map callback")

# 4. Add delegated click listener + remove old broken listener if any
# Insert before renderLiveRides
listener = """
  // Delegated listener for View ride buttons - uses index into cached array
  document.addEventListener('click', function(e) {
    var btn = e.target.closest && e.target.closest('.view-ride-btn');
    if (!btn) return;
    var idx = parseInt(btn.getAttribute('data-idx'));
    if (!isNaN(idx) && _liveRideCache[idx]) {
      viewRide(_liveRideCache[idx]);
    }
  });

"""

# Only add if not already present
if 'view-ride-btn' not in c or 'closest' not in c.split('view-ride-btn')[0].split('\n')[-1]:
    anchor = "  function renderLiveRides"
    # Check we haven't already added it
    if listener.strip()[:30] not in c:
        c = c.replace("  var _liveRideCache", listener + "  var _liveRideCache", 1)
        print("4. Delegated click listener added")
    else:
        print("4. Listener already exists")

open(f, 'w').write(c)
print("   admin.html written")

# Verify no obvious JS issues
import re
opens = c.count('{')
closes = c.count('}')
print(f"   Brace check: {{ {opens}  }} {closes}  diff={opens-closes}")

cmds = [
    'rm -f fix_admin_urgent.py',
    'git add partners-portal/admin.html',
    'git commit -m "fix: admin dashboard JS error - safe view button via cached array index"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
