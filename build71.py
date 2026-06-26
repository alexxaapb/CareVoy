import os, subprocess, json, re

REPO = '/workspaces/CareVoy'
APP = os.path.join(REPO, 'artifacts', 'carevoy')
results = []

# ===== FIX 1: schedule button passes payment_responsibility =====
rf = os.path.join(APP,'app','ride-detail.tsx')
rc = open(rf).read()
o = '''              hospital_name: ride.hospital_name || ride.dropoff_address || "",
              procedure_type: ride.procedure_type || "",
            }))}`)}'''
n = '''              hospital_name: ride.hospital_name || ride.dropoff_address || "",
              procedure_type: ride.procedure_type || "",
              payment_responsibility: ride.payment_responsibility || "self_pay",
            }))}`)}'''
if o in rc:
    rc=rc.replace(o,n); open(rf,'w').write(rc); results.append("1. Schedule button passes payment_responsibility")
else: results.append("1. FAIL button prefill not matched")

# ===== FIX 2a: invite skips who-picker, lands on pickup/date (step 1), re-validates date =====
bf = os.path.join(APP,'app','book-ride.tsx')
bc = open(bf).read()
o2 = """      if (p.special_instructions) {
        // surface as needing extra time if relevant; otherwise ignored quietly
        if (/extra time|slow|mobility|assist/i.test(p.special_instructions))
          setNeedsExtraTime(true);
      }
      setStep(3);"""
n2 = """      if (p.special_instructions) {
        if (/extra time|slow|mobility|assist/i.test(p.special_instructions))
          setNeedsExtraTime(true);
      }
      if ((p as any).payment_responsibility) {
        setInvitePaymentResp((p as any).payment_responsibility);
      }
      if (params.rideId) {
        setWhoChosen(true);
        setStep(1);
      } else {
        setStep(3);
      }"""
if o2 in bc:
    bc=bc.replace(o2,n2); results.append("2a. Invite skips who-picker, lands on pickup/date (step 1), re-validates date")
else: results.append("2a. FAIL prefill end not matched")

# ===== FIX 2b: respect invitePaymentResp on save =====
if '          payment_responsibility: "self_pay",' in bc:
    bc=bc.replace('          payment_responsibility: "self_pay",',
                  '          payment_responsibility: invitePaymentResp || "self_pay",')
    results.append("2b. Save respects invitePaymentResp")
else: results.append("2b. self_pay hardcode not found (ok if already changed)")

# ===== FIX 2c: facility-covered skips payment section =====
pay_block = '''              <Text style={styles.label}>Payment method</Text>
              <PaymentOption
                active={paymentMethod === "hsa_fsa"}
                onPress={() => setPaymentMethod("hsa_fsa")}
                icon="credit-card"
                title="HSA / FSA card"
                subtitle={
                  hsaCardOnFile
                    ? `Card on file ending in ${hsaCardOnFile} • Tax-free`
                    : "Tax-advantaged. We'll generate an IRS-ready receipt."
                }
              />
              <PaymentOption
                active={paymentMethod === "card"}
                onPress={() => setPaymentMethod("card")}
                icon="credit-card"
                title="Credit or debit card"
                subtitle={
                  stdCardOnFile
                    ? `Card on file ending in ${stdCardOnFile}`
                    : "Standard payment."
                }
              />

              {((paymentMethod === "hsa_fsa" && !hsaCardOnFile) ||
                (paymentMethod === "card" && !stdCardOnFile)) && (
                <Pressable
                  style={styles.addCardPrompt}
                  onPress={() => router.push("/(tabs)/payment")}
                >
                  <Feather name="plus-circle" size={18} color={TEAL} />
                  <Text style={styles.addCardText}>
                    Add{" "}
                    {paymentMethod === "hsa_fsa" ? "HSA/FSA card" : "a card"} to
                    continue
                  </Text>
                  <Feather name="chevron-right" size={18} color={TEAL} />
                </Pressable>
              )}'''
wrapped = '''              {invitePaymentResp === "facility" ? (
                <View style={styles.facilityCoveredBox}>
                  <Feather name="check-circle" size={18} color={TEAL} />
                  <Text style={styles.facilityCoveredText}>
                    Your facility covers this ride. No payment needed.
                  </Text>
                </View>
              ) : (
                <View>
''' + pay_block + '''
                </View>
              )}'''
if pay_block in bc:
    bc=bc.replace(pay_block,wrapped); results.append("2c. Facility-covered skips card, shows 'no payment needed'")
else: results.append("2c. FAIL payment block not matched")
open(bf,'w').write(bc)

# ===== FIX 4: styles =====
bc=open(bf).read()
if 'facilityCoveredBox:' not in bc and '  estimateCard:' in bc:
    bc=bc.replace('  estimateCard:','''  facilityCoveredBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  facilityCoveredText: { flex: 1, fontSize: 14, color: "#050D1F", fontWeight: "600" },
  estimateCard:''',1)
    open(bf,'w').write(bc); results.append("4. facilityCoveredBox styles added")
else: results.append("4. styles present or anchor missing")

# ===== FIX 3: home labels =====
hf=os.path.join(APP,'app','(tabs)','index.tsx'); hc=open(hf).read(); ch=False
for pat,repl in [(r'app_downloaded:\s*"[^"]*"','app_downloaded: "Pending invite"'),
                 (r'\binvited:\s*"[^"]*"','invited: "Pending invite"')]:
    nn=re.sub(pat,repl,hc)
    if nn!=hc: hc=nn; ch=True
if ch: open(hf,'w').write(hc); results.append("3. Home labels -> Pending invite")
else: results.append("3. Home: no inline label map found")

# ===== bump 71 =====
aj=os.path.join(APP,'app.json'); ap=json.load(open(aj))
ob=ap['expo']['ios'].get('buildNumber'); ap['expo']['ios']['buildNumber']="71"
json.dump(ap,open(aj,'w'),indent=2); open(aj,'a').write('\n')
results.append(f"5. build {ob} -> 71")

print("="*50)
for r in results: print(r)
print("="*50)
bc=open(bf).read()
print("JSX balance book-ride.tsx: ( =",bc.count('('),") =",bc.count(')'),"| { =",bc.count('{'),"} =",bc.count('}'))
print()
print("NOT committed. Run typecheck, then commit+build if clean.")
