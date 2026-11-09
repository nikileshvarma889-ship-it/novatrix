import { z } from "zod";
import { NextResponse } from "next/server";
import { route, jsonError } from "@/lib/api";
import { ai, VISION_MODEL } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ image: z.string().max(7_000_000).regex(/^data:image\/(png|jpe?g|webp);base64,/) });

/** Reads the question from a photo. The user always sees and can correct the text before it is solved. */
export const POST = route("ocr", Body, async (_ctx, b) => {
  const res = await ai().chat.completions.create({
    model: VISION_MODEL(),
    temperature: 0,
    max_tokens: 1200,
    messages: [
      { role: "system", content: "Transcribe the exam/homework question in the image exactly. Use LaTeX ($...$) for mathematics and chemical formulas. Include all given values, units and answer options. Do NOT solve it. If the image has no readable question, reply exactly: NO_QUESTION_FOUND" },
      { role: "user", content: [{ type: "text", text: "Transcribe the question in this image." }, { type: "image_url", image_url: { url: b.image } }] },
    ],
  });
  const text = res.choices[0]?.message?.content?.trim() ?? "";
  if (!text || text.includes("NO_QUESTION_FOUND")) return jsonError("No readable question was found in the image. Try a clearer, well-lit photo, or type the question.", 422);
  return NextResponse.json({ text });
}, 10);
