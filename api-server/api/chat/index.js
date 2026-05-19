const Anthropic = require("@anthropic-ai/sdk");
const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { messages, patientId, conversationId } = req.body;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are a care coordinator for CareVoy, a medical transportation service. 
Help patients book non-emergency medical rides. Be warm, clear, and efficient.
Extract: pickup address, destination, appointment date/time, procedure type, 
wheelchair needs, and whether they need a companion.
Once you have all details, confirm the ride summary and tell them you'll book it.
Never give medical advice. For emergencies, always say call 911.`,
      messages,
    });

    const reply = response.content[0].text;

    // Persist to Supabase if conversationId provided
    if (conversationId && patientId) {
      await supabase.from("ai_messages").insert([
        { conversation_id: conversationId, role: "assistant", content: reply }
      ]);
    }

    res.status(200).json({ reply, usage: response.usage });
  } catch (e) {
    console.error("chat error:", e);
    res.status(500).json({ error: e.message });
  }
};
