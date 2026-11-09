import { z } from "zod";
import { route } from "@/lib/api";
import { FORMAT_RULES, LANG_INSTRUCTION, streamText } from "@/lib/ai";
import { CHAPTERS } from "@/lib/syllabus";
import { STYLES } from "@/lib/study";

export const runtime = "nodejs";
export const maxDuration = 60;



const Body = z.object({
  subject: z.enum(["mathematics", "physics", "chemistry", "general"]),
  chapterId: z.string().max(20).nullable().optional(),
  question: z.string().trim().min(2).max(6000),
  language: z.enum(["en", "te", "en_te"]).default("en"),
  style: z.enum(Object.keys(STYLES) as [keyof typeof STYLES, ...(keyof typeof STYLES)[]]).default("simple"),
  notebook: z.boolean().default(false),
  level: z.enum(["inter1", "inter2", "eapcet"]).default("inter1"),
});

const NOTEBOOK = `NOTEBOOK FORMAT (mandatory). Write it like a neat examination answer, using exactly these headings as level-3 markdown headings, in this order (skip "Given" and "Formula" only if truly not applicable, e.g. a pure theory question):
### Question
(restate the question)
### Given
(bullet list of known values with symbols and SI units)
### To Find
(what must be calculated)
### Formula
(the relevant formula(s) in display LaTeX, and one line on why it applies)
### Solution
(numbered steps: **Step 1:** …; show every substitution and calculation in LaTeX; keep units throughout)
### Final Answer
(the boxed result, e.g. $$\\boxed{v = 20\\ \\mathrm{m\\,s^{-1}}}$$)
Keep language simple. No extra sections or chit-chat.`;

const SUBJECT_RULES: Record<string, string> = {
  mathematics: "Use correct mathematical notation. Show intermediate algebra; don't skip steps. Verify the answer by substitution or a quick check where possible.",
  physics: "Always state what is given, what must be found, which formula is needed and WHY, then substitute with units and calculate. Use SI units and correct significant figures. Describe diagrams in words (or a simple ASCII sketch) when a diagram helps.",
  chemistry: "Write balanced chemical equations with states where useful. Use IUPAC names. For physical chemistry, show the calculation with units. If a reaction or fact is uncertain or condition-dependent, say so rather than presenting it as definite.",
  general: "",
};

export const POST = route("tutor", Body, async (_ctx, b) => {
  const ch = b.chapterId ? CHAPTERS.find((c) => c.id === b.chapterId) : null;
  const level = { inter1: "Intermediate 1st Year", inter2: "Intermediate 2nd Year", eapcet: "EAPCET preparation" }[b.level];
  const system = `You are MEMORA's AI study tutor for ${level} students (AP/Telangana boards). Subject: ${b.subject}${ch ? `; chapter: "${ch.title}" (${ch.paper})` : ""}.
${LANG_INSTRUCTION[b.language]}
${FORMAT_RULES}
${SUBJECT_RULES[b.subject]}
Explanation style: ${STYLES[b.style]}
${b.notebook ? NOTEBOOK : ""}
Accuracy matters more than length: double-check arithmetic. If the question is ambiguous or missing data, say what is missing and state any assumption.
Never claim a question is from an official EAPCET or previous-year paper. If you create practice questions, label them "AI-generated practice".`;
  const stream = await streamText([{ role: "system", content: system }, { role: "user", content: b.question }], { temperature: 0.2, maxTokens: 3000 });
  const enc = new TextEncoder();
  return new Response(new ReadableStream({
    async start(c) {
      try {
        for await (const chunk of stream) { const t = chunk.choices[0]?.delta?.content; if (t) c.enqueue(enc.encode(t)); }
      } catch { c.enqueue(enc.encode("\n\n_The answer was interrupted. Please try again._")); }
      c.close();
    },
  }), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}, 20);
