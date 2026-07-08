'use strict';

const { createClient } = require('@supabase/supabase-js');
const { generateAndStoreReceipt } = require('../../lib/receipt-pdf');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { rideId } = req.query;
  if (!rideId) return res.status(400).json({ error: 'rideId required' });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { receiptNumber, pdfUrl, pdfBuffer } = await generateAndStoreReceipt(supabase, rideId);

    // If we have the fresh buffer, return it directly; otherwise redirect to Storage URL
    if (pdfBuffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="carevoy-receipt-${receiptNumber}.pdf"`);
      return res.status(200).send(pdfBuffer);
    }

    // Cached: redirect to the stored PDF
    return res.redirect(302, pdfUrl);
  } catch (e) {
    console.error('generate-pdf error:', e);
    return res.status(500).json({ error: e.message });
  }
};
