import subprocess, os, json

REPO = '/workspaces/CareVoy'
APP = os.path.join(REPO, 'artifacts', 'carevoy')

# ═══════════════════════════════════════════════════════
# 1. BOOK-RIDE.TSX
# ═══════════════════════════════════════════════════════
br = os.path.join(APP, 'app', 'book-ride.tsx')
c = open(br).read()

# 1a. Ride reason dropdown
old_proc = '              <Text style={styles.label}>\n                Procedure / visit type<Required />\n              </Text>\n              <TextInput\n                style={[styles.input, styles.textOnly]}\n                placeholder="e.g. Knee replacement, Cataract surgery"\n                placeholderTextColor={MUTED}\n                value={procedureType}\n                onChangeText={setProcedureType}\n              />'

new_proc = """              <Text style={styles.label}>
                Ride reason<Required />
              </Text>
              <View style={{ gap: 6 }}>
                {[
                  "Medical appointment",
                  "Dialysis",
                  "Physical & Occupational therapy",
                  "Post-procedure follow-up",
                  "Other medical visit",
                ].map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => setProcedureType(opt)}
                    style={[
                      styles.input,
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        borderColor: procedureType === opt ? TEAL : BORDER,
                        backgroundColor: procedureType === opt ? "#E0F7F5" : WHITE,
                      },
                    ]}
                  >
                    <View
                      style={{
                        width: 20, height: 20, borderRadius: 10,
                        borderWidth: 2,
                        borderColor: procedureType === opt ? TEAL : BORDER,
                        alignItems: "center", justifyContent: "center",
                      }}
                    >
                      {procedureType === opt && (
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: TEAL }} />
                      )}
                    </View>
                    <Text style={{ fontSize: 14, fontFamily: "System", color: procedureType === opt ? NAVY : MUTED, fontWeight: procedureType === opt ? "600" : "400" }}>
                      {opt}
                    </Text>
                  </Pressable>
                ))}
              </View>"""

if old_proc in c:
    c = c.replace(old_proc, new_proc)
    print('1a. Ride reason dropdown added')
else:
    print('1a. Procedure pattern NOT found')

# 1b. Remove LOI section
loi_start = '              <Text style={styles.label}>Letter of Medical Necessity (optional)</Text>'
loi_end = '              </Pressable>\n\n              {facilityType === "dialysis" && ('
idx_s = c.find(loi_start)
idx_e = c.find(loi_end)
if idx_s > -1 and idx_e > -1:
    c = c[:idx_s] + '\n              {facilityType === "dialysis" && (' + c[idx_e + len(loi_end):]
    print('1b. LOI section removed')
else:
    print('1b. LOI NOT found')

# 1c. Remove DocumentPicker import
c = c.replace('import * as DocumentPicker from "expo-document-picker";\n', '')
print('1c. DocumentPicker import removed')

# 1d. Past-date validation
old_val = '    if (!surgeryDate) return "Please select date";'
new_val = '    if (!surgeryDate) return "Please select date";\n    const todayCheck = new Date();\n    todayCheck.setHours(0, 0, 0, 0);\n    if (surgeryDate < todayCheck) return "Please select today or a future date";'
if old_val in c:
    c = c.replace(old_val, new_val)
    print('1d. Past-date validation added')
else:
    print('1d. Validate pattern NOT found')

# 1e. Date defaults to today
c = c.replace(
    'const [dateMonth, setDateMonth] = useState("");',
    'const [dateMonth, setDateMonth] = useState(String(new Date().getMonth() + 1));'
)
c = c.replace(
    'const [dateDay, setDateDay] = useState("");',
    'const [dateDay, setDateDay] = useState(String(new Date().getDate()));'
)
c = c.replace(
    'const [dateYear, setDateYear] = useState("");',
    'const [dateYear, setDateYear] = useState(String(new Date().getFullYear()));'
)
print('1e. Date defaults to today')

# 1f. Labels
c = c.replace('return "Please enter the procedure or visit type"', 'return "Please select a ride reason"')
c = c.replace('<SummaryRow label="Procedure" value={procedureType} />', '<SummaryRow label="Ride reason" value={procedureType} />')
print('1f. Labels updated')

# 1g. Remove LMN state vars
c = c.replace('  const [lmnNotes, setLmnNotes] = useState("");\n', '')
c = c.replace('  const [lmnImageUri, setLmnImageUri] = useState<string | null>(null);\n', '')
c = c.replace('  const [uploadingLmn, setUploadingLmn] = useState(false);\n', '')
print('1g. LMN state vars removed')

open(br, 'w').write(c)
print('book-ride.tsx saved')

# ═══════════════════════════════════════════════════════
# 2. SETTINGS.TSX
# ═══════════════════════════════════════════════════════
st = os.path.join(APP, 'app', 'settings.tsx')
c = open(st).read()

# 2a0. Add Alert to imports
c = c.replace(
    '  ActivityIndicator,\n  Image,',
    '  ActivityIndicator,\n  Alert,\n  Image,'
)
print('2a0. Alert import added')

# 2a. Notification preferences
c = c.replace(
    'sub="Texts, email, and push"',
    'sub="Push notifications"'
)
c = c.replace(
    'onPress={comingSoon("Notification preferences")}',
    "onPress={() => Alert.alert('Notifications', 'Push notifications are enabled. You will receive ride updates, pickup reminders, and receipt notifications.')}"
)
print('2a. Notification preferences updated')

# 2b. Help email
c = c.replace('support@carevoy.co', 'contact@carevoy.co')
print('2b. Help email -> contact@carevoy.co')

# 2c. Chat with coordinator
c = c.replace(
    'onPress={comingSoon("Chat with care coordinator")}',
    'onPress={() => { const { Linking } = require("react-native"); Linking.openURL("mailto:partners@carevoy.co?subject=CareVoy%20Support%20Request"); }}'
)
c = c.replace(
    'label="Chat with care coordinator"',
    'label="Contact care coordinator"\n            sub="partners@carevoy.co"'
)
print('2c. Chat -> Contact coordinator email')

# 2d. Delete Account before Sign Out
old_signout = '          <MenuRow\n            icon="log-out"\n            label={signingOut ? "Signing out\\u2026" : "Sign Out"}\n            onPress={signingOut ? () => {} : handleSignOut}\n            destructive\n          />'

delete_plus_signout = """          <MenuRow
            icon="trash-2"
            label="Delete Account"
            sub="Permanently remove your data"
            onPress={() => Alert.alert(
              "Delete Account",
              "This will permanently delete your account and all associated data. This action cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: async () => {
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session) {
                      await supabase.from("patients").delete().eq("id", session.user.id);
                      await supabase.auth.signOut();
                    }
                    router.replace("/");
                  } catch { Alert.alert("Error", "Please contact contact@carevoy.co to delete your account."); }
                }}
              ]
            )}
            destructive
          />
          <View style={styles.divider} />
          <MenuRow
            icon="log-out"
            label={signingOut ? "Signing out\\u2026" : "Sign Out"}
            onPress={signingOut ? () => {} : handleSignOut}
            destructive
          />"""

if old_signout in c:
    c = c.replace(old_signout, delete_plus_signout)
    print('2d. Delete Account added')
else:
    print('2d. Sign out pattern NOT found')

# 2e. Version
c = c.replace('CareVoy \xb7 v1.0', 'CareVoy \xb7 v1.1.1')
print('2e. Version -> v1.1.1')

open(st, 'w').write(c)
print('settings.tsx saved')

# ═══════════════════════════════════════════════════════
# 3. CARE CONTEXT — ride status on login
# ═══════════════════════════════════════════════════════
cc = os.path.join(APP, 'lib', 'careContext.tsx')
c = open(cc).read()

old_ref = '    setSelfPatientId(userId);'
new_ref = """    setSelfPatientId(userId);

    // Update rides matching this phone to app_downloaded
    try {
      const phone = session?.user?.phone;
      if (phone) {
        await supabase
          .from("rides")
          .update({ status: "app_downloaded" })
          .eq("contact_phone", phone)
          .eq("status", "invited");
      }
    } catch {}"""

if old_ref in c and 'app_downloaded' not in c:
    c = c.replace(old_ref, new_ref)
    print('3. careContext: app_downloaded on login')
else:
    print('3. careContext: already has it or pattern not found')

open(cc, 'w').write(c)

# ═══════════════════════════════════════════════════════
# 4. APP.JSON
# ═══════════════════════════════════════════════════════
aj = os.path.join(APP, 'app.json')
a = json.load(open(aj))
a['expo']['version'] = '1.1.1'
a['expo']['ios']['buildNumber'] = '46'
a['expo']['updates'] = {
    'url': 'https://u.expo.dev/f70bca6e-82e7-4cea-8455-4d6077dcb765',
    'fallbackToCacheTimeout': 0
}
a['expo']['runtimeVersion'] = {'policy': 'appVersion'}
a['expo']['ios']['infoPlist']['NSUserNotificationsUsageDescription'] = 'CareVoy sends you ride updates, pickup reminders, and receipt notifications.'
json.dump(a, open(aj, 'w'), indent=2)
print('4. app.json updated')

# ═══════════════════════════════════════════════════════
# 5. EAS.JSON
# ═══════════════════════════════════════════════════════
ej = os.path.join(APP, 'eas.json')
e = json.load(open(ej))
e['build']['production']['channel'] = 'production'
json.dump(e, open(ej, 'w'), indent=2)
print('5. eas.json updated')

# ═══════════════════════════════════════════════════════
# COMMIT
# ═══════════════════════════════════════════════════════
for cmd in [
    'git add artifacts/carevoy/',
    'git commit -m "feat: Build 46 — ride dropdown, delete account, notifications, date default, app_downloaded"',
    'git push origin main'
]:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print(r.stdout.strip() or r.stderr.strip())

print('')
print('ALL DONE. Next in Codespaces:')
print('  cd /workspaces/CareVoy/artifacts/carevoy')
print('  npx expo install expo-updates expo-notifications')
print('  eas build --platform ios --profile production')
print('  eas submit --platform ios --latest')
