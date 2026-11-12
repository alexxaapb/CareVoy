// Small shared helper for texting through Twilio. Returns true when Twilio accepted the message.
// Texts contain no medical details: only a time, a driver first name and a STOP line.
const { toE164 } = require('./security');

function configured() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_FROM);
}

async function sendSms(rawPhone, body) {
  const to = toE164(rawPhone);
  if (!to || !configured()) return false;
  try {
    const r = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + process.env.TWILIO_ACCOUNT_SID + '/Messages.json', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_PHONE_FROM, Body: body }).toString()
    });
    return r.ok;
  } catch (e) {
    console.warn('SMS failed:', e.message);
    return false;
  }
}

// Time zone for a ride, from the facility's state (falls back to Eastern).
const CENTRAL = ['TX','IL','WI','MN','IA','MO','AR','LA','MS','AL','OK','KS','NE','SD','ND'];
const MOUNTAIN = ['CO','NM','UT','WY','MT','ID'];
function tzForState(st) {
  const s = String(st || '').trim().toUpperCase();
  if (CENTRAL.indexOf(s) >= 0) return 'America/Chicago';
  if (MOUNTAIN.indexOf(s) >= 0) return 'America/Denver';
  if (s === 'AZ') return 'America/Phoenix';
  if (['CA','WA','OR','NV'].indexOf(s) >= 0) return 'America/Los_Angeles';
  return 'America/New_York';
}
function localTime(iso, tz) {
  return new Date(iso).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
}
function localDay(iso, tz) {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'short', day: 'numeric' });
}
function localHour(date, tz) {
  return parseInt(new Date(date).toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }), 10) % 24;
}

module.exports = { sendSms, configured, tzForState, localTime, localDay, localHour };
