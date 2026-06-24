import os, subprocess, re

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')

# Use full URL for the icon so it resolves on any subdomain
ICON_IMG = '<img src="https://partners.carevoy.co/carevoy-icon-centered.svg" alt="CareVoy" style="width:40px;height:40px;border-radius:10px">'

for fname in ['nemt-signup.html', 'facility-signup.html']:
    fpath = os.path.join(PP, fname)
    c = open(fpath).read()

    # Fix icon - replace the img tag with correct full URL
    c = re.sub(
        r'<img src="[^"]*carevoy-icon[^"]*"[^>]*>',
        ICON_IMG,
        c
    )
    print(f"1. Icon URL fixed in {fname}")

    # For NEMT only: revert vehicle types back to simple single-select dropdown
    if fname == 'nemt-signup.html':
        old_veh = re.search(r'<select id="vehicleTypes".*?</select>', c, re.DOTALL)
        if old_veh:
            new_veh = '''<select id="vehicleTypes" onchange="showOther(this,'vehicleOther')">
      <option value="">Select primary vehicle type</option>
      <option value="ambulatory">Ambulatory</option>
      <option value="wheelchair">Wheelchair Van</option>
      <option value="stretcher">Stretcher / Gurney</option>
      <option value="sedan">Sedan</option>
      <option value="suv">SUV / Minivan</option>
      <option value="bariatric">Bariatric</option>
      <option value="mixed">Mixed fleet (multiple types)</option>
      <option value="other">Other</option>
    </select>'''
            c = c.replace(old_veh.group(0), new_veh)
            print(f"2. Vehicle types reverted to simple dropdown in {fname}")

        # Fix the JS back to val() not getMultiSelect() for vehicleTypes
        c = c.replace(
            "var vehicles=getMultiSelect('vehicleTypes');",
            "var vehicles=val('vehicleTypes');"
        )
        c = c.replace(
            "vehicle_types:vehicles",
            "vehicle_types:[vehicles]"
        )

    open(fpath, 'w').write(c)
    print(f"   {fname} written")

cmds = [
    'rm -f fix_icon_and_vehicle.py',
    'git add partners-portal/nemt-signup.html partners-portal/facility-signup.html',
    'git commit -m "fix: icon uses full URL, vehicle types reverted to single dropdown"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
