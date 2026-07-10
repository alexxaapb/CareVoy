'use strict';

const fs = require('fs');
const path = require('path');

// ── Canonical ride type labels (matches Task 3 map) ─────────────────────────
const RIDE_TYPE_LABELS = {
  pre_op:    'Pre-Op Appointment',
  post_op:   'Post-Op / Return',
  dialysis:  'Dialysis',
  therapy:   'Physical / Occupational Therapy',
  follow_up: 'Post-Procedure Follow-Up',
  other:     'Other Medical Visit',
};

function rideTypeLabel(t) {
  return RIDE_TYPE_LABELS[t] ||
    (t ? t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Medical Transport');
}

// ── Logo (read once, cache as base64 SVG data URI) ───────────────────────────
const SVG_PATH = path.join(__dirname, '../assets/carevoy-logo.svg');
let _logoUri = null;
function getLogoUri() {
  if (!_logoUri) {
    const svg = fs.readFileSync(SVG_PATH, 'utf8');
    _logoUri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  }
  return _logoUri;
}

// ── Line item calculation ────────────────────────────────────────────────────
// Single source of truth: base fare + mileage + accessibility surcharges.
// actual_cost must equal this sum — update-status.js uses the same formula.
function buildLineItems(ride) {
  const nemt        = ride.nemt_partners || {};
  const baseFare    = parseFloat(nemt.base_fare || 0);
  const perMile     = parseFloat(nemt.per_mile_rate || 0);
  const miles       = parseFloat(ride.estimated_miles || 0);
  const wSurcharge  = parseFloat(nemt.wheelchair_surcharge || 0);
  const stSurcharge = parseFloat(nemt.stretcher_surcharge || 0);

  const mobility          = (ride.mobility_needs || '').toLowerCase();
  const wheelchairSelected = mobility.includes('wheelchair');
  const stretcherSelected  = mobility.includes('stretcher');
  const companionSelected  = !!ride.companion_requested;

  const items = [];
  items.push({ label: 'Base Fare', amount: baseFare });
  if (miles > 0 && perMile > 0) {
    items.push({
      label: `Mileage (${miles.toFixed(1)} mi @ $${perMile.toFixed(2)}/mi)`,
      amount: parseFloat((miles * perMile).toFixed(2)),
    });
  }
  if (wheelchairSelected && wSurcharge > 0) {
    items.push({ label: 'Wheelchair Accessibility', amount: wSurcharge });
  }
  if (stretcherSelected && stSurcharge > 0) {
    items.push({ label: 'Stretcher Transport', amount: stSurcharge });
  }
  if (companionSelected) {
    items.push({ label: 'Companion Rider', amount: 0 });
  }

  const lineTotal  = items.reduce((s, i) => s + i.amount, 0);
  const actualCost = parseFloat(ride.actual_cost || ride.estimated_cost || lineTotal);

  return { items, total: actualCost, wheelchairSelected, stretcherSelected, companionSelected };
}

// ── HTML template ────────────────────────────────────────────────────────────
function buildReceiptHtml(ride, receiptNumber) {
  const patient    = { full_name: ride.patient_name, email: ride.contact_email, phone: ride.contact_phone };
  const hospital   = ride.hospitals   || {};
  const nemt       = ride.nemt_partners || {};
  const isFacility = ride.payment_responsibility === 'facility';

  const { items, total } = buildLineItems(ride);

  const facilityAddr = [hospital.address, hospital.city, hospital.state]
    .filter(Boolean).join(', ');

  const dateIssued = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const serviceDate = ride.pickup_time
    ? new Date(ride.pickup_time).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : '—';

  const lineItemsHtml = items.map(({ label, amount }) => `
        <div class="lineitem-row">
          <span class="lineitem-label">${escHtml(label)}</span>
          <span class="lineitem-amount">$${amount.toFixed(2)}</span>
        </div>`).join('');

  const complianceText = isFacility
    ? `This transportation was arranged and paid for directly by ${escHtml(hospital.name || 'the facility')}. No payment or reimbursement action is required from the patient.`
    : 'This receipt documents a qualified non-emergency medical transportation expense under IRS Section 213(d), eligible for reimbursement through Health Savings Accounts (HSA), Flexible Spending Accounts (FSA), or similar tax-advantaged medical accounts. Retain this receipt for your records and submit to your plan administrator as needed.';

  const complianceBg    = isFacility ? 'rgba(16,185,129,0.06)' : 'rgba(0,194,168,0.06)';
  const complianceBdr   = isFacility ? 'rgba(16,185,129,0.25)' : 'rgba(0,194,168,0.25)';
  const complianceColor = isFacility ? '#065F46' : '#00836F';
  const complianceTitle = isFacility ? 'Facility-Covered Transportation' : 'IRS Section 213(d) Eligible Medical Expense';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: letter; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    color: #1F2937;
    font-size: 13px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { width: 8.5in; min-height: 11in; }
  .header {
    background: #050D1F;
    padding: 40px 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .logo { width: 52px; height: 52px; border-radius: 12px; }
  .brand-name { color: #FFFFFF; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }
  .brand-tag { color: #9CA3AF; font-size: 11px; margin-top: 2px; letter-spacing: 0.3px; }
  .header-right { text-align: right; }
  .doc-title { color: #00C2A8; font-size: 13px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; }
  .doc-number { color: #9CA3AF; font-size: 11px; margin-top: 4px; }
  .body-content { padding: 40px 56px; }
  .info-grid { display: flex; justify-content: space-between; margin-bottom: 32px; gap: 40px; }
  .info-block { flex: 1; }
  .info-label {
    font-size: 10px; font-weight: 700; color: #00836F;
    letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;
  }
  .info-row { font-size: 13px; color: #374151; margin-bottom: 3px; }
  .info-row strong { color: #050D1F; font-weight: 600; }
  .service-header {
    display: flex; justify-content: space-between;
    border-bottom: 2px solid #050D1F;
    padding-bottom: 10px; margin-bottom: 4px;
  }
  .service-header-label {
    font-size: 10px; font-weight: 700; color: #6B7280;
    letter-spacing: 0.5px; text-transform: uppercase;
  }
  .service-block { margin-bottom: 20px; }
  .service-desc-main { font-weight: 700; color: #050D1F; font-size: 14px; margin-top: 14px; }
  .service-desc-sub { font-size: 12px; color: #6B7280; margin-top: 4px; line-height: 1.6; }
  .lineitems-block {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid #F3F4F6;
  }
  .lineitem-row {
    display: flex; justify-content: space-between;
    padding: 7px 0; font-size: 13px; color: #374151;
  }
  .lineitem-label { color: #4B5563; }
  .lineitem-amount { color: #050D1F; font-weight: 500; }
  .totals-block {
    display: flex; justify-content: flex-end;
    margin-top: 16px; margin-bottom: 32px;
    border-top: 2px solid #050D1F;
    padding-top: 14px;
  }
  .totals-table { width: 280px; }
  .totals-row {
    display: flex; justify-content: space-between;
    font-size: 17px; font-weight: 700; color: #050D1F;
  }
  .payment-info {
    background: #F8F9FB; border-radius: 10px;
    padding: 16px 20px; margin-bottom: 24px;
    font-size: 12px; color: #374151;
  }
  .payment-info strong { color: #050D1F; }
  .compliance-box {
    background: ${complianceBg};
    border: 1px solid ${complianceBdr};
    border-radius: 10px; padding: 18px 22px; margin-bottom: 32px;
  }
  .compliance-title {
    font-size: 12px; font-weight: 700;
    color: ${complianceColor};
    margin-bottom: 6px;
  }
  .compliance-text {
    font-size: 11.5px;
    color: ${complianceColor};
    line-height: 1.6;
  }
  .footer { padding: 24px 56px 40px; border-top: 1px solid #E8E4DC; }
  .footer-text { font-size: 10.5px; color: #9CA3AF; line-height: 1.6; }
  .footer-brand { font-size: 11px; color: #6B7280; margin-top: 10px; font-weight: 600; }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="header-left">
      <img class="logo" src="${getLogoUri()}" alt="CareVoy">
      <div>
        <div class="brand-name">CareVoy</div>
        <div class="brand-tag">Patient Transportation Coordination, Simplified</div>
      </div>
    </div>
    <div class="header-right">
      <div class="doc-title">Transportation Receipt</div>
      <div class="doc-number">Receipt No. ${escHtml(receiptNumber)}</div>
      <div class="doc-number">${escHtml(dateIssued)}</div>
    </div>
  </div>

  <div class="body-content">

    <div class="info-grid">
      <div class="info-block">
        <div class="info-label">Patient</div>
        <div class="info-row"><strong>${escHtml(patient.full_name || '—')}</strong></div>
        ${patient.email ? `<div class="info-row">${escHtml(patient.email)}</div>` : ''}
        ${patient.phone ? `<div class="info-row">${escHtml(patient.phone)}</div>` : ''}
      </div>
      <div class="info-block">
        <div class="info-label">Non-Emergency Medical Transportation Provider</div>
        <div class="info-row"><strong>${escHtml(nemt.company_name || 'CareVoy Partner')}</strong></div>
        <div class="info-row">Coordinated via CareVoy</div>
      </div>
    </div>

    <div class="service-header">
      <span class="service-header-label">Service Details</span>
      <span class="service-header-label">Date of Service: ${escHtml(serviceDate)}</span>
    </div>

    <div class="service-block">
      <div class="service-desc-main">${escHtml(hospital.name || ride.dropoff_address || '—')}</div>
      ${facilityAddr ? `<div class="service-desc-sub">${escHtml(facilityAddr)}</div>` : ''}
      <div class="service-desc-sub"><strong>Reason for Transport:</strong> ${escHtml(rideTypeLabel(ride.ride_type))}</div>
      <div class="service-desc-sub"><strong>Pickup Address:</strong> ${escHtml(ride.pickup_address || '—')}</div>

      <div class="lineitems-block">
        ${lineItemsHtml}
      </div>
    </div>

    <div class="totals-block">
      <div class="totals-table">
        <div class="totals-row">
          <span>Total ${isFacility ? 'Covered' : 'Paid'}</span>
          <span>$${total.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <div class="payment-info">
      <strong>Payment Method:</strong> ${isFacility ? 'Facility Account' : 'Card on File'} &nbsp;&middot;&nbsp;
      <strong>Payment Status:</strong> ${isFacility ? 'Covered by Facility' : 'Paid in Full'}
    </div>

    <div class="compliance-box">
      <div class="compliance-title">${escHtml(complianceTitle)}</div>
      <div class="compliance-text">${complianceText}</div>
    </div>

  </div>

  <div class="footer">
    <div class="footer-text">
      CareVoy coordinates non-emergency medical transportation on behalf of healthcare facilities and their patients.
      This receipt was generated automatically upon completion of the transportation service.
      For questions regarding this receipt, email billing@carevoy.co.
    </div>
    <div class="footer-brand">CareVoy &middot; www.carevoy.co</div>
  </div>

</div>
</body>
</html>`;
}

// ── XSS guard for data interpolated into HTML ────────────────────────────────
function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Chromium path resolution ─────────────────────────────────────────────────
async function resolveChromium() {
  // Explicit override (useful in Codespaces/CI where Playwright is pre-installed)
  if (process.env.CHROMIUM_EXECUTABLE_PATH) {
    return { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] };
  }

  // Auto-detect Playwright's bundled Chromium (Codespace environment)
  const pwPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (pwPath) {
    try {
      const { execSync } = require('child_process');
      const found = execSync(
        `find ${pwPath} -name "chrome" -executable -type f 2>/dev/null | head -1`,
        { timeout: 3000 }
      ).toString().trim();
      if (found) {
        return { executablePath: found, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] };
      }
    } catch (_) {}
  }

  // Production (Vercel): download @sparticuz/chromium-min at runtime
  const chromium = require('@sparticuz/chromium-min');
  const packUrl = process.env.CHROMIUM_PACK_URL ||
    'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';
  return {
    executablePath: await chromium.executablePath(packUrl),
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
  };
}

// ── PDF generation (Puppeteer + Chromium) ────────────────────────────────────
async function generatePdfBuffer(html) {
  const puppeteer = require('puppeteer-core');
  const { executablePath, args, defaultViewport } = await resolveChromium();

  const browser = await puppeteer.launch({
    executablePath,
    args,
    defaultViewport: defaultViewport || null,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'letter',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ── Atomic receipt number (calls Supabase RPC) ───────────────────────────────
async function assignReceiptNumber(supabase, year) {
  const { data, error } = await supabase.rpc('next_receipt_seq', { p_year: year });
  if (error) throw new Error('Receipt counter error: ' + error.message);
  return `${year}-${String(data).padStart(4, '0')}`;
}

// ── Full ride data fetch ─────────────────────────────────────────────────────
async function fetchRideForReceipt(supabase, rideId) {
  const { data: ride, error } = await supabase
    .from('rides')
    .select(`
      *,
      patients(full_name, email, phone, home_address),
      hospitals(name, address, city, state),
      nemt_partners(company_name, base_fare, per_mile_rate, wheelchair_surcharge, stretcher_surcharge)
    `)
    .eq('id', rideId)
    .single();

  if (error || !ride) throw new Error(`Ride not found: ${rideId} — ${error?.message}`);
  return ride;
}

// ── Upload PDF to private Supabase Storage bucket ────────────────────────────
// Returns the storage path (not a URL). Paths never expire; signed URLs do.
async function uploadPdf(supabase, receiptNumber, rideId, pdfBuffer) {
  const [year, seq] = receiptNumber.split('-');
  const storagePath = `${year}/${seq}/${rideId}.pdf`;

  const { error } = await supabase.storage
    .from('receipts')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

  if (error) throw new Error('Storage upload error: ' + error.message);
  return storagePath;
}

// ── Generate a short-lived signed URL from a stored path ─────────────────────
// expiresIn: seconds (e.g. 3600 = 1 hour, 31536000 = 1 year)
async function getSignedUrl(supabase, storagePath, expiresIn) {
  const { data, error } = await supabase.storage
    .from('receipts')
    .createSignedUrl(storagePath, expiresIn);
  if (error) throw new Error('Signed URL error: ' + error.message);
  return data.signedUrl;
}

// ── Main orchestrator ────────────────────────────────────────────────────────
// Returns { receiptNumber, storagePath, pdfBuffer } on success.
// storagePath is stored in rides.receipt_pdf_url — call getSignedUrl() when you
// need an actual download URL (so URLs can expire without invalidating the data).
// If the ride already has a receipt, returns immediately with cached values.
async function generateAndStoreReceipt(supabase, rideId) {
  // Idempotency check — never issue a second receipt number for the same ride
  const { data: existing } = await supabase
    .from('rides')
    .select('receipt_number, receipt_pdf_url')
    .eq('id', rideId)
    .single();

  if (existing?.receipt_pdf_url) {
    return { receiptNumber: existing.receipt_number, storagePath: existing.receipt_pdf_url, pdfBuffer: null };
  }

  const ride = await fetchRideForReceipt(supabase, rideId);
  const year = new Date().getFullYear();
  const receiptNumber = await assignReceiptNumber(supabase, year);
  const html = buildReceiptHtml(ride, receiptNumber);
  const pdfBuffer = await generatePdfBuffer(html);
  const storagePath = await uploadPdf(supabase, receiptNumber, rideId, pdfBuffer);

  // Persist receipt number and storage path on the ride row
  await supabase.from('rides').update({ receipt_number: receiptNumber, receipt_pdf_url: storagePath }).eq('id', rideId);

  // Upsert into receipts table (aligns with existing schema columns)
  const { items, total } = buildLineItems(ride);
  await supabase.from('receipts').upsert(
    {
      ride_id: rideId,
      patient_id: ride.patient_id,
      pdf_url: storagePath,
      provider_name: ride.nemt_partners?.company_name || 'CareVoy / APB Ventures LLC',
      service_date: ride.pickup_time ? ride.pickup_time.split('T')[0] : null,
      service_type: rideTypeLabel(ride.ride_type),
      amount: total,
      irs_code_reference: 'IRS Section 213(d)',
    },
    { onConflict: 'ride_id', ignoreDuplicates: false }
  );

  return { receiptNumber, storagePath, pdfBuffer };
}

module.exports = {
  buildReceiptHtml,
  buildLineItems,
  generatePdfBuffer,
  generateAndStoreReceipt,
  getSignedUrl,
  rideTypeLabel,
};
