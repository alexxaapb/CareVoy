import os, json, subprocess, re

REPO = '/workspaces/CareVoy'
APP = os.path.join(REPO, 'artifacts', 'carevoy')
PP = os.path.join(REPO, 'partners-portal')

# ════════════════════════════════════════════════════════════════
# FORMS: Fix field highlighting on submit + show/hide password
# The issue: fields aren't wrapped in .field-wrap divs so
# classList.add('field-error') on the parent doesn't target the input.
# Fix: validate directly on the input element itself.
# ════════════════════════════════════════════════════════════════

HIGHLIGHT_JS = '''
    function highlightMissing(ids) {
      // Reset all
      ids.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.borderColor = '';
      });
      var missing = [];
      ids.forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        var empty = false;
        if (el.tagName === 'SELECT' && el.multiple) {
          var sel = Array.from(el.options).some(function(o){return o.selected;});
          if (!sel) empty = true;
        } else if (!el.value || !el.value.trim()) {
          empty = true;
        }
        if (empty) {
          el.style.borderColor = '#EF4444';
          el.style.background = '#FEF2F2';
          missing.push(id);
        }
      });
      // Clear red on input
      ids.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
          var evType = el.tagName === 'SELECT' ? 'change' : 'input';
          el.addEventListener(evType, function() {
            el.style.borderColor = '';
            el.style.background = '';
          }, {once: false});
        }
      });
      return missing.length === 0;
    }
'''

for fname in ['nemt-signup.html', 'facility-signup.html']:
    fpath = os.path.join(PP, fname)
    c = open(fpath).read()

    # Inject highlightMissing JS before closing script tag
    if 'highlightMissing' not in c:
        c = c.replace('    function showError(msg)', HIGHLIGHT_JS + '    function showError(msg)', 1)
        print(f"1. highlightMissing injected in {fname}")

    # Now update the submit function to call highlightMissing
    if fname == 'nemt-signup.html':
        old_val = '''      if(!company||!first||!last||!email||!phone||!dispatch||!city||!homeState||!yearsOp||!fleet||!weeklyR||!brokers||!software||!vehicles||!hasIns||!password)
        return showError('Please fill in all required fields.');
      if(states.length===0) return showError('Please select at least one service state.');'''
        new_val = '''      var reqIds = ['companyName','firstName','lastName','email','phone','dispatchPhone','city','homeState','yearsOp','fleetSize','weeklyRides','brokers','dispatchSoftware','vehicleTypes','hasInsurance','password'];
      if(!highlightMissing(reqIds) || states.length===0) {
        if(states.length===0) { document.getElementById('serviceStates').style.borderColor='#EF4444'; document.getElementById('serviceStates').style.background='#FEF2F2'; }
        return showError('Please fill in all required fields highlighted in red.');
      }'''
        if old_val in c:
            c = c.replace(old_val, new_val)
            print(f"2. NEMT submit calls highlightMissing")

    if fname == 'facility-signup.html':
        old_val = '''      for (var i=0;i<required.length;i++) {
        if (!val(required[i])) return showError('Please fill in all required fields.');
      }'''
        new_val = '''      var required = ['facilityName','facilityType','city','state','locations','ehr',
        'patientVolume','rideFrequency','paymentType','currentProcess','painPoint',
        'firstName','lastName','title','email','phone','password'];
      if(!highlightMissing(required)) {
        return showError('Please fill in all required fields highlighted in red.');
      }'''
        if old_val in c:
            c = c.replace(old_val, new_val)
            print(f"2. Facility submit calls highlightMissing")

    open(fpath, 'w').write(c)
    print(f"   {fname} written")

# ════════════════════════════════════════════════════════════════
# APP: index.tsx status labels + loading fix
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
    print("3a. Status labels added")

old_status = '{r.status?.toUpperCase()}'
new_status = '{RIDE_STATUS_LABELS[r.status ?? ""] ?? r.status?.toUpperCase()}'
if old_status in ic:
    ic = ic.replace(old_status, new_status)
    print("3b. Status display uses labels")

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
    print("3c. Loading timeout fix")
open(idx, 'w').write(ic)

# ════════════════════════════════════════════════════════════════
# APP: book-ride payment_responsibility
# ════════════════════════════════════════════════════════════════
br = os.path.join(APP, 'app', 'book-ride.tsx')
bc = open(br).read()
old_ins = '          status: "pending",'
new_ins = '          status: "pending",\n          payment_responsibility: "self_pay",'
if old_ins in bc and 'payment_responsibility' not in bc:
    bc = bc.replace(old_ins, new_ins, 1)
    open(br, 'w').write(bc)
    print("4. payment_responsibility on ride insert")

# ════════════════════════════════════════════════════════════════
# OTA + build 65
# ════════════════════════════════════════════════════════════════
aj = os.path.join(APP, 'app.json')
a = json.load(open(aj))
if 'updates' not in a['expo']:
    a['expo']['updates'] = {"enabled": True, "checkAutomatically": "ON_LOAD",
        "fallbackToCacheTimeout": 0, "url": "https://u.expo.dev/f70bca6e-82e7-4cea-8455-4d6077dcb765"}
    print("5a. OTA configured")
if 'runtimeVersion' not in a['expo']:
    a['expo']['runtimeVersion'] = {"policy": "appVersion"}
    print("5b. runtimeVersion added")
a['expo']['ios']['buildNumber'] = '65'
json.dump(a, open(aj, 'w'), indent=2)
print("5c. Build -> 65")

# ════════════════════════════════════════════════════════════════
# COMMIT
# ════════════════════════════════════════════════════════════════
cmds = [
    'rm -f fix_form_highlight_and_build65.py',
    'git add "artifacts/carevoy/app/(tabs)/index.tsx" artifacts/carevoy/app/book-ride.tsx artifacts/carevoy/app.json partners-portal/nemt-signup.html partners-portal/facility-signup.html',
    'git commit -m "build 65: status labels, OTA, field highlight on submit, loading fix"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
