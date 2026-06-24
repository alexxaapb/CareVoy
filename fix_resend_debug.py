import os, subprocess

REPO = '/workspaces/CareVoy'
np = os.path.join(REPO, 'api-server', 'api', 'notify', 'new-partner.js')
c = open(np).read()

old = "      if (r.ok) sent = true;\n    }"
new = """      if (r.ok) {
        sent = true;
      } else {
        const errBody = await r.text();
        console.error('Resend error:', r.status, errBody);
      }
    }"""

if old in c:
    c = c.replace(old, new)
    # Also return the error in the response for debugging
    c = c.replace(
        "return res.status(200).json({ success: true, sent });",
        "return res.status(200).json({ success: true, sent, resend_key_set: !!process.env.RESEND_API_KEY });"
    )
    open(np, 'w').write(c)
    print("1. Added Resend error logging + key status to response")

cmds = [
    'rm -f fix_resend_debug.py',
    'git add api-server/api/notify/new-partner.js',
    'git commit -m "debug: log Resend error response + show key status"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:150])
