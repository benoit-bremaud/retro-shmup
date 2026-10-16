# Local review — retro-shmup (test/smoke-three-engines)

- Date: 2026-10-16
- Commit: branch head after the review fixes
- Scope: branch diff main...HEAD (playwright.config.ts, package.json, Makefile, CONTRIBUTING.md,
  tests/smoke/first-playable.spec.ts) — ADR-0026
- Checks run: tests (test-auditor) · correctness + security (code-reviewer) · execution checks;
  design and docs proportional (test and tooling files only, no `src/` change)
- Verdict: ship · Must 0 · Should 0 open (3 fixed) · Nice 3

## Pre-merge gate
| Step | Result |
|---|---|
| 1 Tests | ✅ 1305 Vitest · ✅ smoke 6/6 (2 tests × Chromium, Firefox, WebKit), twice |
| 2 Coverage | tests 99.27 % stmts / 95.67 % branches / 100 % funcs / 99.9 % lines (floor 80) · docs 100 % (floor 90) |
| 3 SonarQube | ✅ PASSED |
| 4 Secrets | ✅ gitleaks clean · only `.env.example` tracked · diff read: nothing sensitive |
| 5 QA pass | ✅ High scores after reload in WebKit: `qa/2026-10-16-hall-of-fame-after-reload-webkit.png`; no `vite preview` left on :4173 |
- Gate: **GREEN**

## 🔴 Must Have
_None._

## 🟡 Should Have (fixed in this branch)
- `tests/smoke/first-playable.spec.ts` `[tests]` · `storedNames` could throw on unreadable JSON · one `storedDocument` helper with a guarded parse.
- `tests/smoke/first-playable.spec.ts` `[tests][correctness]` · `storedAutofire` matched raw text · reads `options.autofire` from the parsed document.
- `tests/smoke/first-playable.spec.ts` `[correctness]` · `SAVE_KEY` copied from `src` · import tried, but `save-store.ts` does not resolve under the smoke `nodenext` settings; kept as a copy with a pointer comment.

## 🔵 Nice to Have
- `tests/smoke/first-playable.spec.ts` `[tests]` · menu navigation by timed key presses · poll the highlight row after each press if it ever flakes.
- `tests/smoke/first-playable.spec.ts` `[tests]` · `PLAY_ROW` and `RESUME_ROW` share a value · pre-existing.
- `playwright.config.ts` `[correctness]` · `playwright test` alone skips the build · `pnpm test:smoke` / `make smoke` build first (CONTRIBUTING.md).

## ⚪ Disagree / Intentional
- `tests/smoke/first-playable.spec.ts` `[tests]` · "the `storedNames` check is tautological, the 2× pixel margin is unverified" · the check proves the game's start-up did not wipe the seeded document, the pixel margin passed in all three engines twice, and the WebKit screenshot shows the names (ADR-0026 decision 2).

## Per-dimension summary
- Tests: one smoke file, two tests, three engines, as ADR-0026 · Correctness: no bug · Security: no new surface, no dependency · Design / Docs: config and CONTRIBUTING aligned with ADR-0026.
