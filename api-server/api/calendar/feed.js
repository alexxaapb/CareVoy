'use strict';
// Calendar Sync (add-on). Coordinators only.
//  GET    /api/calendar/feed   -> { connected, suggestions[] }   (reads the calendar live; nothing is stored)
//  GET    /api/calendar/feed?from=ISO&to=ISO -> { connected, events[] }   (all events in that window, max 62 days, for the calendar view)
//  POST   /api/calendar/feed   body { ics_url }  -> saves the link after checking it works
//  DELETE /api/calendar/feed   -> disconnects
// Off unless CALENDAR_SYNC_ENABLED=true in Vercel.
const { getCaller, adminClient } = require('../../lib/security');
const { requireAddon } = require('../../lib/billing');
const { validateFeedUrl, fetchIcs, suggestionsFromIcs, eventsFromIcs } = require('../../lib/calendar');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ error: 'Unauthorized' });
    const hid = caller.coordinator && caller.coordinator.hospital_id;
    if (!hid) return res.status(403).json({ error: 'Only facility coordinators can use Calendar Sync' });
    if (process.env.CALENDAR_SYNC_ENABLED !== 'true') {
      return res.status(503).json({ error: 'Calendar Sync is not available yet.', code: 'not_enabled' });
    }
    const gate = await requireAddon(caller, 'calendar_sync');
    if (!gate.ok) return res.status(402).json({ error: 'Calendar Sync is an add-on.', code: 'addon_required', addon: 'calendar_sync' });

    const sb = adminClient();

    if (req.method === 'GET') {
      const { data, error } = await sb.from('facility_calendar').select('ics_url').eq('hospital_id', hid).maybeSingle();
      if (error || !data) return res.status(200).json({ connected: false, suggestions: [] });
      try {
        const text = await fetchIcs(data.ics_url);
        const q = req.query || {};
        if (q.from && q.to) {
          const f = new Date(q.from), t = new Date(q.to);
          if (isNaN(f) || isNaN(t) || t <= f || t - f > 62 * 86400000) return res.status(400).json({ error: 'Invalid date range' });
          return res.status(200).json({ connected: true, events: eventsFromIcs(text, f, t) });
        }
        return res.status(200).json({ connected: true, suggestions: suggestionsFromIcs(text) });
      } catch (e) {
        return res.status(200).json({ connected: true, suggestions: [], events: [], warning: e.message });
      }
    }

    if (req.method === 'POST') {
      const url = await validateFeedUrl(req.body && req.body.ics_url);
      const text = await fetchIcs(url);
      suggestionsFromIcs(text); // makes sure it parses
      const { error } = await sb.from('facility_calendar').upsert({ hospital_id: hid, ics_url: url, updated_at: new Date().toISOString() });
      if (error) return res.status(500).json({ error: 'Could not save the link.' });
      await sb.from('audit_log').insert({ actor_id: caller.user.id, actor_role: 'coordinator', action: 'calendar.connected', entity_type: 'hospital', entity_id: hid });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      await sb.from('facility_calendar').delete().eq('hospital_id', hid);
      await sb.from('audit_log').insert({ actor_id: caller.user.id, actor_role: 'coordinator', action: 'calendar.disconnected', entity_type: 'hospital', entity_id: hid });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    // Never log calendar contents
    return res.status(400).json({ error: e.message || 'Something went wrong' });
  }
};
