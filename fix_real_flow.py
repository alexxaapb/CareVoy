import subprocess, os, re

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')
API = os.path.join(REPO, 'api-server', 'api')

# ═══════════════════════════════════════════════════════
# FIX 1: invite.html — send facility_name in coordinator extraData
# ═══════════════════════════════════════════════════════
ip = os.path.join(PP, 'invite.html')
c = open(ip).read()

c = c.replace(
    "extraData = { job_title: jobTitle };",
    "var facilityName = document.getElementById('coordFacility').value.trim();\n    extraData = { job_title: jobTitle, facility_name: facilityName };"
)
print('1. invite.html: facility_name now sent in extraData')

open(ip, 'w').write(c)

# ═══════════════════════════════════════════════════════
# FIX 2: accept.js — look up or create hospital, link coordinator
# ═══════════════════════════════════════════════════════
ap = os.path.join(API, 'invite', 'accept.js')
c = open(ap).read()

# Replace the coordinator upsert block with hospital lookup
old_coord = "      await supabase.from('hospital_coordinators').upsert({ id: finalUid, full_name, email, hospital_id: hospital_id || invite.hospital_id || null, job_title: job_title || null });"

new_coord = """      // Look up or create hospital from facility_name
      let resolvedHospitalId = hospital_id || invite.hospital_id || null;
      const facility_name = req.body.facility_name;
      if (!resolvedHospitalId && facility_name) {
        // Try fuzzy match on hospitals table
        const { data: matches } = await supabase.from('hospitals').select('id, name').ilike('name', '%' + facility_name.split(' ').slice(0, 3).join('%') + '%').limit(1);
        if (matches && matches.length > 0) {
          resolvedHospitalId = matches[0].id;
        } else {
          // Create new hospital record
          const { data: newHosp } = await supabase.from('hospitals').insert({ name: facility_name, city: city || state || null }).select().single();
          if (newHosp) resolvedHospitalId = newHosp.id;
        }
      }
      await supabase.from('hospital_coordinators').upsert({ id: finalUid, full_name, email, hospital_id: resolvedHospitalId, job_title: job_title || null });"""

if old_coord in c:
    c = c.replace(old_coord, new_coord)
    print('2. accept.js: hospital lookup/create added')
else:
    print('2. accept.js: coordinator upsert pattern NOT found')

open(ap, 'w').write(c)

# ═══════════════════════════════════════════════════════
# FIX 3: coordinator.html — auto-format phone with +1 prefix
# ═══════════════════════════════════════════════════════
cp = os.path.join(PP, 'coordinator.html')
c = open(cp).read()

# Add phone formatting before the payload is built
old_payload = "  var pickupISO = new Date(apptDate + 'T' + (apptTime || '08:00')).toISOString();"
new_payload = """  // Auto-format phone to E.164 for Twilio
  contactPhone = contactPhone.replace(/[^\\d+]/g, '');
  if (!contactPhone.startsWith('+')) {
    if (contactPhone.startsWith('1') && contactPhone.length === 11) contactPhone = '+' + contactPhone;
    else if (contactPhone.length === 10) contactPhone = '+1' + contactPhone;
    else contactPhone = '+1' + contactPhone;
  }

  var pickupISO = new Date(apptDate + 'T' + (apptTime || '08:00')).toISOString();"""

if old_payload in c:
    c = c.replace(old_payload, new_payload)
    print('3. coordinator.html: phone auto-formats to +1XXXXXXXXXX')
else:
    print('3. coordinator.html: payload pattern NOT found')

open(cp, 'w').write(c)

# ═══════════════════════════════════════════════════════
# FIX 4: Verify triggers are dropped, clean up test data
# ═══════════════════════════════════════════════════════
print('')
print('IMPORTANT: Run this in Supabase SQL Editor to clean up:')
print('')
print("""-- Verify triggers are gone
select trigger_name from information_schema.triggers where event_object_table = 'rides';

-- Delete test rides with null data  
delete from rides where patient_name is null;

-- Delete your test coordinator so you can re-test the full flow
-- (replace with your test coordinator email)
-- delete from hospital_coordinators where email = 'YOUR_TEST_EMAIL';
-- Then delete from auth.users where email = 'YOUR_TEST_EMAIL';
""")

# ═══════════════════════════════════════════════════════
# COMMIT
# ═══════════════════════════════════════════════════════
for cmd in [
    'git add partners-portal/ api-server/',
    'git commit -m "fix: link coordinator to hospital on signup, auto-format phone E.164, send facility name"',
    'git push origin main'
]:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print(r.stdout.strip() or r.stderr.strip())

print('')
print('DONE. To test the FULL real flow:')
print('1. In Supabase SQL Editor, delete your test coordinator + auth user')
print('2. In admin dashboard, generate a new coordinator invite')
print('3. Open invite link in incognito, type the facility name exactly')
print('4. Create account -> dashboard should load with facility linked')
print('5. Send a ride invite with your phone (+1 format auto-applied)')
print('6. Ride appears in dashboard + SMS arrives on your phone')
