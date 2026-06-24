import os, subprocess, re

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')

# ════════════════════════════════════════════════════════════════
# 1. NEMT SIGNUP: remove insurance question, keep upload only
#    Add broker follow-up field
#    Password show/hide already there - verify
# ════════════════════════════════════════════════════════════════
nf = os.path.join(PP, 'nemt-signup.html')
nc = open(nf).read()

# Remove "Liability insurance in place?" select question
old_ins_q = '''    <div class="section-label">Insurance</div>
    <label class="fl">Liability insurance in place? *</label>
    <select id="hasInsurance">
      <option value="">Select</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>

    <label class="fl">Upload Proof of Liability Insurance *</label>'''
new_ins_q = '''    <div class="section-label">Insurance</div>
    <label class="fl">Upload Proof of Liability Insurance *</label>'''
if old_ins_q in nc:
    nc = nc.replace(old_ins_q, new_ins_q)
    print("N1. Removed 'insurance in place?' question - upload only")

# Remove hasInsurance from required fields list
nc = nc.replace("'hasInsurance','password'", "'password'")
nc = nc.replace("hasIns=val('hasInsurance'),", "")
nc = nc.replace(",has_insurance:hasIns", "")
print("N2. hasInsurance removed from validation + submit")

# Add broker follow-up: if they work with brokers, show which ones
old_broker = '''    <select id="brokers">
      <option value="">Select</option>
      <option value="yes">Yes (LogistiCare, MTM, Modivcare, etc.)</option>
      <option value="no">No</option>
      <option value="sometimes">Sometimes</option>
    </select>'''
new_broker = '''    <select id="brokers" onchange="showBrokerFollowup(this)">
      <option value="">Select</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
      <option value="sometimes">Sometimes</option>
    </select>
    <div id="brokerFollowup" style="display:none;margin-top:8px">
      <label class="fl">Which broker(s)?</label>
      <input type="text" id="brokerNames" placeholder="e.g. LogistiCare, MTM, Modivcare"/>
    </div>'''
if old_broker in nc:
    nc = nc.replace(old_broker, new_broker)
    print("N3. Broker follow-up field added")

# Add showBrokerFollowup JS function
old_show_other = "    function showOther(sel,divId){"
new_show_other = """    function showBrokerFollowup(sel) {
      var d = document.getElementById('brokerFollowup');
      d.style.display = (sel.value === 'yes' || sel.value === 'sometimes') ? 'block' : 'none';
    }
    function showOther(sel,divId){"""
if 'showBrokerFollowup' not in nc and old_show_other in nc:
    nc = nc.replace(old_show_other, new_show_other)
    print("N4. showBrokerFollowup JS added")

# Capture broker names in submit
old_brokers_val = "brokers=val('brokers'),"
new_brokers_val = "brokers=val('brokers'),brokerNames=val('brokerNames'),"
if old_brokers_val in nc:
    nc = nc.replace(old_brokers_val, new_brokers_val)
    # Also add to intake_data
    nc = nc.replace(
        "works_with_brokers:brokers,",
        "works_with_brokers:brokers,broker_names:brokerNames,"
    )
    print("N5. Broker names captured in submit")

open(nf, 'w').write(nc)
print("   nemt-signup.html written")

# ════════════════════════════════════════════════════════════════
# 2. FACILITY SIGNUP: add show/hide to password field
# ════════════════════════════════════════════════════════════════
ff = os.path.join(PP, 'facility-signup.html')
fc = open(ff).read()

# Check if wrapper already exists
if 'pw-wrap' not in fc:
    # Add CSS for pw-wrap
    old_style_end = '  </style>'
    pw_css = '''    .pw-wrap { position: relative; }
    .pw-wrap input { padding-right: 44px; }
    .pw-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #9CA3AF; font-size: 12px; font-weight: 600; padding: 4px; font-family: inherit; }
    .pw-toggle:hover { color: #050D1F; }
'''
    fc = fc.replace(old_style_end, pw_css + old_style_end, 1)

    # Wrap the password input
    old_pw = '    <input type="password" id="password" placeholder="Minimum 8 characters" / oninput="clearError(\'password\')">'
    new_pw = '    <div class="pw-wrap"><input type="password" id="password" placeholder="Minimum 8 characters" oninput="clearError(\'password\')"><button type="button" class="pw-toggle" onclick="togglePw(\'password\',this)">SHOW</button></div>'
    if old_pw in fc:
        fc = fc.replace(old_pw, new_pw)
        print("F1. Password show/hide wrapper added to facility form")
    else:
        # Try alternate
        alt_pw = '<input type="password" id="password" placeholder="Minimum 8 characters"'
        if alt_pw in fc:
            fc = fc.replace(
                alt_pw,
                '<div class="pw-wrap"><input type="password" id="password" placeholder="Minimum 8 characters"'
            )
            # Close the wrap after the input
            fc = fc.replace(
                'placeholder="Minimum 8 characters" required />',
                'placeholder="Minimum 8 characters" /><button type="button" class="pw-toggle" onclick="togglePw(\'password\',this)">SHOW</button></div>'
            )
            print("F1. (alt) Password show/hide wrapper added")
else:
    print("F1. pw-wrap already in facility form")

# Add togglePw function if missing
if 'function togglePw' not in fc:
    fc = fc.replace(
        '    function showError(msg)',
        '''    function togglePw(inputId, btn) {
      var inp = document.getElementById(inputId);
      if (inp.type === 'password') { inp.type = 'text'; btn.textContent = 'HIDE'; }
      else { inp.type = 'password'; btn.textContent = 'SHOW'; }
    }
    function showError(msg)'''
    )
    print("F2. togglePw function added to facility form")
else:
    print("F2. togglePw already in facility form")

open(ff, 'w').write(fc)
print("   facility-signup.html written")

# ════════════════════════════════════════════════════════════════
# 3. EMAIL: Fix notification email to you (partners@carevoy.co)
#    - Replace "Approve in Supabase" with "View Application" button
#    - Remove "24 hours" from applicant confirmation
# ════════════════════════════════════════════════════════════════
np = os.path.join(REPO, 'api-server', 'api', 'notify', 'new-partner.js')
nc2 = open(np).read()

# Fix next step in YOUR email - add View Application link
old_next = '<strong>Next step:</strong> Approve in Supabase: set active=true, pending_review=false'
new_next = '<strong>New partner application received.</strong> <a href="https://partners.carevoy.co" style="display:inline-block;margin-top:8px;background:#050D1F;color:#00C2A8;padding:10px 20px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none">View &amp; Approve Application</a>'
if old_next in nc2:
    nc2 = nc2.replace(old_next, new_next)
    print("E1. 'Next step' replaced with View Application button")

# Remove "24 hours" from applicant confirmation email
old_24 = 'We have received your application and will be in touch within 24 hours.'
new_24 = 'We have received your application and will be in touch as soon as possible.'
if old_24 in nc2:
    nc2 = nc2.replace(old_24, new_24)
    print("E2. '24 hours' removed from applicant confirmation")

open(np, 'w').write(nc2)
print("   new-partner.js written")

# ════════════════════════════════════════════════════════════════
# COMMIT
# ════════════════════════════════════════════════════════════════
cmds = [
    'rm -f fix_partner_forms_final.py',
    'git add partners-portal/nemt-signup.html partners-portal/facility-signup.html api-server/api/notify/new-partner.js',
    'git commit -m "fix: NEMT remove insurance question, broker follow-up, facility pw show/hide, email copy fixes"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
