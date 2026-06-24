import os, json, subprocess

REPO = '/workspaces/CareVoy'
APP = os.path.join(REPO, 'artifacts', 'carevoy')
PP = os.path.join(REPO, 'partners-portal')

changes = []

# ════════════════════════════════════════════════════════════════
# 1. BOOK-RIDE: Lock hospital picker for invited patients
#    When prefill has hospital_id, show locked facility (read-only)
# ════════════════════════════════════════════════════════════════
br = os.path.join(APP, 'app', 'book-ride.tsx')
bc = open(br).read()

# Add invitedHospital state after existing state declarations
old_state = '  const [isRecurring, setIsRecurring] = useState(false);'
new_state = '''  const [isRecurring, setIsRecurring] = useState(false);
  const [invitedHospital, setInvitedHospital] = useState<string | null>(null);
  const [invitePaymentResp, setInvitePaymentResp] = useState<string>("self_pay");'''

if old_state in bc and 'invitedHospital' not in bc:
    bc = bc.replace(old_state, new_state)
    changes.append("1a. invitedHospital + invitePaymentResp state added")

# Extract hospital and payment_responsibility from prefill params
old_prefill = '      const p = JSON.parse(params.prefill) as {'
new_prefill = '''      const p = JSON.parse(params.prefill) as {
        hospital_id?: string;
        hospital_name?: string;
        payment_responsibility?: string;'''

old_prefill_full = '      const p = JSON.parse(params.prefill) as {\n'
# Find and update prefill parsing to capture hospital and payment
old_prefill_effect = '''    if (!params.prefill) return;
    try {
      const p = JSON.parse(params.prefill) as {'''

if 'setInvitedHospital' not in bc and old_prefill_effect in bc:
    new_prefill_effect = '''    if (!params.prefill) return;
    try {
      const p = JSON.parse(params.prefill) as {
        hospital_id?: string;
        hospital_name?: string;
        payment_responsibility?: string;'''
    bc = bc.replace(old_prefill_effect, new_prefill_effect)
    changes.append("1b. prefill type extended with hospital + payment_responsibility")

# Set the invite hospital after prefill parsed - find where prefill sets state
old_set_date = '      if (p.pickup_date) {'
new_set_date = '''      if (p.hospital_name) setInvitedHospital(p.hospital_name);
      if (p.payment_responsibility) setInvitePaymentResp(p.payment_responsibility);
      if (p.pickup_date) {'''
if old_set_date in bc and 'setInvitedHospital' not in bc:
    bc = bc.replace(old_set_date, new_set_date, 1)
    changes.append("1c. invitedHospital set from prefill data")

# Lock the hospital picker when invite has a hospital
old_picker = '                onPress={() => setShowFacilityPicker(true)}'
new_picker = '                onPress={() => { if (!invitedHospital) setShowFacilityPicker(true); }}'
if old_picker in bc:
    bc = bc.replace(old_picker, new_picker, 1)
    changes.append("1d. Hospital picker locked for invited patients")

# Show locked facility name when invited
old_hosp_text = '                  {hospital || "Select a facility"}'
new_hosp_text = '                  {invitedHospital || hospital || "Select a facility"}'
if old_hosp_text in bc:
    bc = bc.replace(old_hosp_text, new_hosp_text, 1)
    changes.append("1e. Invited hospital name shown in picker")

open(br, 'w').write(bc)

# ════════════════════════════════════════════════════════════════
# 2. PAYMENT SCREEN: branch on payment_responsibility
#    Facility-covered rides skip the payment screen entirely
# ════════════════════════════════════════════════════════════════
pf = os.path.join(APP, 'app', '(tabs)', 'payment.tsx')
pc = open(pf).read()

# Add a banner at the top of payment screen when ride is facility-covered
# Check active ride's payment_responsibility and show "covered by facility" message
old_use_stripe = 'const { initPaymentSheet, presentPaymentSheet } = useStripe();'
new_use_stripe = '''const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [facilityCovered, setFacilityCovered] = useState(false);'''

if 'facilityCovered' not in pc and old_use_stripe in pc:
    pc = pc.replace(old_use_stripe, new_use_stripe)
    changes.append("2a. facilityCovered state added to payment screen")

# Check the active ride for payment_responsibility on focus
old_focus = 'useFocusEffect('
new_focus = '''// Check if active ride is facility-covered
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: rides } = await supabase
        .from("rides")
        .select("payment_responsibility")
        .eq("patient_id", user.id)
        .in("status", ["pending", "confirmed", "assigned", "en_route"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (rides && rides[0]?.payment_responsibility === "facility") {
        setFacilityCovered(true);
      }
    })();
  }, []);

  useFocusEffect('''

if 'facilityCovered' not in pc.split('useFocusEffect')[0] and old_focus in pc:
    pc = pc.replace(old_focus, new_focus, 1)
    changes.append("2b. Payment screen checks active ride payment_responsibility")

# Show facility-covered banner (add after ScrollView opens)
old_scroll_content = '      <ScrollView'
facility_banner = '''      {facilityCovered && (
        <View style={{ margin: 20, padding: 16, backgroundColor: "rgba(0,194,168,0.08)", borderRadius: 14, borderWidth: 1, borderColor: "#00C2A8" }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#050D1F", marginBottom: 4 }}>Ride covered by your facility</Text>
          <Text style={{ fontSize: 13, color: "#6B7280", lineHeight: 20 }}>Your facility is covering the cost of this ride. No payment needed from you.</Text>
        </View>
      )}
      <ScrollView'''
if 'facilityCovered' in pc and 'Ride covered by' not in pc and old_scroll_content in pc:
    pc = pc.replace(old_scroll_content, facility_banner, 1)
    changes.append("2c. Facility-covered banner added to payment screen")

open(pf, 'w').write(pc)

# ════════════════════════════════════════════════════════════════
# 3. ADMIN DASHBOARD: Replace invite buttons with Approve/Decline
#    for NEMT Partners and Facilities pending review
# ════════════════════════════════════════════════════════════════
af = os.path.join(PP, 'admin.html')
ac = open(af).read()

# Add approve/decline functions
approve_fn = '''
  async function approvePartner(type, id, email, name) {
    if (!confirm('Approve ' + name + '? They will receive an email with login access.')) return;
    var h = authHeaders();
    var table = type === 'nemt' ? 'nemt_partners' : 'hospitals';
    await fetch(SUPA_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'PATCH',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: true, pending_review: false })
    });
    // Send approval email
    try {
      await fetch('https://care-voy-api-server.vercel.app/api/notify/partner-approved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, type })
      });
    } catch(e) { console.warn('approval email failed:', e); }
    alert(name + ' has been approved and notified.');
    location.reload();
  }

  async function declinePartner(type, id, name) {
    if (!confirm('Decline and remove ' + name + '? This cannot be undone.')) return;
    var h = authHeaders();
    var table = type === 'nemt' ? 'nemt_partners' : 'hospitals';
    await fetch(SUPA_URL + '/rest/v1/' + table + '?id=eq.' + id, {
      method: 'PATCH',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false, pending_review: false })
    });
    alert(name + ' has been declined.');
    location.reload();
  }

'''

anchor = '  function exportCSV'
if 'approvePartner' not in ac and anchor in ac:
    ac = ac.replace(anchor, approve_fn + anchor)
    changes.append("3a. Approve/Decline functions added to admin")

# Add pending applicants section to NEMT Partners tab
old_nemt_title = '''  <div class="page-title">NEMT Partners</div>
  <div class="page-sub">All transport partners in your network</div>'''
new_nemt_title = '''  <div style="display:flex;justify-content:space-between;align-items:center">
    <div><div class="page-title">NEMT Partners</div>
    <div class="page-sub">All transport partners in your network</div></div>
    <button onclick="exportCSV('partners')" style="background:#050D1F;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Export CSV</button>
  </div>
  <div id="nemtPendingSection" style="margin-bottom:20px;display:none">
    <div style="font-size:11px;font-weight:700;color:#F5A623;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">&#9679; Pending Review</div>
    <div id="nemtPendingBody"></div>
  </div>'''

if 'nemtPendingSection' not in ac and old_nemt_title in ac:
    ac = ac.replace(old_nemt_title, new_nemt_title)
    changes.append("3b. NEMT pending section added")

# Add pending applicants section to Facilities tab
old_fac_title = '''  <div class="page-title">Facilities</div>
  <div class="page-sub">All onboarded facility partners</div>'''
new_fac_title = '''  <div style="display:flex;justify-content:space-between;align-items:center">
    <div><div class="page-title">Facilities</div>
    <div class="page-sub">All onboarded facility partners</div></div>
    <button onclick="exportCSV('facilities')" style="background:#050D1F;color:#fff;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Export CSV</button>
  </div>
  <div id="facPendingSection" style="margin-bottom:20px;display:none">
    <div style="font-size:11px;font-weight:700;color:#F5A623;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">&#9679; Pending Review</div>
    <div id="facPendingBody"></div>
  </div>'''

if 'facPendingSection' not in ac and old_fac_title in ac:
    ac = ac.replace(old_fac_title, new_fac_title)
    changes.append("3c. Facility pending section added")

# Load pending applicants when those sections are shown
load_pending_fn = '''
  async function loadPendingApplicants() {
    var h = authHeaders();
    // NEMT pending
    var nr = await fetch(SUPA_URL + '/rest/v1/nemt_partners?pending_review=eq.true&select=id,company_name,city,service_states,created_at,intake_data', { headers: h });
    var nemt = await nr.json();
    var nemtSec = document.getElementById('nemtPendingSection');
    var nemtBody = document.getElementById('nemtPendingBody');
    if (nemt && nemt.length > 0) {
      nemtSec.style.display = 'block';
      nemtBody.innerHTML = nemt.map(function(p) {
        var intake = p.intake_data || {};
        var email = intake.contact_email || '—';
        return '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">' +
          '<div>' +
          '<div style="font-weight:700;color:#050D1F;font-size:14px">' + esc(p.company_name||'Unknown') + '</div>' +
          '<div style="font-size:12px;color:#6B7280;margin-top:2px">' + esc(p.city||'') + ' &bull; ' + (p.service_states||[]).join(', ') + '</div>' +
          '<div style="font-size:11px;color:#9CA3AF;margin-top:2px">Applied: ' + new Date(p.created_at).toLocaleDateString() + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px">' +
          '<button onclick="approvePartner(\'nemt\',\'' + p.id + '\',\'' + esc(email) + '\',\'' + esc(p.company_name) + '\')" style="background:#050D1F;color:#00C2A8;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Approve</button>' +
          '<button onclick="declinePartner(\'nemt\',\'' + p.id + '\',\'' + esc(p.company_name) + '\')" style="background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Decline</button>' +
          '</div></div>';
      }).join('');
    }
    // Facility pending
    var fr = await fetch(SUPA_URL + '/rest/v1/hospitals?pending_review=eq.true&select=id,name,city,state,facility_type,created_at,intake_data', { headers: h });
    var facs = await fr.json();
    var facSec = document.getElementById('facPendingSection');
    var facBody = document.getElementById('facPendingBody');
    if (facs && facs.length > 0) {
      facSec.style.display = 'block';
      facBody.innerHTML = facs.map(function(f) {
        var intake = f.intake_data || {};
        var email = intake.contact_email || '—';
        var vol = intake.patient_volume || '—';
        return '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">' +
          '<div>' +
          '<div style="font-weight:700;color:#050D1F;font-size:14px">' + esc(f.name||'Unknown') + '</div>' +
          '<div style="font-size:12px;color:#6B7280;margin-top:2px">' + esc(f.city||'') + ', ' + esc(f.state||'') + ' &bull; ' + esc((f.facility_type||'').replace(/_/g,' ')) + '</div>' +
          '<div style="font-size:11px;color:#9CA3AF;margin-top:2px">Volume: ' + vol + ' &bull; Applied: ' + new Date(f.created_at).toLocaleDateString() + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px">' +
          '<button onclick="approvePartner(\'facility\',\'' + f.id + '\',\'' + esc(email) + '\',\'' + esc(f.name) + '\')" style="background:#050D1F;color:#00C2A8;border:none;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Approve</button>' +
          '<button onclick="declinePartner(\'facility\',\'' + f.id + '\',\'' + esc(f.name) + '\')" style="background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Decline</button>' +
          '</div></div>';
      }).join('');
    }
  }

'''

anchor2 = '  function approvePartner'
if 'loadPendingApplicants' not in ac and anchor2 in ac:
    ac = ac.replace(anchor2, load_pending_fn + anchor2)
    changes.append("3d. loadPendingApplicants function added")

# Wire loadPendingApplicants when partners/facilities tabs open
old_patients_show = "    if (name === 'patients') { loadPatients(); }"
new_patients_show = "    if (name === 'patients') { loadPatients(); }\n    if (name === 'partners' || name === 'facilities') { loadPendingApplicants(); }"
if 'loadPendingApplicants' in ac and "name === 'partners' || name === 'facilities'" not in ac:
    if old_patients_show in ac:
        ac = ac.replace(old_patients_show, new_patients_show)
        changes.append("3e. loadPendingApplicants wired to tab switches")

open(af, 'w').write(ac)

# ════════════════════════════════════════════════════════════════
# 4. Build 67
# ════════════════════════════════════════════════════════════════
aj = os.path.join(APP, 'app.json')
a = json.load(open(aj))
a['expo']['ios']['buildNumber'] = '67'
json.dump(a, open(aj, 'w'), indent=2)
changes.append("4. Build -> 67")

# Print all changes
print('\n'.join(changes) if changes else "No changes made")

cmds = [
    'rm -f build67_all_outstanding.py',
    'git add "artifacts/carevoy/app/(tabs)/index.tsx" artifacts/carevoy/app/book-ride.tsx "artifacts/carevoy/app/(tabs)/payment.tsx" artifacts/carevoy/app.json partners-portal/admin.html',
    'git commit -m "build 67: hospital lock for invited, facility-covered payment banner, admin approve/decline, status labels"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
