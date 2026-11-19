'use strict';
// GET /api/public/estimator-unsubscribe?token=<uuid>   (public, opened from the reminder email)
// Stops any further estimator reminders for that person and shows a plain confirmation page.
const { adminClient, escHtml } = require('../../lib/security');

module.exports = async function handler(req, res) {
  const page = msg => '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CareVoy</title><body style="font-family:sans-serif;max-width:480px;margin:80px auto;padding:0 16px;color:#060D1F"><h2>CareVoy</h2><p>' + escHtml(msg) + '</p></body>';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  try {
    const token = String((req.query && req.query.token) || '');
    if (!/^[0-9a-f-]{36}$/i.test(token)) return res.status(400).send(page('This link is not valid.'));
    await adminClient().from('estimator_leads').update({ unsubscribed: true }).eq('token', token);
    return res.status(200).send(page('You are unsubscribed. We will not send any more estimator reminders.'));
  } catch (e) { return res.status(500).send(page('Something went wrong. Please email partners@carevoy.co.')); }
};
