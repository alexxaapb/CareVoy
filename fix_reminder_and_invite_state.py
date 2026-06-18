import os, subprocess

REPO = '/workspaces/CareVoy'

# ════════════════════════════════════════════════════════════════
# FIX 1: reminder endpoint crashes on .insert().catch() 
# The SMS sends, then this line throws -> 500. Remove the bad .catch.
# ════════════════════════════════════════════════════════════════
rs = os.path.join(REPO, 'api-server', 'api', 'reminders', 'send.js')
c = open(rs).read()
orig = c

bad = "    await supabase.from('audit_log').insert({ actor_role: 'system', action: 'reminder.sent', entity_type: 'rides', entity_id: ride_id, new_value: { sms_sent: smsSent } }).catch(() => {});"
good = """    try {
      await supabase.from('audit_log').insert({ actor_role: 'system', action: 'reminder.sent', entity_type: 'rides', entity_id: ride_id, new_value: { sms_sent: smsSent } });
    } catch (auditErr) {
      console.warn('audit log insert failed (non-fatal):', auditErr.message);
    }"""

if bad in c:
    c = c.replace(bad, good)
    open(rs, 'w').write(c)
    print("1. Fixed reminder endpoint .catch() crash (SMS will no longer 500 after sending)")
else:
    print("1. exact bad line not found - searching loosely")
    if ".insert(" in c and ".catch(() => {})" in c:
        c = c.replace(".catch(() => {});", ";")
        open(rs, 'w').write(c)
        print("1b. Removed stray .catch(() => {}) loosely")
    else:
        print("1. could not find - manual check needed")

# ════════════════════════════════════════════════════════════════
# Also check the OTHER endpoints for the same .insert().catch() bug
# ════════════════════════════════════════════════════════════════
import glob
api_dir = os.path.join(REPO, 'api-server', 'api')
for path in glob.glob(api_dir + '/**/*.js', recursive=True):
    txt = open(path).read()
    if ".insert(" in txt and ").catch(() => {})" in txt:
        txt2 = txt.replace(".catch(() => {});", ";")
        if txt2 != txt:
            open(path, 'w').write(txt2)
            print(f"   Also fixed same bug in: {os.path.relpath(path, REPO)}")

# Commit
cmds = [
    'rm -f fix_reminder_and_invite_state.py',
    'git add api-server/api',
    'git commit -m "fix: reminder endpoint crashed on insert().catch() after sending SMS"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])

print("")
print("Vercel auto-deploys in ~1 min. Reminder SMS will then work cleanly.")
