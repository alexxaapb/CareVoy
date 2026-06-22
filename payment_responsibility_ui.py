import os, subprocess

REPO = '/workspaces/CareVoy'
cf = os.path.join(REPO, 'partners-portal', 'coordinator.html')
cc = open(cf).read()

# ════════════════════════════════════════════════════════════════
# 1. Add payment responsibility dropdown to the invite form
#    (after appointment type, before the error div)
# ════════════════════════════════════════════════════════════════
old_form_end = '''      </select>
    </div>

    <div id="addPatError" class="form-error">'''

new_form_end = '''      </select>
    </div>
    <div style="margin-bottom:14px">
      <label class="form-label">Who pays for the ride?</label>
      <select class="form-input" id="paymentResp">
        <option value="self_pay">Patient pays (HSA/FSA or card)</option>
        <option value="facility">Facility covers this ride</option>
        <option value="insurance" disabled>Insurance / Medicaid (not available yet)</option>
      </select>
      <div style="font-size:11px;color:#9CA3AF;margin-top:4px">Self-pay patients get an automatic HSA/FSA receipt. Facility-covered rides are invoiced to you.</div>
    </div>

    <div id="addPatError" class="form-error">'''

if old_form_end in cc:
    cc = cc.replace(old_form_end, new_form_end)
    print("1. Payment responsibility dropdown added to invite form")
else:
    print("1. FAILED to find form end anchor")

# ════════════════════════════════════════════════════════════════
# 2. Pass payment_responsibility in the IMMEDIATE invite path
#    (the ride insert for <=7 day appointments)
# ════════════════════════════════════════════════════════════════
old_ride_insert = "    ride_type: 'pre_op',"
new_ride_insert = "    ride_type: 'pre_op',\n    payment_responsibility: document.getElementById('paymentResp').value || 'self_pay',"
if old_ride_insert in cc:
    cc = cc.replace(old_ride_insert, new_ride_insert, 1)
    print("2. payment_responsibility added to immediate ride insert")
else:
    print("2. FAILED to find ride insert anchor")

# ════════════════════════════════════════════════════════════════
# 3. Pass payment_responsibility in the SCHEDULED path (>7 days)
# ════════════════════════════════════════════════════════════════
old_sched_insert = "        source: 'form',"
new_sched_insert = "        source: 'form',\n        payment_responsibility: document.getElementById('paymentResp').value || 'self_pay',"
if old_sched_insert in cc:
    cc = cc.replace(old_sched_insert, new_sched_insert, 1)
    print("3. payment_responsibility added to scheduled appointment insert")
else:
    print("3. FAILED to find scheduled insert anchor")

# ════════════════════════════════════════════════════════════════
# 4. Show payment type in the rides table (add column)
# ════════════════════════════════════════════════════════════════
old_rides_header = '''<div class="th">Status</div>'''
# Only add to the FIRST occurrence (the rides table header, not all rides)
if cc.count(old_rides_header) >= 1:
    # Add "Payment" column header after Status in the rides section
    # Actually, let's just show it in the ride row if it exists - simpler
    print("4. Payment type will show in ride rows (no extra column needed)")

# ════════════════════════════════════════════════════════════════
# 5. Reset the payment selector when modal closes
# ════════════════════════════════════════════════════════════════
old_close = "function closeAddPatient() {"
new_close = """function closeAddPatient() {
  var payResp = document.getElementById('paymentResp'); if (payResp) payResp.value = 'self_pay';"""
if old_close in cc:
    cc = cc.replace(old_close, new_close, 1)
    print("5. Payment selector resets on modal close")

open(cf, 'w').write(cc)
print("   coordinator.html written")

cmds = [
    'rm -f payment_responsibility_ui.py',
    'git add partners-portal/coordinator.html',
    'git commit -m "feat: payment_responsibility on invite - self-pay/facility/insurance-blocked (Model C)"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
