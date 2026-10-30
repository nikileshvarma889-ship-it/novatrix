# THE UNTOLD

*Some Stories Deserve to Be Heard.*

Cinematic documentaries: extraordinary true stories, mysteries, survival, history and business.
This repository is the channel's **documentary production system**, built with Remotion, React, TypeScript and FFmpeg.
Every film is a folder of editable JSON (script, scenes, timing, facts and asset licenses). The same engine renders it as a **16:9 long-form video** and a **9:16 YouTube Short**.

| Film | Folder | Compositions |
|---|---|---|
| 33 Men. 69 Days. Buried Alive. (2010 Chilean miners' rescue) | `src/projects/chile-33/` | `chile-33-long` (16:9, ~7 min), `chile-33-short` (9:16, ~1 min), `chile-33-thumbnail` |

---

## Quick start

Requires **Node.js 18+** and **FFmpeg**.

```bash
npm install
```

```bash
npm run generate-sfx
```

```bash
npm run studio
```

`generate-sfx` builds the copyright-free sound-effects library. `studio` opens a live preview where you can scrub every scene in both formats.

To render a film (both formats, plus the thumbnail and the YouTube description credits):

```bash
npm run render -- chile-33
```

Output goes to `out/chile-33/`. Other forms:

```bash
npm run render -- chile-33 short --draft
```

```bash
npm run render -- chile-33 long --strict
```

- `--draft` renders at half resolution for review.
- `--strict` refuses to render if any fact the narration relies on is not yet verified. Use it for the version you publish.

---

## How a film is organised

```
src/projects/chile-33/
├── project.json   title, category, narration + subtitle languages, disclaimer
├── long.json      the 16:9 cut — an ordered list of scenes
├── short.json     the 9:16 cut
├── assets.json    every photo/clip: file, kind, credit, license, source URL
└── facts.json     every factual claim: status (verified / needs-source / disputed) + sources

public/projects/chile-33/
├── voiceover/long/<scene-id>.mp3    one narration file per scene (+ optional .srt)
├── voiceover/short/<scene-id>.mp3
├── footage/                         files named in assets.json
├── music/                           this film's score (optional)
└── sfx/                             overrides for brand sound effects (optional)

public/brand/
├── music/                           channel music library
├── sfx/                             impact, rumble, riser, whoosh, drill (generated or your own)
└── logo.png                         optional — replaces the drawn wordmark
```

### Scenes

Each scene in `long.json` / `short.json` has an `id`, a `type`, optional `narration`, and optional `visual`, `motion`, `transition`, `sfx`, `facts`, `leadIn`, `tail` and `minSeconds`.

| type | Use it for | Fields |
|---|---|---|
| `brand-intro` | THE UNTOLD ident | — |
| `title` | Film title card | `title` (lines), `kicker` |
| `chapter` | Chapter card | `number`, `title` |
| `footage` | Narration over a photo or clip | `visual`, `motion`, `caption`, `lowerThird` |
| `date` | Date / place card | `date`, `place`, `detail`, `visual` |
| `stat` | A key number | `value`, `unit`, `label` |
| `quote` | A real quote or document | `quote`, `translation`, `attribution` |
| `depth` | Labelled depth illustration | `depthMeters`, `label` |
| `text` | Lines of text on black | `lines` |
| `brand-outro` | Sign-off + end screen | — |

- `motion`: `push-in`, `pull-out`, `pan-left`, `pan-right`, `rise`, `still` (slow camera moves over photos).
- `transition`: `fade`, `dip-to-black`, `slow-dissolve`, `slide-up`, `cut`.
- `sfx`: `[{ "id": "impact", "at": 1.9, "volume": 0.8 }]`, where `at` is seconds into the scene.

**Timing is automatic.** Each scene lasts as long as its narration, plus `leadIn` before and `tail` after. Use `minSeconds` for scenes without narration.

### Narration and subtitles

Narration is written line by line in each cut:

```json
{ "say": "At the San Hosay copper and gold mine…", "sub": "At the San José copper and gold mine…" }
```

- `say` is exactly what the narrator speaks. Spell names phonetically here if needed.
- `sub` is the on-screen subtitle. Leave it out when it matches `say`.
- *33 Men* is narrated and subtitled in **English** (`narrationLanguage` / `subtitleLanguage` in `project.json`). Other languages work the same way: `say` in the spoken language, `sub` in the subtitle language.
- When a voiceover file exists, the scene stretches to fit it. FFmpeg finds the pauses between sentences, and each subtitle is aligned to its sentence.
- For exact timing, add `<scene-id>.srt` next to the audio file. Its times start at 0 for that clip.
- Music is automatically lowered under the voice and comes up between scenes.

#### AI narration voice

`npm run ai-voiceover -- <slug>` voices every scene with a Piper neural voice running on your CPU, which is useful when you can't record. It never overwrites your own recordings, and `--clean` removes what it generated.

The default is LibriTTS speaker 7134: a low, clear male voice, licensed **CC BY 4.0**, so commercial use is allowed with credit. The credit goes in `voiceCredit` in `project.json` and is printed into the YouTube description. Setup steps are at the top of `tools/ai-voiceover.mjs`.

### Footage and honesty rules

Every visual is registered in `assets.json` with a **kind**, and the kind controls the on-screen label:

| kind | Meaning | On-screen label |
|---|---|---|
| `archival` | Real photo/footage of the actual event | "Archive photograph · *credit*" |
| `stock` | Licensed footage that is **not** of the event | "Representative footage" |
| `illustration` | Diagrams, maps | "Illustration" |
| `reconstruction` | Staged / dramatized | "Dramatization" (cannot be hidden) |
| `ai-generated` | Generated imagery | "AI-generated illustration" (cannot be hidden) |

`npm run check` blocks a render if:
- an archival or stock asset has no license, or archival footage has no credit;
- a reconstruction or AI image has its label hidden;
- a scene references a missing asset or fact;
- a scene relies on a **disputed** fact.

With `--strict` it also blocks facts that still `needs-source`.

Missing footage never breaks a render. The scene shows a "footage needed" slate that names the file and the shot to find. Set `SHOW_PLACEHOLDER_SLATES = false` in `src/config.ts` to hide the slates.

`npm run credits -- chile-33` writes `out/chile-33/description.txt`, with sources, image credits and licenses ready to paste into YouTube.

---

## Making the next film

```bash
npm run new-project -- tunguska "The Sky Exploded. Nobody Knows Why."
```

This creates the JSON files, the media folders and the `tunguska-long` / `tunguska-short` compositions. Edit the JSON, add media, then run `npm run render -- tunguska`.

## Testing before the real narration is recorded

```bash
npm run scratch-voiceover -- chile-33
```

This creates a robotic espeak-ng narration, only for quick pacing checks (use `ai-voiceover` for a natural voice). It never overwrites real recordings. Remove it before the final render:

```bash
npm run scratch-voiceover -- chile-33 --clean
```

`npm run placeholder-music` generates a copyright-free drone for testing. Replace it with a licensed score before you publish.

## Where things live in the code

| Folder | What's inside |
|---|---|
| `src/brand/` | THE UNTOLD identity: theme (black / charcoal / muted gold), wordmark, intro, outro, thumbnail |
| `src/engine/` | Schema (`types.ts`), timing + subtitle sync (`timeline.ts`), media manifest, transitions, the `Documentary` renderer |
| `src/scenes/` | One component per scene type, each laid out for both 16:9 and 9:16 |
| `src/components/` | Footage (Ken Burns, video, placeholder slates), provenance labels, subtitles, film look (grade, grain, vignette), audio |
| `src/config.ts` | Volumes, timing defaults, provenance label wording |
| `tools/` | FFmpeg media scanner, project checker, renderer, credits, scaffolding, SFX/music generators |

See [`docs/PRODUCTION.md`](docs/PRODUCTION.md) for the full production checklist, including where to find copyright-safe footage and how to record or generate the narration.
