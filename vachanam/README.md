# Vachanam – Telugu & English Holy Bible

*Read. Understand. Live the Word.*

An offline-first Telugu and English Bible app, built with Expo (SDK 58), React Native, TypeScript, Expo Router, SQLite and (from Phase 6) Supabase. It targets Android first and also runs on iOS and web.

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Project setup, branding, navigation, home screen | **Done** |
| 2 | Bible database and import, book/chapter navigation, reader | **Done**: Telugu IRV + English BSB bundled, offline |
| 3 | Telugu + English parallel reading | **Done**: stacked, side by side, single language |
| 4 | Underline, highlight, notes, bookmarks, collections | Planned (database tables already exist) |
| 5 | Daily verse and notifications | Planned |
| 6 | Auth, Supabase sync, offline merge | Planned |
| 7 | Search, devotional, plans, settings polish, testing | Planned |

The prayer journal already works: create, autosave, mark answered, delete.

**Christian Calendar (2025–2030):** month view with Telugu and English month and weekday names. It shows church festivals for every year, including the moveable ones calculated from Easter (Ash Wednesday, Palm Sunday, Good Friday, Easter, Ascension, Pentecost, Advent). You can add your own events (church programmes, prayer meetings) to any day; they are saved on the device. The home screen shows the next festival. Light/dark theme, text size, line spacing and default reading mode are saved too.

## Bible text

`assets/bible/bible.db` is a read-only SQLite database built from the licensed USFM sources. It holds 31,004 Telugu IRV verses, 31,086 English BSB verses, section headings, Psalm titles, paragraph breaks and Telugu and English book names. It is opened separately from the user's own data, and imported once on first launch.

To rebuild it, then validate it:

```bash
npm run build:bible
```

```bash
node tools/check-bible.mjs
```

The script downloads the sources from eBible.org. Verse text is kept exactly as published; footnotes and word-tag markup are left out, as the in-app licence notice states.

Verses are aligned across translations by their stable reference. Telugu verse ranges (88 of them, such as "1-2") are paired with each English verse they cover, so parallel reading never drifts.

**Licence duties (CC BY-SA 4.0, IRV):**
- The notice is shown in About and under every chapter.
- The database itself stays under CC BY-SA 4.0.
- The app's own code is not affected.

## Bible Guide (AI, powered by Claude)

An in-app assistant that **only** discusses the Bible and the Christian faith: verse meanings, characters, history, faith questions, prayers and devotional thoughts. It answers in English, Telugu or both, and politely declines anything off-topic. Citations such as "(John 3:16)" become links into the reader. The conversation is stored only on the device.

How it's built:
- `supabase/functions/bible-guide/`: a Supabase Edge Function that holds the Anthropic API key (never in the app). It calls **Claude Opus 5.5** with medium effort and streaming, a cached system prompt that sets the Bible-only scope, and automatic refusal fallback (`fallbacks: "default"`). It also validates input and rate-limits to 20 questions per 10 minutes per IP.
- `src/app/guide.tsx` (chat UI), `src/lib/guideClient.ts` (streaming client), `src/lib/refparse.ts` (citation links).

Turn it on:

```bash
supabase functions deploy bible-guide
```

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Then copy `.env.example` to `.env`, fill in your Supabase URL and anon key, and restart `npx expo start`.

Cost: Claude Opus 5.5 is $4 per million input tokens and $20 per million output tokens. A typical question and answer costs roughly ₹0.5–2. Set a monthly spend limit in the Anthropic Console before publishing.

## Run it

```bash
npm install
```

```bash
npx expo start
```

Then scan the QR code with **Expo Go** on Android, or press `a` for an Android emulator or `w` for the web.

Checks:

```bash
npm run typecheck
```

```bash
npm test
```

## Project structure

```
src/app/                Expo Router screens
  _layout.tsx           fonts, theme, SQLite provider + migrations, stack
  (tabs)/               Home, Bible, Notes, Bookmarks, Settings
  read/[book]/[chapter] reader (prev/next chapter across books, text size)
  prayer/               prayer journal list + autosaving editor
  history, about, privacy
src/components/         Logo, line icons, shared UI (cards, rows, empty states)
src/theme/              palette (ivory / deep green / gold, light + dark), fonts, ThemeProvider
src/db/schema.ts        versioned SQLite migrations (content + user data + sync queue)
src/data/books.ts       66-book canon: USFM codes, names, chapter counts
src/lib/                stable verse refs, chapter navigation, prefs, ids, query hook
tests/                  unit tests (canon, navigation, verse references, calendar dates)
```

## Stable verse references

Every note, highlight, underline, bookmark and history entry is stored against a reference like `JHN.3.16` (USFM book code, chapter, verse), plus a sortable number (`43003016`). Both are the same in every translation, so Telugu and English stay linked and user data never depends on screen positions.

## Bible texts: verified licences

Checked on eBible.org (the publisher's detail pages and download archives), 22 Nov 2026. Each candidate was downloaded and its books counted.

| Translation | Language | Licence | Books | Notes |
|---|---|---|---|---|
| **Indian Revised Version (IRV) 2019** (`tel2017`) | Telugu | © 2017, 2019 Bridge Connectivity Solutions, **CC BY-SA 4.0** | 66 (31,004 verses) | Free to redistribute. Must show copyright and source, mark any changes, and share-alike. **Recommended Telugu text.** |
| **Telugu OTSA** (`telotsa`) | Telugu | © 1976–2024 Biblica, Inc., **CC BY-SA 4.0** | 66 (30,936 verses) | Free to redistribute with the Biblica copyright notice; share-alike. Good second Telugu text. |
| Telugu Easy Reading Version (`tel2010`) | Telugu | © World Bible Translation Center, **not free** | – | Written permission needed to host or bundle. **Excluded.** |
| **Berean Standard Bible** (`engbsb`) | English | **Public domain** | 66 (31,086 verses) | Modern, accurate English. **Recommended English text.** |
| **World English Bible** (`engwebp`) | English | **Public domain** ("World English Bible" is a trademark) | 66 + front matter | Modern English. |
| **King James Version** (`eng-kjv2006`) | English | Public domain (outside the UK, where Crown letters patent apply) | 66 | Classic wording that many readers prefer. |

The widely used Telugu "Old Version" (BSI) is not on eBible.org, and I could not verify that it is free to distribute, so it is not included.

CC BY-SA obligations the app must meet (planned for Phase 2): show each translation's notice in About and on shared verse images; don't alter the text; keep the share-alike licence for the text itself. The app code can stay under its own licence.
