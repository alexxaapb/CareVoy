'use strict';

const { getCaller, canAccessRide, adminClient } = require('../../lib/security');
const { regenerateReceiptPdf } = require('../../lib/receipt-pdf');

// A facility coordinator (or admin) confirms that the patient's visit took place.
// The confirmation is stamped on the ride (and its round-trip partner) and, if a receipt
// PDF already exists, the PDF is rebuilt with the same receipt number.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rideId = req.body && req.body.ride_id;
    if (!rideId) return res.status(400).json({ error: 'ride_id required' });

    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });
    // Only facility staff (or admin) can vouch for a visit, not drivers or patients
    if (!caller.isAdmin && !caller.coordinator) return res.status(403).json({ error: 'Only facility staff can confirm a visit' });

    const sb = adminClient();
    const { data: ride } = await sb.from('rides')
      .select('id, status, hospital_id, nemt_partner_id, patient_id, round_trip_pair_id, receipt_pdf_url, visit_confirmed_at')
      .eq('id', rideId).maybeSingle();
    if (!ride) return res.status(404).json({ error: 'Ride not found' });
    if (!canAccessRide(caller, ride)) return res.status(403).json({ error: 'Forbidden' });
    if (ride.status !== 'completed') return res.status(400).json({ error: 'You can confirm a visit once the ride is completed' });
    if (ride.visit_confirmed_at) return res.status(200).json({ success: true, already: true, confirmed_at: ride.visit_confirmed_at });

    let who = (caller.user && (caller.user.user_metadata && caller.user.user_metadata.full_name)) || (caller.user && caller.user.email) || 'Facility staff';
    who = String(who).slice(0, 120);
    const now = new Date().toISOString();

    let ids = [ride.id];
    if (ride.round_trip_pair_id) {
      const { data: legs } = await sb.from('rides').select('id, hospital_id').eq('round_trip_pair_id', ride.round_trip_pair_id);
      ids = (legs || []).filter((l) => l.hospital_id === ride.hospital_id).map((l) => l.id);
      if (!ids.includes(ride.id)) ids.push(ride.id);
    }
    const { error } = await sb.from('rides').update({ visit_confirmed_at: now, visit_confirmed_by: who }).in('id', ids);
    if (error) return res.status(500).json({ error: 'Could not save the confirmation. Has the visit confirmation SQL been run?' });

    // Rebuild the receipt PDF if one was already issued. A failure here must not undo the confirmation.
    let receipt = 'not_issued_yet';
    if (ride.receipt_pdf_url) {
      try { await regenerateReceiptPdf(sb, ride.id); receipt = 'updated'; }
      catch (e) { console.error('confirm-visit receipt rebuild:', e.message); receipt = 'update_failed'; }
    }
    return res.status(200).json({ success: true, confirmed_at: now, confirmed_by: who, receipt });
  } catch (e) {
    console.error('confirm-visit', e.message);
    return res.status(500).json({ error: 'Could not confirm the visit' });
  }
};
