import subprocess, os

c = open('/workspaces/CareVoy/api-server/api/invite/accept.js').read()

c = c.replace(
    "if (!invite_token || !uid || !role)",
    "if (!invite_token || !role || !email)"
)
c = c.replace(
    "const { invite_token, role, uid, full_name, email, hospital_id, nemt_partner_id, company_name, city, state, job_title } = req.body;",
    "const { invite_token, role, uid, full_name, email, password, hospital_id, nemt_partner_id, company_name, city, state, job_title } = req.body;"
)

marker = "if (!invite_token || !role || !email) return res.status(400).json({ error: 'Missing required fields' });"
injection = "\n\n    let finalUid = uid;\n    if (!finalUid) {\n      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });\n      if (createErr) return res.status(400).json({ error: createErr.message });\n      finalUid = newUser.user.id;\n    }"
c = c.replace(marker, marker + injection)

c = c.replace("id: uid,", "id: finalUid,")
c = c.replace("used_by: uid }", "used_by: finalUid }")
c = c.replace("actor_id: uid,", "actor_id: finalUid,")
c = c.replace("entity_id: uid,", "entity_id: finalUid,")

open('/workspaces/CareVoy/api-server/api/invite/accept.js', 'w').write(c)
print('accept.js updated, finalUid count:', c.count('finalUid'))

for cmd in ['git add api-server/api/invite/accept.js', 'git commit -m "fix: accept.js server-side user creation"', 'git push origin main']:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd='/workspaces/CareVoy')
    print(r.stdout.strip() or r.stderr.strip())
