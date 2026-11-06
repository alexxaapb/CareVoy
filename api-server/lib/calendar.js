'use strict';
// Calendar Sync helpers. Reads a facility's private calendar link (ICS feed from
// Google Calendar, Outlook, Apple, etc.), expands recurring events, and picks
// out appointments that usually need a ride. Nothing from the calendar is stored.

const dns = require('dns').promises;
const net = require('net');
const ical = require('node-ical');

const MAX_BYTES = 5 * 1024 * 1024;
const WINDOW_DAYS = 14;

// Appointment keywords -> the "Appointment Type" values used by the coordinator invite form.
const RULES = [
  { re: /\bdialysis\b|\bhemodialysis\b/i, type: 'dialysis', label: 'Dialysis' },
  { re: /\bphysical therapy\b|\boccupational therapy\b|\bPT\b|\bOT\b|\btherapy\b/i, type: 'therapy', label: 'Therapy' },
  { re: /\bpre[- ]?op\b/i, type: 'pre_op', label: 'Pre-op' },
  { re: /\bpost[- ]?op\b|\bfollow[- ]?up\b/i, type: 'follow_up', label: 'Follow-up' },
  { re: /\bchemo|\binfusion\b|\bradiation\b|\bsurgery\b|\bprocedure\b|\bspecialist\b|\bclinic\b|\bcardiology\b|\bneurology\b|\bwound care\b|\bappointment\b|\bvisit\b|\bconsult/i, type: 'other', label: 'Medical visit' },
];

function classify(text) {
  for (const r of RULES) if (r.re.test(text || '')) return { type: r.type, label: r.label };
  return null;
}

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:');
}

// Accepts https:// and webcal:// links only. Blocks internal addresses.
async function validateFeedUrl(raw) {
  let s = String(raw || '').trim();
  if (s.length > 2000) throw new Error('That link is too long.');
  s = s.replace(/^webcal:\/\//i, 'https://');
  let u;
  try { u = new URL(s); } catch (e) { throw new Error('That does not look like a calendar link.'); }
  if (u.protocol !== 'https:') throw new Error('The calendar link must start with https:// or webcal://');
  if (u.username || u.password) throw new Error('That link is not allowed.');
  if (u.port && u.port !== '443') throw new Error('That link is not allowed.');
  const host = u.hostname;
  if (net.isIP(host)) { if (privateIp(host)) throw new Error('That link is not allowed.'); }
  else {
    if (host === 'localhost' || !host.includes('.')) throw new Error('That link is not allowed.');
    const addrs = await dns.lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => privateIp(a.address))) throw new Error('That link is not allowed.');
  }
  return u.toString();
}

async function fetchIcs(url) {
  const safe = await validateFeedUrl(url);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(safe, { redirect: 'manual', signal: ctrl.signal, headers: { Accept: 'text/calendar,*/*' } });
    if (r.status >= 300 && r.status < 400) throw new Error('The calendar link redirects somewhere else. Please copy the secret link directly.');
    if (!r.ok) throw new Error('Could not read the calendar (' + r.status + '). Check the link.');
    const len = Number(r.headers.get('content-length') || 0);
    if (len > MAX_BYTES) throw new Error('That calendar is too large.');
    const text = await r.text();
    if (text.length > MAX_BYTES) throw new Error('That calendar is too large.');
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('That link is not a calendar feed.');
    return text;
  } finally { clearTimeout(t); }
}

// Returns upcoming ride-worthy appointments in the next 14 days, soonest first.
function suggestionsFromIcs(text, now) {
  const from = now || new Date();
  const to = new Date(from.getTime() + WINDOW_DAYS * 86400000);
  const data = ical.sync.parseICS(text);
  const out = [];
  for (const k of Object.keys(data)) {
    const ev = data[k];
    if (!ev || ev.type !== 'VEVENT') continue;
    const insts = ical.expandRecurringEvent(ev, { from, to, includeOverrides: true, excludeExdates: true });
    for (const i of insts) {
      const title = String(i.summary && i.summary.val !== undefined ? i.summary.val : i.summary || '');
      const loc = String(ev.location && ev.location.val !== undefined ? ev.location.val : ev.location || '');
      const cls = classify(title + ' ' + loc);
      if (!cls || !i.start || i.start < from || i.start > to) continue;
      out.push({ title: title.slice(0, 120), location: loc.slice(0, 160), start: i.start.toISOString(), all_day: !!i.datetype && i.datetype === 'date', type: cls.type, label: cls.label });
    }
  }
  out.sort((a, b) => a.start.localeCompare(b.start));
  return out.filter((x) => !x.all_day).slice(0, 60);
}

module.exports = { validateFeedUrl, fetchIcs, suggestionsFromIcs, classify };
