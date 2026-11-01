# Reelwise — AI social video studio with approval-first publishing

Describe a video → Claude writes the script and storyboard → Reelwise's own engine (Remotion + Three.js + FFmpeg) renders it with voiceover, music, subtitles, logo, intro and outro → **you preview, edit and approve** → it publishes to Instagram, Facebook and YouTube through their official APIs.

**Publish kit, made by Claude:** once the preview renders, Claude looks at one frame from every scene plus the script and timings, then writes the YouTube title and description (with chapters when the video is long enough), the Instagram/Facebook caption and 12–20 hashtags (grouped as broad, niche and brand), and designs the cover: which scene to use, the headline, the highlighted word, the accent colour and where the text sits. The cover becomes the YouTube thumbnail and the Facebook video thumbnail; Instagram uses that same frame as the Reel cover (`thumb_offset`). Everything is editable before approval, and hand edits are never overwritten.

Videos are produced entirely by this codebase's programmatic engine. Reelwise uses no external generative-video services.

## What's inside

| Area | Where |
|---|---|
| Web app (Next.js 15, React 19, Tailwind, Framer Motion, Lucide) | `src/app`, `src/components` |
| API routes (auth, roles, validation, rate limits, audit) | `src/app/api` |
| Database schema (PostgreSQL / Supabase) | `db/migrations` |
| AI (Claude `claude-opus-5-5`, structured outputs) | `src/lib/ai` |
| Meta Graph API + Google/YouTube APIs | `src/lib/social` |
| ElevenLabs voice (Telugu uses only the **Bunty** voice) | `src/lib/elevenlabs.ts`, `worker/audio.ts` |
| Video engine (Remotion compositions, Three.js 3D scenes) | `video/` |
| Background worker (render, publish, Auto Pilot, sync) | `worker/` |
| Android app (Capacitor 7) | `mobile/` |
| Tests (unit, end-to-end, integration: `npx vitest run -c vitest.it.config.ts`) | `tests/` |

## Rules the code enforces

- **Approval:** nothing is published without a person approving the finished video.
  - Approval requires an explicit confirmation flag.
  - Any later edit resets the approval.
  - Auto Pilot only creates drafts in "Waiting for approval".
- **Honest status:** a post becomes *Published* only after the platform returns its confirmation (Facebook `video_status=ready`, an Instagram `media_publish` ID, a YouTube upload ID).
- **Real analytics only:** analytics show only what the platforms return, with no placeholder numbers.
- **Inbox replies:** they go out only when a person presses Send and ticks the confirmation.
- **Secrets:**
  - Tokens and API keys are encrypted with AES-256-GCM at rest and never sent to the browser.
  - Passwords are hashed with bcrypt.
  - Sessions are random tokens, stored only as hashes.
- **Workspace isolation:** every query is scoped to the signed-in workspace, and row-level security is enabled on all tables (defence in depth for Supabase).

## Run it locally

Requirements:
- Node 20+.
- PostgreSQL 14+ (or a Supabase database URL).
- FFmpeg.
- Chrome for rendering: Remotion downloads one, or set `REMOTION_BROWSER_EXECUTABLE`.

```bash
npm install
```

```bash
cp .env.example .env
```

Fill in `.env`:
- `DATABASE_URL`;
- `ENCRYPTION_KEY` (the generation command is in the file);
- `APP_URL`;
- optionally the Meta, Google, Claude and ElevenLabs keys.

Then create the tables, and start the web app and the worker in separate terminals:

```bash
npm run db:migrate
```

```bash
npm run dev
```

```bash
npm run worker
```

Open http://localhost:3000, create an account, then:
1. **Settings:** add your Claude API key (and your ElevenLabs key, if it isn't set on the server).
2. **Brand Studio:** create a brand and upload its logo and assets.
3. **Connected Accounts:** connect Instagram/Facebook (Meta) and YouTube (Google).
4. **AI Video Creator:** describe a video, watch the preview, edit it, then **Approve & publish**.

## Setup guides

- [Meta developer app (Instagram + Facebook)](docs/SETUP_META.md)
- [Google Cloud + YouTube APIs](docs/SETUP_GOOGLE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Android app (APK/AAB)](docs/ANDROID.md)
- [Testing](docs/TESTING.md)

## Commands

| Command | Does |
|---|---|
| `npm run dev` / `npm run build && npm start` | Web app (dev / production) |
| `npm run worker` | Background worker (run at least one) |
| `npm run db:migrate` | Apply database migrations |
| `npm test` | Unit tests |
| `node tests/e2e.mjs` | End-to-end workflow test against a running server and worker |
| `npm run typecheck` | TypeScript check |
