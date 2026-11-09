import "server-only";
import OpenAI from "openai";

/** Server-side AI client. Keys never reach the browser. Works with OpenAI or any OpenAI-compatible endpoint (OPENAI_BASE_URL). */
let _client: OpenAI | null = null;
export function aiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}
export function ai() {
  if (!process.env.OPENAI_API_KEY) throw new AiNotConfigured();
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || undefined, timeout: 60_000, maxRetries: 1 });
  return _client;
}
export const MODEL = () => process.env.OPENAI_MODEL || "gpt-4o-mini";
export const VISION_MODEL = () => process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

export class AiNotConfigured extends Error {
  constructor() {
    super("AI is not configured on the server (OPENAI_API_KEY is missing).");
  }
}

export const LANG_INSTRUCTION: Record<string, string> = {
  en: "Reply in clear, simple English.",
  te: "Reply in Telugu (తెలుగు script). Keep standard scientific terms, formulas and symbols in English where that is how students learn them.",
  en_te: "Reply in English, and after each main point add a short Telugu (తెలుగు) explanation of the same idea. Keep formulas and symbols in standard notation.",
};

export const FORMAT_RULES = `Formatting: use GitHub-flavoured Markdown. Write all mathematics with LaTeX: inline $...$ and display $$...$$.
Use SI units for physics. Write chemical equations balanced, with states where useful, e.g. $\\mathrm{2H_2 + O_2 \\rightarrow 2H_2O}$.`;

/** Plain JSON completion with schema-ish validation done by the caller. */
export async function jsonCompletion<T = unknown>(system: string, user: string, opts: { temperature?: number; maxTokens?: number } = {}): Promise<T> {
  const res = await ai().chat.completions.create({
    model: MODEL(),
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 2500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system + "\nRespond with a single valid JSON object only." },
      { role: "user", content: user },
    ],
  });
  const text = res.choices[0]?.message?.content ?? "";
  const start = text.indexOf("{"), end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("The AI returned an unreadable answer. Please try again.");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

/** Streams a chat completion as plain text chunks. */
export async function streamText(messages: OpenAI.Chat.ChatCompletionMessageParam[], opts: { temperature?: number; maxTokens?: number; model?: string } = {}) {
  const stream = await ai().chat.completions.create({
    model: opts.model ?? MODEL(),
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 2500,
    stream: true,
    messages,
  });
  return stream;
}
