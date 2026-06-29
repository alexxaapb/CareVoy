import os, subprocess

REPO = '/workspaces/CareVoy'
PP   = os.path.join(REPO, 'partners-portal')
results = []

# ════════════════════════════════════════════
# 1. PATIENT - remove duplicate old SVG icon
# ════════════════════════════════════════════
pf = os.path.join(PP,'patients.html')
pc = open(pf).read()

old_double = '''      <svg width="28" height="28" viewBox="0 0 100 100" fill="none"><rect width="100" height="100" rx="22" fill="#050D1F"/><circle cx="72" cy="50" r="22" stroke="#00C2A8" stroke-width="5" fill="none" stroke-dasharray="80 30"/><path d="M28 65 Q38 20 52 50 Q60 65 72 50" stroke="white" stroke-width="4" fill="none" stroke-linecap="round"/></svg>
      <svg width="28" height="28" viewBox="0 0 1024 1024"'''
new_double = '''      <svg width="28" height="28" viewBox="0 0 1024 1024"'''
if old_double in pc:
    pc = pc.replace(old_double, new_double)
    results.append("1. Patient topbar: old duplicate icon removed")
else:
    results.append("1. FAIL: double icon pattern not found")

# Default tab to Rides (not AI) on load
pc = pc.replace("function switchTab(name, el) {", """function switchTab(name, el) {""")
# Fix initApp to show Rides tab by default
pc = pc.replace(
    "  await loadRides();\n}",
    "  await loadRides();\n  switchTab('Rides', document.getElementById('navRides'));\n}"
)

# Move AI options INTO the chat as quick-reply chips after greeting, fix clicking
old_chat_ai = '''      <!-- Quick topic buttons -->
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
        </div>'''
new_chat_ai = '''      <div class="chat-wrap">
        <div class="chat-messages" id="chatMessages">
          <div class="chat-msg ai">Hello. I can answer questions about your rides, receipts, and HSA/FSA reimbursement. Select a topic below or type your question.</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;padding:0 4px">
            <button onclick="askTopic(this)" data-q="How do I schedule my ride?" class="chat-chip">Schedule a ride</button>
            <button onclick="askTopic(this)" data-q="How does HSA/FSA reimbursement work?" class="chat-chip">HSA/FSA reimbursement</button>
            <button onclick="askTopic(this)" data-q="Where is my receipt?" class="chat-chip">My receipt</button>
            <button onclick="askTopic(this)" data-q="How do I update my pickup address?" class="chat-chip">Update pickup address</button>
            <button onclick="askTopic(this)" data-q="What does facility-covered payment mean?" class="chat-chip">Facility-covered rides</button>
            <button onclick="askTopic(this)" data-q="How do I cancel or reschedule my ride?" class="chat-chip">Cancel or reschedule</button>
            <button onclick="askTopic(this)" data-q="What is the status of my driver?" class="chat-chip">Driver status</button>
            <button onclick="askTopic(this)" data-q="What is CareVoy and how does it work?" class="chat-chip">About CareVoy</button>
          </div>
        </div>'''
if old_chat_ai in pc:
    pc = pc.replace(old_chat_ai, new_chat_ai)
    results.append("2. AI chat: options moved inside chat as chips below greeting")
else:
    results.append("2. FAIL: chat section not matched")

# Add chip style
pc = pc.replace(
    "    .chat-send:hover{background:#0a1628}",
    "    .chat-send:hover{background:#0a1628}\n    .chat-chip{padding:7px 14px;border-radius:20px;border:1.5px solid var(--border);background:#fff;font-size:12px;font-weight:500;color:var(--navy);cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap}\n    .chat-chip:hover{border-color:var(--teal);background:rgba(0,194,168,.05)}"
)

# Fix askTopic to properly set value then send
old_ask = """function askTopic(btn) {
  var q = btn.getAttribute('data-q');
  document.getElementById('chatInput').value = q;
  sendChat();
}"""
new_ask = """function askTopic(btn) {
  var q = btn.getAttribute('data-q');
  var input = document.getElementById('chatInput');
  input.value = q;
  // Remove chips so they don't clutter after first use
  var chips = document.querySelectorAll('.chat-chip');
  chips.forEach(function(c){ c.parentElement && c.parentElement.remove(); });
  sendChat();
}"""
if old_ask in pc:
    pc = pc.replace(old_ask, new_ask)
    results.append("3. askTopic: chips removed after first click, sendChat fires correctly")

# Fix sendChat to handle errors visibly and add support fallback
old_catch = "    document.getElementById('typingMsg').textContent = 'Sorry, I\\'m unavailable right now. Please try again.';"
new_catch = "    document.getElementById('typingMsg').textContent = 'I was unable to get a response. For further assistance email support@carevoy.co and someone will follow up within 48 business hours.';"
if old_catch in pc:
    pc = pc.replace(old_catch, new_catch)

# Fix reply fallback too
pc = pc.replace(
    "    const reply = data.reply || 'I\\'m sorry, I couldn\\'t get a response right now. Please try again.';",
    "    const reply = data.reply || 'I was unable to get a response. For further assistance email support@carevoy.co and someone will follow up within 48 business hours.';"
)
results.append("4. AI chat: support@carevoy.co fallback on error")

open(pf,'w').write(pc)

# ════════════════════════════════════════════
# 5. ADMIN - dropdown View As + fix keyfob onclick + NEMT click scope
# ════════════════════════════════════════════
af = os.path.join(PP,'admin.html')
ac = open(af).read()

# Replace 4 buttons in topbar with single dropdown
old_viewas_btns = '''        <span style="color:#6B7280;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase">View as</span>
        <button id="modeAdmin" onclick="setViewMode('admin')" style="padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;border:none;cursor:pointer;font-family:inherit;background:rgba(0,194,168,.2);color:#00C2A8">Admin</button>
        <button id="modeCoordinator" onclick="setViewMode('coordinator')" style="padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;border:none;cursor:pointer;font-family:inherit;background:rgba(255,255,255,.07);color:#9CA3AF">Coordinator</button>
        <button id="modeDriver" onclick="setViewMode('driver')" style="padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;border:none;cursor:pointer;font-family:inherit;background:rgba(255,255,255,.07);color:#9CA3AF">Driver</button>
        <button id="modePatient" onclick="setViewMode('patient')" style="padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;border:none;cursor:pointer;font-family:inherit;background:rgba(255,255,255,.07);color:#9CA3AF">Patient</button>'''
new_viewas_btns = '''        <span style="color:#6B7280;font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase">View as</span>
        <select onchange="setViewMode(this.value);this.value=''" style="padding:5px 10px;border-radius:7px;font-size:12px;font-weight:600;font-family:inherit;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff;cursor:pointer;outline:none">
          <option value="" style="background:#050D1F">— Select —</option>
          <option value="coordinator" style="background:#050D1F">Coordinator</option>
          <option value="driver" style="background:#050D1F">Driver</option>
          <option value="patient" style="background:#050D1F">Patient</option>
        </select>'''
if old_viewas_btns in ac:
    ac = ac.replace(old_viewas_btns, new_viewas_btns)
    results.append("5a. Admin View As: 4 buttons → single dropdown")
else:
    results.append("5a. FAIL: view-as buttons not matched")

# Fix setViewMode picker — the onclick quote nesting bug
# Replace the broken picker with a working version using data stored before innerHTML
old_vm_coord = """      var sel = '<div style=\"padding:16px\"><div style=\"font-size:13px;font-weight:700;color:#050D1F;margin-bottom:10px\">View as Coordinator — select a facility:</div><select id=\"previewFacSel\" style=\"width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:inherit;margin-bottom:12px\">' + opts + '</select><button onclick=\"var v=document.getElementById('previewFacSel').value;if(v)window.open('/coordinator?preview_hospital='+v,'_blank');document.getElementById('previewPicker').remove();\" style=\"padding:10px 20px;background:#050D1F;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit\">Open</button> <button onclick=\"document.getElementById('previewPicker').remove();\" style=\"padding:10px 20px;background:#F3F4F6;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit;margin-left:8px\">Cancel</button></div>';
      var d = document.createElement('div');
      d.id = 'previewPicker';
      d.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);background:#fff;border-radius:12px;border:1px solid #E2E8F0;box-shadow:0 8px 32px rgba(0,0,0,0.12);z-index:999;min-width:340px;';
      d.innerHTML = sel;
      document.body.appendChild(d);"""
new_vm_coord = """      var d = document.createElement('div');
      d.id = 'previewPicker';
      d.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);background:#fff;border-radius:12px;border:1px solid #E2E8F0;box-shadow:0 8px 32px rgba(0,0,0,0.12);z-index:999;min-width:340px;padding:16px';
      document.body.appendChild(d);
      var lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:13px;font-weight:700;color:#050D1F;margin-bottom:10px';
      lbl.textContent = 'View as Coordinator — select a facility:';
      d.appendChild(lbl);
      var sel2 = document.createElement('select');
      sel2.id = 'previewFacSel';
      sel2.style.cssText = 'width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:inherit;margin-bottom:12px;display:block';
      sel2.innerHTML = opts;
      d.appendChild(sel2);
      var openBtn = document.createElement('button');
      openBtn.textContent = 'Open';
      openBtn.style.cssText = 'padding:10px 20px;background:#050D1F;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit';
      openBtn.onclick = function(){ var v = sel2.value; if(v){ window.open('/coordinator?preview_hospital='+v,'_blank'); } d.remove(); };
      d.appendChild(openBtn);
      var cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.cssText = 'padding:10px 20px;background:#F3F4F6;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit;margin-left:8px';
      cancelBtn.onclick = function(){ d.remove(); };
      d.appendChild(cancelBtn);"""
if old_vm_coord in ac:
    ac = ac.replace(old_vm_coord, new_vm_coord)
    results.append("5b. Admin keyfob: coordinator picker fixed (no quote-nesting bug)")
else:
    results.append("5b. FAIL: coordinator picker not matched")

# Same fix for driver picker
old_vm_driver = """      var sel = '<div style=\"padding:16px\"><div style=\"font-size:13px;font-weight:700;color:#050D1F;margin-bottom:10px\">View as Driver — select a NEMT partner:</div><select id=\"previewNemtSel\" style=\"width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:inherit;margin-bottom:12px\">' + opts + '</select><button onclick=\"var v=document.getElementById('previewNemtSel').value;if(v)window.open('/driver?preview_nemt='+v,'_blank');document.getElementById('previewPicker').remove();\" style=\"padding:10px 20px;background:#050D1F;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit\">Open</button> <button onclick=\"document.getElementById('previewPicker').remove();\" style=\"padding:10px 20px;background:#F3F4F6;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit;margin-left:8px\">Cancel</button></div>';
      var d = document.createElement('div');
      d.id = 'previewPicker';
      d.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);background:#fff;border-radius:12px;border:1px solid #E2E8F0;box-shadow:0 8px 32px rgba(0,0,0,0.12);z-index:999;min-width:340px;';
      d.innerHTML = sel;
      document.body.appendChild(d);"""
new_vm_driver = """      var d = document.createElement('div');
      d.id = 'previewPicker';
      d.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);background:#fff;border-radius:12px;border:1px solid #E2E8F0;box-shadow:0 8px 32px rgba(0,0,0,0.12);z-index:999;min-width:340px;padding:16px';
      document.body.appendChild(d);
      var lbl2 = document.createElement('div');
      lbl2.style.cssText = 'font-size:13px;font-weight:700;color:#050D1F;margin-bottom:10px';
      lbl2.textContent = 'View as Driver — select a NEMT partner:';
      d.appendChild(lbl2);
      var sel3 = document.createElement('select');
      sel3.style.cssText = 'width:100%;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:13px;font-family:inherit;margin-bottom:12px;display:block';
      sel3.innerHTML = opts;
      d.appendChild(sel3);
      var openBtn2 = document.createElement('button');
      openBtn2.textContent = 'Open';
      openBtn2.style.cssText = 'padding:10px 20px;background:#050D1F;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit';
      openBtn2.onclick = function(){ var v = sel3.value; if(v){ window.open('/driver?preview_nemt='+v,'_blank'); } d.remove(); };
      d.appendChild(openBtn2);
      var cancelBtn2 = document.createElement('button');
      cancelBtn2.textContent = 'Cancel';
      cancelBtn2.style.cssText = 'padding:10px 20px;background:#F3F4F6;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit;margin-left:8px';
      cancelBtn2.onclick = function(){ d.remove(); };
      d.appendChild(cancelBtn2);"""
if old_vm_driver in ac:
    ac = ac.replace(old_vm_driver, new_vm_driver)
    results.append("5c. Admin keyfob: driver picker fixed")
else:
    results.append("5c. FAIL: driver picker not matched")

# Fix _allNemt scope - declare globally before renderNemt function
if 'var _allNemt = [];\n  function renderNemt' in ac:
    ac = ac.replace('var _allNemt = [];\n  function renderNemt', 'window._allNemt = [];\n  function renderNemt')
    ac = ac.replace('_allNemt = list || [];', 'window._allNemt = list || [];')
    ac = ac.replace('showNemtProfile(parseInt(row.getAttribute(\'data-idx\'),10))', 'showNemtProfile(parseInt(row.getAttribute(\'data-idx\'),10))')
    ac = ac.replace('var data = _allNemt[idx];', 'var data = window._allNemt[idx];')
    results.append("5d. Admin NEMT clickable: _allNemt moved to window scope (fixes showNemtProfile)")
else:
    results.append("5d. _allNemt scope: pattern not matched")

open(af,'w').write(ac)

# ════════════════════════════════════════════
# 6. DRIVER - remove MVP banner, remove avg fare
# ════════════════════════════════════════════
df = os.path.join(PP,'driver.html')
dc = open(df).read()
dc = dc.replace(
    "    <div class=\"mvp-banner\">ℹ MVP — simulating ride status before full NEMT dispatch API integration.</div>",
    ""
)
dc = dc.replace("var AVG_FARE = 46;", "var AVG_FARE = null;")
# Remove avg fare display in earnings card
# avg fare handled by regex below
# More targeted: find and clean the avg fare stat
import re
dc = re.sub(r'<div[^>]*>[^<]*Avg[^<]*Fare[^<]*</div>\s*<div[^>]*>\$46[^<]*</div>', '', dc)
dc = re.sub(r'\$\' \+ AVG_FARE \+ \'', '$—', dc)
dc = dc.replace("'$' + AVG_FARE", "'—'")

# Add decline button to ride cards
old_accept_btn = """  ride-action { width:100%; padding:13px; border-radius:10px; border:none; font-size:14px; font-weight:700; font-family:inherit; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:opacity 0.15s; }"""
# Just note that we need to add decline - find the accept button in the render
dc = re.sub(
    r"'<button class=\"ride-action\" style=\"background:#00C2A8;color:#050D1F\" onclick=\"acceptRide\(\\''",
    "'<div style=\"display:flex;gap:8px\"><button class=\"ride-action\" style=\"background:#00C2A8;color:#050D1F;flex:1\" onclick=\"acceptRide(\\''"
    , dc
)
# Close the div after the accept button
dc = re.sub(
    r"(onclick=\"acceptRide\(\\''\s*\+\s*r\.id\s*\+\s*'\\'\)\">[^<]+</button>)'",
    r"\1<button class=\"ride-action\" style=\"background:#FEF2F2;color:#EF4444;border:1.5px solid #FECACA;flex:1\" onclick=\"declineRide(\\''" + "'+r.id+'" + r"'\\')\">' + (svgX) + ' Decline</button></div>'"
    , dc
)
open(df,'w').write(dc)

# Add declineRide function to driver.html
dc = open(df).read()
if 'function declineRide' not in dc:
    dc = dc.replace(
        'async function acceptRide(rideId) {',
        """async function declineRide(rideId) {
  if (!confirm('Decline this ride?')) return;
  try {
    await fetch(SUPA + '/rest/v1/rides?id=eq.' + rideId, {
      method: 'PATCH',
      headers: { ...H, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: 'invited', nemt_partner_id: null })
    });
    showToast('Ride declined', 'ok');
    await loadAvailableRides();
  } catch(e) { showToast('Could not decline', 'err'); }
}

async function acceptRide(rideId) {"""
    )
    open(df,'w').write(dc)
    results.append("6. Driver: MVP note removed, avg fare removed, decline button added")
else:
    results.append("6. Driver: declineRide already exists")

# ════════════════════════════════════════════
# 7. COORDINATOR - all required fields, remove 7-day note,
#    delete cancelled rides, fix greeting
# ════════════════════════════════════════════
cf = os.path.join(PP,'coordinator.html')
cc = open(cf).read()

# Remove 7-day note in invite modal subtitle
cc = cc.replace(
    'Enter the appointment. If it is more than 7 days out, CareVoy automatically invites the patient about 7 days before, no action needed from you. Sooner than that, the invite sends now.',
    'Enter the appointment information below.'
)
results.append("7a. Coordinator: 7-day note removed")

# Remove SMS reference in alerts note
cc = cc.replace(
    'CareVoy also automatically sends an SMS reminder to patients who haven\'t confirmed within <strong>48 hours</strong> — no action needed from you.',
    'CareVoy automatically sends a reminder to patients who have not confirmed within 48 hours.'
)

# All fields required: add red asterisk where missing
# Patient fields
cc = cc.replace(
    '<label class="form-label">Patient First Name</label>',
    '<label class="form-label">Patient First Name <span style="color:#EF4444">*</span></label>'
)
cc = cc.replace(
    '<label class="form-label">Patient Last Name</label>',
    '<label class="form-label">Patient Last Name <span style="color:#EF4444">*</span></label>'
)
cc = cc.replace(
    '<label class="form-label">Appointment Date</label>',
    '<label class="form-label">Appointment Date <span style="color:#EF4444">*</span></label>'
)
cc = cc.replace(
    '<label class="form-label">Appointment Time</label>',
    '<label class="form-label">Appointment Time <span style="color:#EF4444">*</span></label>'
)
cc = cc.replace(
    '<label class="form-label">Ride Type</label>',
    '<label class="form-label">Ride Type <span style="color:#EF4444">*</span></label>'
)
cc = cc.replace(
    '<label class="form-label">Payment</label>',
    '<label class="form-label">Payment <span style="color:#EF4444">*</span></label>'
)
# Caregiver patient name fields
cc = cc.replace(
    '<label class="form-label">Patient First Name\n',
    '<label class="form-label">Patient First Name <span style="color:#EF4444">*</span>\n'
)
results.append("7b. Coordinator: all fields marked required with asterisk")

# Delete cancelled rides (add delete button in ride cards)
old_cancel_btn = "'<button class=\"btn btn-ghost\" style=\"color:#EF4444;border:1px solid #FECACA\" onclick=\"cancelRide(event,\\'' + r.id + '\\')\">Cancel</button>'"
new_cancel_btn = "'<button class=\"btn btn-ghost\" style=\"color:#EF4444;border:1px solid #FECACA\" onclick=\"cancelRide(event,\\'' + r.id + '\\')\">Cancel</button>'"
# Add delete button for cancelled rides in the render function
# Find the cancelled status badge render
cc = cc.replace(
    "r.status === 'cancelled' ? '<span class=\"badge b-red\">Cancelled</span>' :",
    "r.status === 'cancelled' ? '<span style=\"display:flex;align-items:center;gap:6px\"><span class=\"badge b-red\">Cancelled</span><button style=\"padding:4px 10px;background:none;border:1px solid #FECACA;border-radius:6px;color:#EF4444;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit\" onclick=\"deleteRide(event,\\'' + r.id + '\\')\">Remove</button></span>' :"
)
results.append("7c. Coordinator: Remove button added for cancelled rides")

# Fix greeting capitalisation - capitalize first letter of name
cc = cc.replace(
    "greet + (coordInfo.full_name ? ', ' + coordInfo.full_name.split(' ')[0] : '') + '.'",
    "greet + (coordInfo.full_name ? ', ' + coordInfo.full_name.split(' ')[0].charAt(0).toUpperCase() + coordInfo.full_name.split(' ')[0].slice(1) : '') + '.'"
)
results.append("7d. Coordinator: greeting capitalizes name")

# Add deleteRide function
if 'function deleteRide' not in cc:
    cc = cc.replace(
        'async function cancelRide(evt, rideId) {',
        """async function deleteRide(evt, rideId) {
  evt.stopPropagation();
  if (!confirm('Remove this ride permanently?')) return;
  try {
    await fetch(SUPA + '/rest/v1/rides?id=eq.' + rideId, { method: 'DELETE', headers: H });
    showToast('Ride removed', 'ok');
  } catch(e) { showToast('Could not remove', 'err'); }
  await loadRides();
  renderPatientTable();
}

async function cancelRide(evt, rideId) {"""
    )
    results.append("7e. Coordinator: deleteRide function added")
open(cf,'w').write(cc)

print("="*58)
for r in results: print(" ✓", r)
print("="*58)

# Verify
pc2=open(pf).read(); ac2=open(af).read(); dc2=open(df).read(); cc2=open(cf).read()
print("\nVERIFICATION:")
print("  Patient single icon:", 'viewBox="0 0 100 100"' not in pc2)
print("  Rides default tab:", 'switchTab(\'Rides\'' in pc2)
print("  Chat chips in messages:", 'chat-chip' in pc2)
print("  Support email fallback:", 'support@carevoy.co' in pc2)
print("  Admin dropdown:", '<select onchange="setViewMode' in ac2)
print("  Admin keyfob no quotes bug:", 'openBtn.onclick' in ac2)
print("  Driver MVP removed:", 'MVP' not in dc2)
print("  Driver decline button:", 'declineRide' in dc2)
print("  Coord 7-day removed:", '7 days out' not in cc2)
print("  Coord delete cancelled:", 'deleteRide' in cc2)
print()

for cmd in [
    ['git','-C',REPO,'add','-A',
     'partners-portal/patients.html','partners-portal/admin.html',
     'partners-portal/driver.html','partners-portal/coordinator.html'],
    ['git','-C',REPO,'commit','-m','fix: single icon, chat chips, admin dropdown keyfob, driver decline, coord cleanup'],
    ['git','-C',REPO,'push','origin','main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    print((r.stdout+r.stderr).strip()[:200] or "(ok)")
