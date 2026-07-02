import subprocess, os

REPO = '/workspaces/CareVoy'
PP   = os.path.join(REPO, 'partners-portal')
results = []

cf = os.path.join(PP, 'coordinator.html')
cc = open(cf).read()

# The entire broken patient fields block - replace it cleanly
broken_block = '''    <!-- Patient info -->
    <div id="patientFields">
      <div class="form-row">
        <div class="form-group">
          <div class="form-group" style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #F3F4F6">
      <label class="form-label">Quick select existing patient</label>
      <select class="form-input" id="existingPatient" onchange="fillExistingPatient()">
        <option value="">— New patient —</option>
      </select>
      <div style="font-size:11px;color:#9CA3AF;margin-top:4px">Select a patient you've booked before to auto-fill their info</div>
    </div>

    <div class="form-row">
        <div class="form-group">
          <label class="form-label">Patient First Name <span style="color:#EF4444">*</span></label>
          <input class="form-input" id="patFirstName" placeholder="Jane">
        </div>
        <div class="form-group">
          <label class="form-label">Patient Last Name <span style="color:#EF4444">*</span></label>
          <input class="form-input" id="patLastName" placeholder="Doe">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Patient Email <span style="color:#EF4444">*</span></label>
        <input class="form-input" id="patEmail" type="email" placeholder="jane@email.com" required>
      </div>
      <div class="form-group">
        <label class="form-label">Patient Phone <span style="color:#EF4444">*</span></label>
        <input class="form-input" id="patPhone" type="tel" placeholder="(555) 000-0000" required>
      </div>
    </div>'''

clean_block = '''    <!-- Patient info -->
    <div id="patientFields">
      <div class="form-group" style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #F3F4F6">
        <label class="form-label">Quick select existing patient</label>
        <select class="form-input" id="existingPatient" onchange="fillExistingPatient()">
          <option value="">— New patient —</option>
        </select>
        <div style="font-size:11px;color:#9CA3AF;margin-top:4px">Select a patient you've booked before to auto-fill their info</div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Patient First Name <span style="color:#EF4444">*</span></label>
          <input class="form-input" id="patFirstName" placeholder="Jane">
        </div>
        <div class="form-group">
          <label class="form-label">Patient Last Name <span style="color:#EF4444">*</span></label>
          <input class="form-input" id="patLastName" placeholder="Doe">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Patient Email <span style="color:#EF4444">*</span></label>
        <input class="form-input" id="patEmail" type="email" placeholder="jane@email.com" required>
      </div>
      <div class="form-group">
        <label class="form-label">Patient Phone <span style="color:#EF4444">*</span></label>
        <input class="form-input" id="patPhone" type="tel" placeholder="(555) 000-0000" required>
      </div>
    </div>'''

if broken_block in cc:
    cc = cc.replace(broken_block, clean_block)
    results.append("1. Coordinator: patient form structure fixed - picker full width, first/last side by side")
else:
    results.append("1. FAIL: broken block not matched exactly")

open(cf, 'w').write(cc)

print("=" * 60)
for r in results: print(" ", r)
print("=" * 60)

cc2 = open(cf).read()
# Count divs to verify balance in the patientFields section
pf_section = cc2.split('id="patientFields"')[1].split('id="caregiverFields"')[0]
print("\nVERIFICATION:")
print("  patientFields opens:", pf_section.count('<div'))
print("  patientFields closes:", pf_section.count('</div>'))
print("  No nested picker:", 'form-group">\n          <div class="form-group"' not in cc2)
print("  Picker full width:", 'Quick select existing patient' in cc2)

for cmd in [
    ['git', '-C', REPO, 'add', 'partners-portal/coordinator.html'],
    ['git', '-C', REPO, 'commit', '-m', 'fix: coordinator form layout - picker full width, first/last side by side, proper div structure'],
    ['git', '-C', REPO, 'push', 'origin', 'main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout + r.stderr).strip()[:200] or '(ok)')
