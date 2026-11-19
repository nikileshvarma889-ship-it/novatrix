# SOLANA BAY — 30-second photoreal crime-action trailer

An original story with original characters (Marco, Elena), an original unbadged supercar and a fictional
Miami-style city, made in the open-world crime-action genre. It contains no game characters, footage, logos or place names.

## Pipeline

| Step | Command | Needs |
|---|---|---|
| 1. Character and car reference images | `python3 tools/refs.py` | `GEMINI_API_KEY` with image-generation quota (billing enabled) |
| 2. One photoreal video clip per shot (12 shots) | `python3 tools/clips.py` | `VEO_API_KEY`: Gemini API key from a project with billing and Veo access |
| 3. Original soundtrack and sound design | `python tools/audio.py` | Python with numpy, scipy, soundfile; FFmpeg |
| 4. Cut, 4K upscale, grade, titles, mix, export, verify | `python3 tools/assemble.py` | FFmpeg |

`storyboard.json` holds the shots: timing, prompts, which reference images each shot uses, the visual style and the negative prompt. Edit it to change the film; steps 3 and 4 re-time automatically.

## Setup

1. Copy `.env.example` to `.env` and paste your keys there. `.env` is gitignored, and the tools never print keys.
2. Check video access without spending anything: `python3 tools/clips.py --check`
3. Run steps 1–4 in order.

To redo one shot, run `python3 tools/clips.py --only 08_drift --force`, then `python3 tools/assemble.py`.

To choose which part of a generated clip is used, put start offsets in seconds in `clips/trims.json`, for example `{"08_drift": 2.0}`.

## Outputs

| Path | What it is |
|---|---|
| `output/SOLANA_BAY_TRAILER_4K.mp4` | Final trailer: 3840×2160, 24 fps, exactly 30 s. Upscaled from Veo's native resolution. |
| `output/SOLANA_BAY_TRAILER_1080p.mp4` | 1080p copy |
| `output/thumbnail.jpg` | Thumbnail image |
| `clips/graded/` | The individual graded scene clips |
| `audio/` | Mix, score and sound-effects stems |

## Notes

- Veo is billed per second of generated video. Twelve 4–8 s clips is about 70–90 s of generation; see Google's Gemini API pricing page for current rates.
- Veo generates at most 1080p (4K on some models). The 4K master is a high-quality Lanczos upscale of that.
- Generated faces can still drift between shots. Reference images reduce this but don't eliminate it; regenerate any shot that drifts.
