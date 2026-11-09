/** Spaced repetition (SM-2 variant). rating: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy. */
export type SrsCard = { ease: number; interval_days: number; repetitions: number; lapses: number; srs_state: string };
export const RATINGS = [
  { v: 0, label: "Again", hint: "<10 min" },
  { v: 1, label: "Hard", hint: "short" },
  { v: 2, label: "Good", hint: "normal" },
  { v: 3, label: "Easy", hint: "long" },
] as const;

export function review(card: SrsCard, rating: 0 | 1 | 2 | 3, now = new Date()) {
  let { ease, interval_days, repetitions, lapses } = card;
  let due: Date;
  if (rating === 0) {
    lapses += 1;
    repetitions = 0;
    interval_days = 0;
    ease = Math.max(1.3, ease - 0.2);
    due = new Date(now.getTime() + 10 * 60000);
  } else {
    const q = [0, 3, 4, 5][rating];
    ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    repetitions += 1;
    if (repetitions === 1) interval_days = rating === 3 ? 3 : 1;
    else if (repetitions === 2) interval_days = rating === 1 ? 3 : 6;
    else interval_days = Math.round(interval_days * (rating === 1 ? 1.2 : rating === 3 ? ease * 1.3 : ease));
    interval_days = Math.min(interval_days, 365);
    due = new Date(now.getTime() + interval_days * 86400000);
  }
  const srs_state = repetitions === 0 ? "learning" : interval_days >= 21 ? "mastered" : interval_days >= 3 ? "review" : "learning";
  return { ease: Math.round(ease * 100) / 100, interval_days, repetitions, lapses, srs_state, due_at: due.toISOString(), last_reviewed_at: now.toISOString() };
}

/** A card counts as "difficult" if it has lapsed repeatedly or its ease has dropped low. */
export const isDifficult = (c: { lapses: number; ease: number }) => c.lapses >= 2 || c.ease < 1.9;
