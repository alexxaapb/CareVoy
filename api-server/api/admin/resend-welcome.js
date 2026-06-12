const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let sent = 0;
    const results = [];

    // All coordinators
    const { data: coords } = await supabase.from('hospital_coordinators').select('email, full_name');
    if (coords) {
      for (const cd of coords) {
        if (cd.email) {
          try {
            await fetch('https://care-voy-api-server.vercel.app/api/notify/send', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'welcome', to: cd.email, data: { full_name: cd.full_name, role: 'coordinator' } })
            });
            sent++; results.push(cd.email);
          } catch(_) {}
        }
      }
    }

    // All NEMT staff
    const { data: staff } = await supabase.from('staff').select('email, full_name').eq('role', 'nemt');
    if (staff) {
      for (const st of staff) {
        if (st.email) {
          try {
            await fetch('https://care-voy-api-server.vercel.app/api/notify/send', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'welcome', to: st.email, data: { full_name: st.full_name, role: 'nemt' } })
            });
            sent++; results.push(st.email);
          } catch(_) {}
        }
      }
    }

    return res.status(200).json({ success: true, sent, emails: results });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
