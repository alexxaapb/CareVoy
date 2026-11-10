// POST /api/chat   body: { message, context }  (or { messages, conversationId } for the app)
// Signed-in users only. Limit: 100 messages per person per 24 hours.
const Anthropic = require('@anthropic-ai/sdk');
const { getCaller, adminClient } = require('../lib/security');
const { limited, record } = require('../lib/ratelimit');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const caller = await getCaller(req);
    if (!caller) return res.status(401).json({ error: 'Please sign in' });
    // The app sends a full conversation; hand that shape to the conversation handler.
    if (req.body && Array.isArray(req.body.messages)) return require('./chat/index.js')(req, res);

    const { message, context } = req.body || {};
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Missing message' });
    if (message.length > 1000) return res.status(400).json({ error: 'Message too long' });
    const sb = adminClient();
    if (await limited(sb, caller.user.id, 'rate.chat', 100, 86400000)) return res.status(429).json({ error: 'Daily chat limit reached. Please try again tomorrow.' });
    const system = context === 'patient'
      ? "You are CareVoy's AI care coordinator. Help patients with medical rides, HSA/FSA reimbursement, and receipts. Be brief and warm. If they ask about specific rides, tell them to check the Rides tab."
      : "You are CareVoy's assistant for healthcare coordinators. Help with ride coordination and platform questions. Be concise.";
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 600, system, messages: [{ role: 'user', content: message }] });
    await record(sb, caller.user.id, 'user', 'rate.chat');
    return res.status(200).json({ success: true, reply: (response.content && response.content[0] && response.content[0].text) || '' });
  } catch (e) { return res.status(500).json({ error: 'Chat is unavailable right now' }); }
};
