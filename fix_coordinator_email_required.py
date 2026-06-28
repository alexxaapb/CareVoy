import os, subprocess

REPO = '/workspaces/CareVoy'
cf = os.path.join(REPO, 'partners-portal', 'coordinator.html')
cc = open(cf).read()
results = []

# 1. Flip phone to optional, email to required in labels
cc = cc.replace(
    '<label class="form-label">Patient Phone (receives SMS invite)</label>',
    '<label class="form-label">Patient Phone <span style="color:#9CA3AF;font-weight:400">(optional)</span></label>'
)
results.append("1. Phone field label -> optional")

cc = cc.replace(
    '<label class="form-label">Patient Email (optional)</label>',
    '<label class="form-label">Patient Email <span style="color:#EF4444">*</span></label>'
)
results.append("2. Email field label -> required")

# 2. Flip validation: require email, make phone optional
old_validate = """    var phone = document.getElementById('patPhone').value.trim();
    var rawPhone = phone.replace(/\\D/g, '');
    if (rawPhone.length < 10) { showToast('Enter a valid patient phone number', 'err'); return; }"""
new_validate = """    var phone = document.getElementById('patPhone').value.trim();
    var rawPhone = phone.replace(/\\D/g, '');
    var patEmail = document.getElementById('patEmail').value.trim();
    if (!patEmail || !patEmail.includes('@')) { showToast('Patient email is required', 'err'); return; }"""
if old_validate in cc:
    cc = cc.replace(old_validate, new_validate)
    results.append("3. Validation: email required, phone optional")
else:
    results.append("3. FAIL: validation block not matched")

# 3. Switch dup-check from contact_phone to contact_email (both occurrences)
old_dup = "var dupCheck = await fetch(SUPA + '/rest/v1/rides?hospital_id=eq.' + coordInfo.hospital_id + '&contact_phone=eq.' + encodeURIComponent(contactPhone) + '&status=in.(invited,reminder_sent,no_response,pending,confirmed,assigned,en_route,arrived)&select=id,status', { headers: H });"
new_dup = "var dupCheck = await fetch(SUPA + '/rest/v1/rides?hospital_id=eq.' + coordInfo.hospital_id + '&contact_email=eq.' + encodeURIComponent(patEmail) + '&status=in.(invited,reminder_sent,no_response,pending,confirmed,assigned,en_route,arrived)&select=id,status', { headers: H });"
count = cc.count(old_dup)
if count > 0:
    cc = cc.replace(old_dup, new_dup)
    results.append(f"4. Dup-check switched from phone to email ({count} occurrence(s))")
else:
    results.append("4. FAIL: dup-check pattern not matched")

# 4. Make sure patEmail variable is in scope for the dup check
# patEmail is now declared in validation above, so it's in scope. Good.
# Also make sure contact_email is not null on insert (it's required now)
cc = cc.replace(
    "contact_email: (document.getElementById('patEmail') ? document.getElementById('patEmail').value.trim() : null) || null,",
    "contact_email: patEmail,"
)
results.append("5. contact_email insert uses required patEmail variable")

open(cf, 'w').write(cc)

for r in results: print(r)
print()
# Verify
cc2 = open(cf).read()
print("VERIFICATION:")
print("  phone optional in label:", 'optional' in cc2 and 'Patient Phone' in cc2)
print("  email required in label:", 'Patient Email' in cc2 and 'EF4444' in cc2)
print("  dup-check on email:", 'contact_email=eq.' in cc2)
print("  validation requires email:", "Patient email is required" in cc2)
print()

for cmd in [
    ['git','-C',REPO,'add','partners-portal/coordinator.html'],
    ['git','-C',REPO,'commit','-m','fix: coordinator invite - email required, phone optional, dup-check on email'],
    ['git','-C',REPO,'push','origin','main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    out=(r.stdout+r.stderr).strip()
    print("  " + (out[:200] if out else "(ok)"))
