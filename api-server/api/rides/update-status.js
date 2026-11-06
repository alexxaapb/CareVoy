const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { getCaller, canAccessRide } = require('../../lib/security');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let { ride_id, status, driver_name, driver_phone, action, resend_only } = req.body;
    const resendOnly = resend_only === true;
    if (!ride_id) return res.status(400).json({ error: 'Missing ride_id' });

    const authHeader = req.headers['authorization'] || '';
    const jwtToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!jwtToken) return res.status(401).json({ error: 'Unauthorized' });
    const anonSb = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL || 'https://byflpckbjjumxxjxoplk.supabase.co',
      process.env.SUPABASE_ANON_KEY || 'sb_publishable_z2cTzmjGH3njGM1pGqEV7g_h2ys8C0H'
    );
    const { data: { user: caller }, error: authErr } = await anonSb.auth.getUser(jwtToken);
    if (authErr || !caller) return res.status(401).json({ error: 'Invalid or expired token' });

    const sb = createClient(
      process.env.SUPABASE_URL || 'https://byflpckbjjumxxjxoplk.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    , { realtime: { transport: ws } });

    // Authorization: the caller must be allowed to touch THIS ride
    // (admin: any ride; coordinator: own facility; NEMT: own assigned rides)
    const callerCtx = await getCaller(req);
    if (!callerCtx) return res.status(401).json({ error: 'Unauthorized' });
    const { data: rideAuth } = await sb.from('rides').select('id, hospital_id, nemt_partner_id, patient_id').eq('id', ride_id).maybeSingle();
    if (!rideAuth) return res.status(404).json({ error: 'Ride not found' });
    if (!canAccessRide(callerCtx, rideAuth)) return res.status(403).json({ error: 'Forbidden' });

    // Handle ride deletion (admins only)
    if (action === 'delete') {
      if (!callerCtx.isAdmin) return res.status(403).json({ error: 'Admin access required to delete rides' });
      const { error } = await sb.from('rides').delete().eq('id', ride_id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, action: 'deleted' });
    }

    // Resend Receipt: only re-send the email for a ride that is already completed.
    // Must NOT touch the ride (completion time, fare, payment) or charge anything again.
    if (resendOnly) {
      const { data: cur } = await sb.from('rides').select('status').eq('id', ride_id).maybeSingle();
      if (!cur || cur.status !== 'completed') {
        return res.status(400).json({ error: 'Receipts can only be resent for completed rides.' });
      }
      status = 'resend';
    }

    // Build update payload
    const update = { status };
    if (status === 'confirmed') { update.confirmed_at = new Date().toISOString(); }
    if (status === 'assigned' && driver_name) { update.driver_name = driver_name; update.driver_phone = driver_phone || null; update.assigned_at = new Date().toISOString(); }
    if (status === 'in_progress') { update.in_progress_at = new Date().toISOString(); }
    if (status === 'completed') {
      update.completed_at = new Date().toISOString();
      // Always calculate actual fare fresh from the NEMT's CURRENT rates at completion time.
      // Never trust a frozen estimated_cost — NEMT rates can change between booking and completion.
      const { data: existingRide } = await sb.from('rides').select('*').eq('id', ride_id).single();
      if (existingRide && !existingRide.actual_cost) {
        if (!existingRide.nemt_partner_id || !existingRide.estimated_miles) {
          return res.status(400).json({ error: 'Cannot complete ride: missing NEMT assignment or mileage data required to calculate fare.' });
        }
        const { data: nemt } = await sb.from('nemt_partners').select('base_fare,per_mile_rate,wheelchair_surcharge,stretcher_surcharge').eq('id', existingRide.nemt_partner_id).single();
        if (!nemt) {
          return res.status(400).json({ error: 'Cannot complete ride: NEMT partner rates not found.' });
        }
        let fare = parseFloat(nemt.base_fare || 0);
        fare += parseFloat(nemt.per_mile_rate || 0) * existingRide.estimated_miles;
        const mobility = existingRide.mobility_needs || '';
        if (mobility.includes('wheelchair')) fare += parseFloat(nemt.wheelchair_surcharge || 0);
        if (mobility.includes('stretcher')) fare += parseFloat(nemt.stretcher_surcharge || 0);
        update.actual_cost = Math.round(fare * 100) / 100;

        // Charge the patient's saved card for self-pay rides
        if (existingRide.payment_responsibility !== 'facility' && existingRide.patient_id) {
          const { data: patient } = await sb.from('patients').select('stripe_customer_id, stripe_payment_method_id').eq('id', existingRide.patient_id).single();
          if (patient && patient.stripe_customer_id && patient.stripe_payment_method_id) {
            try {
              const Stripe = require('stripe');
              const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
              const amountCents = Math.round(update.actual_cost * 100);
              const paymentIntent = await stripe.paymentIntents.create({
                amount: amountCents,
                currency: 'usd',
                customer: patient.stripe_customer_id,
                payment_method: patient.stripe_payment_method_id,
                off_session: true,
                confirm: true,
                metadata: { rideId: ride_id, patientId: existingRide.patient_id },
                description: 'CareVoy medical transportation — IRS Code 213(d)',
              });
              update.payment_status = paymentIntent.status === 'succeeded' ? 'paid' : 'pending';
              update.stripe_payment_intent_id = paymentIntent.id;
            } catch (chargeErr) {
              console.error('Charge failed at completion:', chargeErr);
              update.payment_status = 'failed';
            }
          } else {
            update.payment_status = 'no_payment_method';
          }
        }
      }
    }

    if (!resendOnly) {
      const { error } = await sb.from('rides').update(update).eq('id', ride_id);
      if (error) return res.status(500).json({ error: error.message });
      // Optional facility alerts (Slack/Teams/email). Never blocks the update; contains no patient details.
      if (status === 'assigned' || status === 'completed' || status === 'cancelled') {
        try {
          const { notifyFacility } = require('../../lib/alerts');
          const { data: ar } = await sb.from('rides').select('hospital_id, pickup_time').eq('id', ride_id).maybeSingle();
          if (ar) await notifyFacility(ar.hospital_id, status === 'assigned' ? 'ride_accepted' : status === 'completed' ? 'ride_completed' : 'ride_cancelled', ar);
        } catch (_) {}
      }
    }

    // On completion (or a resend), generate branded PDF receipt and send email with attachment
    if (status === 'completed' || resendOnly) {
      try {
        const { data: ride } = await sb.from('rides').select('*').eq('id', ride_id).single();

        // Round trips: one combined receipt and one email, sent after the second ride completes
        let pairLegs = null;
        if (ride && ride.round_trip_pair_id) {
          const { data: sibs } = await sb.from('rides')
            .select('id,status,pickup_time,pickup_address,dropoff_address,actual_cost,estimated_cost')
            .eq('round_trip_pair_id', ride.round_trip_pair_id)
            .neq('status', 'cancelled')
            .order('pickup_time', { ascending: true });
          if (sibs && sibs.length > 1) {
            if (sibs.some(function(x){ return x.status !== 'completed'; })) {
              return res.status(200).json({ success: true, status, receipt: 'waits_for_return_ride' });
            }
            pairLegs = sibs;
          }
        }

        if (ride && ride.contact_email && process.env.RESEND_API_KEY) {
          const { Resend } = require('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          const facility = ride.hospital_name || 'your healthcare facility';
          const cost = pairLegs
            ? pairLegs.reduce(function(a, l){ return a + parseFloat(l.actual_cost || l.estimated_cost || 0); }, 0)
            : (ride.actual_cost || ride.estimated_cost || 0);
          const isFacility = ride.payment_responsibility === 'facility';

          // Generate branded PDF receipt
          let pdfAttachment = null;
          let receiptNumber = null;
          let pdfUrl = null;  // signed URL for email link (1-year TTL)
          try {
            const { generateAndStoreReceipt, getSignedUrl } = require('../../lib/receipt-pdf');
            const result = await generateAndStoreReceipt(sb, ride_id);
            receiptNumber = result.receiptNumber;
            if (result.pdfBuffer) {
              pdfAttachment = { filename: `carevoy-receipt-${receiptNumber}.pdf`, content: result.pdfBuffer };
              // Generate a 1-year signed URL so the email link stays valid
              try {
                pdfUrl = await getSignedUrl(sb, result.storagePath, 60 * 60 * 24 * 365);
              } catch (_) {}
            } else if (result.storagePath) {
              // Already stored from a prior run — download the existing PDF to attach it again,
              // and also generate a signed URL for the email link.
              try {
                pdfUrl = await getSignedUrl(sb, result.storagePath, 60 * 60 * 24 * 365);
              } catch (_) {}
              try {
                const { downloadPdf } = require('../../lib/receipt-pdf');
                const existingBuffer = await downloadPdf(sb, result.storagePath);
                pdfAttachment = { filename: `carevoy-receipt-${receiptNumber}.pdf`, content: existingBuffer };
              } catch (dlErr) {
                console.error('Could not re-download existing PDF for attachment:', dlErr);
              }
            }
          } catch (pdfErr) {
            console.error('PDF generation error (email will send without attachment):', pdfErr);
          }

          let rideDate = ride.pickup_time ? new Date(ride.pickup_time).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}) : '';
          let pickup = ride.pickup_address || 'Pickup location';
          let dropoff = ride.dropoff_address || facility;
          if (pairLegs) {
            const dayFmt = function(t){ return t ? new Date(t).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}) : ''; };
            rideDate = Array.from(new Set(pairLegs.map(function(l){ return dayFmt(l.pickup_time); }))).join(' & ');
            pickup = pairLegs[0].pickup_address || pickup;
            dropoff = (pairLegs[0].dropoff_address || dropoff) + ' and return';
          }

          const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
            <div style="background:#050D1F;padding:20px 24px;border-radius:12px 12px 0 0;text-align:center">
              <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:1px">CareVoy</span></div>
            <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px">
              <p style="color:#050D1F;font-size:16px;font-weight:600;margin:0 0 16px">${pairLegs ? 'Round-Trip Receipt' : 'Ride Receipt'}${receiptNumber ? ' — ' + receiptNumber : ''}</p>
              <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151">
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Patient</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${ride.patient_name || 'Patient'}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Date</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${rideDate}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Pickup</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${pickup}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Destination</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${dropoff}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Facility</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${facility}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Payment</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${isFacility ? 'Facility-Covered' : 'Self-Pay'}</td></tr>
                ${cost > 0 ? '<tr><td style="padding:12px 0;color:#6B7280;font-size:14px">Total</td><td style="padding:12px 0;text-align:right;font-weight:700;font-size:18px;color:#050D1F">$' + parseFloat(cost).toFixed(2) + '</td></tr>' : ''}
              </table>
              ${pdfUrl ? '<p style="margin:20px 0 0;font-size:12px;color:#374151">Your full receipt is attached to this email. You can also <a href="' + pdfUrl + '" style="color:#00836F;">view or download it here</a>.</p>' : ''}
              ${!isFacility ? '<div style="background:rgba(0,194,168,0.06);border:1px solid rgba(0,194,168,0.2);border-radius:10px;padding:14px 16px;margin-top:20px;font-size:12px;color:#00836F;line-height:1.6"><strong>IRS Section 213(d) Eligible</strong><br>This receipt documents a qualified medical transportation expense eligible for HSA/FSA reimbursement. Retain this receipt for your records.</div>' : ''}
              ${isFacility ? '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:14px 16px;margin-top:20px;font-size:12px;color:#065F46;line-height:1.6">This ride was covered by your healthcare facility. No payment is required from you.</div>' : ''}
              <p style="color:#9CA3AF;font-size:11px;margin:24px 0 0;line-height:1.5">CareVoy coordinates medical transportation on behalf of healthcare facilities. Questions? Contact support@carevoy.co.</p>
            </div></div>`;

          const emailPayload = {
            from: 'CareVoy <notifications@carevoy.co>',
            to: ride.contact_email,
            subject: isFacility ? 'Ride Completed — ' + facility : (pairLegs ? 'Round-Trip Receipt — $' : 'Ride Receipt — $') + parseFloat(cost).toFixed(2),
            html,
          };
          if (pdfAttachment) emailPayload.attachments = [pdfAttachment];

          await resend.emails.send(emailPayload);
        }
      } catch(emailErr) { console.error('Receipt email error:', emailErr); }
    }

    return res.status(200).json({ success: true, status });
  } catch(e) {
    console.error('update-status error:', e);
    return res.status(500).json({ error: e.message });
  }
};
