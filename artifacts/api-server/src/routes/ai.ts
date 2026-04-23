import { Router, type IRouter } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router: IRouter = Router();

const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

const anthropic = new Anthropic({
  baseURL,
  apiKey: apiKey ?? "placeholder",
});

const SYSTEM_PROMPT = `You are a care coordinator for CareVoy, a surgical transportation platform. You help patients book rides to and from surgery and answer questions about HSA/FSA payments. You are warm, clear, and reassuring — patients may be anxious about their upcoming surgery.

You can help with:
- Booking rides (collect surgery date, hospital, procedure type, mobility needs)
- HSA/FSA eligibility questions (transportation to surgery is always eligible under IRS Code 213d)
- Checking upcoming ride status
- Rescheduling or cancelling rides
- Receipt and reimbursement questions

When a patient wants to book a ride, collect: surgery date, hospital name, procedure type, and any special needs. Then confirm the details and tell them you are sending the request through. After confirmation, append a JSON code block at the very end of your response in this exact format (and ONLY when all required fields are confirmed):

\`\`\`json
{
  "intent": "book_ride",
  "surgery_date": "YYYY-MM-DD",
  "surgery_time": "HH:MM",
  "hospital_name": "string",
  "procedure_type": "string",
  "needs_wheelchair": false,
  "needs_companion": false,
  "special_instructions": "string"
}
\`\`\`

Always be concise. Never mention that you are Claude or made by Anthropic. You are the CareVoy Care Coordinator.`;

type ChatBody = {
  messages?: Array<{ role: "user" | "assistant"; content: string }>;
  patientFirstName?: string;
};

router.post("/ai/chat", async (req, res) => {
  try {
    const { messages, patientFirstName } = req.body as ChatBody;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages required" });
    }

    const safeMessages = messages
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0,
      )
      .map((m) => ({ role: m.role, content: m.content }));

    if (safeMessages.length === 0) {
      return res.status(400).json({ error: "no valid messages" });
    }

    const system = patientFirstName
      ? `${SYSTEM_PROMPT}\n\nThe patient's first name is ${patientFirstName}. Address them by name when natural.`
      : SYSTEM_PROMPT;

    const result = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages: safeMessages,
    });

    const block = result.content[0];
    const text = block && block.type === "text" ? block.text : "";

    let extraction: Record<string, unknown> | null = null;
    let visibleText = text;
    const fence = text.match(/```json\s*([\s\S]*?)```/i);
    if (fence) {
      try {
        const parsed = JSON.parse(fence[1].trim());
        if (parsed && parsed.intent === "book_ride") {
          extraction = parsed;
          visibleText = text.replace(fence[0], "").trim();
        }
      } catch {
        // ignore parse errors
      }
    }

    return res.json({ content: visibleText, extraction });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    req.log?.error({ err }, "ai chat error");
    return res.status(500).json({ error: msg });
  }
});

export default router;
