'use strict';
// Shared security helpers for api-server endpoints.
//  - getCaller(req): verifies the Supabase JWT and loads the caller's roles
//  - isInternal(req): server-to-server calls (cron, other endpoints)
//  - canAccessRide(caller, ride): who may touch a given ride
//  - escHtml(s): escape text before putting it into email/HTML

const crypto = require('crypto');
const ws = require('ws');
const { createClient } = require('@supabase/supabase-js');

let _admin = null;
function adminClient() {
  if (!_admin) {
    _admin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { realtime: { transport: ws } }
    );
  }
  return _admin;
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// Server-to-server calls send the secret in the x-internal-secret header.
// INTERNAL_API_SECRET is preferred; CRON_SECRET is accepted so existing
// cron jobs keep working. If neither env var is set, nothing matches.
function internalSecrets() {
  return [process.env.INTERNAL_API_SECRET, process.env.CRON_SECRET].filter(Boolean);
}

function isInternal(req) {
  const given = req.headers['x-internal-secret'];
  return internalSecrets().some((s) => safeEqual(given, s));
}

// Header to attach on server-to-server fetches.
function internalHeaders(extra) {
  const secret = process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET || '';
  return Object.assign({ 'x-internal-secret': secret }, extra || {});
}

function bearerToken(req) {
  const h = (req.headers && req.headers['authorization']) || '';
  return h.replace(/^Bearer\s+/i, '').trim();
}

// Returns null when there is no valid login. Otherwise:
// { user, staff, coordinator, isAdmin }
async function getCaller(req) {
  const token = bearerToken(req);
  if (!token) return null;
  const sb = adminClient();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data || !data.user) return null;
  const user = data.user;
  const [staffRes, coordRes] = await Promise.all([
    sb.from('staff').select('role, nemt_partner_id').eq('id', user.id).maybeSingle(),
    sb.from('hospital_coordinators').select('hospital_id').eq('id', user.id).maybeSingle(),
  ]);
  const staff = staffRes.data || null;
  const coordinator = coordRes.data || null;
  return { user, staff, coordinator, isAdmin: !!(staff && staff.role === 'admin') };
}

// admin: any ride. coordinator: rides of their own facility.
// nemt staff: rides assigned to their own company.
// patient (only if allowPatient): their own rides.
function canAccessRide(caller, ride, opts) {
  if (!caller || !ride) return false;
  if (caller.isAdmin) return true;
  if (caller.coordinator && caller.coordinator.hospital_id &&
      ride.hospital_id === caller.coordinator.hospital_id) return true;
  if (caller.staff && caller.staff.role === 'nemt' && caller.staff.nemt_partner_id &&
      ride.nemt_partner_id === caller.staff.nemt_partner_id) return true;
  if (opts && opts.allowPatient && ride.patient_id && ride.patient_id === caller.user.id) return true;
  return false;
}

function deny(res, status, message) {
  return res.status(status).json({ error: message });
}

function escHtml(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  adminClient, safeEqual, isInternal, internalHeaders, getCaller,
  canAccessRide, deny, escHtml, bearerToken,
};
