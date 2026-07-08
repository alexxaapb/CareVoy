'use strict';

// Local sample generator — uses Playwright's pre-installed Chromium.
// Run with: node scripts/generate-sample.js
// Outputs: api-server/sample-receipt.pdf and sample-receipt.html

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const { buildReceiptHtml } = require('../lib/receipt-pdf');

// Realistic test ride — matches fields returned by the DB join in receipt-pdf.js
const sampleRide = {
  id: 'test-ride-0001',
  ride_type: 'pre_op',
  pickup_address: '1124 Olentangy River Rd, Columbus, OH 43212',
  dropoff_address: '3535 Olentangy River Rd, Columbus, OH 43212',
  pickup_time: '2026-07-08T13:15:00.000Z',
  estimated_miles: 3.2,
  mobility_needs: 'wheelchair',
  companion_requested: false,
  actual_cost: 58.00,
  payment_responsibility: 'self_pay',
  patients: {
    full_name: 'Margaret Okafor',
    email: 'm.okafor@email.com',
    phone: '(614) 555-0182',
    home_address: '1124 Olentangy River Rd, Columbus, OH 43212',
  },
  hospitals: {
    name: 'OhioHealth Riverside Methodist Hospital',
    address: '3535 Olentangy River Rd',
    city: 'Columbus',
    state: 'OH',
  },
  nemt_partners: {
    company_name: 'Central Ohio Medical Transport, LLC',
    base_fare: 25.00,
    per_mile_rate: 2.50,
    wheelchair_surcharge: 15.00,
    stretcher_surcharge: 0,
  },
};

const RECEIPT_NUMBER = '2026-0001';

async function run() {
  const html = buildReceiptHtml(sampleRide, RECEIPT_NUMBER);

  // Save HTML
  const htmlOut = path.join(__dirname, '../sample-receipt.html');
  fs.writeFileSync(htmlOut, html);
  console.log('HTML saved:', htmlOut);

  // Find local Playwright Chromium
  let chromePath;
  const pwBase = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    chromePath = execSync(
      `find ${pwBase} -name "chrome" -executable -type f 2>/dev/null | head -1`,
      { timeout: 5000 }
    ).toString().trim();
  } catch (_) {}

  if (!chromePath) {
    console.error('Could not find Playwright Chromium. Set PLAYWRIGHT_BROWSERS_PATH.');
    console.log('HTML-only output saved. Open it in a browser and print to PDF.');
    process.exit(0);
  }

  console.log('Using Chromium:', chromePath);

  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    headless: true,
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'letter',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await browser.close();

  const pdfOut = path.join(__dirname, '../sample-receipt.pdf');
  fs.writeFileSync(pdfOut, pdf);
  console.log('PDF saved:', pdfOut);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
