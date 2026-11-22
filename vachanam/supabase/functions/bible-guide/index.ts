// Supabase Edge Function (Deno). Deploy:  supabase functions deploy bible-guide
// Secret:  supabase secrets set ANTHROPIC_API_KEY=...   (never put the key in the app)
import Anthropic from "@anthropic-ai/sdk";
import { handle, makeLimiter } from "./guide.ts";

const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
const allow = makeLimiter(20, 10 * 60_000);   // 20 questions / 10 min per IP, per instance
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};

Deno.serve((req) => handle(req, { client, allow, cors }));
