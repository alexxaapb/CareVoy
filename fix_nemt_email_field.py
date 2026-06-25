import os, subprocess

REPO = '/workspaces/CareVoy'

# 1. NEMT signup form: add contact_email to the nemt_partners insert
nf = os.path.join(REPO, 'partners-portal', 'nemt-signup.html')
nc = open(nf).read()

old_insert = "body: JSON.stringify({ company_name: company, city, service_states: states,\n            vehicle_types: vehicles, dispatch_phone: dispatch, active: false, pending_review: true,"
new_insert = "body: JSON.stringify({ company_name: company, city, service_states: states,\n            vehicle_types: vehicles, dispatch_phone: dispatch, contact_email: email, active: false, pending_review: true,"

if old_insert in nc:
    nc = nc.replace(old_insert, new_insert)
    open(nf, 'w').write(nc)
    print("1. contact_email added to nemt_partners insert")
else:
    # Try finding the nemt_partners insert differently
    import re
    old_pat = r"(body: JSON\.stringify\(\{ company_name: company, city, service_states: states,\s*vehicle_types: vehicles, dispatch_phone: dispatch,)"
    new_pat = r"\1 contact_email: email,"
    nc2, count = re.subn(old_pat, new_pat, nc)
    if count:
        open(nf, 'w').write(nc2)
        print("1. contact_email added (alt match)")
    else:
        # Just find the nemt_partners POST body
        nc3 = nc.replace(
            'dispatch_phone: dispatch, active: false, pending_review: true,',
            'dispatch_phone: dispatch, contact_email: email, active: false, pending_review: true,'
        )
        if nc3 != nc:
            open(nf, 'w').write(nc3)
            print("1. contact_email added (simple match)")
        else:
            print("1. FAILED - insert pattern not found")

# 2. Admin: update NEMT pending query to include contact_email
af = os.path.join(REPO, 'partners-portal', 'admin.html')
ac = open(af).read()

old_q = 'nemt_partners?pending_review=eq.true&select=id,company_name,city,service_states,created_at,intake_data,staff(id)'
new_q = 'nemt_partners?pending_review=eq.true&select=id,company_name,city,service_states,created_at,intake_data,contact_email'
if old_q in ac:
    ac = ac.replace(old_q, new_q)
    print("2. Admin NEMT query now fetches contact_email directly")

# 3. Update partnerEmail extraction to use contact_email for NEMT
old_email = 'var partnerEmail = type === "nemt" ? (data.staff && data.staff[0] ? data.staff[0].id : "") : (data.hospital_coordinators && data.hospital_coordinators[0] ? data.hospital_coordinators[0].email : "");'
new_email = 'var partnerEmail = type === "nemt" ? (data.contact_email || "") : (data.hospital_coordinators && data.hospital_coordinators[0] ? data.hospital_coordinators[0].email : "");'
if old_email in ac:
    ac = ac.replace(old_email, new_email)
    print("3. partnerEmail uses contact_email for NEMT")

open(af, 'w').write(ac)

cmds = [
    'rm -f fix_nemt_email_field.py',
    'git add partners-portal/nemt-signup.html partners-portal/admin.html',
    'git commit -m "fix: save contact_email on nemt_partners, use it for approval email"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
