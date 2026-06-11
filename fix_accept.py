import subprocess

fix = """
c = open('api-server/api/invite/accept.js').read()

old = "    const { invite_token, role, uid, full_name, email, hospital_id, nemt_partner_id, company_name, city, state, job_title } = req.body;\\n    if (!invite_token || !uid || !role) return res.status(400).json({ error: 'Missing required fields' });"

new = """    const { invite_token, role, uid, full_name, email, password, hospital_id, nemt_partner_id, company_name, city, state, job_title } = req.body;
    if (!invite_token || !role || !email) return res.status(400).json({ error: 'Missing required fields' });

    // Create user server-side to bypass email confirmation
    let finalUid = uid;
    if (!finalUid) {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
      if (createErr) return res.status(400).json({ error: createErr.message });
      finalUid = newUser.user.id;
    }"""

if old in c:
    c = c.replace(old, new)
    c = c.replace("id: uid,", "id: finalUid,")
    c = c.replace("used_by: uid }", "used_by: finalUid }")
    c = c.replace("actor_id: uid,", "actor_id: finalUid,")
    c = c.replace("entity_id: uid,", "entity_id: finalUid,")
    open('api-server/api/invite/accept.js','w').write(c)
    print('accept.js updated')
else:
    print('pattern not found, trying alternate...')
    # Try direct rewrite of just the validation line
    c = c.replace(
        "if (!invite_token || !uid || !role)",
        "if (!invite_token || !role || !email)"
    )
    # Add user creation after the validation
    c = c.replace(
        "if (!invite_token || !role || !email) return res.status(400).json({ error: 'Missing required fields' });",
        """if (!invite_token || !role || !email) return res.status(400).json({ error: 'Missing required fields' });

    let finalUid = uid;
    if (!finalUid) {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
      if (createErr) return res.status(400).json({ error: createErr.message });
      finalUid = newUser.user.id;
    }"""
    )
    c = c.replace("id: uid,", "id: finalUid,")
    c = c.replace("used_by: uid }", "used_by: finalUid }")
    c = c.replace("actor_id: uid,", "actor_id: finalUid,")
    c = c.replace("entity_id: uid,", "entity_id: finalUid,")
    open('api-server/api/invite/accept.js','w').write(c)
    print('alternate fix applied')
"""

# Write the fix script
open('/workspaces/CareVoy/fix_accept.py', 'w').write(fix)
print('Running fix...')
result = subprocess.run(['python3', '/workspaces/CareVoy/fix_accept.py'], capture_output=True, text=True, cwd='/workspaces/CareVoy')
print(result.stdout)
print(result.stderr)

# Git commit
cmds = [
    'git add api-server/api/invite/accept.js partners-portal/invite.html',
    'git commit -m "fix: accept.js creates user server-side, bypass email confirmation"',
    'git push origin main'
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd='/workspaces/CareVoy')
    print(r.stdout or r.stderr)

# Cleanup
import os
os.remove('/workspaces/CareVoy/fix_accept.py')
print('Done!')
