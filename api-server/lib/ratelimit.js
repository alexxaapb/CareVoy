// Simple per-person daily limit that reuses the audit log (no new table).
// limited(sb, actorId, action, max, windowMs) -> true when the person is over the limit.
// record(sb, actorId, role, action) saves one use.
async function limited(sb, actorId, action, max, windowMs) {
  const since = new Date(Date.now() - (windowMs || 86400000)).toISOString();
  const { count } = await sb.from('audit_log').select('id', { count: 'exact', head: true })
    .eq('actor_id', actorId).eq('action', action).gte('created_at', since);
  return (count || 0) >= max;
}
async function record(sb, actorId, role, action) {
  await sb.from('audit_log').insert({ actor_id: actorId, actor_role: role, action, entity_type: 'rate_limit' }).then(() => {}, () => {});
}

// Counter for people who are not signed in (or for an API key): keyed by any string, such as an IP address.
// hit(sb, key, action, max, windowMs) -> true when over the limit. Records this attempt. Fails open
// (returns false) if the rate_hits table is missing so a setup slip never blocks real users.
async function hit(sb, key, action, max, windowMs) {
  try {
    const since = new Date(Date.now() - (windowMs || 3600000)).toISOString();
    const { count, error } = await sb.from('rate_hits').select('id', { count: 'exact', head: true })
      .eq('key', String(key).slice(0, 120)).eq('action', action).gte('created_at', since);
    if (error) return false;
    if ((count || 0) >= max) return true;
    await sb.from('rate_hits').insert({ key: String(key).slice(0, 120), action }).then(() => {}, () => {});
    if (Math.random() < 0.01) await sb.from('rate_hits').delete().lt('created_at', new Date(Date.now() - 2 * 86400000).toISOString()).then(() => {}, () => {});
    return false;
  } catch (e) { return false; }
}
function clientIp(req) {
  const xf = String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim();
  return xf || (req.socket && req.socket.remoteAddress) || 'unknown';
}
module.exports = { limited, record, hit, clientIp };
