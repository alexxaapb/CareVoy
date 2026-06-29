import os, subprocess

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')
results = []

# ===== 1. patients.html - fix broken KEY, use single clean key =====
pf = os.path.join(PP, 'patients.html')
pc = open(pf).read()

# Fix the broken placeholder key line
pc = pc.replace(
    "const KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5ZmxwY2tiampdifQ.placeholder';",
    "const KEY  = 'sb_publishable_mwR5uT4W3C2M-K5LbBag4g_GdN0plrT';"
)
# Fix createClient to use KEY variable not hardcoded string
pc = pc.replace(
    "const sb = createClient(SUPA, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5ZmxwY2tiamptdXh4anF4b3BsayIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzM2NDQ1MDc5LCJleHAiOjIwNTIwMjEwNzl9.P-XF-fO8ERnQjKR4bdyEXBKNLSXc_z9-vD6c90X3vXY');",
    "const sb = createClient(SUPA, KEY);"
)
# Fix empty Anthropic key - route to proxy instead
pc = pc.replace(
    "headers: { 'Content-Type': 'application/json', 'x-api-key': '', 'anthropic-version': '2023-06-01' },",
    "headers: { 'Content-Type': 'application/json' },"
)
pc = pc.replace(
    "body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:600,\n        system:'You are CareVoy\\'s AI care coordinator. Help patients with their medical rides, HSA/FSA reimbursement, and receipts. Keep answers brief and friendly. If asked about rides, remind patients to check the Rides tab.',\n        messages:[{role:'user',content:msg}] })",
    "body: JSON.stringify({ message: msg, context: 'patient' })"
)
pc = pc.replace(
    "const res  = await fetch('https://api.anthropic.com/v1/messages', {",
    "const res  = await fetch(API + '/api/chat', {"
)
pc = pc.replace(
    "    const data = await res.json();\n    const reply = data.content?.[0]?.text || 'I\\'m sorry, I couldn\\'t get a response. Please try again.';",
    "    const data = await res.json();\n    const reply = data.reply || 'I\\'m sorry, I couldn\\'t get a response right now. Please try again.';"
)
open(pf,'w').write(pc)
# Verify
pc2 = open(pf).read()
print("1. patients.html KEY fixed:", 'sb_publishable' in pc2 and 'placeholder' not in pc2)
print("   createClient uses KEY:", "createClient(SUPA, KEY)" in pc2)
print("   chat uses proxy:", "API + '/api/chat'" in pc2)

# ===== 2. coordinator.html - fix logo from img to inline SVG =====
cf = os.path.join(PP, 'coordinator.html')
cc = open(cf).read()
LOGO_B64 = 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDI0IDEwMjQiPjxyZWN0IHdpZHRoPSIxMDI0IiBoZWlnaHQ9IjEwMjQiIGZpbGw9IiMwNjBEMUYiLz48ZyB0cmFuc2Zvcm09InRyYW5zbGF0ZSgzMjAuMzQgNjkxLjk1KSBzY2FsZSgwLjUwOTEgLTAuNTA5MSkiPjxwYXRoIGQ9Ik0zODMgNzEyUTUxNSA3MTIgNjA1LjAgNjQxLjVRNjk1IDU3MSA3MjEgNDUwSDUxMFE0OTEgNDkwIDQ1Ny41IDUxMS4wUTQyNCA1MzIgMzgwIDUzMlEzMTIgNTMyIDI3MS41IDQ4My41UTIzMSA0MzUgMjMxIDM1NFEyMzEgMjcyIDI3MS41IDIyMy41UTMxMiAxNzUgMzgwIDE3NVE0MjQgMTc1IDQ1Ny41IDE5Ni4wUTQ5MSAyMTcgNTEwIDI1N0g3MjFRNjk1IDEzNiA2MDUuMCA2NS41UTUxNSAtNSAzODMgLTVRMjc5IC01IDE5OS4wIDQwLjVRMTE5IDg2IDc1LjUgMTY3LjVRMzIgMjQ5IDMyIDM1NFEzMiA0NTggNzUuNSA1MzkuNVExMTkgNjIxIDE5OS4wIDY2Ni41UTI3OSA3MTIgMzgzIDcxMloiIGZpbGw9IiNGRkZGRkYiLz48L2c+PHBhdGggZD0iTSA3NTguMjAgNTU1LjQxIEEgMjUwIDI1MCAwIDEgMSA3NTguMjAgNDY4LjU5IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMEMyQTgiIHN0cm9rZS13aWR0aD0iMjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxjaXJjbGUgY3g9Ijc1OC4yMCIgY3k9IjU1NS40MSIgcj0iMTciIGZpbGw9IiNGNUE2MjMiLz48Y2lyY2xlIGN4PSI3NTguMjAiIGN5PSI0NjguNTkiIHI9IjE3IiBmaWxsPSIjRjVBNjIzIi8+PC9zdmc+'
INLINE_SVG = '<svg width="28" height="28" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style="border-radius:6px;flex-shrink:0"><rect width="1024" height="1024" fill="#060D1F"/><g transform="translate(320.34 691.95) scale(0.5091 -0.5091)"><path d="M383 712Q515 712 605.0 641.5Q695 571 721 450H510Q491 490 457.5 511.0Q424 532 380 532Q312 532 271.5 483.5Q231 435 231 354Q231 272 271.5 223.5Q312 175 380 175Q424 175 457.5 196.0Q491 217 510 257H721Q695 136 605.0 65.5Q515 -5 383 -5Q279 -5 199.0 40.5Q119 86 75.5 167.5Q32 249 32 354Q32 458 75.5 539.5Q119 621 199.0 666.5Q279 712 383 712Z" fill="#FFFFFF"/></g><path d="M 758.20 555.41 A 250 250 0 1 1 758.20 468.59" fill="none" stroke="#00C2A8" stroke-width="22" stroke-linecap="round"/><circle cx="758.20" cy="555.41" r="17" fill="#F5A623"/><circle cx="758.20" cy="468.59" r="17" fill="#F5A623"/></svg>'
old_img = f'<img src="data:image/svg+xml;base64,{LOGO_B64}" width="28" height="28" style="border-radius:6px;flex-shrink:0">'
if old_img in cc:
    cc = cc.replace(old_img, INLINE_SVG)
    open(cf,'w').write(cc)
    print("2. Coordinator logo: img -> inline SVG (same as admin)")
else:
    print("2. Logo already fixed or pattern mismatch")

# ===== 3. /api/chat.js endpoint =====
chat_js = """const Anthropic = require('@anthropic-ai/sdk');
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ error: 'Missing message' });
    const system = context === 'patient'
      ? "You are CareVoy's AI care coordinator. Help patients with medical rides, HSA/FSA reimbursement, and receipts. Be brief and warm. If they ask about specific rides, tell them to check the Rides tab."
      : "You are CareVoy's assistant for healthcare coordinators. Help with ride coordination and platform questions. Be concise.";
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 600, system, messages: [{ role: 'user', content: message }] });
    return res.status(200).json({ success: true, reply: response.content?.[0]?.text || '' });
  } catch(e) { return res.status(500).json({ error: e.message }); }
};
"""
open(os.path.join(REPO,'api-server','api','chat.js'),'w').write(chat_js)
print("3. /api/chat.js created")

print()
for cmd in [
    ['git','-C',REPO,'add','partners-portal/patients.html','partners-portal/coordinator.html','api-server/api/chat.js'],
    ['git','-C',REPO,'commit','-m','fix: patients key, coordinator logo, chat proxy endpoint'],
    ['git','-C',REPO,'push','origin','main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout+r.stderr).strip()[:200] or "(ok)")
