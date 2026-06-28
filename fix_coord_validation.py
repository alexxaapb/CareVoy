import os, subprocess

REPO = '/workspaces/CareVoy'
cf = os.path.join(REPO, 'partners-portal', 'coordinator.html')
cc = open(cf).read()

old = """    var phone = document.getElementById('patPhone').value.trim();
    if (!first || !last) { showErr('Please enter patient name.'); return; }
    if (!phone) { showErr('Please enter patient phone number.'); return; }
    patientName = first + ' ' + last;
    contactPhone = phone;"""

new = """    var phone = document.getElementById('patPhone').value.trim();
    var patEmail = document.getElementById('patEmail').value.trim();
    if (!first || !last) { showErr('Please enter patient name.'); return; }
    if (!patEmail || !patEmail.includes('@')) { showErr('Please enter patient email address.'); return; }
    patientName = first + ' ' + last;
    contactPhone = phone;"""

if old in cc:
    cc = cc.replace(old, new)
    open(cf,'w').write(cc)
    print("Fixed: email required in validation, phone no longer required")
    # Verify
    cc2 = open(cf).read()
    print("Verify email validation:", "Please enter patient email address" in cc2)
    print("Verify phone no longer blocking:", "Please enter patient phone number" not in cc2)
else:
    print("FAIL: pattern not matched")

for cmd in [
    ['git','-C',REPO,'add','partners-portal/coordinator.html'],
    ['git','-C',REPO,'commit','-m','fix: coordinator validation - email required, phone no longer blocking'],
    ['git','-C',REPO,'push','origin','main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout+r.stderr).strip()[:150] or "(ok)")
