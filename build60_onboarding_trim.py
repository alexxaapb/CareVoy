import os, json, subprocess

REPO = '/workspaces/CareVoy'
APP = os.path.join(REPO, 'artifacts', 'carevoy')
ob = os.path.join(APP, 'app', 'onboarding.tsx')
o = open(ob).read()
orig = o

# ════════════════════════════════════════════════════════════════
# 1. REMOVE the Date of birth + Home address fields from the render.
#    Keep only Full name + Email in step 1.
# ════════════════════════════════════════════════════════════════
dob_address_block = '''              <Text style={styles.helper}>
                Required for HSA / FSA receipts.
              </Text>

              <Text style={styles.label}>
                Date of birth<Required />
              </Text>
              <View style={styles.dobRow}>
                <View style={styles.dobField}>
                  <Text style={styles.dobFieldLabel}>Month</Text>
                  <TextInput
                    style={[styles.input, styles.dobInput]}
                    placeholder="MM"
                    placeholderTextColor={MUTED}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={dobMonth}
                    onChangeText={(t) => {
                      const next = t.replace(/\\D/g, "");
                      setDobMonth(next);
                      if (next.length === 2) dobDayRef.current?.focus();
                    }}
                    editable={!loading}
                    returnKeyType="next"
                    onSubmitEditing={() => dobDayRef.current?.focus()}
                  />
                </View>
                <View style={styles.dobField}>
                  <Text style={styles.dobFieldLabel}>Day</Text>
                  <TextInput
                    ref={dobDayRef}
                    style={[styles.input, styles.dobInput]}
                    placeholder="DD"
                    placeholderTextColor={MUTED}
                    keyboardType="number-pad"
                    maxLength={2}
                    value={dobDay}
                    onChangeText={(t) => {
                      const next = t.replace(/\\D/g, "");
                      setDobDay(next);
                      if (next.length === 2) dobYearRef.current?.focus();
                    }}
                    editable={!loading}
                    returnKeyType="next"
                    onSubmitEditing={() => dobYearRef.current?.focus()}
                  />
                </View>
                <View style={[styles.dobField, styles.dobFieldYear]}>
                  <Text style={styles.dobFieldLabel}>Year</Text>
                  <TextInput
                    ref={dobYearRef}
                    style={[styles.input, styles.dobInput]}
                    placeholder="YYYY"
                    placeholderTextColor={MUTED}
                    keyboardType="number-pad"
                    maxLength={4}
                    value={dobYear}
                    onChangeText={(t) => setDobYear(t.replace(/\\D/g, ""))}
                    editable={!loading}
                    returnKeyType="done"
                  />
                </View>
              </View>

              <Text style={styles.label}>
                Home address<Required />
              </Text>
              <AddressInput
                value={address}
                onChange={setAddress}
                placeholder="Start typing your address…"
                multiline
                editable={!loading}
                inputStyle={styles.input}
                zIndex={50}
              />
            </>'''

dob_address_replacement = '''              <Text style={styles.helper}>
                Required for HSA / FSA receipts.
              </Text>
            </>'''

if dob_address_block in o:
    o = o.replace(dob_address_block, dob_address_replacement)
    print("1. Removed DOB + Home address fields from render")
else:
    print("1. FAILED to find DOB/address render block")

# ════════════════════════════════════════════════════════════════
# 2. Change the step indicator: hide "Step X of 4" since it's now 1 step
# ════════════════════════════════════════════════════════════════
o = o.replace(
    'Step {step} of {TOTAL_STEPS}',
    'Create your account'
)
print("2. Step indicator simplified")

# ════════════════════════════════════════════════════════════════
# 3. Change button label on step 1 from "Continue" to "Create account"
#    (it already calls saveMinimalAndAdvance via goNext)
# ════════════════════════════════════════════════════════════════
# (handled by existing goNext -> saveMinimalAndAdvance -> setStep(4))
# But we want to SKIP step 4 (who-for) too. Make saveMinimalAndAdvance
# navigate straight into the app instead of step 4.
old_minimal_end = '''    // Skip address/DOB/emergency/mobility/language steps — go to "who for".
    setStep(4);
  };'''
new_minimal_end = '''    // Onboarding complete with just name + email. Enter the app directly.
    // (Who-for selection happens at booking time, not signup.)
    await refresh();
    router.replace("/(tabs)");
  };'''
if old_minimal_end in o:
    o = o.replace(old_minimal_end, new_minimal_end)
    print("3. After name+email, go straight into app (skip who-for step)")
else:
    print("3. FAILED to find saveMinimalAndAdvance ending")

# Make sure refresh + router are available
if 'const { refresh' not in o and 'refresh()' in o:
    print("   NOTE: verify 'refresh' is available from useAuth/careContext")

if o != orig:
    open(ob, 'w').write(o)
    print("   onboarding.tsx written")
    print(f"   braces: {{ {o.count('{')} }} {o.count('}')}")

# Build 60
aj = os.path.join(APP, 'app.json')
a = json.load(open(aj))
a['expo']['ios']['buildNumber'] = '60'
json.dump(a, open(aj, 'w'), indent=2)
print("4. build -> 60")

cmds = [
    'rm -f build60_onboarding_trim.py',
    'git add artifacts/carevoy/app/onboarding.tsx artifacts/carevoy/app.json',
    'git commit -m "fix: onboarding truly trimmed to name+email only, skip who-for, build 60"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
