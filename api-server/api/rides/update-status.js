const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ride_id, status, driver_name, driver_phone, action } = req.body;
    if (!ride_id) return res.status(400).json({ error: 'Missing ride_id' });

    const sb = createClient(
      process.env.SUPABASE_URL || 'https://byflpckbjjumxxjxoplk.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Handle ride deletion
    if (action === 'delete') {
      const { error } = await sb.from('rides').delete().eq('id', ride_id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, action: 'deleted' });
    }

    // Build update payload
    const update = { status };
    if (status === 'assigned' && driver_name) { update.driver_name = driver_name; update.driver_phone = driver_phone || null; update.assigned_at = new Date().toISOString(); }
    if (status === 'in_progress') { /* just status */ }
    if (status === 'completed') { update.completed_at = new Date().toISOString(); }

    const { error } = await sb.from('rides').update(update).eq('id', ride_id);
    if (error) return res.status(500).json({ error: error.message });

    // On completion, send receipt email
    if (status === 'completed') {
      try {
        const { data: ride } = await sb.from('rides').select('*').eq('id', ride_id).single();
        if (ride && ride.contact_email && process.env.RESEND_API_KEY) {
          const { Resend } = require('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          const patName = (ride.patient_name || 'Patient').split(' ')[0];
          const facility = ride.hospital_name || 'your healthcare facility';
          const rideDate = ride.pickup_time ? new Date(ride.pickup_time).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}) : '';
          const pickup = ride.pickup_address || 'Pickup location';
          const dropoff = ride.dropoff_address || facility;
          const cost = ride.estimated_cost || ride.actual_cost || 0;
          const isFacility = ride.payment_responsibility === 'facility';

          const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
            <div style="background:#050D1F;padding:20px 24px;border-radius:12px 12px 0 0;text-align:center">
              <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:1px">CareVoy</span></div>
            <div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px">
              <p style="color:#050D1F;font-size:16px;font-weight:600;margin:0 0 16px">Ride Receipt</p>
              <table style="width:100%;border-collapse:collapse;font-size:13px;color:#374151">
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Patient</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${ride.patient_name || 'Patient'}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Date</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${rideDate}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Pickup</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${pickup}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Destination</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${dropoff}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Facility</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${facility}</td></tr>
                <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;color:#6B7280">Payment</td><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;text-align:right;font-weight:600;color:#050D1F">${isFacility ? 'Facility-Covered' : 'Self-Pay'}</td></tr>
                ${cost > 0 ? '<tr><td style="padding:12px 0;color:#6B7280;font-size:14px">Total</td><td style="padding:12px 0;text-align:right;font-weight:700;font-size:18px;color:#050D1F">$' + parseFloat(cost).toFixed(2) + '</td></tr>' : ''}
              </table>
              ${!isFacility ? '<div style="background:rgba(0,194,168,0.06);border:1px solid rgba(0,194,168,0.2);border-radius:10px;padding:14px 16px;margin-top:20px;font-size:12px;color:#00836F;line-height:1.6"><strong>IRS Section 213(d) Eligible</strong><br>This receipt documents a qualified medical transportation expense eligible for HSA/FSA reimbursement. Retain this receipt for your records.</div>' : ''}
              ${isFacility ? '<div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:14px 16px;margin-top:20px;font-size:12px;color:#065F46;line-height:1.6">This ride was covered by your healthcare facility. No payment is required from you.</div>' : ''}
              <p style="color:#9CA3AF;font-size:11px;margin:24px 0 0;line-height:1.5">CareVoy coordinates medical transportation on behalf of healthcare facilities. Questions? Contact support@carevoy.co.</p>
            </div></div>`;

          await resend.emails.send({
            from: 'CareVoy <notifications@carevoy.co>',
            to: ride.contact_email,
            subject: isFacility ? 'Ride Completed — ' + facility : 'Ride Receipt — $' + parseFloat(cost).toFixed(2),
            html
          });
        }
      } catch(emailErr) { console.error('Receipt email error:', emailErr); }
    }

    return res.status(200).json({ success: true, status });
  } catch(e) {
    console.error('update-status error:', e);
    return res.status(500).json({ error: e.message });
  }
};
