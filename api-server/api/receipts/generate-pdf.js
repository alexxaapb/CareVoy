'use strict';

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
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
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { realtime: { transport: ws } }
    );


    // Allow either: internal secret (server-to-server) OR a valid JWT owning the ride / staff member
    const internalSecret = req.headers['x-internal-secret'];
    if (internalSecret !== process.env.INTERNAL_API_SECRET) {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.replace(/^Bearer\s+/i, '');
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      const anonClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY || 'sb_publishable_z2cTzmjGH3njGM1pGqEV7g_h2ys8C0H', { realtime: { transport: ws } });
      const { data: { user: caller }, error: authErr } = await anonClient.auth.getUser(token);
      if (authErr || !caller) return res.status(401).json({ error: 'Invalid or expired token' });
      const { data: rideCheck } = await supabase.from('rides').select('patient_id').eq('id', rideId).single();
      if (!rideCheck) return res.status(404).json({ error: 'Ride not found' });
      const isOwner = rideCheck.patient_id === caller.id;
      if (!isOwner) {
        const { data: staffRow } = await supabase.from('staff').select('role').eq('id', caller.id).single();
        if (!staffRow) return res.status(403).json({ error: 'Forbidden' });
      }
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
