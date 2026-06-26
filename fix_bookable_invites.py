import os, subprocess, json

REPO = '/workspaces/CareVoy'
APP = os.path.join(REPO, 'artifacts', 'carevoy')
results = []

# ============================================================
# FIX A: book-ride.tsx - accept rideId param, UPDATE instead of INSERT when present
# ============================================================
bf = os.path.join(APP, 'app', 'book-ride.tsx')
bc = open(bf).read()

# A1: add rideId to params type
old_params = 'const params = useLocalSearchParams<{ prefill?: string }>();'
new_params = 'const params = useLocalSearchParams<{ prefill?: string; rideId?: string }>();'
if old_params in bc:
    bc = bc.replace(old_params, new_params)
    results.append("A1. book-ride accepts rideId param")
else:
    results.append("A1. FAILED params not found")

# A2: when rideId present, UPDATE that ride instead of inserting new rows
old_insert = '    const { error: insertErr } = await supabase.from("rides").insert(rows);'
new_insert = '''    let insertErr = null;
    if (params.rideId) {
      // Booking an existing invited ride: update it in place (claim + schedule)
      const first = rows[0] as any;
      const { error } = await supabase
        .from("rides")
        .update({
          pickup_time: first.pickup_time,
          pickup_address: first.pickup_address,
          dropoff_address: first.dropoff_address,
          ride_type: first.ride_type,
          procedure_type: first.procedure_type,
          wheelchair_required: first.wheelchair_required,
          companion_requested: first.companion_requested,
          status: "confirmed",
        })
        .eq("id", params.rideId);
      insertErr = error;
    } else {
      const { error } = await supabase.from("rides").insert(rows);
      insertErr = error;
    }'''
if old_insert in bc:
    bc = bc.replace(old_insert, new_insert)
    results.append("A2. book-ride updates invited ride when rideId present (status->confirmed)")
else:
    results.append("A2. FAILED insert line not found")

open(bf, 'w').write(bc)

# ============================================================
# FIX B: ride-detail.tsx - "Schedule this ride" button for invited/app_downloaded rides
# ============================================================
rf = os.path.join(APP, 'app', 'ride-detail.tsx')
rc = open(rf).read()

# Insert a Schedule button right before the Safety button block
anchor = '''        {/* Safety button */}'''
schedule_btn = '''        {/* Schedule button for invited rides not yet booked */}
        {["invited", "app_downloaded", "reminder_sent", "no_response"].includes(ride.status) ? (
          <Pressable
            onPress={() => router.push(`/book-ride?rideId=${ride.id}&prefill=${encodeURIComponent(JSON.stringify({
              hospital_name: ride.hospital_name || ride.dropoff_address || "",
              procedure_type: ride.procedure_type || "",
            }))}`)}
            style={styles.scheduleBtn}
          >
            <Feather name="calendar" size={16} color="#fff" />
            <Text style={styles.scheduleText}>Schedule this ride</Text>
          </Pressable>
        ) : null}

        {/* Safety button */}'''
if anchor in rc and 'scheduleBtn' not in rc:
    rc = rc.replace(anchor, schedule_btn, 1)
    results.append("B1. ride-detail has 'Schedule this ride' button for invited rides")
else:
    results.append("B1. FAILED anchor not found or already present")

# Add the button styles (append near other styles - find styles.safetyBtn def)
if 'scheduleBtn:' not in rc:
    # insert before safetyBtn style
    style_anchor = '  safetyBtn:'
    style_block = '''  scheduleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#050D1F",
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  scheduleText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  safetyBtn:'''
    if style_anchor in rc:
        rc = rc.replace(style_anchor, style_block, 1)
        results.append("B2. ride-detail schedule button styles added")
    else:
        results.append("B2. FAILED safetyBtn style not found")

open(rf, 'w').write(rc)

# ============================================================
# FIX C: relabel app_downloaded -> "Pending invite" in both screens
# ============================================================
for path, name in [(rf, 'ride-detail'), (os.path.join(APP,'app','(tabs)','index.tsx'),'home')]:
    c = open(path).read()
    changed = False
    # add/replace label for app_downloaded
    if 'app_downloaded:' in c:
        import re
        c2 = re.sub(r'app_downloaded:\s*"[^"]*"', 'app_downloaded: "Pending invite"', c)
        if c2 != c: c = c2; changed = True
    if 'invited:' in c:
        import re
        c2 = re.sub(r'invited:\s*"[^"]*"', 'invited: "Pending invite"', c)
        if c2 != c: c = c2; changed = True
    if changed:
        open(path,'w').write(c)
        results.append(f"C. {name}: invited/app_downloaded label -> 'Pending invite'")

# ============================================================
# Bump build 69 -> 70
# ============================================================
aj = os.path.join(APP, 'app.json')
app = json.load(open(aj))
old = app['expo']['ios'].get('buildNumber')
app['expo']['ios']['buildNumber'] = "70"
json.dump(app, open(aj,'w'), indent=2); open(aj,'a').write('\n')
results.append(f"D. buildNumber {old} -> 70")

for r in results: print(r)

print("\n=== commit + push ===")
for cmd in [
    ['git','-C',REPO,'add','-A','artifacts/carevoy/app'],
    ['git','-C',REPO,'add','artifacts/carevoy/app.json'],
    ['git','-C',REPO,'commit','-m','feat: invited rides bookable via schedule button + relabel, build 70'],
    ['git','-C',REPO,'push','origin','main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    out=(r.stdout+r.stderr).strip()
    print("  " + (out[:200] if out else "(ok)"))
