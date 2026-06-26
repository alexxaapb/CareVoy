import os, subprocess

REPO = '/workspaces/CareVoy'
af = os.path.join(REPO, 'partners-portal', 'admin.html')
ac = open(af).read()
results = []

# 1. Expand the main fetch to pull intake_data + service_states + contact_email for NEMTs
old_fetch = "fetch(SUPA_URL + '/rest/v1/nemt_partners?select=id,company_name,city,active', { headers: h }),"
new_fetch = "fetch(SUPA_URL + '/rest/v1/nemt_partners?select=id,company_name,city,active,service_states,intake_data,contact_email', { headers: h }),"
if old_fetch in ac:
    ac = ac.replace(old_fetch, new_fetch)
    results.append("1. Main fetch now pulls intake_data + service_states + contact_email")
else:
    results.append("1. FAILED main fetch not found")

# 2. Store the full nemt list globally + make renderNemt rows clickable
old_render = """  function renderNemt(list) {
    var el = document.getElementById('nemtTable');
    document.getElementById('nemtSub').textContent = list.length + ' total';
    if (!list.length) {
      el.innerHTML = '<div class="table-head nemt-grid"><div class="th">Company</div><div class="th">City</div><div class="th">Total Rides</div><div class="th">Active</div><div class="th">Last Ride</div></div><div class="empty-row">No NEMT partners yet. Invite one using the button above.</div>';
      return;
    }
    var rows = list.map(function(p) {
      var active = p.active ? '<span class="badge teal">Yes</span>' : '<span class="badge gray">No</span>';
      return '<div class="table-row nemt-grid"><div class="td">' + esc(p.company_name||'—') + '</div><div class="td muted">' + esc(p.city||'—') + '</div><div class="td muted">—</div><div class="td">' + active + '</div><div class="td muted">—</div></div>';
    }).join('');
    el.innerHTML = '<div class="table-head nemt-grid"><div class="th">Company</div><div class="th">City</div><div class="th">Total Rides</div><div class="th">Active</div><div class="th">Last Ride</div></div>' + rows;
  }"""

new_render = """  var _allNemt = [];
  function renderNemt(list) {
    _allNemt = list || [];
    var el = document.getElementById('nemtTable');
    document.getElementById('nemtSub').textContent = list.length + ' total';
    if (!list.length) {
      el.innerHTML = '<div class="table-head nemt-grid"><div class="th">Company</div><div class="th">City</div><div class="th">Total Rides</div><div class="th">Active</div><div class="th">Last Ride</div></div><div class="empty-row">No NEMT partners yet.</div>';
      return;
    }
    var rows = list.map(function(p, i) {
      var active = p.active ? '<span class="badge teal">Yes</span>' : '<span class="badge gray">No</span>';
      return '<div class="table-row nemt-grid cv-nemt-row" data-idx="' + i + '" style="cursor:pointer"><div class="td">' + esc(p.company_name||'—') + '</div><div class="td muted">' + esc(p.city||'—') + '</div><div class="td muted">—</div><div class="td">' + active + '</div><div class="td muted">—</div></div>';
    }).join('');
    el.innerHTML = '<div class="table-head nemt-grid"><div class="th">Company</div><div class="th">City</div><div class="th">Total Rides</div><div class="th">Active</div><div class="th">Last Ride</div></div>' + rows;
    // delegated click -> open read-only partner detail
    Array.prototype.forEach.call(el.querySelectorAll('.cv-nemt-row'), function(row){
      row.addEventListener('click', function(){ showNemtProfile(parseInt(row.getAttribute('data-idx'),10)); });
    });
  }

  function showNemtProfile(idx) {
    var data = _allNemt[idx];
    if (!data) return;
    var intake = data.intake_data || {};
    var fields = [
      ["Company", data.company_name], ["City", data.city],
      ["Service States", (data.service_states||[]).join(", ")],
      ["Contact Email", data.contact_email],
      ["Years in Operation", intake.years_operation], ["Fleet Size", intake.fleet_size],
      ["Weekly Rides", intake.weekly_rides], ["Works with Brokers", intake.works_with_brokers],
      ["Broker Names", intake.broker_names], ["Dispatch Software", intake.dispatch_software],
      ["Contact Phone", intake.contact_phone], ["Home State", intake.home_state],
      ["Active", data.active ? "Yes" : "No"]
    ];
    if (intake.insurance_doc) {
      fields.push(["Insurance Doc", '<a href="https://byflpckbjjumxxjxoplk.supabase.co/storage/v1/object/public/partner-docs/' + intake.insurance_doc + '" target="_blank" style="color:#00C2A8;font-weight:600">View Document</a>']);
    }
    var rows = fields.filter(function(f){return f[1];}).map(function(f) {
      return '<div style="display:flex;padding:10px 0;border-bottom:1px solid #F3F4F6">' +
        '<div style="width:140px;font-size:12px;color:#6B7280;flex-shrink:0">' + f[0] + '</div>' +
        '<div style="font-size:13px;color:#050D1F;font-weight:500">' + (f[1]||"-") + '</div></div>';
    }).join("");
    document.getElementById("rideDetailBody").innerHTML = rows;
    var modal = document.getElementById("rideDetailModal");
    var titleEl = modal.querySelector('div[style*="font-size:18px"]');
    if (titleEl) titleEl.textContent = "Partner Profile";
    modal.style.display = "flex";
  }"""

if old_render in ac:
    ac = ac.replace(old_render, new_render)
    results.append("2. NEMT rows clickable -> showNemtProfile modal (intake + insurance doc)")
else:
    results.append("2. FAILED renderNemt block not matched exactly")

open(af, 'w').write(ac)

for r in results: print(r)
print()
for cmd in [
    ['git','-C',REPO,'add','partners-portal/admin.html'],
    ['git','-C',REPO,'commit','-m','feat: clickable NEMT partners in admin - view intake + insurance doc'],
    ['git','-C',REPO,'push','origin','main'],
]:
    r = subprocess.run(cmd, capture_output=True, text=True)
    out=(r.stdout+r.stderr).strip()
    print("  " + (out[:200] if out else "(ok)"))
