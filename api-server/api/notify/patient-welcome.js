module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS') return res.status(200).end();
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  try {
    const {name, email} = req.body;
    if(!email) return res.status(400).json({error:'Missing email'});
    const firstName = (name||'there').split(' ')[0];
    const {Resend} = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const {error} = await resend.emails.send({
      from: 'CareVoy <notifications@carevoy.co>',
      to: email,
      subject: 'Welcome to CareVoy',
      html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
        <div style="background:#050D1F;padding:20px 24px;border-radius:12px 12px 0 0;text-align:center">
          <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:1px">CareVoy</span>
        </div>
        <div style="background:#fff;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:28px 24px">
          <p style="color:#050D1F;font-size:16px;font-weight:600;margin:0 0 12px">Welcome, ${firstName}.</p>
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">
            Your CareVoy account is ready. Your healthcare facility has arranged medical transportation for you — your upcoming ride will appear automatically in your portal.
          </p>
          <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 24px">
            Once your ride is scheduled, an IRS Section 213(d) compliant receipt will be emailed to you automatically for HSA/FSA reimbursement.
          </p>
          <a href="https://partners.carevoy.co/patients"
             style="display:inline-block;background:#050D1F;color:#fff;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none">
            Go to My Portal
          </a>
          <p style="color:#9CA3AF;font-size:12px;margin:24px 0 0;line-height:1.5">
            CareVoy coordinates medical transportation on behalf of your healthcare facility.<br>
            Questions? Reply to this email or visit partners.carevoy.co/patients.
          </p>
        </div>
      </div>`
    });
    if(error) return res.status(500).json({error: error.message});
    return res.status(200).json({success:true, email_sent:true});
  } catch(e) { return res.status(500).json({error:e.message}); }
};
