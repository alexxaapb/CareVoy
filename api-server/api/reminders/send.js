const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ride_id } = req.body;
    if (!ride_id) return res.status(400).json({ error: 'Missing ride_id' });

    const { data: ride } = await supabase.from('rides').select('*, hospitals(name)').eq('id', ride_id).single();
    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    var rawPhone = ride.contact_phone || '';
    var digits = String(rawPhone).replace(/\D/g, '');
    if (digits.length === 10) digits = '1' + digits;
    const contactPhone = digits ? '+' + digits : '';
    const patientName  = ride.patient_name || 'your patient';
    const facilityName = (ride.hospitals && ride.hospitals.name) || 'your facility';
    const apptDate     = ride.pickup_time ? new Date(ride.pickup_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'your upcoming appointment';
    const appLink = 'https://apps.apple.com/us/app/carevoy/id6768714735';
    const message = 'Reminder: ' + patientName + ' has an appointment scheduled at ' + facilityName + ' on ' + apptDate + '. Download CareVoy to book your ride: ' + appLink;

    let smsSent = false;
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_FROM && contactPhone) {
      try {
        const twilioRes = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + process.env.TWILIO_ACCOUNT_SID + '/Messages.json', {
          method: 'POST',
          headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ To: contactPhone, From: process.env.TWILIO_PHONE_FROM, Body: message }).toString()
        });
        if (twilioRes.ok) smsSent = true;
      } catch(e) { console.warn('Twilio SMS failed:', e.message); }
    }

    await supabase.from('rides').update({ status: 'reminder_sent', reminder_sent: true, reminder_sent_at: new Date().toISOString() }).eq('id', ride_id);
    try {
      await supabase.from('audit_log').insert({ actor_role: 'system', action: 'reminder.sent', entity_type: 'rides', entity_id: ride_id, new_value: { sms_sent: smsSent } });
    } catch (auditErr) {
      console.warn('audit log insert failed (non-fatal):', auditErr.message);
    }

    let emailSent = false;
    const contactEmail = ride.contact_email || null;
    if (contactEmail && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = require('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const apptStr = ride.pickup_time ? new Date(ride.pickup_time).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'your upcoming appointment';
        const patName = ride.patient_name || 'there';
        const facName = ride.hospital_name || 'your healthcare facility';
        await resend.emails.send({
          from: 'CareVoy <notifications@carevoy.co>',
          to: contactEmail,
          subject: 'Reminder: Your ride is waiting to be scheduled',
          html: '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px"><div style="background:#050D1F;padding:20px 24px;border-radius:12px 12px 0 0;text-align:center"><span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:1px">CareVoy</span></div><div style="background:#fff;border:1px solid #E8E4DC;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px"><p style="color:#1A1714;font-size:16px;font-weight:600;margin:0 0 12px">Hi ' + patName + ',</p><p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px"><strong>' + facName + '</strong> has arranged a medical ride for you on <strong>' + apptStr + '</strong>.</p><p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px">Please visit your patient portal to schedule your pickup time and confirm your ride.</p><a href="https://partners.carevoy.co/patients" style="display:inline-block;background:#050D1F;color:#fff;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">Schedule My Ride</a><p style="color:#9CA3AF;font-size:12px;margin:24px 0 0">Automated reminder from CareVoy on behalf of ' + facName + '</p></div></div>'
        });
        emailSent = true;
      } catch(e){ console.warn('Reminder email error:', e.message); }
    }
    return res.status(200).json({ success: true, sms_sent: smsSent, email_sent: emailSent });
  } catch(e) {
    console.error('Reminder send error:', e);
    return res.status(500).json({ error: e.message });
  }
};
