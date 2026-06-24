import os, subprocess

REPO = '/workspaces/CareVoy'
PP = os.path.join(REPO, 'partners-portal')

# All 50 states + DC
ALL_STATES = [
    ('AL','Alabama'),('AK','Alaska'),('AZ','Arizona'),('AR','Arkansas'),
    ('CA','California'),('CO','Colorado'),('CT','Connecticut'),('DE','Delaware'),
    ('DC','Washington DC'),('FL','Florida'),('GA','Georgia'),('HI','Hawaii'),
    ('ID','Idaho'),('IL','Illinois'),('IN','Indiana'),('IA','Iowa'),
    ('KS','Kansas'),('KY','Kentucky'),('LA','Louisiana'),('ME','Maine'),
    ('MD','Maryland'),('MA','Massachusetts'),('MI','Michigan'),('MN','Minnesota'),
    ('MS','Mississippi'),('MO','Missouri'),('MT','Montana'),('NE','Nebraska'),
    ('NV','Nevada'),('NH','New Hampshire'),('NJ','New Jersey'),('NM','New Mexico'),
    ('NY','New York'),('NC','North Carolina'),('ND','North Dakota'),('OH','Ohio'),
    ('OK','Oklahoma'),('OR','Oregon'),('PA','Pennsylvania'),('RI','Rhode Island'),
    ('SC','South Carolina'),('SD','South Dakota'),('TN','Tennessee'),('TX','Texas'),
    ('UT','Utah'),('VT','Vermont'),('VA','Virginia'),('WA','Washington'),
    ('WV','West Virginia'),('WI','Wisconsin'),('WY','Wyoming')
]
STATE_OPTIONS = '\n'.join([f'      <option value="{abbr}">{name}</option>' for abbr, name in ALL_STATES])
STATE_CHECKBOXES = '\n'.join([f'      <label class="checkbox-item" onclick="toggleCheck(this)"><input type="checkbox" value="{abbr}" /><span>{abbr}</span></label>' for abbr, _ in ALL_STATES])

# Shared styles
SHARED_STYLE = '''
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Poppins', -apple-system, sans-serif; background: #F0F4F8; min-height: 100vh; display: flex; align-items: flex-start; justify-content: center; padding: 40px 24px; }
    .card { background: white; border-radius: 20px; padding: 40px 36px; width: 100%; max-width: 560px; box-shadow: 0 4px 24px rgba(5,13,31,0.08); }
    .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
    .logo-icon { width: 36px; height: 36px; background: #050D1F; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .logo-icon svg { width: 22px; height: 22px; }
    .brand-text { color: #050D1F; font-size: 18px; font-weight: 700; }
    .brand-sub { color: #00C2A8; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
    h1 { font-size: 22px; font-weight: 700; color: #050D1F; margin-bottom: 6px; }
    .sub { font-size: 13px; color: #6B7280; margin-bottom: 28px; line-height: 1.6; }
    .section-label { font-size: 10px; font-weight: 700; color: #00C2A8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; margin-top: 28px; padding-bottom: 6px; border-bottom: 1px solid #F0F4F8; }
    label.field-label { display: block; font-size: 11px; font-weight: 700; color: #050D1F; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; margin-top: 14px; }
    input[type=text], input[type=email], input[type=tel], input[type=password], select { width: 100%; padding: 12px 14px; border: 1.5px solid #E2E8F0; border-radius: 10px; font-size: 14px; color: #050D1F; background: #F8FAFC; font-family: inherit; outline: none; transition: border-color 0.15s; }
    input:focus, select:focus { border-color: #00C2A8; background: white; }
    .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .checkbox-group { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 7px; max-height: 180px; overflow-y: auto; padding: 8px; background: #F8FAFC; border: 1.5px solid #E2E8F0; border-radius: 10px; }
    .checkbox-item { display: flex; align-items: center; gap: 5px; background: white; border: 1.5px solid #E2E8F0; border-radius: 7px; padding: 6px 10px; cursor: pointer; transition: all 0.15s; }
    .checkbox-item input[type="checkbox"] { width: auto; padding: 0; background: none; border: none; accent-color: #00C2A8; }
    .checkbox-item.checked { border-color: #00C2A8; background: rgba(0,194,168,0.06); }
    .checkbox-item span { font-size: 12px; font-weight: 600; color: #050D1F; }
    .upload-area { border: 2px dashed #E2E8F0; border-radius: 10px; padding: 20px; text-align: center; cursor: pointer; transition: border-color 0.15s; background: #F8FAFC; margin-top: 6px; }
    .upload-area:hover { border-color: #00C2A8; }
    .upload-area input { display: none; }
    .upload-label { font-size: 13px; color: #6B7280; }
    .upload-label strong { color: #00C2A8; }
    .upload-name { font-size: 12px; color: #050D1F; font-weight: 600; margin-top: 6px; display: none; }
    .submit { width: 100%; padding: 15px; background: #050D1F; color: #00C2A8; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 28px; font-family: inherit; transition: opacity 0.15s; }
    .submit:hover { opacity: 0.88; }
    .submit:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #EF4444; font-size: 12px; margin-top: 10px; display: none; background: #FEF2F2; padding: 10px 12px; border-radius: 8px; }
    .note { font-size: 11px; color: #9CA3AF; margin-top: 16px; text-align: center; line-height: 1.5; }
'''

# Shared logo SVG (matches login page - navy rounded square with teal C arc)
LOGO_SVG = '''<svg viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M16 6.5C14.5 5 12.9 4.2 11 4.2C7.3 4.2 4.2 7.3 4.2 11C4.2 14.7 7.3 17.8 11 17.8C12.9 17.8 14.5 17 16 15.5" stroke="#00C2A8" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M14 9L16.5 6.5L14 4" stroke="#F5A623" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''

# Shared JS helpers
SHARED_JS = f'''
    var SUPA = 'https://byflpckbjjumxxjxoplk.supabase.co';
    var SUPA_KEY = 'sb_publishable_mwR5uT4W3C2M-K5LbBag4g_GdN0plrT';
    var API = 'https://care-voy-api-server.vercel.app';

    function val(id) {{ return (document.getElementById(id)||{{}}).value?.trim()||''; }}

    function toggleCheck(el) {{
      var cb = el.querySelector('input[type="checkbox"]');
      setTimeout(function() {{ el.classList.toggle('checked', cb.checked); }}, 0);
    }}

    function getChecked(groupId) {{
      return Array.from(document.querySelectorAll('#'+groupId+' input[type="checkbox"]'))
        .filter(function(b){{return b.checked;}}).map(function(b){{return b.value;}});
    }}

    function showError(msg) {{
      var el = document.getElementById('errMsg');
      el.textContent = msg; el.style.display = 'block';
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 20);
    }}

    async function uploadInsurance(uid, token, file) {{
      if (!file) return null;
      var ext = file.name.split('.').pop();
      var path = 'insurance/' + uid + '.' + ext;
      var r = await fetch(SUPA + '/storage/v1/object/partner-docs/' + path, {{
        method: 'POST',
        headers: {{ 'Authorization': 'Bearer ' + token, 'apikey': SUPA_KEY, 'Content-Type': file.type }},
        body: file
      }});
      return r.ok ? path : null;
    }}

    async function notifyTeam(type, name, email, phone, city, state, details) {{
      try {{
        await fetch(API + '/api/notify/new-partner', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: JSON.stringify({{ type, name, email, phone, city, state, details }})
        }});
      }} catch(e) {{ console.warn('notify failed (non-fatal):', e.message); }}
    }}
'''

# ════════════════════════════════════════════════════════════════
# NEMT SIGNUP PAGE (rebuilt with all fixes)
# ════════════════════════════════════════════════════════════════
nemt_html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Join CareVoy | Transport Partner Signup</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>{SHARED_STYLE}</style>
</head>
<body>
  <div class="card" id="formCard">
    <div class="logo">
      <div class="logo-icon">{LOGO_SVG}</div>
      <div><div class="brand-text">CareVoy</div><div class="brand-sub">Transport Partner</div></div>
    </div>
    <h1>Join as a Transport Partner</h1>
    <p class="sub">Free to join. Receive ride requests from healthcare facilities in your service area. You keep <strong>80% of every fare</strong> — no broker fees, no middlemen.</p>

    <div class="section-label">Company Information</div>
    <label class="field-label">Company Name *</label>
    <input type="text" id="companyName" placeholder="ABC Medical Transport LLC" />
    <div class="row2">
      <div><label class="field-label">Contact First Name *</label><input type="text" id="firstName" placeholder="Jane" /></div>
      <div><label class="field-label">Contact Last Name *</label><input type="text" id="lastName" placeholder="Smith" /></div>
    </div>
    <label class="field-label">Business Email *</label>
    <input type="email" id="email" placeholder="jane@abcmedical.com" />
    <label class="field-label">Contact Phone *</label>
    <input type="tel" id="phone" placeholder="+1 (614) 555-0000" />
    <label class="field-label">Dispatch Phone (shown to patients) *</label>
    <input type="tel" id="dispatchPhone" placeholder="+1 (614) 555-0001" />
    <label class="field-label">City / Base of Operations *</label>
    <input type="text" id="city" placeholder="Columbus" />

    <div class="section-label">Operations</div>
    <label class="field-label">Years in Operation *</label>
    <select id="yearsOp">
      <option value="">Select</option>
      <option value="less_1">Less than 1 year</option>
      <option value="1_3">1-3 years</option>
      <option value="3_5">3-5 years</option>
      <option value="5_plus">5+ years</option>
    </select>
    <label class="field-label">Fleet Size *</label>
    <select id="fleetSize">
      <option value="">Select</option>
      <option value="1_5">1-5 vehicles</option>
      <option value="6_15">6-15 vehicles</option>
      <option value="16_50">16-50 vehicles</option>
      <option value="50_plus">50+ vehicles</option>
    </select>
    <label class="field-label">Average rides per week *</label>
    <select id="weeklyRides">
      <option value="">Select</option>
      <option value="under_25">Under 25</option>
      <option value="25_100">25-100</option>
      <option value="100_250">100-250</option>
      <option value="250_plus">250+</option>
    </select>
    <label class="field-label">Do you currently work with brokers? *</label>
    <select id="brokers">
      <option value="">Select</option>
      <option value="yes">Yes (LogistiCare, MTM, Modivcare, etc.)</option>
      <option value="no">No</option>
      <option value="sometimes">Sometimes</option>
    </select>
    <label class="field-label">Dispatch software currently used *</label>
    <select id="dispatchSoftware">
      <option value="">Select</option>
      <option value="trip_master">TripMaster</option>
      <option value="route_genie">RouteGenie</option>
      <option value="trapeze">Trapeze</option>
      <option value="none">None / manual</option>
      <option value="other">Other</option>
    </select>
    <label class="field-label">Liability insurance in place? *</label>
    <select id="hasInsurance">
      <option value="">Select</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>

    <div class="section-label">Service Area</div>
    <p style="font-size:12px;color:#6B7280;margin-bottom:6px">Select all states where you provide rides *</p>
    <div class="checkbox-group" id="statesGroup">
{STATE_CHECKBOXES}
    </div>

    <div class="section-label">Vehicle Types *</div>
    <p style="font-size:12px;color:#6B7280;margin-bottom:6px">Select all vehicle types you operate (required) *</p>
    <div class="checkbox-group" id="vehiclesGroup" style="max-height:none">
      <label class="checkbox-item" onclick="toggleCheck(this)"><input type="checkbox" value="ambulatory" /><span>Ambulatory</span></label>
      <label class="checkbox-item" onclick="toggleCheck(this)"><input type="checkbox" value="wheelchair" /><span>Wheelchair Van</span></label>
      <label class="checkbox-item" onclick="toggleCheck(this)"><input type="checkbox" value="stretcher" /><span>Stretcher / Gurney</span></label>
      <label class="checkbox-item" onclick="toggleCheck(this)"><input type="checkbox" value="sedan" /><span>Sedan</span></label>
      <label class="checkbox-item" onclick="toggleCheck(this)"><input type="checkbox" value="suv" /><span>SUV / Minivan</span></label>
      <label class="checkbox-item" onclick="toggleCheck(this)"><input type="checkbox" value="bariatric" /><span>Bariatric</span></label>
    </div>

    <div class="section-label">Insurance Document</div>
    <label class="field-label">Upload Proof of Liability Insurance *</label>
    <div class="upload-area" onclick="document.getElementById('insuranceFile').click()">
      <input type="file" id="insuranceFile" accept=".pdf,.jpg,.jpeg,.png" onchange="showFileName(this,'insuranceName')" />
      <div class="upload-label">&#128206; <strong>Click to upload</strong> or drag and drop<br><span style="font-size:11px">PDF, JPG or PNG — max 5MB</span></div>
      <div class="upload-name" id="insuranceName"></div>
    </div>

    <div class="section-label">Account Setup</div>
    <label class="field-label">Password *</label>
    <input type="password" id="password" placeholder="Minimum 8 characters" />

    <div class="error" id="errMsg"></div>
    <button class="submit" id="btn" onclick="submitNemt()">Join CareVoy &rarr;</button>
    <p class="note">By submitting, you agree to CareVoy's partner terms. We'll review your application and notify you within 24 hours.</p>
  </div>

  <div id="successCard" style="display:none;max-width:560px;width:100%;background:white;border-radius:20px;padding:48px 36px;box-shadow:0 4px 24px rgba(5,13,31,0.08);text-align:center">
    <div style="font-size:48px;margin-bottom:16px">&#9989;</div>
    <h2 style="font-size:20px;font-weight:700;color:#050D1F;margin-bottom:10px">Application received!</h2>
    <p style="font-size:13px;color:#6B7280;line-height:1.7">Thank you for applying to join the CareVoy network. We'll review your application and reach out within 24 hours.<br><br>Once approved, sign in at <a href="https://partners.carevoy.co" style="color:#00C2A8;font-weight:600">partners.carevoy.co</a></p>
  </div>

  <script>
{SHARED_JS}
    function showFileName(input, nameId) {{
      var el = document.getElementById(nameId);
      if (input.files[0]) {{ el.textContent = '&#10003; ' + input.files[0].name; el.style.display = 'block'; }}
    }}

    async function submitNemt() {{
      var btn = document.getElementById('btn');
      document.getElementById('errMsg').style.display = 'none';

      var company = val('companyName'), first = val('firstName'), last = val('lastName'),
          email = val('email'), phone = val('phone'), dispatch = val('dispatchPhone'),
          city = val('city'), yearsOp = val('yearsOp'), fleet = val('fleetSize'),
          weeklyR = val('weeklyRides'), brokers = val('brokers'), software = val('dispatchSoftware'),
          hasIns = val('hasInsurance'), password = val('password');
      var states = getChecked('statesGroup');
      var vehicles = getChecked('vehiclesGroup');
      var insFile = document.getElementById('insuranceFile').files[0];

      if (!company||!first||!last||!email||!phone||!dispatch||!city||!yearsOp||!fleet||!weeklyR||!brokers||!software||!hasIns||!password)
        return showError('Please fill in all required fields.');
      if (states.length === 0) return showError('Please select at least one service state.');
      if (vehicles.length === 0) return showError('Please select at least one vehicle type.');
      if (!insFile) return showError('Please upload your proof of liability insurance.');
      if (password.length < 8) return showError('Password must be at least 8 characters.');

      btn.disabled = true; btn.textContent = 'Submitting\u2026';

      try {{
        var signupRes = await fetch(SUPA + '/auth/v1/signup', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json', 'apikey': SUPA_KEY }},
          body: JSON.stringify({{ email, password }})
        }});
        var sd = await signupRes.json();
        if (!signupRes.ok || !sd.user) throw new Error(sd.error_description || sd.msg || 'Signup failed. Email may already be registered.');
        var uid = sd.user.id, token = sd.access_token;
        var H = {{ 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + token }};

        var insPath = await uploadInsurance(uid, token, insFile);

        var pRes = await fetch(SUPA + '/rest/v1/nemt_partners', {{
          method: 'POST', headers: {{ ...H, 'Prefer': 'return=representation' }},
          body: JSON.stringify({{ company_name: company, city, service_states: states, vehicle_types: vehicles,
            dispatch_phone: dispatch, active: false, pending_review: true,
            intake_data: {{ years_operation: yearsOp, fleet_size: fleet, weekly_rides: weeklyR,
              works_with_brokers: brokers, dispatch_software: software, has_insurance: hasIns,
              insurance_doc: insPath, contact_phone: phone }} }})
        }});
        var pd = await pRes.json();
        var partnerId = Array.isArray(pd) ? pd[0]?.id : pd?.id;

        await fetch(SUPA + '/rest/v1/staff', {{ method: 'POST', headers: H,
          body: JSON.stringify({{ id: uid, role: 'nemt', partner_id: partnerId }}) }});

        await fetch(SUPA + '/rest/v1/nemt_staff', {{ method: 'POST', headers: H,
          body: JSON.stringify({{ id: uid, partner_id: partnerId, full_name: first+' '+last,
            email, phone, role: 'dispatcher' }}) }}).catch(function(){{}});

        await notifyTeam('nemt', company, email, phone, city, states.join(', '), {{
          contact: first+' '+last, fleet_size: fleet, vehicles: vehicles.join(', '),
          service_states: states.join(', '), weekly_rides: weeklyR,
          works_with_brokers: brokers, insurance_uploaded: insPath ? 'Yes' : 'No'
        }});

        document.getElementById('formCard').style.display = 'none';
        document.getElementById('successCard').style.display = 'block';
      }} catch(e) {{
        showError(e.message || 'Something went wrong. Email partners@carevoy.co');
        btn.disabled = false; btn.textContent = 'Join CareVoy \u2192';
      }}
    }}
  </script>
</body>
</html>'''

# ════════════════════════════════════════════════════════════════
# FACILITY SIGNUP PAGE (rebuilt with all fixes)
# ════════════════════════════════════════════════════════════════
facility_html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Partner with CareVoy | Facility Application</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>{SHARED_STYLE}</style>
</head>
<body>
  <div class="card" id="formCard">
    <div class="logo">
      <div class="logo-icon">{LOGO_SVG}</div>
      <div><div class="brand-text">CareVoy</div><div class="brand-sub">Facility Partner</div></div>
    </div>
    <h1>Partner with CareVoy</h1>
    <p class="sub">Tell us about your facility. We'll review your application and follow up within 24 hours with a custom plan — no commitment required.</p>

    <div class="section-label">Facility Information</div>
    <label class="field-label">Facility Name *</label>
    <input type="text" id="facilityName" placeholder="Columbus Family Medicine" />
    <label class="field-label">Facility Type *</label>
    <select id="facilityType">
      <option value="">Select facility type</option>
      <optgroup label="Clinics & Offices">
        <option value="independent_clinic">Independent Clinic</option>
        <option value="medical_office">Medical / Doctor's Office</option>
        <option value="specialty_clinic">Specialty Clinic (oncology, nephrology, etc.)</option>
        <option value="womens_health">Women's Health / OB-GYN</option>
        <option value="mental_health">Mental / Behavioral Health Practice</option>
        <option value="physical_therapy">Physical Therapy / Rehabilitation</option>
        <option value="community_health">Community Health Center / FQHC</option>
      </optgroup>
      <optgroup label="Long-Term Care">
        <option value="assisted_living">Assisted Living Facility</option>
        <option value="memory_care">Memory Care / Dementia Facility</option>
        <option value="skilled_nursing">Skilled Nursing Facility</option>
        <option value="senior_living">Senior Living Community</option>
      </optgroup>
      <optgroup label="Specialty Centers">
        <option value="dialysis_center">Dialysis Center</option>
        <option value="surgery_center">Ambulatory Surgery Center</option>
        <option value="infusion_center">Infusion / Chemotherapy Center</option>
        <option value="imaging_center">Imaging / Radiology Center</option>
      </optgroup>
      <optgroup label="Hospital Systems">
        <option value="hospital">Hospital</option>
        <option value="health_system">Health System / IDN</option>
        <option value="va_clinic">VA / Military Clinic</option>
      </optgroup>
      <option value="other">Other</option>
    </select>
    <div class="row2">
      <div><label class="field-label">City *</label><input type="text" id="city" placeholder="Columbus" /></div>
      <div><label class="field-label">State *</label>
        <select id="state"><option value="">State</option>{STATE_OPTIONS}</select>
      </div>
    </div>
    <label class="field-label">Number of Locations *</label>
    <select id="locations">
      <option value="">Select</option>
      <option value="1">1 location</option>
      <option value="2_5">2-5 locations</option>
      <option value="6_20">6-20 locations</option>
      <option value="20_plus">20+ locations</option>
    </select>
    <label class="field-label">EHR / Practice Management System *</label>
    <select id="ehr">
      <option value="">Select your system</option>
      <option value="athenahealth">athenahealth</option>
      <option value="epic">Epic</option>
      <option value="cerner">Cerner / Oracle Health</option>
      <option value="eclinicalworks">eClinicalWorks</option>
      <option value="tebra_kareo">Tebra / Kareo</option>
      <option value="elation">Elation Health</option>
      <option value="modmed">ModMed</option>
      <option value="allscripts">Allscripts / Veradigm</option>
      <option value="meditech">MEDITECH</option>
      <option value="pointclickcare">PointClickCare</option>
      <option value="none">No EHR system</option>
      <option value="other">Other</option>
    </select>

    <div class="section-label">Patient Transport Volume</div>
    <label class="field-label">Estimated patients needing transport per month *</label>
    <select id="patientVolume">
      <option value="">Select range</option>
      <option value="under_25">Under 25 patients</option>
      <option value="25_50">25-50 patients</option>
      <option value="50_100">50-100 patients</option>
      <option value="100_250">100-250 patients</option>
      <option value="250_plus">250+ patients</option>
    </select>
    <label class="field-label">How often do patients need rides? *</label>
    <select id="rideFrequency">
      <option value="">Select</option>
      <option value="one_time">Mostly one-time appointments</option>
      <option value="recurring">Mostly recurring (dialysis, therapy, etc.)</option>
      <option value="mix">Mix of both</option>
    </select>
    <label class="field-label">Who typically pays for patient rides? *</label>
    <select id="paymentType">
      <option value="">Select</option>
      <option value="patient_self_pay">Patient self-pay (out of pocket / HSA/FSA)</option>
      <option value="facility_covers">Facility covers ride costs</option>
      <option value="insurance_medicaid">Insurance / Medicaid</option>
      <option value="mix">Mix</option>
    </select>
    <label class="field-label">How do you currently coordinate transport? *</label>
    <select id="currentProcess">
      <option value="">Select</option>
      <option value="phone_calls">Phone calls to NEMT companies</option>
      <option value="broker">Through a broker (LogistiCare, MTM, etc.)</option>
      <option value="patient_arranges">Patient arranges their own</option>
      <option value="we_dont">We don't — patients often miss appointments</option>
      <option value="other">Other</option>
    </select>
    <label class="field-label">Biggest transport challenge *</label>
    <select id="painPoint">
      <option value="">Select</option>
      <option value="no_shows">High no-show rate</option>
      <option value="coordinator_time">Too much coordinator time on logistics</option>
      <option value="patient_confusion">Patients confused about arranging rides</option>
      <option value="no_hsa">No HSA/FSA receipt system for patients</option>
      <option value="all">All of the above</option>
    </select>

    <div class="section-label">Primary Contact</div>
    <div class="row2">
      <div><label class="field-label">First Name *</label><input type="text" id="firstName" placeholder="Jane" /></div>
      <div><label class="field-label">Last Name *</label><input type="text" id="lastName" placeholder="Smith" /></div>
    </div>
    <label class="field-label">Title / Role *</label>
    <select id="title">
      <option value="">Select</option>
      <option value="physician_owner">Physician / Owner</option>
      <option value="practice_manager">Practice Manager</option>
      <option value="administrator">Administrator / Executive Director</option>
      <option value="coordinator">Care Coordinator</option>
      <option value="operations">Operations Director</option>
      <option value="other">Other</option>
    </select>
    <label class="field-label">Work Email *</label>
    <input type="email" id="email" placeholder="jane@yourpractice.com" />
    <label class="field-label">Phone *</label>
    <input type="tel" id="phone" placeholder="+1 (614) 555-0000" />

    <div class="section-label">Account Setup</div>
    <p style="font-size:12px;color:#6B7280;margin-bottom:4px">You'll use this to access your coordinator dashboard once approved.</p>
    <label class="field-label">Password *</label>
    <input type="password" id="password" placeholder="Minimum 8 characters" />

    <div class="error" id="errMsg"></div>
    <button class="submit" id="btn" onclick="submitFacility()">Submit Application &rarr;</button>
    <p class="note">No commitment required. We'll review your application and reach out within 24 hours with a custom pricing plan tailored to your facility size and volume.</p>
  </div>

  <div id="successCard" style="display:none;max-width:560px;width:100%;background:white;border-radius:20px;padding:48px 36px;box-shadow:0 4px 24px rgba(5,13,31,0.08);text-align:center">
    <div style="font-size:48px;margin-bottom:16px">&#127973;</div>
    <h2 style="font-size:20px;font-weight:700;color:#050D1F;margin-bottom:10px">Application received!</h2>
    <p style="font-size:13px;color:#6B7280;line-height:1.7">Thank you for applying to partner with CareVoy. We'll review your information and reach out within 24 hours with a custom plan and next steps.<br><br>Questions? Email us at <a href="mailto:partners@carevoy.co" style="color:#00C2A8;font-weight:600">partners@carevoy.co</a></p>
  </div>

  <script>
{SHARED_JS}
    async function submitFacility() {{
      var btn = document.getElementById('btn');
      document.getElementById('errMsg').style.display = 'none';

      var required = ['facilityName','facilityType','city','state','locations','ehr',
        'patientVolume','rideFrequency','paymentType','currentProcess','painPoint',
        'firstName','lastName','title','email','phone','password'];
      for (var i=0;i<required.length;i++) {{
        if (!val(required[i])) return showError('Please fill in all required fields.');
      }}
      if (val('password').length < 8) return showError('Password must be at least 8 characters.');

      btn.disabled = true; btn.textContent = 'Submitting\u2026';

      try {{
        var signupRes = await fetch(SUPA + '/auth/v1/signup', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json', 'apikey': SUPA_KEY }},
          body: JSON.stringify({{ email: val('email'), password: val('password') }})
        }});
        var sd = await signupRes.json();
        if (!signupRes.ok || !sd.user) throw new Error(sd.error_description || sd.msg || 'Signup failed. Email may already be registered.');
        var uid = sd.user.id, token = sd.access_token;
        var H = {{ 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + token }};

        var hRes = await fetch(SUPA + '/rest/v1/hospitals', {{
          method: 'POST', headers: {{ ...H, 'Prefer': 'return=representation' }},
          body: JSON.stringify({{ name: val('facilityName'), facility_type: val('facilityType'),
            city: val('city'), state: val('state'), active: false, pending_review: true,
            intake_data: {{ locations: val('locations'), ehr: val('ehr'),
              patient_volume: val('patientVolume'), ride_frequency: val('rideFrequency'),
              payment_type: val('paymentType'), current_process: val('currentProcess'),
              pain_point: val('painPoint'), contact_title: val('title'), contact_phone: val('phone') }} }})
        }});
        var hd = await hRes.json();
        var hospitalId = Array.isArray(hd) ? hd[0]?.id : hd?.id;

        if (hospitalId) {{
          await fetch(SUPA + '/rest/v1/hospital_coordinators', {{
            method: 'POST', headers: H,
            body: JSON.stringify({{ id: uid, full_name: val('firstName')+' '+val('lastName'),
              email: val('email'), hospital_id: hospitalId }})
          }});
        }}
        await fetch(SUPA + '/rest/v1/staff', {{ method: 'POST', headers: H,
          body: JSON.stringify({{ id: uid, role: 'coordinator' }}) }});

        await notifyTeam('facility', val('facilityName'), val('email'), val('phone'),
          val('city'), val('state'), {{
            facility_type: val('facilityType'), locations: val('locations'),
            ehr: val('ehr'), patient_volume: val('patientVolume'),
            payment_type: val('paymentType'), pain_point: val('painPoint'),
            contact: val('firstName')+' '+val('lastName'), title: val('title')
          }});

        document.getElementById('formCard').style.display = 'none';
        document.getElementById('successCard').style.display = 'block';
      }} catch(e) {{
        showError(e.message || 'Something went wrong. Email partners@carevoy.co');
        btn.disabled = false; btn.textContent = 'Submit Application \u2192';
      }}
    }}
  </script>
</body>
</html>'''

# Write files
open(os.path.join(PP, 'nemt-signup.html'), 'w').write(nemt_html)
print("1. nemt-signup.html rebuilt (all states, required vehicles, insurance upload, email notify, correct icon)")

open(os.path.join(PP, 'facility-signup.html'), 'w').write(facility_html)
print("2. facility-signup.html rebuilt (all states, all facility types, EHR dropdown, email notify, correct icon)")

# Notify endpoint
notify_dir = os.path.join(REPO, 'api-server', 'api', 'notify')
os.makedirs(notify_dir, exist_ok=True)
open(os.path.join(notify_dir, 'new-partner.js'), 'w').write(open('/tmp/notify_new_partner.js').read())
print("3. api/notify/new-partner.js created (emails partners@carevoy.co on new signup)")

cmds = [
    'rm -f build_partner_signups_final.py',
    'git add partners-portal/nemt-signup.html partners-portal/facility-signup.html api-server/api/notify/new-partner.js',
    'git commit -m "feat: rebuilt NEMT+facility signups (all states, insurance upload, email notify, correct icon, required vehicles)"',
    'git push origin main',
]
for cmd in cmds:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=REPO)
    print((r.stdout or r.stderr).strip()[:200])
