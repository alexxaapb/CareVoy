import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Verify caller is admin
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Missing auth" });
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: "Invalid auth" });

    const { data: staff } = await supabase
      .from("staff")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!staff || staff.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { role, email, company_name, facility_name } = req.body;
    if (!role || !["nemt", "coordinator"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Generate secure random token
    const inviteToken = crypto.randomBytes(24).toString("base64url");

    const { data, error } = await supabase
      .from("invites")
      .insert({
        token: inviteToken,
        role,
        email: email || null,
        company_name: company_name || null,
        facility_name: facility_name || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    const inviteUrl = `https://partners.carevoy.co/invite?token=${inviteToken}`;
    
    return res.status(200).json({ 
      invite_url: inviteUrl,
      token: inviteToken,
      expires_at: data.expires_at,
    });
  } catch (e) {
    console.error("Invite create error:", e);
    return res.status(500).json({ error: e.message });
  }
}
