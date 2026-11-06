'use strict';
// Developer settings for a facility (API key + webhook). Coordinators only.
//  GET  /api/developer/settings
//  POST { action: 'create_key' }     -> makes a new API key (replaces any old one) and returns it ONCE
//  POST { action: 'revoke_key' }     -> deletes the API key
//  POST { webhook_url, events[] }    -> saves the webhook; first save returns the signing secret ONCE (also on 'rotate_secret')
//  POST { action: 'rotate_secret' }  -> new signing secret, returned ONCE
//  POST { action: 'remove_webhook' } -> clears the webhook
//  POST { test: true }               -> sends a test event to the webhook
const crypto = require('crypto');
const { getCaller, adminClient } = require('../../lib/security');
const { validateFeedUrl } = require('../../lib/calendar');
const { EVENTS } = require('../../lib/alerts');
const { deliver } = require('../../lib/webhooks');

const sha = (k) => crypto.createHash('sha256').update(k).digest('hex');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const caller = await getCaller(req);
    const hid = caller && caller.coordinator && caller.coordinator.hospital_id;
    if (!hid) return res.status(403).json({ error: 'Only facility coordinators can change developer settings' });
    const sb = adminClient();
    const { data: cur } = await sb.from('facility_api').select('*').eq('hospital_id', hid).maybeSingle();
    const audit = (action) => sb.from('audit_log').insert({ actor_id: caller.user.id, actor_role: 'coordinator', action, entity_type: 'hospital', entity_id: hid }).then(() => {}, () => {});

    if (req.method === 'GET') {
      return res.status(200).json({
        has_key: !!(cur && cur.api_key_hash), key_prefix: (cur && cur.api_key_prefix) || '',
        webhook_url: (cur && cur.webhook_url) || '', has_secret: !!(cur && cur.webhook_secret),
        events: (cur && cur.events) || Object.keys(EVENTS),
        available_events: Object.keys(EVENTS).map((k) => ({ key: k, label: EVENTS[k].label })),
      });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const b = req.body || {};
    const now = new Date().toISOString();

    if (b.action === 'create_key') {
      const key = 'cv_live_' + crypto.randomBytes(24).toString('base64url');
      const { error } = await sb.from('facility_api').upsert({ hospital_id: hid, api_key_hash: sha(key), api_key_prefix: key.slice(0, 12), updated_at: now });
      if (error) return res.status(500).json({ error: 'Could not create the key.' });
      await audit('api_key.created');
      return res.status(200).json({ api_key: key, note: 'Copy it now. It will not be shown again.' });
    }
    if (b.action === 'revoke_key') {
      if (cur) await sb.from('facility_api').update({ api_key_hash: null, api_key_prefix: null, updated_at: now }).eq('hospital_id', hid);
      await audit('api_key.revoked');
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'remove_webhook') {
      if (cur) await sb.from('facility_api').update({ webhook_url: null, webhook_secret: null, updated_at: now }).eq('hospital_id', hid);
      return res.status(200).json({ ok: true });
    }
    if (b.action === 'rotate_secret') {
      if (!cur || !cur.webhook_url) return res.status(400).json({ error: 'Save a webhook URL first.' });
      const secret = 'whsec_' + crypto.randomBytes(24).toString('base64url');
      await sb.from('facility_api').update({ webhook_secret: secret, updated_at: now }).eq('hospital_id', hid);
      return res.status(200).json({ webhook_secret: secret, note: 'Copy it now. It will not be shown again.' });
    }
    if (b.test === true) {
      if (!cur || !cur.webhook_url) return res.status(400).json({ error: 'Save a webhook URL first.' });
      const ok = await deliver(cur, 'test', { id: null, pickup_time: null, hospital_id: hid });
      return res.status(200).json({ delivered: !!ok });
    }

    // Save webhook URL and events
    const row = { hospital_id: hid, updated_at: now };
    let secretOut = null;
    if (typeof b.webhook_url === 'string') {
      const v = b.webhook_url.trim();
      if (v) {
        try { row.webhook_url = await validateFeedUrl(v); } catch (e) { return res.status(400).json({ error: 'The webhook URL must be a public https:// address.' }); }
        if (!cur || !cur.webhook_secret) { secretOut = 'whsec_' + crypto.randomBytes(24).toString('base64url'); row.webhook_secret = secretOut; }
      }
    }
    if (Array.isArray(b.events)) row.events = b.events.filter((e) => EVENTS[e]);
    const { error } = await sb.from('facility_api').upsert(row);
    if (error) return res.status(500).json({ error: 'Could not save.' });
    return res.status(200).json(secretOut ? { ok: true, webhook_secret: secretOut, note: 'Copy the secret now. It will not be shown again.' } : { ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Something went wrong' });
  }
};
