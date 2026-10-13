'use strict';

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { generateAndStoreReceipt, getSignedUrl } = require('../../lib/receipt-pdf');
const { isInternal, getCaller, canAccessRide } = require('../../lib/security');

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
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { realtime: { transport: ws } }
    );


    // Allow either: internal secret (server-to-server) OR a logged-in user who may access this ride
    if (!isInternal(req)) {
      const caller = await getCaller(req);
      if (!caller) return res.status(401).json({ error: 'Unauthorized' });
      const { data: rideCheck } = await supabase.from('rides').select('patient_id, hospital_id, nemt_partner_id').eq('id', rideId).single();
      if (!rideCheck) return res.status(404).json({ error: 'Ride not found' });
      if (!canAccessRide(caller, rideCheck, { allowPatient: true })) return res.status(403).json({ error: 'Forbidden' });
    }
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
