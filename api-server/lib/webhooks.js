'use strict';
// Outbound webhooks for facility IT. Opt-in: nothing is sent unless a facility saved a URL.
// Messages are signed so the receiver can check they came from CareVoy:
//   X-CareVoy-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>" with the webhook secret>
//   X-CareVoy-Timestamp: <unix seconds>
// Payloads carry ids and times only (no patient names); the receiver fetches details with the API key.

const crypto = require('crypto');
const { validateFeedUrl } = require('./calendar');

function sign(secret, timestamp, rawBody) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(timestamp + '.' + rawBody).digest('hex');
}

async function deliver(cfg, event, ride) {
  if (!cfg || !cfg.webhook_url || !cfg.webhook_secret) return null;
  try {
    const url = await validateFeedUrl(cfg.webhook_url); // https only, blocks internal addresses
    const body = JSON.stringify({
      id: 'evt_' + crypto.randomBytes(8).toString('hex'),
      event,
      created_at: new Date().toISOString(),
      data: { ride_id: ride && ride.id || null, pickup_time: ride && ride.pickup_time || null, hospital_id: ride && ride.hospital_id || null },
    });
    const ts = String(Math.floor(Date.now() / 1000));
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const r = await fetch(url, {
        method: 'POST', redirect: 'manual', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'X-CareVoy-Timestamp': ts, 'X-CareVoy-Signature': sign(cfg.webhook_secret, ts, body), 'User-Agent': 'CareVoy-Webhooks/1' },
        body,
      });
      return r.status >= 200 && r.status < 300;
    } finally { clearTimeout(t); }
  } catch (e) { return false; }
}

module.exports = { deliver, sign };
