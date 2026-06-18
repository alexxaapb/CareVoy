import os, subprocess

REPO = '/workspaces/CareVoy'
ep = os.path.join(REPO, 'api-server', 'api', 'invites', 'send-sms.js')
c = open(ep).read()
orig = c

# Replace the single hardcoded message with known-vs-new patient logic
old = """    const { phone, patient_name, facility, ride_id } = req.body;
    if (!phone) return res.status(400).json({ error: 'Missing phone' });

    const appLink = 'https://apps.apple.com/us/app/carevoy/id6768714735';
    const message = (facility || 'Your care team') + ' has scheduled an appointment for ' + (patient_name || 'you') + '. Download CareVoy to book your ride and get your HSA/FSA receipt: ' + appLink;"""

new = """    const { phone, patient_name, facility, ride_id, known_patient } = req.body;
    if (!phone) return res.status(400).json({ error: 'Missing phone' });

    const downloadLink = 'https://apps.apple.com/us/app/carevoy/id6768714735';
    // Deep link opens the app straight to booking for returning patients.
    const openLink = 'https://carevoy.co/book';
    const who = facility || 'Your care team';
    const name = patient_name || 'you';

    let message;
    if (known_patient) {
      // Returning patient: already has the app + a session. No download, no OTP.
      message = who + ' has scheduled an appointment for ' + name +
        '. Open CareVoy to book your ride: ' + openLink;
    } else {
      // New patient: download flow.
      message = who + ' has scheduled an appointment for ' + name +
        '. Download CareVoy to book your ride and get your HSA/FSA receipt: ' + downloadLink;
    }"""

if old in c:
    c = c.replace(old, new)
    open(ep, 'w').write(c)
    print("1. send-sms now picks known-patient vs new-patient message")
else:
    print("1. FAILED to find the message block - manual check needed")
    print("   (endpoint may have changed)")

cmds = [
    'rm -f part3d_known_patient_sms.py',
    'git add api-server/api/invites/send-sms.js',
    'git commit -m "feat: dual SMS templates - returning patients get open-app link, new get download (Part 3D)"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
