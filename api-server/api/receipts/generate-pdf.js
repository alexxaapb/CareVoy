'use strict';

const { createClient } = require('@supabase/supabase-js');
const { generateAndStoreReceipt, getSignedUrl } = require('../../lib/receipt-pdf');

const SIGNED_URL_TTL = 60 * 60; // 1 hour — coordinator/admin uses it immediately

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

    const { receiptNumber, storagePath, pdfBuffer } = await generateAndStoreReceipt(supabase, rideId);

    // Fresh generation — stream the buffer directly (no round-trip to Storage needed)
    if (pdfBuffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="carevoy-receipt-${receiptNumber}.pdf"`);
      return res.status(200).send(pdfBuffer);
    }

    // Already stored — generate a short-lived signed URL and redirect
    const signedUrl = await getSignedUrl(supabase, storagePath, SIGNED_URL_TTL);
    return res.redirect(302, signedUrl);
  } catch (e) {
    console.error('generate-pdf error:', e);
    return res.status(500).json({ error: e.message });
  }
};
