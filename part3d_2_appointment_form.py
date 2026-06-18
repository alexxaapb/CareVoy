import os, subprocess

REPO = '/workspaces/CareVoy'
f = os.path.join(REPO, 'partners-portal', 'coordinator.html')
c = open(f).read()
orig = c

anchor = """  if (!apptDate) { showErr('Please select appointment date.'); return; }
  if (!apptType) { showErr('Please select appointment type.'); return; }

  // Auto-format phone to E.164 for Twilio
  contactPhone = contactPhone.replace(/[^\\d+]/g, '');"""

replacement = """  if (!apptDate) { showErr('Please select appointment date.'); return; }
  if (!apptType) { showErr('Please select appointment type.'); return; }

  // Auto-format phone to E.164 for Twilio
  contactPhone = contactPhone.replace(/[^\\d+]/g, '');
  if (!contactPhone.startsWith('+')) {
    if (contactPhone.startsWith('1') && contactPhone.length === 11) contactPhone = '+' + contactPhone;
    else if (contactPhone.length === 10) contactPhone = '+1' + contactPhone;
    else contactPhone = '+1' + contactPhone;
  }

  // SMART TIMING: appointment more than 7 days away -> schedule for auto-invite
  // (engine sends SMS ~7 days before). Otherwise fall through to immediate invite.
  var apptDateTime = new Date(apptDate + 'T' + (apptTime || '08:00'));
  var daysOut = (apptDateTime - new Date()) / (1000 * 60 * 60 * 24);
  if (daysOut > 7) {
    btn.disabled = true; btn.textContent = 'Scheduling...';
    var schedRes = await fetch(SUPA + '/rest/v1/scheduled_appointments', {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        hospital_id: coordInfo.hospital_id,
        patient_name: patientName,
        caregiver_name: caregiverName || null,
        contact_phone: contactPhone,
        contact_email: (document.getElementById('patEmail') ? document.getElementById('patEmail').value.trim() : null) || null,
        appointment_at: apptDateTime.toISOString(),
        procedure_type: apptType,
        source: 'form',
        created_by: uid
      })
    });
    if (schedRes.ok) {
      closeAddPatient();
      var d = apptDateTime.toLocaleDateString('en-US', { month:'short', day:'numeric' });
      showToast('Appointment scheduled. CareVoy will auto-invite ~7 days before ' + d, 'ok');
      await loadRides();
      renderPatientTable();
    } else {
      showErr('Could not schedule appointment. Please try again.');
    }
    btn.disabled = false; btn.textContent = 'Send Invite \\u2192';
    return;
  }

  var _phoneAlreadyFormatted = true;"""

if anchor in c:
    c = c.replace(anchor, replacement, 1)
    print("1. Smart timing branch added to submitAddPatient")
else:
    print("1. FAILED to find anchor - NOT writing")

# Modal copy - use plain ASCII only
old_sub = '<div class="modal-sub">The patient or caregiver will receive an SMS to download CareVoy and confirm their ride. CareVoy handles the reminder automatically after 48 hours.</div>'
new_sub = '<div class="modal-sub">Enter the appointment. If it is more than 7 days out, CareVoy automatically invites the patient about 7 days before, no action needed from you. Sooner than that, the invite sends now.</div>'
if old_sub in c:
    c = c.replace(old_sub, new_sub)
    print("2. Modal copy updated")
else:
    print("2. modal sub not found (non-critical)")

if anchor in orig:
    open(f, 'w').write(c)
    print("   coordinator.html written")
    cmds = [
        'rm -f part3d_2_appointment_form.py',
        'git add partners-portal/coordinator.html',
        'git commit -m "feat: coordinator form auto-schedules invites for appts >7 days out (Part 3D)"',
        'git push origin main',
    ]
    for cmd in cmds:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
        print((r.stdout or r.stderr).strip()[:200])
else:
    print("   NOT committing - anchor missing")
