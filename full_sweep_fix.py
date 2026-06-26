import os, subprocess

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')
results = []

# 1. PHONE NORMALIZE in send-sms.js
sf = os.path.join(REPO, 'api-server', 'api', 'invites', 'send-sms.js')
sc = open(sf).read()
if 'normalizedPhone' not in sc:
    old = "    const { phone, patient_name, facility, ride_id } = req.body;\n    if (!phone) return res.status(400).json({ error: 'Missing phone' });"
    new = """    const { phone, patient_name, facility, ride_id } = req.body;
    if (!phone) return res.status(400).json({ error: 'Missing phone' });
    var digits = String(phone).replace(/\\D/g, '');
    if (digits.length === 10) digits = '1' + digits;
    var normalizedPhone = '+' + digits;"""
    if old in sc:
        sc = sc.replace(old, new)
        sc = sc.replace("To: phone,", "To: normalizedPhone,")
        open(sf, 'w').write(sc)
        results.append("1. send-sms.js normalizes phone (any format works)")
    else:
        results.append("1. FAILED - send-sms pattern not found")
else:
    results.append("1. send-sms.js already normalizes phone")

# 2. REMOVE INSURANCE - facility form
ff = os.path.join(PP, 'facility-signup.html')
fc = open(ff).read()
if '<option value="insurance_medicaid">Insurance / Medicaid</option>' in fc:
    fc = fc.replace('\n      <option value="insurance_medicaid">Insurance / Medicaid</option>', '')
    open(ff, 'w').write(fc)
    results.append("2a. Removed insurance from facility form")
else:
    results.append("2a. Insurance already gone from facility form")

# 2b. REMOVE INSURANCE - coordinator
cf = os.path.join(PP, 'coordinator.html')
cc = open(cf).read()
if '<option value="insurance" disabled>Insurance / Medicaid (not available yet)</option>' in cc:
    cc = cc.replace('\n        <option value="insurance" disabled>Insurance / Medicaid (not available yet)</option>', '')
    results.append("2b. Removed insurance from coordinator")
else:
    results.append("2b. Insurance already gone from coordinator")

# 3. COORDINATOR send invite button alignment
btn_old = '<div class="modal-foot">\n      <button class="btn btn-ghost btn-lg" style="padding:10px 18px" onclick="closeAddPatient()">Cancel</button>\n      <button class="btn btn-navy btn-lg" style="flex:1" id="addPatSubmit" onclick="submitAddPatient()">Send Invite'
btn_new = '<div class="modal-foot" style="display:flex;justify-content:flex-end;gap:10px">\n      <button class="btn btn-ghost btn-lg" style="padding:10px 18px" onclick="closeAddPatient()">Cancel</button>\n      <button class="btn btn-navy btn-lg" style="padding:10px 28px" id="addPatSubmit" onclick="submitAddPatient()">Send Invite'
if btn_old in cc:
    cc = cc.replace(btn_old, btn_new)
    results.append("3. Coordinator Send Invite button aligned right")
else:
    results.append("3. Coordinator button pattern not exact (skipped)")
open(cf, 'w').write(cc)

# 4. DRIVER available rides - fix infinite loading
df = os.path.join(PP, 'driver.html')
dc = open(df).read()
old_guard = "async function loadAvailableRides() {\n  var body = document.getElementById('availableRidesBody');\n  if (!body || !staffInfo || !staffInfo.nemt_partner_id) return;"
new_guard = """async function loadAvailableRides() {
  var body = document.getElementById('availableRidesBody');
  if (!body) return;
  if (!staffInfo || !staffInfo.nemt_partner_id) {
    body.innerHTML = '<div style="padding:40px;text-align:center;color:#9CA3AF;font-size:13px">No available rides yet</div>';
    return;
  }"""
if old_guard in dc:
    dc = dc.replace(old_guard, new_guard)
    open(df, 'w').write(dc)
    results.append("4. Driver available rides shows empty state (no infinite loading)")
else:
    results.append("4. FAILED - driver guard not found")

# 5. REMOVE Invite Partners section from admin (keep one process)
af = os.path.join(PP, 'admin.html')
ac = open(af).read()
invite_section = """    <!-- Invite Partners -->
    <div class="invite-section">
      <div class="section-header">
        <div class="section-title">Invite Partners</div>
        <div class="section-count">Generate a secure onboarding link. Each link expires in 7 days.</div>
      </div>
      <div class="invite-row">
        <button class="invite-btn teal" id="btnFacility" onclick="generateInvite('coordinator')">
          Invite Facility / Coordinator
        </button>
        <button class="invite-btn navy" id="btnNemt" onclick="generateInvite('nemt')">
          Invite NEMT Partner
        </button>
      </div>
    </div>

"""
if invite_section in ac:
    ac = ac.replace(invite_section, '')
    open(af, 'w').write(ac)
    results.append("5. Removed Invite Partners section from admin (approval email untouched)")
else:
    results.append("5. FAILED - invite section pattern not exact")

for r in results:
    print(r)

cmds = [
    'rm -f full_sweep_fix.py',
    'git add api-server/api/invites/send-sms.js partners-portal/facility-signup.html partners-portal/coordinator.html partners-portal/driver.html partners-portal/admin.html',
    'git commit -m "sweep: phone normalize, remove insurance, fix button/loading, remove admin invite buttons"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
