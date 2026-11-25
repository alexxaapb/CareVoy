const { escHtml, adminClient } = require('../../lib/security');
const { hit, clientIp } = require('../../lib/ratelimit');
const { PLANS, tierForBand } = require('../../lib/plans');
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    // Public sign-up form: cap it per IP so it cannot be used to spam your inbox or other people's.
    if (await hit(adminClient(), 'ip:' + clientIp(req), 'new_partner', 5, 3600000)) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    const { type, name, phone, city, state, details } = req.body || {};
    let email = req.body && req.body.email;
    if (email && !/^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/.test(String(email))) email = '';
    const appType = type === "nemt" ? "NEMT Partner" : "Facility Partner";
    // Facilities create their own account and pay to start: tell them which plan fits (no price in email).
    const isFacility = type !== "nemt";
    const recTier = isFacility ? tierForBand(details && details.patient_volume) : null;
    const recName = recTier === 'enterprise' ? 'Enterprise' : (PLANS[recTier] && PLANS[recTier].label);
    const adminHtml = '<div style="font-family:sans-serif;max-width:520px;margin:0 auto"><div style="background:#050D1F;padding:20px;border-radius:12px 12px 0 0"><span style="color:#00C2A8;font-weight:700;font-size:18px">CareVoy</span></div><div style="background:#fff;border:1px solid #E2E8F0;padding:28px;border-radius:0 0 12px 12px"><h2 style="color:#050D1F;font-size:18px;margin:0 0 12px">' + (isFacility ? 'New facility account (not paid yet)' : 'New ' + appType + ' Application') + '</h2><p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px"><strong>' + escHtml(name||"Unknown") + '</strong> from ' + escHtml(city||"") + ', ' + escHtml(state||"") + (isFacility ? ' created an account. They choose and pay for a plan when they sign in' + (recName ? ' (recommended: ' + escHtml(recName) + ')' : '') + '.' : ' has submitted a partner application.') + '</p><a href="https://partners.carevoy.co/admin" style="display:inline-block;background:#050D1F;color:#00C2A8;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">Review in Dashboard</a></div></div>';
    const facilityHtml = '<div style="font-family:sans-serif;max-width:520px;margin:0 auto"><div style="background:#050D1F;padding:20px;border-radius:12px 12px 0 0"><span style="color:#00C2A8;font-weight:700;font-size:18px">CareVoy</span></div><div style="background:#fff;border:1px solid #E2E8F0;padding:28px;border-radius:0 0 12px 12px"><h2 style="color:#050D1F;font-size:18px;margin:0 0 12px">Your CareVoy account is ready</h2><p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 14px">Thank you for creating a CareVoy account for <strong>' + escHtml(name||"your facility") + '</strong>.</p><p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 14px">Based on the ride volume you told us, we recommend the <strong>' + escHtml(recName || 'right') + '</strong> plan. ' + (recTier === 'enterprise' ? 'Reply to this email and we will build a custom plan for you.' : 'Sign in, review the plans, and pay to start using CareVoy. You can choose a different plan at that step.') + '</p><a href="https://partners.carevoy.co" style="display:inline-block;background:#050D1F;color:#00C2A8;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">Sign in to get started</a><p style="color:#9CA3AF;font-size:12px;margin-top:24px">Questions? Email partners@carevoy.co</p></div></div>';
    const applicantHtml = '<div style="font-family:sans-serif;max-width:520px;margin:0 auto"><div style="background:#050D1F;padding:20px;border-radius:12px 12px 0 0"><span style="color:#00C2A8;font-weight:700;font-size:18px">CareVoy</span></div><div style="background:#fff;border:1px solid #E2E8F0;padding:28px;border-radius:0 0 12px 12px"><h2 style="color:#050D1F;font-size:18px;margin:0 0 12px">Application received!</h2><p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">Thank you for applying to join CareVoy. We have received your application and will be in touch as soon as possible.</p><p style="color:#9CA3AF;font-size:12px;margin-top:24px">Questions? Email partners@carevoy.co</p></div></div>';
    let sent = false;
    if (process.env.RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ from: "CareVoy <partners@carevoy.co>", to: ["partners@carevoy.co"], subject: (isFacility ? "New facility account: " : "New " + appType + " Application: ") + escHtml(name||"Unknown"), html: adminHtml })
      });
      if (r.ok) sent = true;
      if (email) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ from: "CareVoy <partners@carevoy.co>", to: [email], subject: isFacility ? "Your CareVoy account is ready" : "Your CareVoy partner application was received", html: isFacility ? facilityHtml : applicantHtml })
        }).catch(function(e){});
      }
    }
    return res.status(200).json({ success: true, sent, resend_key_set: !!process.env.RESEND_API_KEY });
  } catch(e) { return res.status(500).json({ error: e.message }); }
};
