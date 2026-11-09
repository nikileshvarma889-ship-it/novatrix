import { z } from "zod";
import { route, jsonError } from "@/lib/api";
import { AiNotConfigured, FORMAT_RULES, LANG_INSTRUCTION, aiConfigured, streamText } from "@/lib/ai";
import { retrieveContext } from "@/lib/retrieval";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1).max(8000).optional(),
  regenerate: z.boolean().optional(),
  language: z.enum(["en", "te", "en_te"]).optional(),
  timezone: z.string().max(64).optional(),
});

const SAVE_INTENT = /^\s*(please\s+)?(remember|save|note down|keep in mind|don'?t forget|store)\b/i;

export const POST = route("chat", Body, async ({ supabase, user }, body) => {
  if (!aiConfigured()) throw new AiNotConfigured();   // fail before saving anything
  let convId = body.conversationId ?? null;
  let question = body.message ?? "";

  if (convId) {
    const { data: conv } = await supabase.from("conversations").select("id").eq("id", convId).maybeSingle();
    if (!conv) return jsonError("Conversation not found.", 404);
  }

  if (body.regenerate) {
    if (!convId) return jsonError("Nothing to regenerate.");
    const { data: last } = await supabase.from("messages").select("id,role,content").eq("conversation_id", convId).order("created_at", { ascending: false }).limit(2);
    const lastAssistant = last?.find((m) => m.role === "assistant");
    const lastUser = last?.find((m) => m.role === "user");
    if (!lastUser) return jsonError("Nothing to regenerate.");
    if (lastAssistant) await supabase.from("messages").delete().eq("id", lastAssistant.id);
    question = lastUser.content;
  } else {
    if (!question) return jsonError("Please type a message.");
    if (!convId) {
      const { data, error } = await supabase.from("conversations").insert({ title: question.slice(0, 60) }).select("id").single();
      if (error || !data) return jsonError("Could not start a conversation: " + (error?.message ?? "unknown error"), 500);
      convId = data.id;
    }
    const { error } = await supabase.from("messages").insert({ conversation_id: convId, role: "user", content: question });
    if (error) return jsonError("Your message could not be saved: " + error.message, 500);
  }

  const [{ data: profile }, { data: history }, ctx] = await Promise.all([
    supabase.from("profiles").select("full_name,language_pref,study_level,timezone").eq("id", user.id).single(),
    supabase.from("messages").select("role,content").eq("conversation_id", convId!).order("created_at", { ascending: false }).limit(16),
    retrieveContext(supabase, question),
  ]);
  const lang = body.language ?? profile?.language_pref ?? "en";
  const tz = body.timezone || profile?.timezone || "Asia/Kolkata";
  const now = new Intl.DateTimeFormat("en-IN", { timeZone: tz, dateStyle: "full", timeStyle: "short" }).format(new Date());
  const saveIntent = SAVE_INTENT.test(question);

  const system = `You are MEMORA, a warm, precise personal memory assistant and study tutor for ${profile?.full_name || "a student"} (level: ${profile?.study_level ?? "intermediate"}; Andhra Pradesh / Telangana Intermediate and EAPCET). Current date/time: ${now} (${tz}).

${LANG_INSTRUCTION[lang]}
${FORMAT_RULES}

PERSONAL DATA RULES — follow strictly:
- The block "USER'S SAVED DATA" below is the ONLY personal information you have. It was retrieved from the user's own account for this question.
- When you use it, cite the reference in square brackets, e.g. "Your Physics assignment is due Friday [M1]."
- Clearly separate three things: (1) what the user actually saved (cite it), (2) what you infer from it (say "I infer…"), (3) your own suggestions (say "Suggestion:").
- NEVER invent memories, notes, tasks, dates, teachers or instructions. If the saved data doesn't contain the answer, say plainly: "I couldn't find that in your saved memories." and suggest saving it.
- You cannot save, edit or delete anything yourself. ${saveIntent ? 'The user wants something remembered: reply in one or two sentences that you have prepared it and they should tap "Review & confirm" on the card below your reply. Do NOT say it is already saved.' : "Never claim you have saved anything."}
- For general knowledge or study questions, answer normally; be accurate and show steps for calculations. Say when you are unsure.
- Do not present AI-generated practice questions as official or previous-year EAPCET questions.

USER'S SAVED DATA:
${ctx.context || "(nothing relevant was found in the user's saved memories, notes or upcoming tasks)"}`;

  const msgs = (history ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const stream = await streamText([{ role: "system", content: system }, ...msgs], { temperature: 0.35, maxTokens: 2200 });

  const enc = new TextEncoder();
  const id = convId!;
  const body2 = new ReadableStream({
    async start(controller) {
      let full = "";
      try {
        for await (const chunk of stream) {
          const t = chunk.choices[0]?.delta?.content ?? "";
          if (t) { full += t; controller.enqueue(enc.encode(t)); }
        }
      } catch {
        const note = "\n\n_The answer was interrupted. Please try again._";
        full += note; controller.enqueue(enc.encode(note));
      }
      const used = ctx.sources.filter((s) => full.includes(`[${s.ref}]`));
      const { error } = await supabase.from("messages").insert({ conversation_id: id, role: "assistant", content: full || "(no answer)", sources: used });
      if (error) controller.enqueue(enc.encode("\n\n_⚠ This reply could not be saved to your conversation history._"));
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", id);
      controller.close();
    },
  });
  return new Response(body2, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-conversation-id": id,
      "x-sources": encodeURIComponent(JSON.stringify(ctx.sources)),
      "x-save-intent": saveIntent ? "1" : "0",
    },
  });
}, 20);
