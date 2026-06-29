const Anthropic = require('@anthropic-ai/sdk');
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ error: 'Missing message' });
    const system = context === 'patient'
      ? "You are CareVoy's AI care coordinator. Help patients with medical rides, HSA/FSA reimbursement, and receipts. Be brief and warm. If they ask about specific rides, tell them to check the Rides tab."
      : "You are CareVoy's assistant for healthcare coordinators. Help with ride coordination and platform questions. Be concise.";
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 600, system, messages: [{ role: 'user', content: message }] });
    return res.status(200).json({ success: true, reply: response.content?.[0]?.text || '' });
  } catch(e) { return res.status(500).json({ error: e.message }); }
};
