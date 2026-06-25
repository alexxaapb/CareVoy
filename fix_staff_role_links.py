import os, subprocess

REPO = '/workspaces/CareVoy'

# 1. NEMT form - fix partner_id -> nemt_partner_id + add email, full_name
nf = os.path.join(REPO, 'partners-portal', 'nemt-signup.html')
nc = open(nf).read()

old_nemt = "body:JSON.stringify({id:uid,role:'nemt',partner_id:partnerId})});"
new_nemt = "body:JSON.stringify({id:uid,role:'nemt',nemt_partner_id:partnerId,email:email,full_name:first+' '+last})});"
if old_nemt in nc:
    nc = nc.replace(old_nemt, new_nemt)
    open(nf, 'w').write(nc)
    print("1. NEMT staff insert: nemt_partner_id + email + full_name")
else:
    print("1. FAILED - NEMT staff insert not found")
    for i,l in enumerate(nc.split('\n')):
        if "role:'nemt'" in l:
            print(f"   Line {i+1}: {l.strip()[:100]}")

# 2. Facility form - add hospital_id, email, full_name to staff insert
ff = os.path.join(REPO, 'partners-portal', 'facility-signup.html')
fc = open(ff).read()

old_fac = "body: JSON.stringify({ id: uid, role: 'coordinator' }) });"
new_fac = "body: JSON.stringify({ id: uid, role: 'coordinator', hospital_id: hospitalId, email: val('email'), full_name: val('firstName')+' '+val('lastName') }) });"
if old_fac in fc:
    fc = fc.replace(old_fac, new_fac)
    open(ff, 'w').write(fc)
    print("2. Facility staff insert: hospital_id + email + full_name")
else:
    print("2. FAILED - facility staff insert not found")
    for i,l in enumerate(fc.split('\n')):
        if "role: 'coordinator'" in l:
            print(f"   Line {i+1}: {l.strip()[:100]}")

cmds = [
    'rm -f fix_staff_role_links.py',
    'git add partners-portal/nemt-signup.html partners-portal/facility-signup.html',
    'git commit -m "fix: staff insert links nemt_partner_id/hospital_id + email + name so login works"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
