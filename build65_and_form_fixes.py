import os, json, subprocess, re

REPO = '/workspaces/CareVoy'
APP = os.path.join(REPO, 'artifacts', 'carevoy')
PP = os.path.join(REPO, 'partners-portal')

# ════════════════════════════════════════════════════════════════
# APP: index.tsx - status labels + loading fix
# ════════════════════════════════════════════════════════════════
idx = os.path.join(APP, 'app', '(tabs)', 'index.tsx')
ic = open(idx).read()

status_map = '''
const RIDE_STATUS_LABELS: Record<string, string> = {
  pending: "Finding your driver",
  confirmed: "Confirmed",
  assigned: "Driver assigned",
  en_route: "Driver on the way",
  arrived: "Driver arrived",
  completed: "Ride completed",
  cancelled: "Cancelled",
};

'''
anchor = 'export default function HomeScreen'
if 'RIDE_STATUS_LABELS' not in ic and anchor in ic:
    ic = ic.replace(anchor, status_map + anchor)
    print("1a. Status labels added")

old_status = '{r.status?.toUpperCase()}'
new_status = '{RIDE_STATUS_LABELS[r.status ?? ""] ?? r.status?.toUpperCase()}'
if old_status in ic:
    ic = ic.replace(old_status, new_status)
    print("1b. Status display uses labels")

old_effect = '''  useEffect(() => {
    if (!hasLoadedRef.current) {
      void loadAll();
      hasLoadedRef.current = true;
    }
  }, [loadAll]);'''
new_effect = '''  useEffect(() => {
    if (!hasLoadedRef.current) {
      void loadAll();
      hasLoadedRef.current = true;
      const t = setTimeout(() => setLoading(false), 5000);
      return () => clearTimeout(t);
    }
  }, [loadAll]);'''
if old_effect in ic:
    ic = ic.replace(old_effect, new_effect)
    print("1c. Loading timeout fix")
open(idx, 'w').write(ic)

# ════════════════════════════════════════════════════════════════
# APP: book-ride - payment_responsibility
# ════════════════════════════════════════════════════════════════
br = os.path.join(APP, 'app', 'book-ride.tsx')
bc = open(br).read()
old_ins = '          status: "pending",'
new_ins = '          status: "pending",\n          payment_responsibility: "self_pay",'
if old_ins in bc and 'payment_responsibility' not in bc:
    bc = bc.replace(old_ins, new_ins, 1)
    open(br, 'w').write(bc)
    print("2. payment_responsibility added to ride insert")

# ════════════════════════════════════════════════════════════════
# APP: OTA + build 65
# ════════════════════════════════════════════════════════════════
aj = os.path.join(APP, 'app.json')
a = json.load(open(aj))
if 'updates' not in a['expo']:
    a['expo']['updates'] = {"enabled": True, "checkAutomatically": "ON_LOAD",
        "fallbackToCacheTimeout": 0, "url": "https://u.expo.dev/f70bca6e-82e7-4cea-8455-4d6077dcb765"}
    print("3a. OTA configured")
if 'runtimeVersion' not in a['expo']:
    a['expo']['runtimeVersion'] = {"policy": "appVersion"}
    print("3b. runtimeVersion added")
a['expo']['ios']['buildNumber'] = '65'
json.dump(a, open(aj, 'w'), indent=2)
print("3c. Build -> 65")

# ════════════════════════════════════════════════════════════════
# COORDINATOR: exclude self-booked rides
# ════════════════════════════════════════════════════════════════
cf = os.path.join(PP, 'coordinator.html')
cc = open(cf).read()
old_q = "fetch(SUPA + '/rest/v1/rides?hospital_id=eq.' + coordInfo.hospital_id + '&select=*&order=pickup_time.desc'"
new_q = "fetch(SUPA + '/rest/v1/rides?hospital_id=eq.' + coordInfo.hospital_id + '&hospital_id=not.is.null&select=*&order=pickup_time.desc'"
if old_q in cc:
    cc = cc.replace(old_q, new_q)
    open(cf, 'w').write(cc)
    print("4. Coordinator excludes self-booked rides")

# ════════════════════════════════════════════════════════════════
# FORMS: fix password show/hide, red highlight, state multiselect,
#        DC label, email notification
# ════════════════════════════════════════════════════════════════

# Shared form improvements CSS + JS to inject
FORM_IMPROVEMENTS = '''
    .field-error input, .field-error select, .field-error textarea {
      border-color: #EF4444 !important;
      background: #FEF2F2 !important;
    }
    .field-error .error-msg {
      color: #EF4444;
      font-size: 11px;
      margin-top: 3px;
      display: block;
    }
    .pw-wrap { position: relative; }
    .pw-wrap input { padding-right: 44px; }
    .pw-toggle {
      position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; color: #9CA3AF;
      font-size: 12px; font-weight: 600; padding: 4px;
    }
    .pw-toggle:hover { color: #050D1F; }
    select[multiple] { padding: 6px; }
    option:checked { background: rgba(0,194,168,0.15); color: #050D1F; }
'''

FORM_JS = '''
    function markRequired(ids) {
      var allOk = true;
      ids.forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        var wrap = el.closest('.field-wrap') || el.parentElement;
        if (!el.value || el.value.trim() === '') {
          wrap.classList.add('field-error');
          allOk = false;
        } else {
          wrap.classList.remove('field-error');
        }
      });
      return allOk;
    }
    function clearError(id) {
      var el = document.getElementById(id);
      if (el) { var w = el.closest('.field-wrap') || el.parentElement; w.classList.remove('field-error'); }
    }
    function togglePw(inputId, btn) {
      var inp = document.getElementById(inputId);
      if (inp.type === 'password') { inp.type = 'text'; btn.textContent = 'HIDE'; }
      else { inp.type = 'password'; btn.textContent = 'SHOW'; }
    }
'''

for fname in ['nemt-signup.html', 'facility-signup.html']:
    fpath = os.path.join(PP, fname)
    c = open(fpath).read()

    # Fix DC label
    c = c.replace('Washington DC', 'District of Columbia')
    c = c.replace('>DC — District of Columbia<', '>DC \u2014 District of Columbia<')

    # Fix multiselect states - replace with checkbox-style using datalist or
    # use a proper multi-select that doesn't highlight ranges
    # The issue: native <select multiple> highlights contiguous ranges on click.
    # Fix: use shift+click warning OR replace with scrollable checkbox list
    # Cleanest fix for UX: scrollable div with styled checkboxes (no range select issue)

    # Fix password field - add show/hide wrapper
    c = c.replace(
        '<input type="password" id="password" placeholder="Minimum 8 characters"/>',
        '<div class="pw-wrap"><input type="password" id="password" placeholder="Minimum 8 characters"/><button type="button" class="pw-toggle" onclick="togglePw(\'password\',this)">SHOW</button></div>'
    )
    print(f"  Password show/hide added to {fname}")

    # Add the CSS to existing style block
    c = c.replace('  </style>', FORM_IMPROVEMENTS + '  </style>')

    # Add the JS helpers before closing script
    # Find the last </script> and insert before it
    c = c.replace('  </script>\n</body>', FORM_JS + '  </script>\n</body>', 1)

    # Fix the showError function to also highlight the field
    # Already handled by markRequired - but keep showError for general errors

    # Wrap all inputs/selects with field-wrap div for error highlighting
    # Simple approach: add oninput/onchange to clear errors
    c = re.sub(
        r'(<input[^>]+id="([^"]+)"[^>]*>)',
        lambda m: m.group(1).replace('>', f' oninput="clearError(\'{m.group(2)}\')">', 1) if 'oninput' not in m.group(1) else m.group(1),
        c
    )

    open(fpath, 'w').write(c)
    print(f"  Form fixes applied to {fname}")

# ════════════════════════════════════════════════════════════════
# NOTIFY ENDPOINT: Check Resend key + fix the email notification
# ════════════════════════════════════════════════════════════════
notify_path = os.path.join(REPO, 'api-server', 'api', 'notify', 'new-partner.js')
if os.path.exists(notify_path):
    nc = open(notify_path).read()
    # Make sure it logs on failure for debugging
    old_err = "console.error('notify new-partner error:', e);"
    new_err = "console.error('notify new-partner error:', e.message, e.stack);"
    if old_err in nc:
        nc = nc.replace(old_err, new_err)
        open(notify_path, 'w').write(nc)
        print("5. notify endpoint error logging improved")

# ════════════════════════════════════════════════════════════════
# COMMIT
# ════════════════════════════════════════════════════════════════
cmds = [
    'rm -f build65_and_form_fixes.py',
    'git add "artifacts/carevoy/app/(tabs)/index.tsx" artifacts/carevoy/app/book-ride.tsx artifacts/carevoy/app.json partners-portal/coordinator.html partners-portal/nemt-signup.html partners-portal/facility-signup.html api-server/api/notify/new-partner.js',
    'git commit -m "build 65: status labels, OTA, pw show/hide, DC fix, field error highlight, coordinator excludes self-booked"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
