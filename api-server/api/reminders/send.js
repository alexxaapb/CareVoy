import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { ride_id } = req.body;
    if (!ride_id) return res.status(400).json({ error: 'Missing ride_id' });

    // Get ride with hospital info
    const { data: ride } = await supabase
      .from('rides')
      .select('*, hospitals(name)')
      .eq('id', ride_id)
      .single();

    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    const contactPhone = ride.contact_phone;
    const patientName  = ride.patient_name || 'your patient';
    const facilityName = ride.hospitals?.name || 'your facility';
    const apptDate     = ride.pickup_time
      ? new Date(ride.pickup_time).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      : 'your upcoming appointment';

    const appLink = 'https://apps.apple.com/us/app/carevoy/id6768714735';
    const message = `Reminder: ${patientName} has a ride scheduled to ${facilityName} on ${apptDate}. Download CareVoy to confirm your pickup: ${appLink}`;

    let smsSent = false;

    // Try Twilio if configured
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_FROM && contactPhone) {
      try {
        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + Buffer.from(
                process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN
              ).toString('base64'),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              To: contactPhone,
              From: process.env.TWILIO_PHONE_FROM,
              Body: message,
            }).toString(),
          }
        );
        if (twilioRes.ok) smsSent = true;
      } catch(e) { console.warn('Twilio SMS failed:', e.message); }
    }

    // Update ride status and reminder flag
    await supabase
      .from('rides')
      .update({
        status: 'reminder_sent',
        reminder_sent: true,
        reminder_sent_at: new Date().toISOString(),
      })
      .eq('id', ride_id);

    // Audit log
    await supabase.from('audit_log').insert({
      actor_role: 'system',
      action: 'reminder.sent',
      entity_type: 'rides',
      entity_id: ride_id,
      new_value: { sms_sent: smsSent, contact_phone: contactPhone },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      sms_sent: smsSent,
      note: smsSent ? 'SMS sent via Twilio' : 'Twilio not configured — add TWILIO_* env vars to enable SMS',
    });

  } catch(e) {
    console.error('Reminder send error:', e);
    return res.status(500).json({ error: e.message });
  }
}
