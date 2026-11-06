'use strict';
// POST /api/rides/cancel   body: { ride_id }
// Cancels a ride that a driver has already accepted ("assigned").
//  - Allowed for the patient, the facility coordinator, or an admin.
//  - Patients and coordinators can cancel until 2 hours before pickup.
//    After that the transport company is already on the way, so they are
//    told to call instead. Admins are not limited by the cutoff.
//  - The driver and the transport company's dispatcher get a text.
// Rides that are not assigned yet keep using the existing cancel flow.

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { getCaller, toE164 } = require('../../lib/security');

const CUTOFF_MS = 2 * 60 * 60 * 1000; // 2 hours

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ride_id } = req.body || {};
    if (!ride_id) return res.status(400).json({ error: 'Missing ride_id' });

    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });

    const sb = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { realtime: { transport: ws } }
    );

    const { data: ride } = await sb
      .from('rides')
      .select('id, status, pickup_time, patient_id, hospital_id, nemt_partner_id, patient_name, driver_name, driver_phone, hospitals(name)')
      .eq('id', ride_id)
      .maybeSingle();
    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    // Who may cancel: the patient, the facility's coordinator, or an admin.
    // Transport company staff cannot cancel patient rides here.
    const isPatient = !!(ride.patient_id && caller.user && ride.patient_id === caller.user.id);
    const isCoordinator = !!(caller.coordinator && caller.coordinator.hospital_id && ride.hospital_id === caller.coordinator.hospital_id);
    if (!caller.isAdmin && !isPatient && !isCoordinator) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (ride.status !== 'assigned') {
      return res.status(400).json({ error: 'This endpoint only cancels rides that have a driver assigned.' });
    }

    const pickupMs = ride.pickup_time ? new Date(ride.pickup_time).getTime() : NaN;
    if (!caller.isAdmin) {
      if (!Number.isFinite(pickupMs)) return res.status(400).json({ error: 'Ride has no pickup time.' });
      if (pickupMs - Date.now() < CUTOFF_MS) {
        return res.status(400).json({
          error: 'Rides can be cancelled up to 2 hours before pickup. Please call your transport company or CareVoy support.',
          code: 'too_late',
        });
      }
    }

    // Only cancel if it is still assigned (guards against a double click or a race).
    const { data: updated, error: upErr } = await sb
      .from('rides')
      .update({ status: 'cancelled' })
      .eq('id', ride_id)
      .eq('status', 'assigned')
      .select('id');
    if (upErr) return res.status(500).json({ error: upErr.message });
    if (!updated || !updated.length) {
      return res.status(409).json({ error: 'This ride changed while you were cancelling. Refresh and try again.' });
    }

    // Tell the driver and the transport company's dispatcher.
    let texted = 0;
    try {
      let partnerPhone = '';
      if (ride.nemt_partner_id) {
        const { data: partner } = await sb.from('nemt_partners').select('contact_phone').eq('id', ride.nemt_partner_id).maybeSingle();
        partnerPhone = partner ? partner.contact_phone : '';
      }
      const targets = Array.from(new Set([toE164(ride.driver_phone), toE164(partnerPhone)].filter(Boolean)));
      const first = String(ride.patient_name || 'A patient').split(' ')[0];
      const facility = (ride.hospitals && ride.hospitals.name) || 'the facility';
      const when = Number.isFinite(pickupMs)
        ? new Date(pickupMs).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET'
        : 'the scheduled time';
      const body = 'CareVoy: the ride for ' + first + ' to ' + facility + ' on ' + when + ' has been cancelled. No pickup is needed.';
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_FROM) {
        for (const to of targets) {
          try {
            const tw = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + process.env.TWILIO_ACCOUNT_SID + '/Messages.json', {
              method: 'POST',
              headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ To: to, From: process.env.TWILIO_PHONE_FROM, Body: body }).toString(),
            });
            if (tw.ok) texted++;
          } catch (e) { console.warn('cancel SMS failed:', e.message); }
        }
      }
    } catch (e) { console.warn('cancel notify failed (non-fatal):', e.message); }

    try {
      await sb.from('audit_log').insert({
        actor_id: caller.user.id,
        actor_role: caller.isAdmin ? 'admin' : (isCoordinator ? 'coordinator' : 'patient'),
        action: 'ride.cancelled_after_assign',
        entity_type: 'rides',
        entity_id: ride_id,
        new_value: { texted },
      });
    } catch (e) { console.warn('audit failed (non-fatal):', e.message); }

    return res.status(200).json({ success: true, notified: texted });
  } catch (e) {
    console.error('rides/cancel error:', e);
    return res.status(500).json({ error: e.message });
  }
};
