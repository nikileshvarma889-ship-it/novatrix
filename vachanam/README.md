# Vachanam – Telugu & English Holy Bible

*Read. Understand. Live the Word.*

An offline-first Telugu and English Bible app, built with Expo (SDK 58), React Native, TypeScript, Expo Router, SQLite and (from Phase 6) Supabase. It targets Android first and also runs on iOS and web.

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 | Project setup, branding, navigation, home screen | **Done** |
| 2 | Bible database and import, book/chapter navigation, reader | Next (book/chapter navigation already works) |
| 3 | Telugu + English parallel reading | Planned |
| 4 | Underline, highlight, notes, bookmarks, collections | Planned (database tables already exist) |
| 5 | Daily verse and notifications | Planned |
| 6 | Auth, Supabase sync, offline merge | Planned |
| 7 | Search, devotional, plans, settings polish, testing | Planned |

The prayer journal already works: create, autosave, mark answered, delete. Light/dark theme, text size, line spacing and default reading mode are saved too.

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
tests/                  unit tests (canon, navigation, verse references)
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
