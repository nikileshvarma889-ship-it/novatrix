# MEMORA AI

**Your Memory. Your Studies. Your AI.**

MEMORA AI is a personal AI memory assistant and study companion for Intermediate (1st / 2nd year) and EAPCET students. It is a full-stack Next.js app backed by Supabase (Postgres, Auth, Storage, Row Level Security). Its AI features (OpenAI or any OpenAI-compatible API) run only on the server. It installs as a PWA on Android and desktop.

| Area | What works |
|---|---|
| **Accounts** | Sign up with email verification, log in and out, password reset, protected routes, profile and preferences, avatar upload, data export, delete-all-data |
| **Dashboard** | Personalised greeting, AI search bar with instant results, today's sessions, deadlines and overdue items, subject progress, weekly study chart, memory overview, continue-watching, quick actions |
| **My Memories** | Create, edit, delete, pin, archive, categories, tags, priority, filter, sort, full-text search (English and Telugu), recently accessed |
| **Voice memory** | Speech-to-text in English (`en-IN`) or Telugu (`te-IN`) via the browser, editable transcript, AI suggests a memory, task or reminder, and nothing is saved until you confirm. Typing works as a fallback. |
| **AI Assistant** | Streaming chat, conversation history, new/rename/delete/clear, copy, regenerate, suggested prompts, English / Telugu / both. It retrieves your own memories, notes and tasks, cites them as `[M1]`/`[N1]`/`[T1]`, and says plainly when something isn't saved. "Remember…" requests show a confirm-to-save card instead of claiming to have saved. |
| **Study Centre** | Maths, Physics and Chemistry for Inter 1, Inter 2 and EAPCET. Covers: <ul><li>99 chapters (AP BIEAP structure)</li><li>progress tracking, important topics, chapter notes and revision dates</li><li>AI tutor with 6 explanation styles in 3 languages</li><li>notebook-style exam answers (Question → Given → Formula → Solution → Final Answer) with print and save</li><li>photo-of-question OCR that you check before solving</li><li>formula library, interactive periodic table, practice tests</li></ul> |
| **Study Planner** | Day, week and month views; tasks, reminders, exams and study sessions; recurring tasks; reschedule; priorities; exam countdown; study-session timer. The AI timetable generator caps sessions at 90 min with breaks and stays within your daily hours (Asia/Kolkata by default). |
| **Assignments** | Subject, description, due date, priority, status, private file attachments, overdue highlighting, filters |
| **Notes & Documents** | Markdown notes with a formatting toolbar, preview, LaTeX and autosave; pin, favourite, tags, subjects, search. PDF / TXT / MD upload to private storage with page-aware indexing. AI summary, key points, revision notes, practice questions, flashcards and Q&A, all grounded in your file and citing page numbers. |
| **Flashcards** | Manual or AI-generated (from a chapter, text, note, document or video notes), with review and edit before saving. Flip cards, SM-2 spaced repetition, the new / learning / review / difficult / mastered states, and a daily recommendation. |
| **Quizzes** | AI MCQs with 4 options, timer, navigation, mark for review, auto-submit, score, explanations, topic-wise analysis and suggested revision. Always labelled as AI-generated practice. |
| **YouTube Learning** | Data API v3 search (embeddable, safe-search), 11 learning categories, in-app playback with the official IFrame Player API, resume position, continue watching, saved videos, history, playlists, subject/chapter tagging, timestamped notes, and flashcards from your notes. Videos that can't be embedded show a message and an optional YouTube link. |
| **Progress** | Syllabus rings and bars, study time by day and subject, quiz-score trend, flashcard activity, assignment and revision completion, and a weekly summary built only from recorded data |
| **Notifications** | In-app centre fed by reminders, due-soon and overdue items, upcoming sessions, revision dates, due flashcards and exam countdown. Optional browser pop-ups while the app is open. |
| **PWA** | Manifest, maskable icons, service worker (caches static assets only, never private data), offline page, installable |

## Tech stack

- Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Framer Motion · Lucide · Recharts · KaTeX
- Supabase: Postgres + Auth + Storage, with Row Level Security on every user table
- AI: OpenAI SDK, server-side only. `OPENAI_BASE_URL` also allows any OpenAI-compatible endpoint (e.g. Google Gemini).
- YouTube Data API v3 (server-side key) and the YouTube IFrame Player API

## 1. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run both files in `supabase/migrations/`, in order. They create:
   - the schema, RLS policies and search functions;
   - the private `user-files` storage bucket and its policies;
   - the syllabus seed data.

   Alternatively, use the CLI: `supabase link` then `supabase db push`.
3. Under **Authentication → URL configuration**:
   - Set **Site URL** to your app URL, e.g. `https://memora.example.com`.
   - Add `https://memora.example.com/**` to **Redirect URLs**.
4. Under **Authentication → Providers → Email**, keep **Confirm email** on.

## 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill it in:

```
NEXT_PUBLIC_SUPABASE_URL=...        # Project Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # the anon/public key (safe for the browser; RLS protects data)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
OPENAI_API_KEY=...                  # server-only
YOUTUBE_API_KEY=...                 # server-only; Google Cloud → enable "YouTube Data API v3"
```

Notes:
- The **service-role key is not used anywhere** and must never be added.
- To use Gemini instead of OpenAI, set `OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`, `OPENAI_MODEL=gemini-2.5-flash`, and your Gemini key as `OPENAI_API_KEY`.

## 3. Run

Install and start the app:

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. If the Supabase variables are missing, the app shows a `/setup` page that lists what's needed.

### Local backend (optional)

You can run the whole backend locally with the Supabase CLI and Docker. It includes Mailpit for verification emails.

```bash
npx supabase start -x studio,realtime,edge-runtime,imgproxy,logflare,vector,supavisor,postgres-meta
```

`supabase status` prints the local URL and anon key. Emails appear at http://127.0.0.1:54324.

## 4. Deploy

- **Vercel (recommended):**
  1. Import the repo and set the **Root Directory** to `memora-ai`.
  2. Add the environment variables, and set `NEXT_PUBLIC_SITE_URL` to the production URL.
  3. Deploy.
- **Any Node host:** run the build, then start the server.

  ```bash
  npm run build
  ```

  ```bash
  npm start
  ```

- After deploying, add the production URL to the Supabase redirect URLs.

## Security model

- **RLS everywhere:** every table carries `user_id` and has select / insert / update / delete policies of the form `user_id = auth.uid()`. Messages, playlist items, quiz attempts, flashcard reviews and document chunks also check that the parent belongs to the user. The `anon` role has no table access. The syllabus table is read-only.
- **Storage:** the bucket is private, and users can only touch objects under `<their uid>/…`. Files are opened through short-lived signed URLs.
- **Search functions:** they are `security invoker`, so RLS still applies.
- **API routes:** every route re-verifies the session with `supabase.auth.getUser()`, validates input with Zod, and rate-limits per user. Errors are returned as safe messages.
- **Keys:** AI and YouTube keys live only on the server.
- **Headers:** `nosniff`, `X-Frame-Options: DENY`, a strict referrer policy and a permissions policy are set.
- **Honest AI:**
  - Answers cite your saved data or say it wasn't found.
  - Document answers are grounded and cite page numbers.
  - Quizzes are labelled AI-generated and never claimed to be official or previous-year papers.
  - Progress summaries come only from recorded data.
  - Video features never claim to have watched a video.

## Project structure

```
src/app/(auth)/            login, signup, forgot-password
src/app/auth/              email callback / confirm, reset-password
src/app/(app)/             the 12 main sections + search, notes/[id], documents/[id], quizzes/[id], youtube/watch/[id]
src/app/api/               ai/{chat,parse,tutor,ocr,material,flashcards,quiz,study-plan}, documents/process, youtube/*, search, notifications/sync
src/components/            UI kit, app shell, voice capture, tutor, editors, YouTube player, periodic table…
src/lib/                   supabase clients, AI helpers, retrieval, dates (timezone-aware), SRS, syllabus, formulas
supabase/migrations/       schema + RLS + storage + syllabus seed
scripts/                   syllabus generator, PWA icon renderer
```

## Known limitations

- **Voice input:** uses the browser's Web Speech API. This works in Chrome and Edge on Android and desktop, but Firefox has no Web Speech support, so it falls back to typing there.
- **Reminders:** fire as in-app and browser notifications while MEMORA is open. Background push when the app is closed would need a push server (Web Push / VAPID), which is not included.
- **Scanned PDFs:** PDFs that are only images, with no text layer, can't be read yet. DOCX files are stored but not read by the AI; export them to PDF first.
- **Rate limits:** the per-user rate limiter is in-memory, so it applies per server instance. Use a shared store such as Upstash or Redis for multi-instance deployments.
- **Syllabus:** chapter lists follow the AP BIEAP structure. Check them against your current syllabus.
