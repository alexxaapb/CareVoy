import os, subprocess

REPO = '/workspaces/CareVoy'
of = os.path.join(REPO, 'artifacts', 'carevoy', 'app', 'onboarding.tsx')
oc = open(of).read()

# After the upsert succeeds, claim any invited rides matching this phone
old = """    setLoading(false);
    if (upsertErr) {
      setError(upsertErr.message);
      return;
    }
    setStep(3);
  };"""

new = """    setLoading(false);
    if (upsertErr) {
      setError(upsertErr.message);
      return;
    }
    // Claim any invited rides that match this patient's verified phone.
    // Coordinator-created invites have contact_phone set but patient_id null.
    try {
      const verifiedPhone = user.phone ? "+" + user.phone.replace(/\\\\D/g, "") : null;
      const digits10 = verifiedPhone ? verifiedPhone.replace(/\\\\D/g, "").slice(-10) : null;
      if (digits10) {
        // Match on the last 10 digits regardless of stored format
        const { data: invited } = await supabase
          .from("rides")
          .select("id, contact_phone, patient_id")
          .is("patient_id", null)
          .in("status", ["invited", "reminder_sent", "no_response"]);
        if (Array.isArray(invited) && invited.length) {
          const mine = invited.filter((rd) => {
            const rdDigits = String(rd.contact_phone || "").replace(/\\\\D/g, "").slice(-10);
            return rdDigits && rdDigits === digits10;
          });
          for (const rd of mine) {
            await supabase
              .from("rides")
              .update({ patient_id: user.id })
              .eq("id", rd.id);
          }
        }
      }
    } catch (e) {
      // Non-fatal: patient can still book manually if claim fails
    }
    setStep(3);
  };"""

if old in oc:
    oc = oc.replace(old, new)
    open(of, 'w').write(oc)
    print("1. Onboarding now claims invited rides by matching phone (last 10 digits)")
    print(f"   Verify: claim logic present = {'Claim any invited rides' in oc}")
else:
    print("1. FAILED - upsert success block not found")
    # show context
    idx = oc.find("setStep(3)")
    print(oc[idx-200:idx+50])

cmds = [
    'rm -f fix_claim_invites.py',
    'git add artifacts/carevoy/app/onboarding.tsx',
    'git commit -m "feat: claim invited rides by phone match on patient onboarding (build 68)"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
