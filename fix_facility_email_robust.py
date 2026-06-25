import os, subprocess

REPO = '/workspaces/CareVoy'

# 1. Facility signup form - save contact_email on hospitals insert
ff = os.path.join(REPO, 'partners-portal', 'facility-signup.html')
fc = open(ff).read()

# Find the hospitals insert and add contact_email
if 'contact_email' not in fc:
    # The insert has name, facility_type, city, state, active, pending_review, intake_data
    old = "name: val('facilityName'), facility_type: val('facilityType'),\n            city: val('city'), state: val('state'), active: false, pending_review: true,"
    new = "name: val('facilityName'), facility_type: val('facilityType'),\n            city: val('city'), state: val('state'), contact_email: val('email'), active: false, pending_review: true,"
    if old in fc:
        fc = fc.replace(old, new)
        print("1. Facility form saves contact_email")
    else:
        # Try different formatting
        import re
        # Find the hospitals POST body
        m = re.search(r"name:\s*val\('facilityName'\),\s*facility_type:\s*val\('facilityType'\),\s*city:\s*val\('city'\),\s*state:\s*val\('state'\),\s*active:\s*false", fc)
        if m:
            fc = fc[:m.end()-13] + "contact_email: val('email'), active: false" + fc[m.end():]
            print("1. Facility form saves contact_email (regex)")
        else:
            print("1. FAILED - showing hospitals insert area")
            idx = fc.find("facilityName")
            print(fc[idx-50:idx+300])
    open(ff, 'w').write(fc)
else:
    print("1. contact_email already in facility form")

# 2. Admin - read contact_email directly for facility (no join)
af = os.path.join(REPO, 'partners-portal', 'admin.html')
ac = open(af).read()

# Update facility query to use contact_email column
ac = ac.replace(
    'hospitals?pending_review=eq.true&select=id,name,city,state,facility_type,created_at,intake_data,hospital_coordinators(id,email)',
    'hospitals?pending_review=eq.true&select=id,name,city,state,facility_type,created_at,intake_data,contact_email'
)
print("2. Admin facility query uses contact_email column directly")

# Update partnerEmail extraction for facility
ac = ac.replace(
    'var partnerEmail = type === "nemt" ? (data.contact_email || "") : (data.hospital_coordinators && data.hospital_coordinators[0] ? data.hospital_coordinators[0].email : "");',
    'var partnerEmail = data.contact_email || "";'
)
print("3. partnerEmail reads contact_email for both NEMT and facility")

open(af, 'w').write(ac)

cmds = [
    'rm -f fix_facility_email_robust.py',
    'git add partners-portal/facility-signup.html partners-portal/admin.html',
    'git commit -m "fix: facility saves contact_email directly, admin reads it without fragile join"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
