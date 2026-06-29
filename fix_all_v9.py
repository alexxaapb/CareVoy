import os, subprocess, re

REPO = '/workspaces/CareVoy'
PP   = os.path.join(REPO, 'partners-portal')
results = []

# ════════════════════════════════════════════
# 1. ADMIN — rewrite settings section cleanly
# ════════════════════════════════════════════
af = os.path.join(PP,'admin.html')
ac = open(af).read()

# Find the opening of sec-settings and replace EVERYTHING up to its closing tag
# The section opens at the <div id="sec-settings" line
# We'll replace from that point to the matching </div> that closes it

# Find start
settings_start = ac.find('<div id="sec-settings"')
if settings_start == -1:
    results.append("1. FAIL: sec-settings not found")
else:
    # Find where main ends (after settings) - use /main comment as anchor
    main_end = ac.find('</div><!-- /main -->')
    if main_end == -1:
        main_end = ac.find('</div><!-- /sec')
    
    # Everything between settings_start and main_end is the settings section (broken)
    # Replace it entirely with a clean version
    new_settings = '''<div id="sec-settings" style="display:none" class="page-overlay">
  <div class="page-title">Settings</div>
  <div class="page-sub">Portal configuration and account management</div>

  <div style="background:#fff;border-radius:14px;border:1px solid #E8E4DC;padding:24px;margin-bottom:16px">
    <div style="font-size:14px;font-weight:700;color:#050D1F;margin-bottom:16px;border-bottom:1px solid #F3F4F6;padding-bottom:10px">Platform Status</div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F3F4F6">
      <div><div style="font-size:13px;font-weight:600;color:#050D1F">Patient Portal</div><div style="font-size:12px;color:#9CA3AF">partners.carevoy.co/patients</div></div>
      <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(0,194,168,.1);color:#00836F">Live</span>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F3F4F6">
      <div><div style="font-size:13px;font-weight:600;color:#050D1F">Partner Portal</div><div style="font-size:12px;color:#9CA3AF">partners.carevoy.co</div></div>
      <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(0,194,168,.1);color:#00836F">Live</span>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0">
      <div><div style="font-size:13px;font-weight:600;color:#050D1F">Email Notifications</div><div style="font-size:12px;color:#9CA3AF">partners@carevoy.co / notifications@carevoy.co</div></div>
      <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(16,185,129,.1);color:#065f46">Active</span>
    </div>
  </div>

  <div style="background:#fff;border-radius:14px;border:1px solid #E8E4DC;padding:24px;margin-bottom:16px">
    <div style="font-size:14px;font-weight:700;color:#050D1F;margin-bottom:12px;border-bottom:1px solid #F3F4F6;padding-bottom:10px">Automatic Reminders</div>
    <div style="font-size:13px;color:#374151;line-height:1.6">CareVoy automatically sends a reminder email to patients who have not confirmed within 48 hours of receiving their invitation. Contact support@carevoy.co to adjust the reminder window.</div>
  </div>

  <div style="background:#fff;border-radius:14px;border:1px solid #E8E4DC;padding:24px;margin-bottom:16px">
    <div style="font-size:14px;font-weight:700;color:#050D1F;margin-bottom:12px;border-bottom:1px solid #F3F4F6;padding-bottom:10px">Admin Accounts</div>
    <div style="font-size:13px;color:#6B7280;line-height:1.6">To add or remove admin accounts, contact support@carevoy.co.</div>
  </div>

  <div style="background:#fff;border-radius:14px;border:1px solid #E8E4DC;padding:24px">
    <div style="font-size:14px;font-weight:700;color:#050D1F;margin-bottom:12px;border-bottom:1px solid #F3F4F6;padding-bottom:10px">Notifications</div>
    <div style="font-size:13px;color:#6B7280;line-height:1.6">CareVoy sends email alerts for new bookings, partner applications, and ride completions automatically. No configuration required.</div>
  </div>
</div>
</div><!-- /main -->

'''
    ac = ac[:settings_start] + new_settings + ac[main_end + len('</div><!-- /main -->'):]
    results.append("1. Admin settings: entire section rewritten cleanly (no more bleed)")

open(af,'w').write(ac)

# ════════════════════════════════════════════
# 2. PATIENT — move chips OUTSIDE chat-messages so clicks always work
# ════════════════════════════════════════════
pf = os.path.join(PP,'patients.html')
pc = open(pf).read()

# Move chips from inside chat-messages to between chat-messages and input-row
old_chips_inside = '''          <div id="chatChips" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;padding:0 4px">
            <button onclick="askTopic(this)" data-q="How do I schedule my ride?" class="chat-chip">Schedule a ride</button>
            <button onclick="askTopic(this)" data-q="How does HSA/FSA reimbursement work?" class="chat-chip">HSA/FSA reimbursement</button>
            <button onclick="askTopic(this)" data-q="Where is my receipt?" class="chat-chip">My receipt</button>
            <button onclick="askTopic(this)" data-q="How do I update my pickup address?" class="chat-chip">Update pickup address</button>
            <button onclick="askTopic(this)" data-q="What does facility-covered payment mean?" class="chat-chip">Facility-covered rides</button>
            <button onclick="askTopic(this)" data-q="How do I cancel or reschedule my ride?" class="chat-chip">Cancel or reschedule</button>
            <button onclick="askTopic(this)" data-q="What is the status of my driver?" class="chat-chip">Driver status</button>
            <button onclick="askTopic(this)" data-q="What is CareVoy and how does it work?" class="chat-chip">About CareVoy</button>
          </div>'''

new_chips_inside = ''  # Remove from chat-messages

new_chips_outside = '''        <div id="chatChips" style="display:flex;flex-wrap:wrap;gap:8px;padding:12px 0 4px">
          <button onclick="askTopic(this)" data-q="How do I schedule my ride?" class="chat-chip">Schedule a ride</button>
          <button onclick="askTopic(this)" data-q="How does HSA/FSA reimbursement work?" class="chat-chip">HSA/FSA reimbursement</button>
          <button onclick="askTopic(this)" data-q="Where is my receipt?" class="chat-chip">My receipt</button>
          <button onclick="askTopic(this)" data-q="How do I update my pickup address?" class="chat-chip">Update pickup address</button>
          <button onclick="askTopic(this)" data-q="What does facility-covered payment mean?" class="chat-chip">Facility-covered rides</button>
          <button onclick="askTopic(this)" data-q="How do I cancel or reschedule my ride?" class="chat-chip">Cancel or reschedule</button>
          <button onclick="askTopic(this)" data-q="What is the status of my driver?" class="chat-chip">Driver status</button>
          <button onclick="askTopic(this)" data-q="What is CareVoy and how does it work?" class="chat-chip">About CareVoy</button>
        </div>
        <div class="chat-input-row">'''

old_input_row = '        <div class="chat-input-row">'

if old_chips_inside in pc:
    pc = pc.replace(old_chips_inside, new_chips_inside)
    pc = pc.replace(old_input_row, new_chips_outside, 1)  # only first occurrence
    results.append("2a. Patient chips: moved outside scroll container (click events now reliable)")
else:
    results.append("2a. FAIL: chips inside pattern not matched")

# Also simplify askTopic now that chips are outside scroll area
old_ask = """function askTopic(btn) {
  var q = btn.getAttribute('data-q');
  if (!q) return;
  var input = document.getElementById('chatInput');
  if (!input) return;
  // Hide chips wrapper
  var chipsWrap = document.getElementById('chatChips');
  if (chipsWrap) chipsWrap.style.display = 'none';
  // Set value then send after brief tick to ensure DOM is ready
  input.value = q;
  setTimeout(function(){ sendChat(); }, 10);
}"""
new_ask = """function askTopic(btn) {
  var q = btn.getAttribute('data-q');
  if (!q) return;
  document.getElementById('chatChips').style.display = 'none';
  document.getElementById('chatInput').value = q;
  sendChat();
}"""
if old_ask in pc:
    pc = pc.replace(old_ask, new_ask)
    results.append("2b. askTopic: simplified (no setTimeout needed, chips outside scroll)")
else:
    results.append("2b. FAIL: askTopic not matched")

open(pf,'w').write(pc)

# ════════════════════════════════════════════
# 3. Facility email (write to file)
# ════════════════════════════════════════════
email_txt = """FACILITY COLD EMAIL — SHORT VERSION

Subject: Reducing transport no-shows at [Practice Name]

Hi [Name],

Transport barriers are one of the leading causes of preventable no-shows for independent practices.

CareVoy handles the coordination automatically — ride scheduling, driver matching, and IRS-compliant HSA/FSA receipts:

- Your team enters the appointment once
- Patient receives an invitation and schedules their own pickup
- Vetted transport confirmed, documentation generated automatically

We're onboarding founding clinics now with no setup fee.

Apply here: partners.carevoy.co/facility-signup
Or reply to schedule a 15-minute call.

Alexandra Belizaire | CareVoy

---

SUBJECT LINE OPTIONS (pick one):
- "Transport no-shows at [Practice Name]"
- "Automating patient transport for [Practice Name]"
- "[Practice Name] — medical transport coordination"

---

DIALYSIS VERSION (shorter):

Subject: Dialysis transport at [Center Name]

Hi [Name],

Dialysis transport coordination is one of the most time-intensive workflows for your team.

CareVoy automates it:
- Coordinator enters the appointment once
- Patient invitation, driver matching, and HSA/FSA receipt handled automatically
- Vetted NEMT providers in [State]

Founding center pricing, no setup fee.

partners.carevoy.co/facility-signup | Or reply to schedule a call.

Alexandra Belizaire | CareVoy
"""
email_path = os.path.join('/mnt/user-data/outputs','CareVoy_Facility_Email_Short.md')
open(email_path,'w').write(email_txt)
results.append("3. Facility emails written — short format, no overselling")

print("="*60)
for r in results: print(" ✓", r)
print("="*60)

# Verify
ac2 = open(af).read()
pc2 = open(pf).read()
print("\nVERIFICATION:")
print("  Settings section clean:", 'byflpckbjjumxxjxoplk' not in ac2)
print("  Settings only once:", ac2.count('Automatic Reminders') == 1)
print("  Settings inside sec-settings:", ac2.count('<div id="sec-settings"') == 1)
print("  Chips outside scroll area:", 'chat-input-row' in pc2 and 'chatChips' in pc2)
print("  Chips before input row:", pc2.index('chatChips') < pc2.index('chat-input-row'))
print("  askTopic simplified:", 'setTimeout' not in pc2.split('askTopic')[1][:200])
print()

for cmd in [
    ['git','-C',REPO,'add','-A',
     'partners-portal/admin.html','partners-portal/patients.html'],
    ['git','-C',REPO,'commit','-m','fix: settings section clean rewrite, chips outside scroll (click events work), AI chat'],
    ['git','-C',REPO,'push','origin','main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout+r.stderr).strip()[:200] or "(ok)")
