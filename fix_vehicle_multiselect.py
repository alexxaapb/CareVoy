import os, subprocess

REPO = '/workspaces/CareVoy'
nf = os.path.join(REPO, 'partners-portal', 'nemt-signup.html')
nc = open(nf).read()

# Replace single select with multiselect matching states style
old_veh = '''    <label class="fl">Vehicle Types *</label>
    <select id="vehicleTypes" onchange="showOther(this,'vehicleOther')">
      <option value="">Select primary vehicle type</option>
      <option value="ambulatory">Ambulatory</option>
      <option value="wheelchair">Wheelchair Van</option>
      <option value="stretcher">Stretcher / Gurney</option>
      <option value="sedan">Sedan</option>
      <option value="suv">SUV / Minivan</option>
      <option value="bariatric">Bariatric</option>
      <option value="mixed">Mixed fleet (multiple types)</option>
      <option value="other">Other</option>
    </select>
    <div class="other-input" id="vehicleOther">
      <input type="text" id="vehicleOtherVal" placeholder="Please describe your vehicle types"/>
    </div>'''

new_veh = '''    <label class="fl">Vehicle Types * <span style="font-size:10px;color:#9CA3AF;font-weight:400;text-transform:none">(Hold Ctrl/Cmd to select multiple)</span></label>
    <select id="vehicleTypes" multiple style="height:160px;padding:6px;background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:10px;font-size:13px;width:100%">
      <option value="ambulatory">Ambulatory</option>
      <option value="wheelchair">Wheelchair Van</option>
      <option value="stretcher">Stretcher / Gurney</option>
      <option value="sedan">Sedan</option>
      <option value="suv">SUV / Minivan</option>
      <option value="bariatric">Bariatric</option>
    </select>'''

if old_veh in nc:
    nc = nc.replace(old_veh, new_veh)
    print("1. Vehicle types changed to multi-select")
else:
    # Try finding just the select
    import re
    old_sel = re.search(r'<label class="fl">Vehicle Types \*</label>.*?</select>(\s*<div class="other-input"[^>]*>.*?</div>)?', nc, re.DOTALL)
    if old_sel:
        nc = nc[:old_sel.start()] + new_veh + nc[old_sel.end():]
        print("1. Vehicle types changed to multi-select (alt match)")
    else:
        print("1. FAILED - vehicle select not found")

# Fix validation - vehicle types now uses getMultiSelect
nc = nc.replace(
    "vehicles=val('vehicleTypes'),",
    "vehicles=getMultiSelect('vehicleTypes'),"
)
# Fix: vehicles is now an array
nc = nc.replace(
    "if (!company||!first||!last||!email||!phone||!dispatch||!city||!homeState||!yearsOp||!fleet||!weeklyR||!brokers||!software||!vehicles||!hasIns||!password)",
    "if (!company||!first||!last||!email||!phone||!dispatch||!city||!homeState||!yearsOp||!fleet||!weeklyR||!brokers||!software||!password)"
)
nc = nc.replace(
    "if (states.length===0) return showError('Please select at least one service state.');",
    "if (states.length===0) return showError('Please select at least one service state.');\n      if (vehicles.length===0) return showError('Please select at least one vehicle type.');"
)
nc = nc.replace(
    "vehicle_types:[vehicles]",
    "vehicle_types:vehicles"
)
nc = nc.replace(
    "vehicles:vehicles.join(', ')",
    "vehicles:(Array.isArray(vehicles)?vehicles:[vehicles]).join(', ')"
)
print("2. Validation updated for multi-select")

open(nf, 'w').write(nc)

cmds = [
    'rm -f fix_vehicle_multiselect.py',
    'git add partners-portal/nemt-signup.html',
    'git commit -m "feat: NEMT vehicle types now multi-select (matches states UI)"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:150])
