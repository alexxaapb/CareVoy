import os, json, subprocess

REPO = '/workspaces/CareVoy'
APP = os.path.join(REPO, 'artifacts', 'carevoy')

# ════════════════════════════════════════════════════════════════
# 3E-1: ADDRESS FORMATTING — clean "# street, city, state, zip"
# (was saving ugly Nominatim display_name with county/country)
# ════════════════════════════════════════════════════════════════
aa = os.path.join(APP, 'lib', 'addressAutocomplete.ts')
c = open(aa).read()
orig = c

old_shortlabel = '''function shortLabel(d: NominatimResult): string {
  const a = d.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const city = a.city || a.town || a.village || a.hamlet || "";
  const region = a.state || "";
  return [street, city, region].filter(Boolean).join(", ") || d.display_name;
}'''

new_shortlabel = '''function cleanAddress(d: NominatimResult): string {
  const a = d.address ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const city = a.city || a.town || a.village || a.hamlet || "";
  const region = a.state || "";
  const zip = a.postcode || "";
  // Google-style: "123 Main St, Columbus, Ohio 43215"
  const cityStateZip = [city, [region, zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [street, cityStateZip].filter(Boolean).join(", ") || d.display_name;
}'''

if old_shortlabel in c:
    c = c.replace(old_shortlabel, new_shortlabel)
    print("1a. Address formatter rewritten (clean street, city, state zip)")
else:
    print("1a. FAILED to find shortLabel")

# Use cleanAddress for BOTH label and fullAddress (was display_name)
old_map = '''    return data.map((d) => ({
      id: String(d.place_id ?? d.osm_id ?? d.display_name),
      label: shortLabel(d),
      fullAddress: d.display_name,
    }));'''
new_map = '''    return data.map((d) => ({
      id: String(d.place_id ?? d.osm_id ?? d.display_name),
      label: cleanAddress(d),
      fullAddress: cleanAddress(d),
    }));'''
if old_map in c:
    c = c.replace(old_map, new_map)
    print("1b. fullAddress now uses clean format (not display_name)")
else:
    print("1b. FAILED to find map block")

if c != orig:
    open(aa, 'w').write(c)
    print("    addressAutocomplete.ts written")

# ════════════════════════════════════════════════════════════════
# 3E-2: ONBOARDING — trim step 1 to NAME + EMAIL only, then save &
# jump to the final "who for" step. Skip address/DOB/emergency/mobility.
# ════════════════════════════════════════════════════════════════
ob = os.path.join(APP, 'app', 'onboarding.tsx')
o = open(ob).read()
oorig = o

# 2a. Step 1 validation: only name + email, then save+skip to who-for
old_step1 = '''    if (step === 1) {
      if (!fullName.trim()) return setError("Please enter your full name");
      if (!isValidEmail(email))
        return setError("Please enter a valid email address");
      const dobCheck = parseDob();
      if (dobCheck.error) return setError(dobCheck.error);
      if (!address.trim()) return setError("Please enter your home address");
      setStep(2);
    } else if (step === 2) {
      if (!emergencyName.trim())
        return setError("Please enter an emergency contact name");
      if (normalizePhone(emergencyPhone).length < 11)
        return setError("Please enter a valid emergency contact phone");
      void saveRequiredAndAdvance();
    }'''

new_step1 = '''    if (step === 1) {
      if (!fullName.trim()) return setError("Please enter your full name");
      if (!isValidEmail(email))
        return setError("Please enter a valid email address");
      // Trimmed onboarding: only name + email required. Save and go
      // straight to the final "who is this for" step. Address, DOB,
      // emergency contact, and mobility are collected later (at booking).
      void saveMinimalAndAdvance();
    }'''

if old_step1 in o:
    o = o.replace(old_step1, new_step1)
    print("2a. Step 1 trimmed to name + email")
else:
    print("2a. FAILED to find step 1 validation")

# 2b. Add saveMinimalAndAdvance (saves just name+email, jumps to who-for step 4)
anchor = '''  const saveRequiredAndAdvance = async () => {'''
minimal_fn = '''  const saveMinimalAndAdvance = async () => {
    setLoading(true);
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      setLoading(false);
      setError("You're not signed in. Please log in again.");
      return;
    }
    const user = userData.user;
    const { error: upsertErr } = await supabase.from("patients").upsert(
      {
        id: user.id,
        full_name: fullName.trim(),
        email: email.trim(),
        phone: user.phone ? "+" + user.phone.replace(/\\D/g, "") : null,
        onboarding_complete: true,
      },
      { onConflict: "id" },
    );
    setLoading(false);
    if (upsertErr) {
      setError(upsertErr.message);
      return;
    }
    // Skip address/DOB/emergency/mobility/language steps — go to "who for".
    setStep(4);
  };

  const saveRequiredAndAdvance = async () => {'''

if anchor in o:
    o = o.replace(anchor, minimal_fn, 1)
    print("2b. saveMinimalAndAdvance added (name+email, jump to step 4)")
else:
    print("2b. FAILED to find anchor")

if o != oorig:
    open(ob, 'w').write(o)
    print("    onboarding.tsx written")
    print(f"    onboarding braces: {{ {o.count('{')} }} {o.count('}')}")

# ════════════════════════════════════════════════════════════════
# 3E-3: RIDE STATUS — home screen showed only pending/confirmed, so a
# ride VANISHED when NEMT accepted (status->assigned). Include the
# active statuses so the patient sees "assigned/en route/arrived".
# ════════════════════════════════════════════════════════════════
idx = os.path.join(APP, 'app', '(tabs)', 'index.tsx')
ix = open(idx).read()
ixorig = ix
old_q = '.eq("patient_id", activePatientId)\n        .in("status", ["pending", "confirmed"])\n        .order("pickup_time", { ascending: true }),'
new_q = '.eq("patient_id", activePatientId)\n        .in("status", ["pending", "confirmed", "assigned", "en_route", "arrived"])\n        .order("pickup_time", { ascending: true }),'
if old_q in ix:
    ix = ix.replace(old_q, new_q)
    open(idx, 'w').write(ix)
    print("4. Home screen now shows assigned/en_route/arrived rides (no more vanishing)")
else:
    print("4. FAILED to find active rides query in index.tsx")

# ════════════════════════════════════════════════════════════════
# 3E-bump: build 59
# ════════════════════════════════════════════════════════════════
aj = os.path.join(APP, 'app.json')
a = json.load(open(aj))
a['expo']['ios']['buildNumber'] = '59'
json.dump(a, open(aj, 'w'), indent=2)
print("3. build number -> 59")

cmds = [
    'rm -f build59_3e.py artifacts/carevoy/build59_3e.py',
    'git add artifacts/carevoy/lib/addressAutocomplete.ts artifacts/carevoy/app/onboarding.tsx "artifacts/carevoy/app/(tabs)/index.tsx" artifacts/carevoy/app.json',
    'git commit -m "3E: address format, trim onboarding, fix ride vanishing after accept, build 59"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
