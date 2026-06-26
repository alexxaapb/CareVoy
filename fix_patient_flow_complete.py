import os, subprocess

REPO = '/workspaces/CareVoy'

# FIX 1: careContext phone match - use last 10 digits, claim patient_id too
cf = os.path.join(REPO, 'artifacts', 'carevoy', 'lib', 'careContext.tsx')
cc = open(cf).read()

old_claim = """    // Update rides matching this phone to app_downloaded
    try {
      const phone = session?.user?.phone;
      if (phone) {
        await supabase
          .from(\"rides\")
          .update({ status: \"app_downloaded\" })
          .eq(\"contact_phone\", phone)
          .eq(\"status\", \"invited\");
      }
    } catch {}"""

new_claim = """    // Claim invited rides matching this phone (last 10 digits, format-agnostic)
    // and attach this user's patient_id so they appear in the app.
    try {
      const phone = session?.user?.phone;
      const digits10 = phone ? String(phone).replace(/\\\\D/g, \"\").slice(-10) : null;
      if (digits10) {
        const { data: invitedRides } = await supabase
          .from(\"rides\")
          .select(\"id, contact_phone\")
          .is(\"patient_id\", null)
          .in(\"status\", [\"invited\", \"reminder_sent\", \"no_response\", \"app_downloaded\"]);
        if (Array.isArray(invitedRides)) {
          for (const rd of invitedRides) {
            const rdDigits = String(rd.contact_phone || \"\").replace(/\\\\D/g, \"\").slice(-10);
            if (rdDigits && rdDigits === digits10) {
              await supabase
                .from(\"rides\")
                .update({ patient_id: userId, status: \"app_downloaded\" })
                .eq(\"id\", rd.id);
            }
          }
        }
      }
    } catch {}"""

if old_claim in cc:
    cc = cc.replace(old_claim, new_claim)
    open(cf, 'w').write(cc)
    print("1. careContext claims invited rides by last-10-digit phone match + sets patient_id")
else:
    print("1. FAILED - careContext claim block not found")

# FIX 2: Home screen shows invited/app_downloaded rides as upcoming so patient sees them
hf = os.path.join(REPO, 'artifacts', 'carevoy', 'app', '(tabs)', 'index.tsx')
hc = open(hf).read()
old_status = '.in("status", ["pending", "confirmed", "assigned", "en_route", "arrived"])'
new_status = '.in("status", ["invited", "app_downloaded", "reminder_sent", "no_response", "pending", "confirmed", "assigned", "en_route", "arrived"])'
if old_status in hc:
    hc = hc.replace(old_status, new_status)
    open(hf, 'w').write(hc)
    print("2. Home screen now shows invited/app_downloaded rides as upcoming")
else:
    print("2. FAILED - home screen status filter not found")

cmds = [
    'rm -f fix_patient_flow_complete.py',
    'git add artifacts/carevoy/lib/careContext.tsx "artifacts/carevoy/app/(tabs)/index.tsx"',
    'git commit -m "fix: patient ride claiming - phone match + show invited rides (build)"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
