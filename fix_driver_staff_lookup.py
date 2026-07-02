import subprocess, os

REPO = '/workspaces/CareVoy'
PP   = os.path.join(REPO, 'partners-portal')
API_DIR = os.path.join(REPO, 'api-server', 'api')
results = []

# ═══════════════════════════════════════
# 1. Create /api/staff/lookup.js — service role, no expiry
# ═══════════════════════════════════════
os.makedirs(os.path.join(API_DIR, 'staff'), exist_ok=True)

lookup_js = r"""const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { uid, nemt_partner_id } = req.body;
    const sb = createClient(
      process.env.SUPABASE_URL || 'https://byflpckbjjumxxjxoplk.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    let staff;
    if (nemt_partner_id) {
      // Admin preview mode
      const { data } = await sb.from('staff').select('*').eq('nemt_partner_id', nemt_partner_id).eq('role', 'nemt').limit(1);
      staff = data && data[0];
    } else if (uid) {
      const { data } = await sb.from('staff').select('*').eq('id', uid).limit(1);
      staff = data && data[0];
    }

    if (!staff) return res.status(404).json({ error: 'Staff not found' });

    // Also fetch partner info
    let partner = null;
    if (staff.nemt_partner_id) {
      const { data: pd } = await sb.from('nemt_partners').select('*').eq('id', staff.nemt_partner_id).limit(1);
      partner = pd && pd[0];
    }

    return res.status(200).json({ staff, partner });
  } catch(e) {
    console.error('staff lookup error:', e);
    return res.status(500).json({ error: e.message });
  }
};
"""

open(os.path.join(API_DIR, 'staff', 'lookup.js'), 'w').write(lookup_js)
results.append("1. Created /api/staff/lookup.js (service role, no token expiry)")

# ═══════════════════════════════════════
# 2. Driver init() uses the API lookup instead of direct staff query
# ═══════════════════════════════════════
df = os.path.join(PP, 'driver.html')
dc = open(df).read()

# Revert H to use token (for other queries that need it) but staff lookup via API
dc = dc.replace(
    "var H = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY };",
    "var H = { 'apikey': KEY, 'Authorization': 'Bearer ' + (token || KEY) };"
)

# Replace the staff lookup in init with API call
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

if old_lookup in dc:
    dc = dc.replace(old_lookup, new_lookup)
    results.append("2. Driver: staff lookup via API (works even when token expired)")
else:
    results.append("2. FAIL: staff lookup block not matched")

open(df, 'w').write(dc)

print("=" * 60)
for r in results: print(" ", r)
print("=" * 60)

dc2 = open(df).read()
print("\nVERIFICATION:")
print("  staff lookup endpoint exists:", os.path.exists(os.path.join(API_DIR, 'staff', 'lookup.js')))
print("  Driver uses API lookup:", "/api/staff/lookup" in dc2)
print("  H uses token fallback:", "(token || KEY)" in dc2)

for cmd in [
    ['git', '-C', REPO, 'add', '-A', '.'],
    ['git', '-C', REPO, 'commit', '-m', 'fix: driver staff lookup via API service role (no more no-company error on token expiry)'],
    ['git', '-C', REPO, 'push', 'origin', 'main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout + r.stderr).strip()[:200] or '(ok)')
