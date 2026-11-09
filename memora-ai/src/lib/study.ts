/** Tutor explanation styles (shared by the API and the UI). */
export const STYLES = {
  simple: "Very simple explanation: everyday language, a relatable analogy, short sentences. Assume no prior knowledge.",
  detailed: "Detailed explanation: build the concept from basics, include derivation or reasoning where relevant, and one worked example.",
  exam: "Exam-oriented explanation: definitions in exam language, key points to write, typical question types and common mistakes. Keep it scoring-focused for Intermediate board exams and EAPCET.",
  steps: "Step-by-step solution: number every step, show every substitution and intermediate calculation, and state the final answer clearly.",
  revision: "Quick revision: compact bullet points, key formulas, and 3 memory hooks. No long paragraphs.",
  formula: "Formula explanation: state the formula, define every symbol with its SI unit, explain when and why it applies, its derivation idea in brief, and one short example.",
} as const;
export type StyleId = keyof typeof STYLES;
export const STYLE_LABELS: Record<StyleId, string> = { simple: "Very simple", detailed: "Detailed", exam: "Exam-oriented", steps: "Step-by-step", revision: "Quick revision", formula: "Formula explanation" };
