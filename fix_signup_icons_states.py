import os, subprocess, re

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')

# Read the REAL icon from the repo
icon_path = os.path.join(PP, 'carevoy-icon-centered.svg')
REAL_ICON = open(icon_path).read().strip()
print(f"Icon loaded: {len(REAL_ICON)} chars")

# Wrap it for use in HTML (40x40 display size, preserving viewBox)
ICON_HTML = f'<img src="/carevoy-icon-centered.svg" alt="CareVoy" style="width:40px;height:40px;border-radius:10px">'

ALL_STATES = [
    ('AL','Alabama'),('AK','Alaska'),('AZ','Arizona'),('AR','Arkansas'),
    ('CA','California'),('CO','Colorado'),('CT','Connecticut'),('DE','Delaware'),
    ('DC','Washington DC'),('FL','Florida'),('GA','Georgia'),('HI','Hawaii'),
    ('ID','Idaho'),('IL','Illinois'),('IN','Indiana'),('IA','Iowa'),
    ('KS','Kansas'),('KY','Kentucky'),('LA','Louisiana'),('ME','Maine'),
    ('MD','Maryland'),('MA','Massachusetts'),('MI','Michigan'),('MN','Minnesota'),
    ('MS','Mississippi'),('MO','Missouri'),('MT','Montana'),('NE','Nebraska'),
    ('NV','Nevada'),('NH','New Hampshire'),('NJ','New Jersey'),('NM','New Mexico'),
    ('NY','New York'),('NC','North Carolina'),('ND','North Dakota'),('OH','Ohio'),
    ('OK','Oklahoma'),('OR','Oregon'),('PA','Pennsylvania'),('RI','Rhode Island'),
    ('SC','South Carolina'),('SD','South Dakota'),('TN','Tennessee'),('TX','Texas'),
    ('UT','Utah'),('VT','Vermont'),('VA','Virginia'),('WA','Washington'),
    ('WV','West Virginia'),('WI','Wisconsin'),('WY','Wyoming')
]
STATE_OPTS = '\n'.join([f'<option value="{a}">{a} — {n}</option>' for a,n in ALL_STATES])
STATE_SINGLE_OPTS = '\n'.join([f'<option value="{a}">{n}</option>' for a,n in ALL_STATES])

MULTISELECT_STYLE = '''
      select[multiple] {
        height: 160px;
        padding: 6px;
        background: #F8FAFC;
        border: 1.5px solid #E2E8F0;
        border-radius: 10px;
        font-size: 13px;
      }
      select[multiple]:focus { border-color: #00C2A8; background: white; }
      .multiselect-hint { font-size: 11px; color: #9CA3AF; margin-top: 4px; }
'''

for fname, subtitle in [('nemt-signup.html', 'Transport Partner'), ('facility-signup.html', 'Facility Partner')]:
    fpath = os.path.join(PP, fname)
    c = open(fpath).read()

    # 1. Fix the icon - replace whatever logo-icon is there with real img tag
    c = re.sub(
        r'<div class="logo-icon">.*?</div>',
        f'<div class="logo-icon">{ICON_HTML}</div>',
        c, count=1, flags=re.DOTALL
    )
    print(f"  Icon replaced in {fname}")

    # 2. For NEMT: fix service states to match vehicle type (both multiselect)
    if fname == 'nemt-signup.html':
        # Replace the multi-select states (currently has size=8 select)
        old_states = re.search(r'<select id="serviceStates".*?</select>', c, re.DOTALL)
        if old_states:
            new_states = f'''<select id="serviceStates" multiple style="height:160px;padding:6px;background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:10px;font-size:13px;width:100%">
      {STATE_OPTS}
    </select>'''
            c = c.replace(old_states.group(0), new_states)
            print(f"  States multiselect fixed in {fname}")

        # Replace vehicle types single select to also be multiselect for consistency
        old_veh = re.search(r'<select id="vehicleTypes".*?</select>', c, re.DOTALL)
        if old_veh:
            new_veh = '''<select id="vehicleTypes" multiple style="height:160px;padding:6px;background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:10px;font-size:13px;width:100%">
      <option value="ambulatory">Ambulatory</option>
      <option value="wheelchair">Wheelchair Van</option>
      <option value="stretcher">Stretcher / Gurney</option>
      <option value="sedan">Sedan</option>
      <option value="suv">SUV / Minivan</option>
      <option value="bariatric">Bariatric</option>
      <option value="other">Other</option>
    </select>'''
            c = c.replace(old_veh.group(0), new_veh)
            # Remove the old other-input divs for vehicle (no longer needed with multiselect)
            print(f"  Vehicle types now multiselect (matches states) in {fname}")

        # Update the hint text for both
        c = c.replace(
            'Hold Ctrl (Windows) or Cmd (Mac) to select multiple states',
            'Hold Ctrl (Windows) or Cmd (Mac) to select multiple'
        )

        # Fix getMultiSelect usage for vehicleTypes in submitNemt
        c = c.replace(
            "var vehicles=val('vehicleTypes');",
            "var vehicles=getMultiSelect('vehicleTypes');"
        )
        c = c.replace(
            "vehicle_types:[vehicles]",
            "vehicle_types:vehicles"
        )
        c = c.replace(
            "vehicles:vehicles.join(', ')",
            "vehicles:(Array.isArray(vehicles)?vehicles:getMultiSelect('vehicleTypes')).join(', ')"
        )

    # 3. For FACILITY: add note about one location per application
    if fname == 'facility-signup.html':
        old_loc = '<label class="field-label">Number of Locations *</label>'
        new_loc = '''<label class="field-label">Number of Locations *</label>
    <p style="font-size:11px;color:#F5A623;margin-top:4px;margin-bottom:4px">&#9432; If you have multiple locations with different contacts, please submit a separate application for each location.</p>'''
        if old_loc in c and '&#9432;' not in c:
            c = c.replace(old_loc, new_loc)
            print(f"  Multi-location note added to {fname}")

        # Fix state to use all states
        old_state_sel = re.search(r'<select id="state">.*?</select>', c, re.DOTALL)
        if old_state_sel and 'Alabama' not in old_state_sel.group(0):
            new_state = f'<select id="state"><option value="">State</option>\n{STATE_SINGLE_OPTS}\n    </select>'
            c = c.replace(old_state_sel.group(0), new_state)
            print(f"  All 50 states added to facility state dropdown")

    open(fpath, 'w').write(c)
    print(f"  {fname} written")

cmds = [
    'rm -f fix_signup_icons_states.py',
    'git add partners-portal/nemt-signup.html partners-portal/facility-signup.html',
    'git commit -m "fix: real icon from repo, matching multiselect for states+vehicles, facility multi-location note"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
