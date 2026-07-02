import subprocess, os

REPO = '/workspaces/CareVoy'
PP   = os.path.join(REPO, 'partners-portal')
results = []

df = os.path.join(PP, 'driver.html')
dc = open(df).read()

# Revert H header to token-based (the working version)
dc = dc.replace(
    "var H = { 'apikey': KEY, 'Authorization': 'Bearer ' + (token || KEY) };",
    "var H = { 'apikey': KEY, 'Authorization': 'Bearer ' + token };"
)
dc = dc.replace(
    "var H = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY };",
    "var H = { 'apikey': KEY, 'Authorization': 'Bearer ' + token };"
)

# Revert auth check to original
dc = dc.replace(
    "if (!uid && !new URLSearchParams(window.location.search).get('preview_nemt')) { window.location.href = '/'; }",
    "if (!token || !uid) { if (!new URLSearchParams(window.location.search).get('preview_nemt')) { window.location.href = '/'; } }"
)

# Revert the staff lookup back to direct query
new_lookup = """    var previewNemt = new URLSearchParams(window.location.search).get('preview_nemt');
    // Look up staff via API (service role, no token expiry)
    var lookupResp = await fetch(API + '/api/staff/lookup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(previewNemt ? { nemt_partner_id: previewNemt } : { uid: uid })
    });
    var lookupData = await lookupResp.json();
    staffInfo = lookupData.staff || null;
    partnerInfo = lookupData.partner || null;

    if (!staffInfo || !staffInfo.nemt_partner_id) {
      showNoPartner();
      document.getElementById('loading').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      return;
    }"""

old_lookup = """    var previewNemt = new URLSearchParams(window.location.search).get('preview_nemt');
    var sr;
    if (previewNemt) {
      sr = await fetch(SUPA + '/rest/v1/staff?nemt_partner_id=eq.' + previewNemt + '&role=eq.nemt&select=*&limit=1', { headers: H });
    } else {
      sr = await fetch(SUPA + '/rest/v1/staff?id=eq.' + uid + '&select=*', { headers: H });
    }
    var sd = await sr.json();
    staffInfo = sd[0] || null;

    if (!staffInfo || !staffInfo.nemt_partner_id) {
      showNoPartner();
      document.getElementById('loading').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      return;
    }

    var pr = await fetch(SUPA + '/rest/v1/nemt_partners?id=eq.' + staffInfo.nemt_partner_id + '&select=company_name,city,service_states,vehicle_types,dispatch_phone', { headers: H });
    var pd = await pr.json();
    partnerInfo = pd[0] || null;"""

if new_lookup in dc:
    dc = dc.replace(new_lookup, old_lookup)
    results.append("Reverted: driver staff lookup back to direct query (working version)")
else:
    results.append("NOTE: API lookup block not found - checking current state")

open(df, 'w').write(dc)

print("=" * 60)
for r in results: print(" ", r)
print("=" * 60)

dc2 = open(df).read()
print("\nVERIFICATION:")
print("  H uses token:", "'Authorization': 'Bearer ' + token }" in dc2)
print("  Direct staff query:", "staff?id=eq.' + uid" in dc2)
print("  No API lookup:", "/api/staff/lookup" not in dc2)
print("  Auth check original:", "if (!token || !uid)" in dc2)

for cmd in [
    ['git', '-C', REPO, 'add', 'partners-portal/driver.html'],
    ['git', '-C', REPO, 'commit', '-m', 'revert: driver dashboard back to working token-based auth'],
    ['git', '-C', REPO, 'push', 'origin', 'main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout + r.stderr).strip()[:200] or '(ok)')
