import os, subprocess

REPO = '/workspaces/CareVoy'

# 1. SIMPLIFY notification email
np = os.path.join(REPO, 'api-server', 'api', 'notify', 'new-partner.js')

new_handler = (
    'module.exports = async function handler(req, res) {\n'
    '  res.setHeader("Access-Control-Allow-Origin", "*");\n'
    '  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");\n'
    '  res.setHeader("Access-Control-Allow-Headers", "Content-Type");\n'
    '  if (req.method === "OPTIONS") return res.status(200).end();\n'
    '  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });\n'
    '  try {\n'
    '    const { type, name, email, phone, city, state } = req.body || {};\n'
    '    const appType = type === "nemt" ? "NEMT Partner" : "Facility Partner";\n'
    '    const adminHtml = \'<div style="font-family:sans-serif;max-width:520px;margin:0 auto"><div style="background:#050D1F;padding:20px;border-radius:12px 12px 0 0"><span style="color:#00C2A8;font-weight:700;font-size:18px">CareVoy</span></div><div style="background:#fff;border:1px solid #E2E8F0;padding:28px;border-radius:0 0 12px 12px"><h2 style="color:#050D1F;font-size:18px;margin:0 0 12px">New \' + appType + \' Application</h2><p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px"><strong>\' + (name||"Unknown") + \'</strong> from \' + (city||"") + \', \' + (state||"") + \' has submitted a partner application.</p><a href="https://partners.carevoy.co" style="display:inline-block;background:#050D1F;color:#00C2A8;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">Review in Dashboard</a></div></div>\';\n'
    '    const applicantHtml = \'<div style="font-family:sans-serif;max-width:520px;margin:0 auto"><div style="background:#050D1F;padding:20px;border-radius:12px 12px 0 0"><span style="color:#00C2A8;font-weight:700;font-size:18px">CareVoy</span></div><div style="background:#fff;border:1px solid #E2E8F0;padding:28px;border-radius:0 0 12px 12px"><h2 style="color:#050D1F;font-size:18px;margin:0 0 12px">Application received!</h2><p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">Thank you for applying to join CareVoy. We have received your application and will be in touch as soon as possible.</p><p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px">Once approved you can log in at:</p><a href="https://partners.carevoy.co" style="display:inline-block;background:#050D1F;color:#00C2A8;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">partners.carevoy.co</a><p style="color:#9CA3AF;font-size:12px;margin-top:24px">Questions? Email partners@carevoy.co</p></div></div>\';\n'
    '    let sent = false;\n'
    '    if (process.env.RESEND_API_KEY) {\n'
    '      const r = await fetch("https://api.resend.com/emails", {\n'
    '        method: "POST",\n'
    '        headers: { "Authorization": "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },\n'
    '        body: JSON.stringify({ from: "CareVoy <notifications@carevoy.co>", to: ["partners@carevoy.co"], subject: "New " + appType + " Application: " + (name||"Unknown"), html: adminHtml })\n'
    '      });\n'
    '      if (r.ok) sent = true;\n'
    '      if (email) {\n'
    '        await fetch("https://api.resend.com/emails", {\n'
    '          method: "POST",\n'
    '          headers: { "Authorization": "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },\n'
    '          body: JSON.stringify({ from: "CareVoy <partners@carevoy.co>", to: [email], subject: "Your CareVoy partner application was received", html: applicantHtml })\n'
    '        }).catch(function(e){});\n'
    '      }\n'
    '    }\n'
    '    return res.status(200).json({ success: true, sent, resend_key_set: !!process.env.RESEND_API_KEY });\n'
    '  } catch(e) { return res.status(500).json({ error: e.message }); }\n'
    '};\n'
)
open(np, 'w').write(new_handler)
print("1. Email simplified")

# 2. ADMIN: Replace renderPending with detail modal version
af = os.path.join(REPO, 'partners-portal', 'admin.html')
ac = open(af).read()

old_render = "  function renderPending() {"
end_marker = "  setInterval(renderPending, 30000);"

if old_render in ac and end_marker in ac:
    start = ac.index(old_render)
    end = ac.index(end_marker) + len(end_marker)

    new_code = (
        '  var _pendingNemt = [];\n'
        '  var _pendingFac = [];\n\n'
        '  function showAppDetail(type, idx) {\n'
        '    var data = type === "nemt" ? _pendingNemt[idx] : _pendingFac[idx];\n'
        '    if (!data) return;\n'
        '    var intake = data.intake_data || {};\n'
        '    var fields = [];\n'
        '    if (type === "nemt") {\n'
        '      fields = [\n'
        '        ["Company", data.company_name], ["City", data.city],\n'
        '        ["Service States", (data.service_states||[]).join(", ")],\n'
        '        ["Years in Operation", intake.years_operation], ["Fleet Size", intake.fleet_size],\n'
        '        ["Weekly Rides", intake.weekly_rides], ["Works with Brokers", intake.works_with_brokers],\n'
        '        ["Broker Names", intake.broker_names], ["Dispatch Software", intake.dispatch_software],\n'
        '        ["Contact Phone", intake.contact_phone], ["Home State", intake.home_state],\n'
        '      ];\n'
        '      if (intake.insurance_doc) {\n'
        '        fields.push(["Insurance Doc", \'<a href="https://byflpckbjjumxxjxoplk.supabase.co/storage/v1/object/public/partner-docs/\' + intake.insurance_doc + \'" target="_blank" style="color:#00C2A8;font-weight:600">View Document</a>\']);\n'
        '      }\n'
        '    } else {\n'
        '      fields = [\n'
        '        ["Facility", data.name], ["Type", (data.facility_type||"").replace(/_/g," ")],\n'
        '        ["City", data.city], ["State", data.state], ["Locations", intake.locations],\n'
        '        ["EHR System", intake.ehr], ["Patient Volume", intake.patient_volume],\n'
        '        ["Ride Frequency", intake.ride_frequency], ["Payment Type", intake.payment_type],\n'
        '        ["Current Process", intake.current_process], ["Pain Point", intake.pain_point],\n'
        '        ["Contact Title", intake.contact_title], ["Contact Phone", intake.contact_phone],\n'
        '      ];\n'
        '    }\n'
        '    var rows = fields.filter(function(f){return f[1];}).map(function(f) {\n'
        '      return \'<div style="display:flex;padding:10px 0;border-bottom:1px solid #F3F4F6">\' +\n'
        '        \'<div style="width:140px;font-size:12px;color:#6B7280;flex-shrink:0">\' + f[0] + \'</div>\' +\n'
        '        \'<div style="font-size:13px;color:#050D1F;font-weight:500">\' + (f[1]||"-") + \'</div></div>\';\n'
        '    }).join("");\n'
        '    var nm = type === "nemt" ? e(data.company_name||"") : e(data.name||"");\n'
        '    document.getElementById("rideDetailBody").innerHTML = rows +\n'
        '      \'<div style="display:flex;gap:10px;margin-top:20px">\' +\n'
        '      \'<button class="cv-approve" data-type="\' + type + \'" data-id="\' + data.id + \'" data-name="\' + nm + \'" style="flex:1;background:#050D1F;color:#00C2A8;border:none;padding:12px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Approve</button>\' +\n'
        '      \'<button class="cv-decline" data-type="\' + type + \'" data-id="\' + data.id + \'" data-name="\' + nm + \'" style="flex:1;background:#FEF2F2;color:#EF4444;border:1px solid #FECACA;padding:12px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Decline</button></div>\';\n'
        '    var modal = document.getElementById("rideDetailModal");\n'
        '    var titleEl = modal.querySelector(\'div[style*="font-size:18px"]\');\n'
        '    if (titleEl) titleEl.textContent = "Application Details";\n'
        '    modal.style.display = "flex";\n'
        '  }\n\n'
        '  function renderPending() {\n'
        '    fetch(SU + "/rest/v1/nemt_partners?pending_review=eq.true&select=id,company_name,city,service_states,created_at,intake_data", { headers: hdr })\n'
        '    .then(function(r){ return r.json(); })\n'
        '    .then(function(nemt){\n'
        '      _pendingNemt = nemt || [];\n'
        '      var sec = document.getElementById("nemtPendingSection");\n'
        '      var body = document.getElementById("nemtPendingBody");\n'
        '      if (!sec || !body) return;\n'
        '      if (!_pendingNemt.length) { sec.style.display = "none"; return; }\n'
        '      sec.style.display = "block";\n'
        '      body.innerHTML = _pendingNemt.map(function(p, i){\n'
        '        return \'<div class="cv-pending-card" data-type="nemt" data-idx="\' + i + \'" style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px;cursor:pointer">\' +\n'
        '          \'<div><div style="font-weight:700;color:#050D1F;font-size:14px">\' + e(p.company_name) + \'</div>\' +\n'
        '          \'<div style="font-size:12px;color:#6B7280;margin-top:3px">\' + e(p.city||"") + \' | \' + (p.service_states||[]).join(", ") + \'</div>\' +\n'
        '          \'<div style="font-size:11px;color:#9CA3AF;margin-top:2px">Applied \' + new Date(p.created_at).toLocaleDateString() + \'</div></div>\' +\n'
        '          \'<div style="font-size:11px;color:#00C2A8;font-weight:700">View &#8594;</div></div>\';\n'
        '      }).join("");\n'
        '    }).catch(function(){});\n\n'
        '    fetch(SU + "/rest/v1/hospitals?pending_review=eq.true&select=id,name,city,state,facility_type,created_at,intake_data", { headers: hdr })\n'
        '    .then(function(r){ return r.json(); })\n'
        '    .then(function(facs){\n'
        '      _pendingFac = facs || [];\n'
        '      var sec = document.getElementById("facPendingSection");\n'
        '      var body = document.getElementById("facPendingBody");\n'
        '      if (!sec || !body) return;\n'
        '      if (!_pendingFac.length) { sec.style.display = "none"; return; }\n'
        '      sec.style.display = "block";\n'
        '      body.innerHTML = _pendingFac.map(function(f, i){\n'
        '        return \'<div class="cv-pending-card" data-type="facility" data-idx="\' + i + \'" style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px;cursor:pointer">\' +\n'
        '          \'<div><div style="font-weight:700;color:#050D1F;font-size:14px">\' + e(f.name) + \'</div>\' +\n'
        '          \'<div style="font-size:12px;color:#6B7280;margin-top:3px">\' + e(f.city||"") + \', \' + e(f.state||"") + \' | \' + e((f.facility_type||"").replace(/_/g," ")) + \'</div>\' +\n'
        '          \'<div style="font-size:11px;color:#9CA3AF;margin-top:2px">Applied \' + new Date(f.created_at).toLocaleDateString() + \'</div></div>\' +\n'
        '          \'<div style="font-size:11px;color:#00C2A8;font-weight:700">View &#8594;</div></div>\';\n'
        '      }).join("");\n'
        '    }).catch(function(){});\n'
        '  }\n\n'
        '  document.addEventListener("click", function(ev) {\n'
        '    var card = ev.target.closest && ev.target.closest(".cv-pending-card");\n'
        '    if (card) {\n'
        '      showAppDetail(card.getAttribute("data-type"), parseInt(card.getAttribute("data-idx")));\n'
        '    }\n'
        '  });\n\n'
        '  renderPending();\n'
        '  setInterval(renderPending, 30000);'
    )

    ac = ac[:start] + new_code + ac[end:]
    open(af, 'w').write(ac)
    print("2. Admin: clickable cards -> detail modal with all fields + approve/decline")
else:
    print("2. FAILED - renderPending or setInterval not found in admin.html")

cmds = [
    'rm -f fix_email_and_admin_detail.py',
    'git add api-server/api/notify/new-partner.js partners-portal/admin.html',
    'git commit -m "feat: simplified email, admin detail modal for pending apps"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
