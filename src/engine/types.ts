// Schema for a THE UNTOLD documentary project. Projects live in
// src/projects/<slug>/ as plain JSON so scripts, text and timing can be
// edited without touching code. Media lives in public/projects/<slug>/.

export type FormatId = "landscape" | "vertical";

/** Where a visual came from. Drives the on-screen provenance label. */
export type AssetKind =
  | "archival" // real photo/footage of the actual event
  | "stock" // licensed footage that is NOT of the actual event
  | "illustration" // diagrams, maps, motion graphics
  | "reconstruction" // staged / dramatized footage
  | "ai-generated"; // generated imagery

export type Asset = {
  /** Path inside public/projects/<slug>/footage/. */
  file: string;
  kind: AssetKind;
  /** What the shot shows. Also printed on the placeholder slate. */
  description: string;
  credit?: string;
  license?: string;
  sourceUrl?: string;
  /** Focal point (0–1) used when cropping, e.g. for 9:16. */
  focus?: [number, number];
  /** "contain" shows the whole image over a blurred fill instead of cropping.
   *  Use for wide documents/photos that must stay legible in 9:16. */
  fitVertical?: "cover" | "contain";
  /** Override the automatic provenance label ("" hides it). */
  label?: string;
};

export type FactStatus = "verified" | "needs-source" | "disputed";

export type Fact = {
  id: string;
  claim: string;
  status: FactStatus;
  sources: { title: string; url: string }[];
  note?: string;
};

export type TransitionId = "cut" | "fade" | "dip-to-black" | "slow-dissolve" | "slide-up";

export type Motion = "push-in" | "pull-out" | "pan-left" | "pan-right" | "rise" | "still";

export type SfxCue = { id: string; at: number; volume?: number };

/**
 * One narrated sentence. `say` is exactly what the narrator speaks (in the
 * project's narration language); `sub` is the on-screen subtitle (in the
 * subtitle language). If `sub` is omitted, `say` is shown.
 */
export type Line = { say: string; sub?: string };

type SceneBase = {
  id: string;
  /** Narration for this scene. Record it as voiceover/<cut>/<scene id>.mp3. */
  narration?: Line[];
  /** Silence before narration starts (seconds). */
  leadIn?: number;
  /** Hold after narration ends (seconds). */
  tail?: number;
  /** Minimum scene length when there is little or no narration. */
  minSeconds?: number;
  /** Transition INTO the next scene. */
  transition?: TransitionId;
  sfx?: SfxCue[];
  /** Fact ids from facts.json that this scene's narration relies on. */
  facts?: string[];
  /** Background asset id (from assets.json). */
  visual?: string;
  motion?: Motion;
};

export type Scene =
  | (SceneBase & { type: "brand-intro" })
  | (SceneBase & { type: "brand-outro" })
  | (SceneBase & { type: "title"; title: string[]; kicker?: string })
  | (SceneBase & { type: "chapter"; number: string; title: string })
  | (SceneBase & { type: "footage"; caption?: string; lowerThird?: { name: string; role: string } })
  | (SceneBase & { type: "date"; date: string; place?: string; detail?: string })
  | (SceneBase & { type: "stat"; value: string; unit?: string; label: string })
  | (SceneBase & { type: "quote"; quote: string; translation?: string; attribution: string })
  | (SceneBase & { type: "depth"; depthMeters: number; label: string })
  | (SceneBase & { type: "text"; lines: string[] });

export type Cut = {
  id: string;
  format: FormatId;
  title: string;
  /** Music file name in public/projects/<slug>/music/ (or brand music). */
  music?: string;
  scenes: Scene[];
};

export type Project = {
  slug: string;
  /** BCP-47 code of the spoken narration, e.g. "te" (Telugu) or "en". */
  narrationLanguage: string;
  /** Language of the subtitles, e.g. "en". */
  subtitleLanguage: string;
  title: string;
  subtitle?: string;
  category: "survival" | "mystery" | "history" | "business" | "true-story";
  /** Short disclaimer shown at the start, e.g. about reconstructions. */
  disclaimer?: string;
};
