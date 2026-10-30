# NOVATRIX

Welcome to NOVATRIX! Exploring the future of Artificial Intelligence, technology and digital innovation.
Technology. AI. Possibilities.

---

## Video 001 — *7 FREE AI Tools That Feel Illegal to Know in 2026*

This repository is a complete [Remotion](https://www.remotion.dev) video project (React + TypeScript, rendered to MP4 with FFmpeg).

| | |
|---|---|
| Format | 1920 × 1080, 16:9, 30 fps, H.264 MP4 + AAC audio |
| Length | ~3–5 min (follows your voiceover automatically) |
| Scenes | Cinematic logo intro → title → 7 tool scenes → outro with like/subscribe + end screen |

### Render the video

You need **Node.js 18+** and **FFmpeg** installed (`ffmpeg -version` should work).

```bash
npm install
```

```bash
npm run render
```

The finished video is written to **`out/novatrix-001-7-free-ai-tools.mp4`**.

Other commands:

| Command | What it does |
|---|---|
| `npm run studio` | Opens Remotion Studio in your browser to preview and scrub the video live |
| `npm run render:draft` | Fast half-resolution preview render → `out/draft.mp4` |
| `npm run thumbnail` | Renders a 1280×720 YouTube thumbnail → `out/thumbnail.png` |
| `npm run media` | Re-scans `public/` after you add or change media (runs automatically before render/studio) |
| `npm run placeholder-music` | Generates a royalty-free ambient synth loop to test the music track |
| `npm run scratch-voiceover` | Generates a robotic test narration with espeak-ng, to check timing before you record |

> The first render downloads a headless Chrome. If your machine has no internet access, point Remotion at an installed one:
> `REMOTION_BROWSER_EXECUTABLE=/path/to/chrome npm run render`

### Add your own voiceover, music and screen recordings

Everything goes in the `public/` folder. **Just drop files in and render again.** No code changes needed.

```
public/
├── voiceover/      one narration file per scene (see names below)
├── music/          your background track (any name)
├── clips/          screen recordings, one per tool
├── sfx/            whoosh.mp3 → plays on every transition (optional)
└── brand/          logo.png → replaces the built-in emblem (optional)
```

#### 1. Voiceover (`public/voiceover/`)

Record one file per scene and name it after the scene:

| File name | Narration |
|---|---|
| `intro.mp3` | Intro ("Imagine having access to tools…") |
| `claude.mp3` | Tool 1 |
| `perplexity.mp3` | Tool 2 |
| `gamma.mp3` | Tool 3 |
| `leonardo.mp3` | Tool 4 |
| `elevenlabs.mp3` | Tool 5 |
| `suno.mp3` | Tool 6 |
| `canva.mp3` | Tool 7 |
| `outro.mp3` | Outro ("So, which of these 7 AI tools…") |

- `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg` and `.flac` all work. A number prefix is fine too (`02-claude.wav`).
- The exact narration for each file is in [`src/content/narration.json`](src/content/narration.json). Read it word for word.
- **Each scene stretches to fit its recording**, so pacing is automatic.
- **Subtitles sync automatically.** FFmpeg finds the pauses between your sentences and lines the subtitles up with them. Words highlight as you speak.
- Want exact subtitles? Put an `.srt` file next to the audio file with the same name (e.g. `claude.srt`), with times starting at 0 for that clip. It overrides the automatic timing.
- If you change the wording you record, update `narration.json` so the subtitles match.
- Scenes without a recording use estimated timing (≈2.6 words/second), so the video always renders.

#### 2. Background music (`public/music/`)

Drop **one** music file in (the first file alphabetically is used). It loops if it's shorter than the video and fades in and out. It is **automatically ducked** to a low level whenever narration plays, and comes up between scenes. Change the levels in [`src/config.ts`](src/config.ts) (`AUDIO.musicVolumeUnderVoice`, `AUDIO.musicVolumeNoVoice`).

Use music you have the rights to (YouTube Audio Library, or a licensed track).

#### 3. Screen recordings (`public/clips/`)

Name each recording after its tool: `claude.mp4`, `perplexity.mp4`, `gamma.mp4`, `leonardo.mp4`, `elevenlabs.mp4`, `suno.mp4`, `canva.mp4`.

- It plays inside the 3D browser window of that tool's scene, muted and looping.
- Record in 16:10 or 16:9 (e.g. 1920×1200 or 1920×1080). It is cropped to fill the window.
- `.mov`, `.mkv` and HEVC files (iPhone/Mac recordings) are **converted to H.264 automatically** with FFmpeg the first time you render.
- Until you add a recording, the scene shows an animated mock-up of the tool with a small "screen recording placeholder" tag. To hide those tags, set `SHOW_PLACEHOLDER_HINTS = false` in `src/config.ts`.

#### 4. Optional extras

- `public/sfx/whoosh.mp3` plays on each scene transition.
- `public/brand/logo.png` (or `.svg`) replaces the drawn hexagon "N" emblem in the intro and outro.

### Editing the video

| To change… | Edit |
|---|---|
| Narration / subtitles text | `src/content/narration.json` |
| Tool names, URLs, features, colours, mock-up prompts | `src/content/tools.ts` |
| Title, brand colours, volumes, transition length, subtitle line length | `src/config.ts` |
| Intro / tool / outro animations | `src/scenes/` |
| Background, logo, subtitles, browser window | `src/components/` |

### How it works

```
public/ media ──► tools/scan-media.mjs (FFprobe durations, FFmpeg silence detection)
                        │
                        ▼
              src/generated/media-manifest.json
                        │
src/content/ ──► src/timeline.ts  (scene lengths, sentence timing, subtitle cues, music ducking)
                        │
                        ▼
              src/Video.tsx  (TransitionSeries of scenes + music + SFX)  ──►  remotion render ──► MP4
```

### Before you publish

- "Free" means each tool has a **free plan with limits**. The scenes show a "FREE PLAN" badge, not "free forever".
- Check each tool's current pricing and usage-rights page the week you publish. Free plans of voice and music tools may restrict commercial use.
- The tool scenes use generic category icons, not the companies' logos. Your screen recordings show the real products.
- YouTube end screen: the outro ends with ~7 seconds that have two "Watch next" boxes. Place your YouTube end-screen elements over them in YouTube Studio.

### Other files

- [`scripts/001-7-free-ai-tools.md`](scripts/001-7-free-ai-tools.md): the original script and production notes.
