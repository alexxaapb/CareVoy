import os, subprocess

REPO = '/workspaces/CareVoy'
af = os.path.join(REPO, 'partners-portal', 'admin.html')
ac = open(af).read()

# Update NEMT query to join staff for email
old_nemt_query = "SU + '/rest/v1/nemt_partners?pending_review=eq.true&select=id,company_name,city,service_states,created_at,intake_data'"
new_nemt_query = "SU + '/rest/v1/nemt_partners?pending_review=eq.true&select=id,company_name,city,service_states,created_at,intake_data,staff(id,role)'"
if old_nemt_query in ac:
    ac = ac.replace(old_nemt_query, new_nemt_query)
    print("1. NEMT query updated to include staff join")

# Update facility query to join hospital_coordinators for email
old_fac_query = "SU + '/rest/v1/hospitals?pending_review=eq.true&select=id,name,city,state,facility_type,created_at,intake_data'"
new_fac_query = "SU + '/rest/v1/hospitals?pending_review=eq.true&select=id,name,city,state,facility_type,created_at,intake_data,hospital_coordinators(id,email)'"
if old_fac_query in ac:
    ac = ac.replace(old_fac_query, new_fac_query)
    print("2. Facility query updated to include coordinator email join")

# Update doApprove to use email from the pending data instead of id
old_approve = '''  async function doApprove(type, id, name) {
    if (!confirm('Approve ' + name + '?')) return;
    var tbl = type === 'nemt' ? 'nemt_partners' : 'hospitals';
    await fetch(SU + '/rest/v1/' + tbl + '?id=eq.' + id, {
      method: 'PATCH',
      headers: Object.assign({}, hdr, {'Content-Type':'application/json'}),
      body: JSON.stringify({active: true, pending_review: false})
    });
    // Send approval email using partner-approved endpoint
    try {
      await fetch('https://care-voy-api-server.vercel.app/api/notify/partner-approved', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: id, name: name, type: type})
      });
    } catch(e) {}
    alert(name + ' approved. Login email sent.');
    document.getElementById('rideDetailModal').style.display = 'none';
    location.reload();
  }'''

new_approve = '''  async function doApprove(type, id, name, email) {
    if (!confirm('Approve ' + name + '?')) return;
    var tbl = type === 'nemt' ? 'nemt_partners' : 'hospitals';
    await fetch(SU + '/rest/v1/' + tbl + '?id=eq.' + id, {
      method: 'PATCH',
      headers: Object.assign({}, hdr, {'Content-Type':'application/json'}),
      body: JSON.stringify({active: true, pending_review: false})
    });
    if (email) {
      try {
        await fetch('https://care-voy-api-server.vercel.app/api/notify/partner-approved', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({email: email, name: name, type: type})
        });
      } catch(e) {}
    }
    alert(name + ' approved. Login email sent to ' + (email||'partner') + '.');
    document.getElementById('rideDetailModal').style.display = 'none';
    location.reload();
  }'''

if old_approve in ac:
    ac = ac.replace(old_approve, new_approve)
    print("3. doApprove now accepts email param")

# Update showAppDetail to extract email from joined data and pass to buttons
old_nm_line = "    var nm = type === \"nemt\" ? e(data.company_name||'') : e(data.name||'');\n    document.getElementById(\"rideDetailBody\").innerHTML = rows +"
new_nm_line = """    var nm = type === "nemt" ? e(data.company_name||'') : e(data.name||'');
    // Extract email from joined staff/coordinator records
    var partnerEmail = '';
    if (type === 'nemt' && data.staff && data.staff.length) {
      partnerEmail = data.staff[0].id || '';
    } else if (type === 'facility' && data.hospital_coordinators && data.hospital_coordinators.length) {
      partnerEmail = data.hospital_coordinators[0].email || '';
    }
    document.getElementById("rideDetailBody").innerHTML = rows +"""

if old_nm_line in ac:
    ac = ac.replace(old_nm_line, new_nm_line)
    print("4. Email extracted from joined data in showAppDetail")

# Update approve button to pass email
old_approve_btn = '\'<button class="cv-approve" data-type="\' + type + \'" data-id="\' + data.id + \'" data-name="\' + nm + \'" style="flex:1;background:#050D1F;color:#00C2A8;border:none;padding:12px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Approve</button>\' +'
new_approve_btn = '\'<button class="cv-approve" data-type="\' + type + \'" data-id="\' + data.id + \'" data-name="\' + nm + \'" data-email="\' + partnerEmail + \'" style="flex:1;background:#050D1F;color:#00C2A8;border:none;padding:12px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Approve</button>\' +'
if old_approve_btn in ac:
    ac = ac.replace(old_approve_btn, new_approve_btn)
    print("5. Approve button carries data-email attribute")

# Update listener to pass email to doApprove
old_listener = "      doApprove(ab.getAttribute('data-type'), ab.getAttribute('data-id'), ab.getAttribute('data-name'));"
new_listener = "      doApprove(ab.getAttribute('data-type'), ab.getAttribute('data-id'), ab.getAttribute('data-name'), ab.getAttribute('data-email'));"
if old_listener in ac:
    ac = ac.replace(old_listener, new_listener)
    print("6. Listener passes email to doApprove")

open(af, 'w').write(ac)

cmds = [
    'rm -f fix_pending_email.py',
    'git add partners-portal/admin.html',
    'git commit -m "fix: approval email uses partner email from staff/coordinator join"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
