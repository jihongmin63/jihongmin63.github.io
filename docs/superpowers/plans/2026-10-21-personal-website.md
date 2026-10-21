# Personal Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a bilingual, static personal site with a reversible card, equal research/cinema/writing pages, the supplied movie data, and an official Instagram sync pipeline.

**Architecture:** Astro prerenders every route from checked-in content snapshots. A local CSV importer validates and normalizes movie data; a separate scheduled script fetches all posts from Meta's API, validates a complete response, and atomically replaces the Instagram snapshot. GitHub Actions builds and deploys the result to GitHub Pages.

**Tech Stack:** Astro, Node.js 22+, Node's built-in test runner, GitHub Actions, Meta Instagram API with Instagram Login.

**Spec:** `docs/superpowers/specs/2026-10-21-personal-website-design.md`

## Global Constraints

- Routes: `/ko/`, `/en/` and `/research/`, `/cinema/`, `/writing/` under each language; `/` redirects to `/ko/`.
- Both languages cover authored text; source movie titles/reviews and Instagram captions stay in their original language.
- The source is `movie.csv` (272 rows; 260 `MOVIE` rows). `1970-01-01` is an exporter placeholder and must sort as an unknown watch date.
- Keep `movie.csv` untracked and ignored. Commit only normalized public data.
- Do not scrape Watcha Pedia or Instagram. The Instagram token is a GitHub Actions secret, never a browser value.
- No invented research items, film productions, public email, or Instagram posts. Use truthful empty states where data is unavailable.
- The cinema list includes one-line reviews and hides spoiler-marked reviews until reveal.

## Review Focus

- CSV with a quoted comma or newline inside a review must import intact; test parser behavior.
- Invalid CSV rows must leave the existing JSON snapshot unchanged; test atomic failure.
- `1970-01-01` must not outrank a real watch date; test sorting.
- Instagram pagination failure after page one must leave the previous snapshot intact; test fetch and write separation.
- Internal navigation and language switch must work under a non-root deployment base path; inspect generated links or build with a base path.

---

### Task 1: Movie data importer

**Files:** Create `scripts/movie-data.mjs`, `scripts/import-movies.mjs`, `tests/movie-data.test.mjs`, `src/data/movies.json`; modify `.gitignore`.

**Interfaces:**
- Produces `parseMovieCsv(text: string): Movie[]` and `importMovieFile(sourcePath: string, targetPath: string): Promise<number>` from `scripts/movie-data.mjs`.
- `Movie` is `{ id, url, title, year, rating, review, spoiler, watchedAt }`; `watchedAt` is ISO date or `null`.

- [ ] Write tests for quoted reviews, `MOVIE` filtering, deduplication, valid half-star ratings, missing columns, `1970-01-01`, unknown dates, and failed import preservation.
- [ ] Run `node --test tests/movie-data.test.mjs`; verify relevant assertions fail because the importer is absent.
- [ ] Implement the parser and atomic importer. Require the nine named source columns; validate complete input before replacement; reject invalid rating and URL. Dedupe by ID in first-seen order. Sort known watch dates descending, then unknown dates in source order.
- [ ] Run `node --test tests/movie-data.test.mjs`; expect all tests to pass.
- [ ] Run `node scripts/import-movies.mjs movie.csv`; expect 260 movie records in `src/data/movies.json`. Commit importer, test, snapshot and ignore rule, excluding `movie.csv`.

### Task 2: Instagram snapshot sync

**Files:** Create `scripts/instagram-data.mjs`, `scripts/sync-instagram.mjs`, `tests/instagram-data.test.mjs`, `src/data/instagram.json`.

**Interfaces:**
- Produces `normalizeInstagramPages(fetchPage: (url: string) => Promise<object>, startUrl: string): Promise<Post[]>` and `syncInstagram({ token, userId, fetchImpl, outputPath }): Promise<number>` from `scripts/instagram-data.mjs`.
- `Post` is `{ id, caption, mediaType, timestamp, permalink, previewUrl }`; empty initial snapshot is `[]`.

- [ ] Write tests for pagination, post normalization, duplicate IDs, malformed responses, and partial-fetch failure preserving the prior snapshot.
- [ ] Run `node --test tests/instagram-data.test.mjs`; verify the missing implementation fails the tests.
- [ ] Implement Graph API requests using `INSTAGRAM_ACCESS_TOKEN` and `INSTAGRAM_USER_ID`; fetch all pages, validate and sort before atomic write. Never log a token or include it in saved data.
- [ ] Run `node --test tests/instagram-data.test.mjs`; expect pass. Commit code, tests, and truthful empty snapshot.

### Task 3: Bilingual site and visual behavior

**Files:** Create `package.json`, `astro.config.mjs`, `src/layouts/BaseLayout.astro`, `src/components/BusinessCard.astro`, `src/components/MovieList.astro`, `src/lib/site.ts`, `src/pages/index.astro`, `src/pages/[lang]/index.astro`, `src/pages/[lang]/research.astro`, `src/pages/[lang]/cinema.astro`, `src/pages/[lang]/writing.astro`, `src/styles/global.css`, and `tests/site.test.mjs`.

**Interfaces:**
- Consumes `src/data/movies.json`, `src/data/instagram.json`.
- Produces static pages and a `localizedPath(lang, section)` helper that respects Astro's configured base path.

- [ ] Write tests for localized paths, document language, all six section routes, card controls, cinema review/spoiler rendering, and truthful Instagram empty state.
- [ ] Run `node --test tests/site.test.mjs`; verify failure before pages/helpers exist.
- [ ] Implement the four page types in both languages with semantic navigation, keyboard card flip, reduced-motion handling, responsive layout, paginated Instagram posts, and accessible spoiler disclosure.
- [ ] Run `node --test tests/site.test.mjs` and `npm run build`; expect green tests and eight generated pages including root redirect.
- [ ] Inspect desktop/mobile render if a browser is available, fix visible clipping, then commit site code and tests.

### Task 4: Deployment and operating instructions

**Files:** Create `.github/workflows/deploy.yml`, `.github/workflows/sync-instagram.yml`; modify `README.md`.

**Interfaces:** Uses `npm run build`, `node scripts/import-movies.mjs movie.csv`, and `npm run sync:instagram`.

- [ ] Write a static workflow check asserting a daily schedule, required secret environment mapping, Pages permissions, and no raw CSV publication.
- [ ] Run `node --test tests/workflows.test.mjs`; verify expected failure.
- [ ] Add workflows. Deploy on `main` push. Sync daily and manually; only commit `src/data/instagram.json` after a fully successful fetch, then allow deploy on that push.
- [ ] Document local setup, CSV replacement, Meta app/token/user ID setup, credential rotation, scheduled-run monitoring, and GitHub Pages settings in README.
- [ ] Run full `node --test` and `npm run build`; inspect generated output for secret leaks and empty states; commit workflows/docs/tests.
