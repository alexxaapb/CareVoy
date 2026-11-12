'use strict';
// Facility alerts to Slack, Microsoft Teams and email.
// Opt-in: nothing is sent unless a coordinator has saved a link or email on the Integrations page.
// PRIVACY: messages never contain patient names or other patient details. They say a ride
// event happened, give the time, and point back to CareVoy.

const { adminClient } = require('./security');

const EVENTS = {
  ride_accepted:   { label: 'A driver accepted a ride' },
  ride_completed:  { label: 'A ride was completed' },
  ride_cancelled:  { label: 'A ride was cancelled' },
  ride_unaccepted: { label: 'A ride still has no driver' },
  patient_no_response: { label: 'A patient has not confirmed an upcoming ride' },
};

const SLACK_HOST = /^hooks\.slack\.com$/i;
const TEAMS_HOST = /(^|\.)(webhook\.office\.com|logic\.azure\.com|powerplatform\.com|outlook\.office\.com)$/i;

function validWebhook(kind, raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch (e) { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
  if (kind === 'slack' && !SLACK_HOST.test(u.hostname)) return null;
  if (kind === 'teams' && !TEAMS_HOST.test(u.hostname)) return null;
  return u.toString();
}

function fmtWhen(t) {
  if (!t) return '';
  return new Date(t).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET';
}

function buildText(event, pickupTime) {
  const base = (EVENTS[event] || { label: 'Ride update' }).label;
  const when = pickupTime ? ' (pickup ' + fmtWhen(pickupTime) + ')' : '';
  return base + when + '. Open CareVoy for details: https://partners.carevoy.co/coordinator.html#rides';
}

async function post(url, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { method: 'POST', redirect: 'manual', signal: ctrl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.status >= 200 && r.status < 300;
  } catch (e) { return false; } finally { clearTimeout(t); }
}

async function sendToChannels(cfg, text) {
  const out = { slack: null, teams: null, email: null };
  if (cfg.slack_webhook_url && validWebhook('slack', cfg.slack_webhook_url)) {
    out.slack = await post(cfg.slack_webhook_url, { text });
  }
  if (cfg.teams_webhook_url && validWebhook('teams', cfg.teams_webhook_url)) {
    out.teams = await post(cfg.teams_webhook_url, {
      type: 'message',
      attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: { type: 'AdaptiveCard', version: '1.4', body: [{ type: 'TextBlock', text, wrap: true }] } }],
    });
  }
  if (cfg.alert_email && process.env.RESEND_API_KEY) {
    try {
      const { Resend } = require('resend');
      const r = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: 'CareVoy Alerts <notifications@carevoy.co>',
        to: cfg.alert_email,
        subject: 'CareVoy ride update',
        html: '<div style="font-family:sans-serif;font-size:14px;color:#060D1F"><p>' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/(https:\/\/\S+)/, '<a href="$1">$1</a>') + '</p><p style="color:#6B7280;font-size:12px">You are receiving this because alerts are turned on in your CareVoy Integrations page.</p></div>',
      });
      out.email = !(r && r.error);
    } catch (e) { out.email = false; }
  }
  return out;
}

// Fire-and-forget safe: never throws, never blocks a ride update on a failed alert.
// Sends to the facility's Slack/Teams/email alerts and to its webhook, whichever are set up.
async function notifyFacility(hospitalId, event, ride) {
  try {
    if (!hospitalId || !EVENTS[event]) return;
    const sb = adminClient();
    const [al, api] = await Promise.all([
      sb.from('facility_alerts').select('*').eq('hospital_id', hospitalId).maybeSingle(),
      sb.from('facility_api').select('webhook_url, webhook_secret, events').eq('hospital_id', hospitalId).maybeSingle(),
    ]);
    const jobs = [];
    if (!al.error && al.data && (al.data.events || []).includes(event)) {
      jobs.push(sendToChannels(al.data, buildText(event, ride && ride.pickup_time)));
    }
    if (!api.error && api.data && api.data.webhook_url && (api.data.events || []).includes(event)) {
      jobs.push(require('./webhooks').deliver(api.data, event, Object.assign({ hospital_id: hospitalId }, ride)));
    }
    await Promise.all(jobs);
  } catch (e) { /* alerts must never break the main flow */ }
}

module.exports = { EVENTS, validWebhook, buildText, sendToChannels, notifyFacility };
