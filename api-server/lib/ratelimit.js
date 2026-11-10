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
module.exports = { limited, record };
