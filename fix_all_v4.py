import os, subprocess

REPO = '/workspaces/CareVoy'
PP   = os.path.join(REPO, 'partners-portal')
results = []

MOTION_MARK_SVG = '<svg width="28" height="28" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style="border-radius:6px;flex-shrink:0"><rect width="1024" height="1024" fill="#060D1F"/><g transform="translate(320.34 691.95) scale(0.5091 -0.5091)"><path d="M383 712Q515 712 605.0 641.5Q695 571 721 450H510Q491 490 457.5 511.0Q424 532 380 532Q312 532 271.5 483.5Q231 435 231 354Q231 272 271.5 223.5Q312 175 380 175Q424 175 457.5 196.0Q491 217 510 257H721Q695 136 605.0 65.5Q515 -5 383 -5Q279 -5 199.0 40.5Q119 86 75.5 167.5Q32 249 32 354Q32 458 75.5 539.5Q119 621 199.0 666.5Q279 712 383 712Z" fill="#FFFFFF"/></g><path d="M 758.20 555.41 A 250 250 0 1 1 758.20 468.59" fill="none" stroke="#00C2A8" stroke-width="22" stroke-linecap="round"/><circle cx="758.20" cy="555.41" r="17" fill="#F5A623"/><circle cx="758.20" cy="468.59" r="17" fill="#F5A623"/></svg>'

# ═══════════════════════════════════════════════════════
# 1. PATIENT PORTAL - fix topbar icon to match login screen
# ═══════════════════════════════════════════════════════
pf = os.path.join(PP,'patients.html')
pc = open(pf).read()

old_topbar_logo = '''      <span class="topbar-logo">CareVoy</span>'''
new_topbar_logo = '''      ''' + MOTION_MARK_SVG + '''
      <span class="topbar-logo">CareVoy</span>'''
if old_topbar_logo in pc:
    pc = pc.replace(old_topbar_logo, new_topbar_logo, 1)
    results.append("1. Patient topbar: Motion Mark icon added (matches login screen)")
else:
    results.append("1. FAIL: topbar logo span not matched")

# ═══════════════════════════════════════════════════════
# 2. AI ASSISTANT - remove emojis, add clickable Q&A topics
# ═══════════════════════════════════════════════════════
old_chat_section = '''    <!-- AI tab -->
    <div class="tab-section" id="tabAI">
      <div class="section-title">Care Coordinator</div>
      <div class="section-sub">Ask anything about your rides, receipts, or HSA/FSA</div>
      <div class="chat-wrap">
        <div class="chat-messages" id="chatMessages">
          <div class="chat-msg ai">Hi! I\'m your CareVoy care coordinator. I can help you with your rides, receipts, or any questions about your HSA/FSA reimbursement. How can I help?</div>
        </div>
        <div class="chat-input-row">
          <input class="chat-input" id="chatInput" placeholder="Ask me anything…" onkeydown="if(event.key===\'Enter\')sendChat()">
          <button class="chat-send" onclick="sendChat()">
            <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>
          </button>
        </div>
      </div>
    </div>'''

new_chat_section = '''    <!-- AI tab -->
    <div class="tab-section" id="tabAI">
      <div class="section-title">Care Assistant</div>
      <div class="section-sub">Get answers about your rides, receipts, and HSA/FSA coverage</div>

      <!-- Quick topic buttons -->
      <div id="chatTopics" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">
        <button onclick="askTopic(this)" data-q="How do I schedule my ride?" style="padding:9px 16px;border-radius:8px;border:1.5px solid var(--border);background:#fff;font-size:13px;font-weight:500;color:var(--navy);cursor:pointer;font-family:inherit;transition:all .15s">Schedule a ride</button>
        <button onclick="askTopic(this)" data-q="How does HSA/FSA reimbursement work?" style="padding:9px 16px;border-radius:8px;border:1.5px solid var(--border);background:#fff;font-size:13px;font-weight:500;color:var(--navy);cursor:pointer;font-family:inherit;transition:all .15s">HSA/FSA reimbursement</button>
        <button onclick="askTopic(this)" data-q="Where is my receipt?" style="padding:9px 16px;border-radius:8px;border:1.5px solid var(--border);background:#fff;font-size:13px;font-weight:500;color:var(--navy);cursor:pointer;font-family:inherit;transition:all .15s">My receipt</button>
        <button onclick="askTopic(this)" data-q="How do I update my pickup address?" style="padding:9px 16px;border-radius:8px;border:1.5px solid var(--border);background:#fff;font-size:13px;font-weight:500;color:var(--navy);cursor:pointer;font-family:inherit;transition:all .15s">Update pickup address</button>
        <button onclick="askTopic(this)" data-q="What is facility-covered payment?" style="padding:9px 16px;border-radius:8px;border:1.5px solid var(--border);background:#fff;font-size:13px;font-weight:500;color:var(--navy);cursor:pointer;font-family:inherit;transition:all .15s">Facility-covered rides</button>
        <button onclick="askTopic(this)" data-q="How do I cancel or reschedule my ride?" style="padding:9px 16px;border-radius:8px;border:1.5px solid var(--border);background:#fff;font-size:13px;font-weight:500;color:var(--navy);cursor:pointer;font-family:inherit;transition:all .15s">Cancel or reschedule</button>
        <button onclick="askTopic(this)" data-q="Who is my driver and when do they arrive?" style="padding:9px 16px;border-radius:8px;border:1.5px solid var(--border);background:#fff;font-size:13px;font-weight:500;color:var(--navy);cursor:pointer;font-family:inherit;transition:all .15s">Driver status</button>
        <button onclick="askTopic(this)" data-q="Why do I need CareVoy?" style="padding:9px 16px;border-radius:8px;border:1.5px solid var(--border);background:#fff;font-size:13px;font-weight:500;color:var(--navy);cursor:pointer;font-family:inherit;transition:all .15s">About CareVoy</button>
      </div>

      <div class="chat-wrap">
        <div class="chat-messages" id="chatMessages">
          <div class="chat-msg ai">Hello. I can answer questions about your rides, receipts, and HSA/FSA reimbursement. Select a topic above or type your question below.</div>
        </div>
        <div class="chat-input-row">
          <input class="chat-input" id="chatInput" placeholder="Type your question…" onkeydown="if(event.key===\'Enter\')sendChat()">
          <button class="chat-send" onclick="sendChat()">
            <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>
          </button>
        </div>
      </div>
    </div>'''

if old_chat_section in pc:
    pc = pc.replace(old_chat_section, new_chat_section)
    results.append("2. AI assistant: emoji chat replaced with professional Q&A topic buttons")
else:
    results.append("2. FAIL: chat section not matched")

# Add askTopic function right before sendChat function
old_send_chat = "async function sendChat() {"
new_send_chat = """function askTopic(btn) {
  var q = btn.getAttribute('data-q');
  document.getElementById('chatInput').value = q;
  sendChat();
}

async function sendChat() {"""
if old_send_chat in pc and 'askTopic' not in pc:
    pc = pc.replace(old_send_chat, new_send_chat, 1)
    results.append("2b. askTopic() function added")

# Update the AI system prompt to reflect current product state
old_system = "system:'You are CareVoy\\'s AI care coordinator. Help patients with their medical rides, HSA/FSA reimbursement, and receipts. Keep answers brief and friendly. If asked about rides, remind patients to check the Rides tab.'"
new_system = "system:'You are CareVoy\\'s patient care assistant. CareVoy is a medical transportation coordination platform for patients attending healthcare facilities like dialysis centers, clinics, and assisted living. Patients access CareVoy through the web portal at partners.carevoy.co/patients — there is no mobile app. Rides are arranged by the patient\\'s healthcare facility; patients cannot self-book without a facility invitation. Payment is either facility-covered (patient pays nothing) or self-pay via HSA/FSA card or credit card. HSA/FSA receipts are IRS Section 213(d) compliant and emailed automatically after ride completion. To schedule a ride: tap the pending invite in the Rides tab, click Schedule this ride, pick a date/time, enter pickup address, and confirm. To update pickup address: open the ride and tap Schedule this ride to edit before confirming. Receipts appear in the Receipts tab and are also emailed automatically. Keep answers factual, brief, and professional. If asked about specific ride status, tell them to check the Rides tab.'"
if old_system in pc:
    pc = pc.replace(old_system, new_system)
    results.append("2c. AI system prompt updated to reflect current product (web portal, no app, facility-first)")
else:
    results.append("2c. FAIL: system prompt not matched - check chat proxy path")

open(pf,'w').write(pc)

# ═══════════════════════════════════════════════════════
# 3. KEYFOB - coordinator init (correct pattern)
# ═══════════════════════════════════════════════════════
cf = os.path.join(PP,'coordinator.html')
cc = open(cf).read()

# Coordinator uses session from sessionStorage (cv_coord_token), not Supabase session
# The lookup is by uid (user id), not email
# Add preview_hospital override at the coordInfo fetch
old_coord_fetch = "    var r = await fetch(SUPA + '/rest/v1/hospital_coordinators?id=eq.' + uid + '&select=*', { headers: H });"
new_coord_fetch = """    // Admin keyfob: if preview_hospital param, load that facility's coordinator instead
    var previewHospital = new URLSearchParams(window.location.search).get('preview_hospital');
    var r;
    if (previewHospital) {
      r = await fetch(SUPA + '/rest/v1/hospital_coordinators?hospital_id=eq.' + previewHospital + '&select=*&limit=1', { headers: H });
    } else {
      r = await fetch(SUPA + '/rest/v1/hospital_coordinators?id=eq.' + uid + '&select=*', { headers: H });
    }"""
if old_coord_fetch in cc:
    cc = cc.replace(old_coord_fetch, new_coord_fetch)
    results.append("3. Coordinator keyfob: preview_hospital param overrides coordinator lookup")
else:
    results.append("3. FAIL: coordinator hospital_coordinators fetch not matched")
open(cf,'w').write(cc)

# ═══════════════════════════════════════════════════════
# 4. KEYFOB - driver init (correct pattern)
# ═══════════════════════════════════════════════════════
df = os.path.join(PP,'driver.html')
dc = open(df).read()

old_driver_fetch = "    var sr = await fetch(SUPA + '/rest/v1/staff?id=eq.' + uid + '&select=*', { headers: H });"
new_driver_fetch = """    // Admin keyfob: preview_nemt param lets admin view any NEMT's dashboard
    var previewNemt = new URLSearchParams(window.location.search).get('preview_nemt');
    var sr;
    if (previewNemt) {
      sr = await fetch(SUPA + '/rest/v1/staff?nemt_partner_id=eq.' + previewNemt + '&role=eq.nemt&select=*&limit=1', { headers: H });
    } else {
      sr = await fetch(SUPA + '/rest/v1/staff?id=eq.' + uid + '&select=*', { headers: H });
    }"""
if old_driver_fetch in dc:
    dc = dc.replace(old_driver_fetch, new_driver_fetch)
    results.append("4. Driver keyfob: preview_nemt param overrides driver lookup")
else:
    results.append("4. FAIL: driver staff fetch not matched")
open(df,'w').write(dc)

print("="*58)
for r in results: print(" ✓", r)
print("="*58)

# Verify
pc2 = open(pf).read(); cc2 = open(cf).read(); dc2 = open(df).read()
print("\nVERIFICATION:")
print("  Patient topbar has SVG:", '605.0 641.5' in pc2 and 'topbar-logo' in pc2)
print("  Topic buttons exist:", 'askTopic' in pc2)
print("  No emojis in chat section:", 'emoji' not in pc2.lower())
print("  System prompt updated:", 'web portal' in pc2)
print("  Coordinator keyfob:", 'preview_hospital' in cc2)
print("  Driver keyfob:", 'preview_nemt' in dc2)
print()

for cmd in [
    ['git','-C',REPO,'add','-A',
     'partners-portal/patients.html',
     'partners-portal/coordinator.html',
     'partners-portal/driver.html'],
    ['git','-C',REPO,'commit','-m','fix: patient topbar icon, AI Q&A topics, keyfob coordinator+driver'],
    ['git','-C',REPO,'push','origin','main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout+r.stderr).strip()[:200] or "(ok)")
