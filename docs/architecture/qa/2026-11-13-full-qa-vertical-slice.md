# QA full - retro-shmup (2026-11-13)

| Level | Head SHA / base | Environment | Targets | Agent / model | Matrix page |
|---|---|---|---|---|---|
| full | 7ccedfd / none (first report of this folder; no deploy note) | staging (https://retro-shmup.pages.dev, serves 7ccedfd) | W | qa-tester, product part, Sonnet | not published (orchestrator) |

Checklist: `61702fb560a9`

## Plan
Level `full`, product part. Browser game (W): keyboard, touch (390 portrait, mobile landscape, 320x568) and mouse; Chromium, Firefox and WebKit; EN and FR; effect toggles and reduced motion; tampered save documents; persistence across reload; Lighthouse and a layout-shift trace; header and cache review by `curl`. In: FON, DAT, UI, A11Y, PERF, ROB, USA, PRI. Out: SEC (security part), ROB-11 and MOB (not applicable), ROB-13 (static host).

Online leaderboard: deployed build has the URL empty, as designed: no ONLINE SCORES row, no SEND row, no request to any non-origin host (checked in the network list and on a keyboard run). Local exercise **done**: a copy of the sources in the scratchpad (outside the worktree; the worktree product files were not modified) was served by `vite` with the leaderboard URL set to the unresolvable `https://leaderboard.invalid`, version 0.1.0. Seen: ONLINE SCORES row between FULLSCREEN and BACK, empty list screen, 13 injected kept runs shown 10 + 3 with NEXT and PREV, 13 status calls failing with ERR_NAME_NOT_RESOLVED without breaking the screen (runs stay PENDING VERIFICATION). Not exercised: the send screens after a run and the erase confirmation. Dev-server noise: one 404 on a dev-only resource, not investigated. The server was stopped and the copy edit is not part of the repository.

Shot names below are `2026-11-13-<name>.png` in this folder; `*` stands for several files.

## QA matrix
Gate ❌ · 🔴 Must 2 · 🟡 Should 1 · 🔵 Nice 2 — 70 checks: Pass 28 · Fail 7 · Mixed 1 · Not tested/N/A 34

| ID | Domain | Check | Result | Verdict | Evidence | Issues | Shots |
|---|---|---|---|---|---|---|---|
| FON-01 | FON | Nominal journey | Pass | PASS | title, country, run, pause, game over, name entry, high scores, reload, EN and FR walked |  | 01, 10, 11, 12, 20, 23, 25 |
| FON-02 | FON | The diff's paths (online scores off in the deployed build) | Pass | PASS | no ONLINE SCORES row, no SEND row, zero non-origin requests on the deployed page |  | 02, 90 |
| FON-03 | FON | Boundaries on inputs | Pass | PASS | volume clamp and wrap, name length, tampered save values handled by allowlist |  | 04, 61-save-* |
| FON-04 | FON | Text inputs (unicode, long) | Not tested/N/A | N/A | no free text input; the name entry is a letter grid (XSS and garbage in a tampered save are dropped) |  | 61-save-xss |
| FON-05 | FON | Numbers and locale | Not tested/N/A | N/A | no numeric input; scores shown as plain integers |  |  |
| FON-06 | FON | Dates | Not tested/N/A | N/A | dates are only displayed (online list ISO dates) |  |  |
| FON-07 | FON | Decision tables | Not tested/N/A | N/A | no role or plan rules |  |  |
| FON-08 | FON | State transitions and reload | Pass | PASS | title, pause, options, quit confirm, resume count-in, reload on the high scores; Esc and Back paths |  | 13-19, 26 |
| FON-09 | FON | Error guessing, double actions | Not tested/N/A | NOT TESTED | no rapid double-press or two-tab session recorded |  |  |
| FON-10 | FON | Forms | Not tested/N/A | N/A | no form; name entry covered by FON-01 |  |  |
| FON-11 | FON | List lifecycle, pagination | Pass | PASS | high scores top 10 kept across reload; the online list (local dev only) pages 10 per page, 13 runs give 10 + 3 with NEXT and PREV |  | 25, 26, 92, 94 |
| FON-12 | FON | Regression of the previous report | Not tested/N/A | N/A | no previous report under docs/architecture/qa/ (screenshots only) |  |  |
| FON-13 | FON | Exploratory session | Pass | PASS | impatient-player charter: Esc, remap collisions, tampered saves, touch rotation; findings in USA-06 and UI-08 |  | 60, 61-save-* |
| DAT-01 | DAT | API contract | Not tested/N/A | N/A | no API in the deployed build (leaderboard off) |  |  |
| DAT-02 | DAT | Persistence | Pass | PASS | options, bindings, language, high scores kept across reload; newer-version save read-only, garbage save gives defaults |  | 26, 61-save-newer, 61-save-garbage |
| DAT-10 | DAT | Deploy mid-request | Not tested/N/A | N/A | static host, no request in flight |  |  |
| UI-01 | UI | Viewports | Pass | PASS | 1440x900, 390 portrait, mobile landscape, 320x568: no scroll, nothing clipped; text zoom N/A on canvas |  | 01, 50, 56, 60 |
| UI-02 | UI | Console and network | Pass | PASS | deployed page: zero console errors, only same-origin requests; WebKit CSP lines came from the screenshot harness (clean without it) |  |  |
| UI-03 | UI | Engines | Pass | PASS | Chromium, Firefox, WebKit: options, play, pause identical |  | 80, 81, 82 |
| UI-04 | UI | Dark, reduced motion, forced colors | Pass | PASS | prefers-reduced-motion changes the effect defaults (shot 41); dark scheme N/A (always dark) |  | 41 |
| UI-05 | UI | States | Pass | PASS | default high-score table, unreadable save, read-only newer save, empty online list (local), unreachable origin (local) |  | 91, 61-save-* |
| UI-06 | UI | i18n | Pass | PASS | every screen checked in FR: options, audio, controls, high scores, title; no English left |  | 30-36 |
| UI-07 | UI | Visual regression | Not tested/N/A | N/A | no previous report to compare with |  |  |
| UI-08 | UI | Favicon, meta, 404, robots | Fail | FAIL | unknown paths, robots.txt and favicon answer 200 with the game page; no meta description | #188 |  |
| A11Y-01 | A11Y | Keyboard only, whole journey | Pass | PASS | all menus, remap, run, pause, name entry reachable and completed without a mouse |  | 05, 13, 21-23 |
| A11Y-02 | A11Y | Semantics | Fail | FAIL | no main landmark, no h1, canvas without accessible name, html lang stays en in FR | #185 |  |
| A11Y-03 | A11Y | Errors announced | Not tested/N/A | N/A | no form errors |  |  |
| A11Y-04 | A11Y | Contrast | Fail | FAIL | version label measures 4.42:1 (45% white), under 4.5:1; menu text passes | #185 | 01 |
| A11Y-05 | A11Y | Target size | Pass | PASS | every title and options row tapped on a 390 viewport (touch, hasTouch), no miss |  | 50, 51 |
| A11Y-06 | A11Y | Focus not obscured | Not tested/N/A | N/A | no sticky overlay |  |  |
| A11Y-07 | A11Y | Single-pointer alternative to drags | Pass | PASS | steering has keyboard and tap alternatives; no drag-only action |  | 53 |
| A11Y-08 | A11Y | Accessible authentication | Not tested/N/A | N/A | no sign-in |  |  |
| A11Y-09 | A11Y | Consistent help, no redundant entry | Not tested/N/A | N/A | no help or repeated entry |  |  |
| A11Y-10 | A11Y | W3C Easy Checks | Fail | FAIL | structure and headings missing (see A11Y-02); title, keyboard and contrast otherwise hold | #185 |  |
| A11Y-11 | A11Y | axe-core and accessibility tree | Not tested/N/A | NOT TESTED | axe not run; the accessibility tree was read by hand (A11Y-02) |  |  |
| A11Y-12 | A11Y | Reflow, text spacing, zoom 400 % | Not tested/N/A | NOT TESTED | 320 px reflow seen under UI-01; text spacing and 400 % zoom not run |  |  |
| A11Y-13 | A11Y | Flashing, orientation, time limits | Mixed | INCONCLUSIVE | orientation not locked and effects toggles work; but the blink stays on by default even under prefers-reduced-motion (documented interim in src/domain/save/save-store.ts); flash rate not measured; owner decision needed, see Findings |  | 41 |
| A11Y-14 | A11Y | Screen reader pass | Not tested/N/A | NOT TESTED | no NVDA or Orca run on this machine |  |  |
| PERF-01 | PERF | Lab budget | Fail | FAIL | Lighthouse CLS 0.126 over 0.1, caused by the canvas resized by script after load | #184 |  |
| PERF-02 | PERF | Bundle, compression, cache headers | Fail | FAIL | hashed JS and CSS and the audio answer max-age=0, must-revalidate | #186 |  |
| PERF-05 | PERF | Memory over 50 open/close | Not tested/N/A | NOT TESTED | no heap snapshot taken |  |  |
| SEC-01…10 | SEC | Ten probes | Not tested/N/A | NOT TESTED | security part not run (hand-off: sourcemap: true in vite.config.ts, check for served .map files on SEC-09) |  |  |
| SEC-11 | SEC | Vertical access control | Not tested/N/A | N/A | no accounts or privileged routes |  |  |
| SEC-12 | SEC | Sign-out | Not tested/N/A | N/A | no session |  |  |
| SEC-13 | SEC | Injection beyond XSS | Not tested/N/A | NOT TESTED | security part not run |  |  |
| SEC-14 | SEC | File upload | Not tested/N/A | N/A | no upload |  |  |
| SEC-15 | SEC | Business logic | Not tested/N/A | NOT TESTED | security part not run |  |  |
| SEC-16 | SEC | Tokens and OAuth | Not tested/N/A | N/A | no tokens in the deployed build |  |  |
| SEC-17 | SEC | Information leaks | Not tested/N/A | NOT TESTED | security part not run |  |  |
| SEC-18 | SEC | Dependencies | Not tested/N/A | NOT TESTED | security part not run (just check runs pnpm audit) |  |  |
| ROB-01 | ROB | Network cut, timeout | Pass | PASS | local dev copy with an unreachable origin: 13 status calls failed, list kept, no crash; deployed build makes no call |  | 93 |
| ROB-02 | ROB | Backend down | Pass | PASS | same unreachable origin run, game stays usable |  | 93 |
| ROB-05 | ROB | Two tabs | Not tested/N/A | NOT TESTED | not run |  |  |
| ROB-06 | ROB | Malformed input to parsers | Pass | PASS | garbage, wrong types, huge score, XSS strings and newer version in the save document: defaults or dropped, no throw |  | 61-save-*, 62-save-* |
| ROB-10 | ROB | Flag on and off | Pass | PASS | leaderboard URL off (deployed) and on (local copy): both paths work |  | 90 |
| ROB-11 | ROB | Firmware safety | Not tested/N/A | N/A | no firmware |  |  |
| ROB-13 | ROB | Server logs of the pass window | Not tested/N/A | N/A | static host (Cloudflare Pages), no application logs; the orchestrator can confirm |  |  |
| MOB-01…14 | MOB | Native mobile checks | Not tested/N/A | N/A | web product, no Expo or native build; mobile browser covered under UI, A11Y-05 |  |  |
| USA-01 | USA | Nielsen heuristics | Pass | PASS | visible state, confirm on quit, consistent Esc; one finding in USA-06 |  | 18 |
| USA-02 | USA | First-time user | Pass | PASS | title to run to name entry without docs |  | 10, 11 |
| USA-03 | USA | Actionable error messages | Not tested/N/A | N/A | no user-facing errors in the deployed build |  |  |
| USA-04 | USA | Destructive actions confirmed | Pass | PASS | quit to title asks to confirm, No returns to pause |  | 18, 19 |
| USA-05 | USA | Feedback timing | Pass | PASS | count-in on resume, selection highlight immediate |  | 14 |
| USA-06 | USA | Consistency, polish | Fail | FAIL | leaving an options sub-screen puts the highlight on the first row, not on the row that was opened | #187 | 05 |
| PRI-01 | PRI | No personal data in URL, storage, network | Pass | PASS | storage holds options, name and country only; URL clean; no non-origin request |  |  |
| PRI-02 | PRI | Consent | Pass | PASS | nothing non-essential fires; no tracker |  |  |
| PRI-03 | PRI | Third parties | Pass | PASS | no third-party host at all |  |  |
| PRI-04 | PRI | Data subject rights | Not tested/N/A | N/A | no account; local data only |  |  |
| PRI-05 | PRI | Data minimisation | Pass | PASS | name and country are the only fields, nothing copied into this report |  |  |
| PRI-07 | PRI | autocomplete, Referrer-Policy | Not tested/N/A | N/A | no form field; Referrer-Policy header present |  |  |

No `docs/architecture/qa/test-plan.md` exists: no JRN rows.

## Findings to act on
1. 🔴 Must - fix(render): layout shift of 0.126 at load because the canvas is resized by script (PERF-01) -> #184. Seen: Lighthouse CLS 0.126 and a layout-shift entry when `main.ts` sets the visible size after the canvas rendered at 240x320. Expected: below 0.1. Suggested fix: size the canvas box in CSS before the script runs, or hide it until the first frame.
2. 🔴 Must - fix(ui): no landmark, heading, canvas name or live `lang`; version label contrast 4.42:1 (A11Y-02, A11Y-04, A11Y-10) -> #185. Suggested fix: `<main>`, a visually hidden `<h1>`, `aria-label` on the canvas, update `documentElement.lang` with the language option, raise the label from 45% to about 50% white.
3. 🟡 Should - fix(repo): long cache for hashed assets and audio in `public/_headers` (PERF-02) -> #186.
4. 🔵 Nice - fix(ui): Options sub-screen back restores the first row (USA-06) -> #187.
5. 🔵 Nice - chore(repo): 404 page, robots.txt, favicon, meta description (UI-08) -> #188.
6. Owner decision, not filed (A11Y-13): the blink effect defaults to on even when `prefers-reduced-motion` is set; the code comments call it an interim until a non-flashing form exists. Confirm it is covered by an existing GDD item, otherwise file it.
7. Hand-off to the security part: `vite.config.ts` has `sourcemap: true`; check whether `.map` files are served on the deployed site (SEC-09).

## Not tested
- SEC-01…10, 13, 15, 17, 18: NOT TESTED (security part not run).
- A11Y-11 (axe), A11Y-12 (text spacing, 400 % zoom), A11Y-14 (screen reader), PERF-05 (heap over 50 open/close), FON-09 (double actions), ROB-05 (two tabs): not run, would need axe or a screen reader on the machine and a longer session.
- ROB-13: N/A, static host without logs; the orchestrator may close it.
- Send-online screens after a run and the online erase: not exercised (local copy covered only the list, empty state, pagination and failure path).
- iOS Safari on a real device: not available; WebKit engine on desktop only.
- `.playwright-mcp/` at the worktree root is an untracked artefact of the browser tool; delete it before committing.

## Delta vs previous report
No previous report: fixed 0, still failing 0, new 5 issues.
