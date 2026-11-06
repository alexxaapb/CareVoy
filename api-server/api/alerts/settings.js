'use strict';
// Coordinator alert settings.
//  GET  /api/alerts/settings              -> current settings (links are masked)
//  POST /api/alerts/settings  { slack_webhook_url, teams_webhook_url, alert_email, events[] }  (empty string clears one)
//  POST /api/alerts/settings  { test: true }  -> sends a test message to every saved channel
const { getCaller, adminClient } = require('../../lib/security');
const { EVENTS, validWebhook, sendToChannels } = require('../../lib/alerts');

function mask(u) { return u ? 'Saved (…' + String(u).slice(-6) + ')' : ''; }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const caller = await getCaller(req);
    const hid = caller && caller.coordinator && caller.coordinator.hospital_id;
    if (!hid) return res.status(403).json({ error: 'Only facility coordinators can change alerts' });
    const sb = adminClient();
    const { data: cur } = await sb.from('facility_alerts').select('*').eq('hospital_id', hid).maybeSingle();

    if (req.method === 'GET') {
      return res.status(200).json({
        slack: mask(cur && cur.slack_webhook_url), teams: mask(cur && cur.teams_webhook_url),
        alert_email: (cur && cur.alert_email) || '',
        events: (cur && cur.events) || Object.keys(EVENTS),
        available_events: Object.keys(EVENTS).map((k) => ({ key: k, label: EVENTS[k].label })),
      });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const b = req.body || {};

    if (b.test === true) {
      if (!cur) return res.status(400).json({ error: 'Save a Slack link, Teams link or email first.' });
      const r = await sendToChannels(cur, 'Test from CareVoy: alerts are working. (Real alerts never include patient names.)');
      return res.status(200).json({ results: r });
    }

    const row = { hospital_id: hid, updated_at: new Date().toISOString() };
    if (typeof b.slack_webhook_url === 'string') {
      const v = b.slack_webhook_url.trim();
      if (v && !validWebhook('slack', v)) return res.status(400).json({ error: 'That is not a Slack webhook link (it should start with https://hooks.slack.com/).' });
      row.slack_webhook_url = v || null;
    }
    if (typeof b.teams_webhook_url === 'string') {
      const v = b.teams_webhook_url.trim();
      if (v && !validWebhook('teams', v)) return res.status(400).json({ error: 'That is not a Microsoft Teams webhook link.' });
      row.teams_webhook_url = v || null;
    }
    if (typeof b.alert_email === 'string') {
      const v = b.alert_email.trim();
      if (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return res.status(400).json({ error: 'Enter a valid email address.' });
      row.alert_email = v || null;
    }
    if (Array.isArray(b.events)) row.events = b.events.filter((e) => EVENTS[e]);

    const { error } = await sb.from('facility_alerts').upsert(row);
    if (error) return res.status(500).json({ error: 'Could not save alert settings.' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
};
