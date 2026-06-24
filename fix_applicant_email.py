import os, subprocess

REPO = '/workspaces/CareVoy'
np = os.path.join(REPO, 'api-server', 'api', 'notify', 'new-partner.js')
c = open(np).read()

# Add applicant confirmation before the final return
old = "    return res.status(200).json({ success: true, sent, resend_key_set: !!process.env.RESEND_API_KEY });"
new = """    // Confirmation email to the applicant
    if (process.env.RESEND_API_KEY && email) {
      const appType = type === 'nemt' ? 'transport partner' : 'facility partner';
      const confirmHtml = '<div style="font-family:sans-serif;max-width:520px;margin:0 auto">' +
        '<div style="background:#050D1F;padding:20px;border-radius:12px 12px 0 0">' +
        '<span style="color:#00C2A8;font-weight:700;font-size:18px">CareVoy</span></div>' +
        '<div style="background:#fff;border:1px solid #E2E8F0;padding:28px;border-radius:0 0 12px 12px">' +
        '<h2 style="color:#050D1F;font-size:18px;margin:0 0 12px">Application received!</h2>' +
        '<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">Thank you for applying to join CareVoy as a ' + appType + '. We have received your application and will be in touch within 24 hours.</p>' +
        '<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px">Once approved you can log in at:</p>' +
        '<a href="https://partners.carevoy.co" style="display:inline-block;background:#050D1F;color:#00C2A8;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">partners.carevoy.co</a>' +
        '<p style="color:#9CA3AF;font-size:12px;margin-top:24px">Questions? <a href="mailto:partners@carevoy.co" style="color:#00C2A8">partners@carevoy.co</a></p>' +
        '</div></div>';
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'CareVoy <partners@carevoy.co>', to: [email], subject: 'Your CareVoy partner application was received', html: confirmHtml })
        });
      } catch(e) { console.warn('applicant confirm failed:', e.message); }
    }

    return res.status(200).json({ success: true, sent, resend_key_set: !!process.env.RESEND_API_KEY });"""

if old in c:
    c = c.replace(old, new)
    open(np, 'w').write(c)
    print("1. Applicant confirmation email added")
else:
    print("1. FAILED - return statement not found")
    print("   Actual line:", [l for l in c.split('\n') if 'resend_key_set' in l])

cmds = [
    'rm -f fix_applicant_email.py',
    'git add api-server/api/notify/new-partner.js',
    'git commit -m "feat: applicant confirmation email on form submit"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
