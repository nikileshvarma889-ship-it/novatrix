# Production checklist: 33 Men. 69 Days. Buried Alive.

## 1. Facts (before recording)

Open `src/projects/chile-33/facts.json`. Every claim the narration makes is listed with its sources.

The following claims are marked **needs-source**. Find a reliable source for each (news archive, NASA, Chilean government, or a published book such as Héctor Tobar's *Deep Down Dark*). Then add it under `sources` and set `"status": "verified"`.

| Fact | Line in the script |
|---|---|
| F04 Mine unstable after collapse | "But the mine was unstable. Another collapse could kill the rescuers too." |
| F06 Families camped outside (Camp Hope) | "Families gathered outside the mine, hoping for a miracle." |
| F07 Supplies sent through boreholes | "The miners received food, water, medicine and communication equipment through small boreholes." |
| F08 NASA advice: medical, nutrition, psychological | "Even NASA experts provided advice on…" |
| F15 No contact with the surface | "No phone signal. No way out." |

Then confirm everything passes:

```bash
npm run check -- chile-33 --strict
```

### Changes made to the submitted script for accuracy

| Original | Changed to | Why |
|---|---|---|
| "Imagine going to work one ordinary **morning**." | "…one ordinary **day**." | The collapse happened around 14:00. |
| "October 12th… **After 69 days underground**, the rescue operation began." | "**After more than two months underground**, the rescue operation began." | 69 days is counted to 13 October, when the last miner surfaced. |
| "It was called Phoenix." | Subtitle: "It was called **Fénix — Phoenix**." | The capsule's name was Fénix 2 (Spanish for Phoenix). |
| — | Avoided "1 billion viewers" and specific ration sizes | Not confirmed by a source. |

## 2. Footage (copyright-safe)

`npm run check` prints the list of files still missing. Each file is described in `assets.json`.

- **Archival (the real event):** the Chilean government (Gobierno de Chile) published rescue photos, many on Wikimedia Commons under CC BY 2.0. Open each file's page, confirm the license, and copy the author into `credit`.
  - CC BY requires attribution. The on-screen label and `description.txt` cover it.
- **NASA:** images.nasa.gov media are generally public domain. Check each item.
- **Representative footage (stock):** Pexels and Pixabay are free to use without attribution. This footage is always labelled "Representative footage", because it does not show the San José mine.
- **Never** present stock, AI or staged images as archival. Set their `kind` honestly; the label is then automatic.
- **Avoid** TV-network footage, other YouTubers' clips, and stills from the film *The 33* (2015). These are copyrighted.

### Photos supplied by the producer (phone screenshots)

Five reference photos were cropped from phone screenshots and are in use. Each is labelled "Archive photograph · Unknown — verify" on screen until its source is confirmed. `--strict` refuses to render until then.

| File | Shows | Used in |
|---|---|---|
| `san-jose-site.jpg` | Rescue workers and vehicles at the mine entrance | collapse-date, s-collapse |
| `rescue-teams.jpg` | Rescue team underground with ropes and headlamps | collapse-rescuers |
| `drill-rig.jpg` | Crew handling drill pipe at a rig | silence-drilling, fight-drill, s-silence |
| `fenix-capsule.jpg` | The Fénix 2 capsule with rescuers and officials | fight-capsule, rescue-capsule, s-capsule |
| `miner-surfaces.jpg` | A rescued miner being embraced | rescue-feeling |

For each photo:
1. Find the original (a reverse image search works well). Many rescue photos come from the Chilean government (often CC BY 2.0); others are agency photos (AP, Reuters, Getty), which you cannot use without a paid license.
2. Fill in `credit`, `license` and `sourceUrl` in `assets.json`.
3. Replace the file with the original full-resolution image. The screenshots are about 1074 px wide and look soft at 1080p.
4. Confirm the location and date of `rescue-teams.jpg`. The narration presents it as rescuers trying to get inside the mine.

These files are git-ignored, because the repository is public and their rights are unknown. Keep your own copies.

Photos: 3000 px or wider looks best with the slow camera moves. For 9:16, set `"focus": [x, y]` (0–1) on an asset to choose the crop centre.

## 3. Narration (Telugu)

- Record one file per scene, named after the scene id:
  - long cut: `public/projects/chile-33/voiceover/long/open-01.wav`
  - Short: `voiceover/short/s-hook.wav`
- Read the `say` text from `long.json` exactly. Leave a clear pause (≈0.4 s) between sentences, which helps the subtitle alignment.
- Recording: quiet room, 48 kHz WAV, peaks around −6 dB.
- A native Telugu speaker should review the translations before recording. They are written for natural narration, not word-for-word.
- Pronunciations to settle: San José (శాన్ హోసే), Fénix (ఫీనిక్స్), the Spanish note.
  - The script has the narrator read the note in Spanish and then translate it. Drop the Spanish line if you prefer.
- AI voices: only use a service whose license allows commercial YouTube use, and check its Telugu quality. Disclose synthetic narration if YouTube requires it.

## 4. Music and sound

- Put a licensed score in `public/projects/chile-33/music/`. Good sources:
  - YouTube Audio Library, which is free for YouTube.
  - Paid libraries such as Artlist or Epidemic Sound, if you have a subscription.
- The engine lowers music under the voice automatically. Adjust the levels in `src/config.ts`.
- SFX: `npm run generate-sfx` synthesizes the effects. Replace any of them with a licensed sound of the same name in `public/brand/sfx/`.

## 5. Render and publish

```bash
npm run render -- chile-33 --draft
```

Review the draft, then render the final version:

```bash
npm run render -- chile-33 --strict
```

Upload:
- `out/chile-33/chile-33-long.mp4`
- `out/chile-33/chile-33-short.mp4`
- the thumbnail
- the contents of `description.txt`

In YouTube Studio, place the end-screen elements over the two frames in the last 8 seconds of the long cut.
