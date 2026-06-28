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

# ===== FIX 5: Gate "Book a medical ride" button - invite-only model =====
# Patients can only be in the app via a facility invite. Remove the self-book
# button and replace with a "waiting for invite" message when no rides exist.
hf = os.path.join(APP,'app','(tabs)','index.tsx')
hc = open(hf).read()

old_book_btn = '''        {/* Book button */}
        <Pressable
          onPress={() => router.push("/book-ride")}
          style={({ pressed }) => [
            styles.bookBtn,
            pressed && styles.pressed,
          ]}
          accessibilityLabel="Book a medical ride"
        >
          <Text style={styles.bookBtnText}>Book a medical ride</Text>
          <View style={styles.bookBtnArrow}>
            <Feather name="arrow-right" size={18} color={NAVY} />
          </View>
        </Pressable>'''

new_book_btn = '''        {/* Invite-only model: no self-booking. Show waiting state when no invites. */}
        {!loading && upcoming.length === 0 && (
          <View style={styles.inviteWaitBox}>
            <Feather name="mail" size={20} color={TEAL} />
            <Text style={styles.inviteWaitText}>
              Your healthcare facility will send you a ride invitation via text message.
            </Text>
          </View>
        )}'''

if old_book_btn in hc:
    hc = hc.replace(old_book_btn, new_book_btn)
    # Add styles for inviteWaitBox
    if 'inviteWaitBox:' not in hc and 'bookBtn:' in hc:
        hc = hc.replace('  bookBtn:', '''  inviteWaitBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F0FDFA",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  inviteWaitText: {
    flex: 1,
    fontSize: 14,
    color: "#050D1F",
    lineHeight: 20,
  },
  bookBtn:''', 1)
    open(hf,'w').write(hc)
    results.append("5. Book button removed - invite-only model (waiting state shown when no rides)")
else:
    results.append("5. FAIL: book button block not matched")
