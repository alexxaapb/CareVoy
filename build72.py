import os, json, re

REPO = '/workspaces/CareVoy'
APP = os.path.join(REPO, 'artifacts', 'carevoy')
results = []

# ===== FIX 1: HOME LABEL - add invited/app_downloaded keys to RIDE_STATUS_LABELS =====
# VERIFIED: map at line 113 lacks these keys, falls back to UPPERCASE
hf = os.path.join(APP,'app','(tabs)','index.tsx')
hc = open(hf).read()
old_map = '''const RIDE_STATUS_LABELS: Record<string, string> = {
  pending: "Finding your driver",'''
new_map = '''const RIDE_STATUS_LABELS: Record<string, string> = {
  invited: "Pending invite",
  app_downloaded: "Pending invite",
  reminder_sent: "Pending invite",
  no_response: "Pending invite",
  pending: "Finding your driver",'''
if old_map in hc:
    hc = hc.replace(old_map, new_map)
    open(hf,'w').write(hc)
    results.append("1. HOME LABEL: added invited/app_downloaded -> 'Pending invite' to RIDE_STATUS_LABELS")
else:
    results.append("1. FAIL: RIDE_STATUS_LABELS map not matched")

# ===== FIX 2: FACILITY-COVERED - bypass the card-required gate =====
# VERIFIED: submit() line 574 needsCard blocks facility rides
bf = os.path.join(APP,'app','book-ride.tsx')
bc = open(bf).read()
old_gate = '''    const needsCard =
      paymentMethod === "hsa_fsa" ? !hsaCardOnFile : !stdCardOnFile;
    if (needsCard) {'''
new_gate = '''    const needsCard =
      invitePaymentResp === "facility"
        ? false
        : paymentMethod === "hsa_fsa" ? !hsaCardOnFile : !stdCardOnFile;
    if (needsCard) {'''
if old_gate in bc:
    bc = bc.replace(old_gate, new_gate)
    results.append("2. FACILITY-COVERED: card-required gate bypassed when facility covers ride")
else:
    results.append("2. FAIL: needsCard gate not matched")

# ===== FIX 3: payment-step error message - generic 'add a payment method' =====
# Per Al: don't specify HSA/FSA, just 'please add a payment method'
old_msg = '''      setError(
        paymentMethod === "hsa_fsa"
          ? "Please add an HSA/FSA card from the Payment tab to continue."
          : "Please add a card from the Payment tab to continue.",
      );'''
new_msg = '''      setError("Please add a payment method from the Payment tab to continue.");'''
if old_msg in bc:
    bc = bc.replace(old_msg, new_msg)
    results.append("3. Payment error message generic ('add a payment method')")
else:
    results.append("3. FAIL: payment error msg not matched")

open(bf,'w').write(bc)

# ===== bump 72 =====
aj=os.path.join(APP,'app.json'); ap=json.load(open(aj))
ob=ap['expo']['ios'].get('buildNumber'); ap['expo']['ios']['buildNumber']="72"
json.dump(ap,open(aj,'w'),indent=2); open(aj,'a').write('\n')
results.append(f"4. build {ob} -> 72")

print("="*55)
for r in results: print(r)
print("="*55)
# verification: confirm each change is actually in the files now
print("\nVERIFICATION (reading files back):")
hc2=open(hf).read(); bc2=open(bf).read()
print("  invited label in map:", '"invited": "Pending invite"' in hc2 or 'invited: "Pending invite"' in hc2)
print("  facility gate bypass:", 'invitePaymentResp === "facility"\n        ? false' in bc2)
print("  generic payment msg:", 'add a payment method from the Payment tab' in bc2)
print("  JSX balance book-ride: ( =",bc2.count('('),") =",bc2.count(')'),"| { =",bc2.count('{'),"} =",bc2.count('}'))
