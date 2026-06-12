const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = process.env.RESEND_API ? new Resend(process.env.RESEND_API) : null;

const FROM = 'CareVoy <notifications@carevoy.co>';

function emailTemplate(title, body, ctaText, ctaUrl) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#F0F4F8;font-family:-apple-system,Segoe UI,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px">
      <div style="background:#050D1F;border-radius:14px 14px 0 0;padding:24px 28px">
        <span style="color:#fff;font-size:18px;font-weight:700">CareVoy</span>
        <span style="color:#00C2A8;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin-left:8px">Partner Portal</span>
      </div>
      <div style="background:#fff;border-radius:0 0 14px 14px;padding:28px;border:1px solid #E2E8F0;border-top:none">
        <h1 style="font-size:19px;color:#050D1F;margin:0 0 12px">${title}</h1>
        <div style="font-size:14px;color:#374151;line-height:1.6">${body}</div>
        ${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:20px;background:#050D1F;color:#00C2A8;text-decoration:none;padding:12px 24px;border-radius:9px;font-size:14px;font-weight:700">${ctaText}</a>` : ''}
        <div style="margin-top:24px;padding-top:18px;border-top:1px solid #F0F4F8;font-size:12px;color:#9CA3AF;line-height:1.6">
          <span style="white-space:nowrap">Account changes: <a href="mailto:partners@carevoy.co" style="color:#00C2A8;text-decoration:none">partners@carevoy.co</a></span> &nbsp;·&nbsp; <span style="white-space:nowrap">Billing: <a href="mailto:billing@carevoy.co" style="color:#00C2A8;text-decoration:none">billing@carevoy.co</a></span> &nbsp;·&nbsp; <span style="white-space:nowrap">Help: <a href="mailto:contact@carevoy.co" style="color:#00C2A8;text-decoration:none">contact@carevoy.co</a></span>
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid #F0F4F8;font-size:11px;color:#B0B7C3;line-height:1.7">
            This is an automated message from CareVoy. Please do not reply to this email.<br>
            If you need assistance, contact us at <a href="mailto:contact@carevoy.co" style="color:#9CA3AF;text-decoration:none">contact@carevoy.co</a>.<br>
            &copy; 2026 CareVoy. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  </body></html>`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { type, to, data } = req.body;
    if (!to || !type) return res.status(400).json({ error: 'Missing to or type' });
    if (!resend) return res.status(200).json({ success: false, note: 'Resend not configured' });

    let subject, title, body, ctaText, ctaUrl;
    const portal = 'https://partners.carevoy.co';

    if (type === 'ride_confirmed') {
      subject = 'Ride Confirmed — ' + (data.patient_name || 'Patient');
      title = 'A ride has been confirmed';
      body = `The ride for <strong>${data.patient_name || 'your patient'}</strong> on ${data.date || 'the scheduled date'} has been confirmed and assigned to a transport partner.`;
      ctaText = 'View in Dashboard'; ctaUrl = portal + '/coordinator.html';
    } else if (type === 'ride_completed') {
      subject = 'Ride Completed — ' + (data.patient_name || 'Patient');
      title = 'A ride was completed';
      body = `The ride for <strong>${data.patient_name || 'your patient'}</strong> has been completed. An IRS-compliant HSA/FSA receipt has been generated.`;
      ctaText = 'View Details'; ctaUrl = portal + '/coordinator.html';
    } else if (type === 'ride_assigned_driver') {
      subject = 'New Ride Assigned';
      title = 'You have a new ride assignment';
      body = `A new ride for <strong>${data.patient_name || 'a patient'}</strong> on ${data.date || 'the scheduled date'} has been assigned to your company.`;
      ctaText = 'View Schedule'; ctaUrl = portal + '/driver.html';
    } else if (type === 'patient_no_response') {
      subject = 'Patient Needs Attention';
      title = 'A patient has not confirmed their ride';
      body = `<strong>${data.patient_name || 'A patient'}</strong> has not confirmed their upcoming ride. You may want to follow up or send a reminder.`;
      ctaText = 'View Patient'; ctaUrl = portal + '/coordinator.html';
    } else if (type === 'welcome') {
      subject = 'Welcome to CareVoy';
      title = 'Your account is ready';
      const roleLabel = data.role === 'nemt' ? 'transport partner' : 'facility coordinator';
      const dashUrl = data.role === 'nemt' ? portal + '/driver.html' : portal + '/coordinator.html';
      body = `Welcome${data.full_name ? ' ' + data.full_name : ''}! Your CareVoy ${roleLabel} account has been created successfully. You can now sign in anytime at <a href="${portal}" style="color:#00C2A8;text-decoration:none">partners.carevoy.co</a> to manage rides and coordinate transportation.<br><br>Need help getting started? Just reply to this email or reach us at the contacts below.`;
      ctaText = 'Go to My Dashboard'; ctaUrl = dashUrl;
    } else {
      return res.status(400).json({ error: 'Unknown notification type' });
    }

    const { error } = await resend.emails.send({
      from: FROM, to: [to], subject,
      html: emailTemplate(title, body, ctaText, ctaUrl)
    });
    if (error) return res.status(200).json({ success: false, error: error.message });

    return res.status(200).json({ success: true });
  } catch(e) {
    console.error('Notify error:', e);
    return res.status(500).json({ error: e.message });
  }
};
