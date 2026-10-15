# Project Log — retro-shmup

Reverse-chronological operational logbook (most recent first). It complements `git log` with the
human context: what was done, why, and by which PR. Not the release changelog (see
[CHANGELOG.md](CHANGELOG.md)).

---

## 2026-10-15

### G2-3a: the name entry (branch `feat/g2-name-entry`) — Refs #46

- After Game over or the Ending card, a score that enters the top 10 opens the name entry; else
  the title, as before. `NameEntry` (`scenes/name-entry.ts`): the name on a letter grid (`A`–`Z`,
  `0`–`9`, *SPACE*, *DEL*, *OK*, *SKIP*), then the country on the letters-only grid (*DEL*,
  *NONE*, *OK* shown only for a code of `COUNTRY_CODES`), preselected from the browser language.
  *SKIP*, or *OK* on an empty or all-space name, records nothing; `back` deletes and never
  leaves. An entry is inserted, saved through `SceneHost.highScoresChanged` and shown
  highlighted on the High scores screen. The two G2 interims (Ending and Game over → title) are
  lifted.
- `LetterGrid` (`scenes/letter-grid.ts`): a two-dimensional wrapping cursor, wide cells, the
  menus' release, re-press and opening guards through `PressGuard`, shared with `Menu` in the new
  `scenes/menu-input.ts` (the direction thresholds moved there too). `drawNameEntry` in
  `overlays.ts`; six catalogue keys. `SceneHost` gains `countryOfLanguage` (the region of the
  browser language, read once at startup: ADR-0009's snapshot), `today` and `highScoresChanged`
  (`main.ts`).
- Owner decisions (2026-10-15, after a drift audit of 27 items): the stored level is 1 while the
  slice has one level; the country step opens on *OK* when the preselected code is known; the
  other implementation choices (diagonal sideways, row-wrapping, the cursor stepping back when
  *OK* disappears, no way back to the name, the geometry, `PressGuard`) approved and documented in
  GDD v0.16 §9.1, CD-menus, STM-scenes, SD-score and the traceability matrix.
- Reviews: code review no Must/Should; anti-patterns no Must, four Should fixed (private
  `stage`/`cursor`, shared input rules out of `menu.ts`, `GridAction` back in the scene, the entry
  built by `NameEntry`). Mutation checks: every planted bug caught.
- Headless check: a run lost at 16 500 points opens the grid; the cursor, typing and `Escape`
  deleting work.

## 2026-10-14

### G2-2: the High scores screen and the Ending card (branch `feat/g2-high-scores-screen`) — Refs #46

- *High scores* / *MEILLEURS SCORES* in the title menu (between *Play* and *Options*): ten rows
  formatted once on opening by `HighScoresScreen` (`scenes/high-scores-screen.ts`: rank, name,
  country, score, level; dashes on an empty rank), drawn by `drawHighScores` in the menu font;
  `back`, `confirm` or a tap started on the screen returns to a title locked 1 s; `Pause` ignored.
  The table comes from the save (`SceneMachine`'s new `highScores` argument, `main.ts` passes
  `save.highScores`).
- The Ending card: a cleared run's Results now lead to *VICTORY* / *VICTOIRE* and the final score
  (`drawEnding`), left by `confirm` or a tap after 1 s, or after 6 s (`SceneTuning.endingSeconds`);
  the slice-end interim is lifted. Interim until G2-3: the card returns to the title (the name
  entry of a qualifying score comes with the letter grid).
- The title menu has three rows: the smoke test taps PLAY at y 144.
- Chrome check on the local build with a planted table: the title menu, the High scores screen
  (aligned columns, dashes), a click back to the title, no console error. Not checked in Chrome:
  the Ending card (it needs a cleared run); the scene tests cover its texts, lock and timer.
- Reviews: no Must. Fixed — the starfield froze on the Ending card (each scene drawing a run counts
  its own background steps; test proven against the old code); the high-score row type declared
  once in presentation; the Ending layout and highlight margin named; the Ending lock its own
  tuning value; stale Results comment; the screen reuses the table's size.
- Owner decisions the same day: a simple attract mode (10 s idle on the title → the high scores 6 s
  → the title; any input returns) in G2-3; the enemies' look (squares today) — analysis pending.
- Design-versus-code drift audit (2026-10-15): 27 drifts — 18 where the code was ahead of the
  study, 4 contradictions, 5 planned items. Owner approvals the same day, documented in the GDD
  (§4.2, §9.1), STM-scenes, CD-menus, SD-remap and the traceability matrix: A1 `ControlsScreen`
  and `HighScoresScreen` own their screens, the scene machine routes; A2 the binding capture
  goes through `SceneHost` (`keyLabel`), `ControlsScreen` calls `bind`; A3 the top 10 is the
  scene machine's `highScores` constructor parameter, the host's country, date and table
  callbacks planned for G2-3; A4 seven `Menu` objects, `OpenableMenu`, `ignore`,
  `lastSideways`, `flips`, optional `MenuScreen` header and value, `screenOf`; C1 the High
  scores columns as coded; C2 Ending and Game over → title an interim until G2-3; C3 keys with
  Ctrl, Alt or Cmd/Meta held are ignored and keep their browser action. Name entry, letter grid
  and the host's G2-3 methods stay in the study, marked planned.
- Codex review (P2): a stored score wider than the column overlapped the row. Owner choice A
  (47/50): an arcade counter stop at 99 999 999 — `ScoreKeeper.add` stops there
  (`ScoreTuning.counterStop`), `parseHighScores` drops a stored score above it; GDD §8 and the
  gameplay class diagram updated.

### G2-1: the high-score table, its save and two glyphs (branch `feat/g2-table`) — Refs #46

- First of the three G2 code PRs (owner choice A, 44/50). No visible change.
- `domain/hall-of-fame/country-codes.ts`: the 249 officially assigned ISO 3166-1 alpha-2 codes
  (XK excluded); `domain/hall-of-fame/high-scores.ts`: `HighScoreEntry`, `parseHighScores`
  (allowlist: name rules, country in the list, whole score ≥ 0, level 1–3, `YYYY-MM-DD`; invalid
  entries dropped, best first, ten at most, never throws) and `HighScoreTable` (a score above 0
  enters above the tenth, ties after the older, `insert` returns the rank).
- `SaveStore` reads the table by allowlist (`highScores`) and writes it with the options last
  loaded or saved (`saveHighScores`); an option change keeps it; a newer document stays unwritten.
- The menu font gains `?` and `-`.
- Reviews: code-reviewer no Must or Should (the 249 codes checked against the official list by
  script); architecture-guardian 2 Must fixed — `HighScoreTable` now sorts and caps whatever it is
  given (the guarantee lived in the parser only), and `SaveStore` writes nothing before `load`,
  which also resets its cached options and table (a save before reading could have overwritten
  the stored options with the defaults). Also: a stored score of 0 dropped, the class diagram's
  `SaveStore` aligned (`load` returns the options, `highScores`), tests for ties, a full table and
  `__proto__`. Not done: exporting `???` as a constant, no second use since skipping records
  nothing.
- Owner decision the same day: *SKIP*, or *OK* on an empty name, records nothing and returns to the
  title (the player is never made to appear) — GDD v0.16 amended, a second amendment note in
  ADR-0021 (status unchanged; `???` still parsed), UC3 2b, STM-scenes and CD-menus follow.
- Also decided: after G2, a third rebalance of level 1 (v0.17) — the owner finds the waves, the
  boss, the ship's power and the whole level far too easy; the measurement bot (#56) is rebuilt
  for it.

### G2 design: the hall of fame, GDD v0.16 (branch `docs/g2-hall-of-fame-design`) — Refs #46

- Owner choices (scored, after a deeper analysis each): the name on a letter grid (43/50, against
  the arcade wheel 30 and grid plus typing 42); the country on the same grid with letters only and
  *OK* only for a valid code (44/50 — revised up from the first analysis, which preferred a
  two-letter spinner, now 37).
- Defaults taken and stated: a score enters only above the tenth, ties keep the older entry
  first; *High scores* in the title menu; the Ending card *VICTORY* (title font, *MISSION
  COMPLETE* being wider than the field) with the score, its two story sentences deferred to the
  assets brick; the date given by the host; the slice-end interim lifted (Results → Ending).
- Doc review: 4 Must fixed (the stale slice-end passage, UC1 9a and its decision row marked
  superseded; *NONE* / *AUCUN* two cells wide; the menu font gains `?` and `-`; the opening guard
  and the 1 s title lock after the high scores), Shoulds applied (an amendment note at the end of
  ADR-0021 — entries first ship under save version 2, no bump, status unchanged; `saveHighScores`;
  `country` optional; the name trimmed; cursor rules for the wide and hidden cells; fonts and table
  columns named; the host gives the date as `YYYY-MM-DD`; pause ignored in the G2 screens; a score
  of 0 never enters). A stray `.mcp.json` (not from this work) kept out of the PR.
- Docs only: GDD v0.16 (§9.1 letter grid, table, High scores, Ending; decision record), STM-scenes
  (G2 states), CD-menus (`LetterGrid`, `NameEntry`, `HighScoreTable`, `HighScoreEntry`), new
  SD-score sequence, UC3, UC4, matrix, architecture README.

### G1b-3: the controls screen (branch `feat/g1b-controls-screen`) — Refs #46

- *Controls* / *COMMANDES* in the options (hidden when the last device used is touch: two option
  menus, chosen at each opening), from the title and from the pause; *Restore defaults* asks
  first (*NO* first) and resets the edited device only.
- `ControlsScreen` (`scenes/controls-screen.ts`) owns the screen so the scene machine only routes:
  the `ControlsGrid` (a `Menu` of 9 rows plus the column from left and right, the hover and the
  tap's x), the edited device (the last of keyboard and gamepad, fixed during a capture), the
  capture through the `SceneHost` (now also `startCapture`, `captureNext`, `cancelCapture`,
  `keyLabel`, in its own `scenes/scene-host.ts`), `bind` with a refused exchange restarting the
  wait, and each cell's text. No menu action is read while waiting nor in the answering step; a
  tap or leaving cancels.
- `domain/input/input-names.ts`: `keyName` (the layout's character, else the arrow glyph, the
  numpad name or the catalogue's name by language) and `buttonName` (A, B, … START, the d-pad
  arrows), strings built once. The catalogue gains the screen's texts EN / FR.
- `drawControlsScreen`: the header, the device, one row per intent (label, two centred cells), the
  two action rows; one cell highlighted.
- Reviews: no Must. Fixed (architecture-guardian) — no capture cancel on every menu opening (it
  could never act); the options without *Controls* chosen once per opening, the scene table kept
  immutable (`screenOf`); the grid rows derived from `REMAPPABLE_INTENTS` through a typed label
  record (a reorder can no longer bind the wrong intent); the view says how many intent rows it
  has; `drawMenu` and the controls screen share one highlighted-row drawing; `SlotColumn`.
  Fixed (code-reviewer) — a tap in the same step no longer erases a capture's answer; left, right
  and the hover change the column on the intent rows only; a tap on a label starts nothing; the
  touch test uses a real tap and covers the row coming back after a key; the pause-side
  automatic pause during a capture is tested.
- Chrome check on the local build (an AZERTY keyboard): the US `W A S D` and `Z` show as **Z S Q D**
  and **W** through the layout map; capture of *PAUSE*'s secondary (*PRESS*, then `C`, saved);
  exchange (*FIRE* takes `X`, *BOMB* gets *SPACE*); *Restore defaults* with its confirmation; no
  console error. Not proven in Chrome: that the new key pauses in play (the extension's captures
  pause the game on their own); the input tests cover a new binding being applied.

### G1b-2: the capture in the input adapter and the menu font (branch `feat/g1b-capture`) — Refs #46

- `InputPort.startCapture(device)`, `captureNext`, `cancelCapture` in `DeviceInput`: the next
  capturable key or button of the device answers; `Escape` cancels and keeps its browser action;
  a key outside the set is refused and every other key's browser action is prevented while
  waiting; a button already held at the start never answers (the gamepad module exposes the
  presses of its last poll); the gamepad wait cancels itself after 5 s of reads; a lost focus
  cancels.
- `InputPort.label(code)` now answers only a letter or digit key's printed character: learned
  from the session's key events (`KeyEventLike.key`), else the browser layout map (Chromium,
  read through a type guard in `main.ts`, put in capitals once), else US; a character the font
  cannot draw falls back to US; `''` for other keys, whose names are the domain's (G1b-3, they
  depend on the language). Nothing learned is saved or sent.
- The menu font gains the digits and the arrows ← ↑ → ↓ (`menuGlyph`); the renderer, the test
  double and the contract tests follow.
- Reviews (code-reviewer, architecture-guardian). Must fixed: Ctrl and Alt could never be
  captured (their own keydown carries their flag, read as a shortcut — `isShortcut` now ignores a
  modifier's own flag); the lost active pad did not cancel a capture; `label` built a string per
  call, in the draw path (now the code's last character, cached). Should fixed: while a keyboard
  capture waits a key only answers it and latches no intent (so `Escape` or a bound key never
  acts twice); the labels move to their own `KeyLabels` class (`adapters/input/key-labels.ts`)
  that keeps only drawable characters; the button scan loops over the 17 standard buttons and
  filters by the allowlist; the Numpad contract (`label` gives `''`, the domain names them) is
  written down.

### G1b-1: bindings in the domain and save version 2 (branch `feat/g1b-bindings`) — Refs #46

- First of the three G1b code PRs (owner choice A, 44/50). No visible change: the saved bindings
  now drive the input at start.
- `domain/input/capturable.ts`: the closed capturable set of GDD v0.15 §4.2 (letters, digits,
  arrows, space, Shift, Ctrl, Alt, Backspace, numpad; buttons 0–15); `domain/input/
  bindings-editor.ts`: `bind` (exchange; an emptied primary takes its secondary or the input is
  refused; a key for the gamepad or a button for the keyboard refused) and `restore` (one device).
- `Options.bindings`; `SaveStore` version 2: version 1 migrates with the default bindings; each
  device parsed by allowlist (capturable inputs, primary present, no duplicate, known intents
  only), a failing device getting its defaults back, the other kept. `main.ts` pushes the saved
  bindings at start and a new bindings object on each change.
- Reviews: no Must. Fixed — the intent list moved into the input port with the type derived from
  it (it was written three times and not tied to the type), the bindings parsing moved out of the
  save store into `domain/input/parse-bindings.ts` (with a shared `domain/guards.ts`), and `bind`
  refuses an input outside the capturable set itself.

### G1b design: the controls screen, GDD v0.15 (branch `docs/g1b-remap-design`) — Refs #46

- Owner choices (scored): one row per intent with two slot columns and one cell highlighted
  (46/50, against one row per slot on two pages 31, a sub-screen per intent 34); key labels
  learned from the session's key events, then the browser layout map (Chromium only, checked),
  then US, with fixed names and arrow glyphs (46/50, against layout map then US 38 — wrong on
  Firefox and Safari with AZERTY — US always 30, a full font now 30).
- Defaults taken and stated: the device edited is the last of keyboard and gamepad, the row
  hidden on touch only (a mouse player edits the keyboard; refines UC6 1a); restore defaults asks
  first; `Enter` and `NumpadEnter` refused during a capture; save version 2 with a v1 migration
  and allowlist parsing of the bindings.
- Doc review: 3 Must fixed (`Escape` both cancelling and refused; an exchange into an empty slot
  could leave an intent unbound — now the secondary moves up or the input is refused; labels the
  font cannot draw or that overflow — now a closed capturable set with labels of 10 characters at
  most and blank empty slots), 6 Should (row texts, live device then frozen during a capture, the
  answering step reads no menu action, the named pause triggers, browser defaults prevented and
  the refused keys, button 16 refused) and 3 Nice applied.
- Docs only: GDD v0.15 (§4.2 controls screen, §9.3, decision record), CD-menus (`ControlsGrid`,
  `BindingsEditor`, `ButtonNames`, `KeyLabels`, `InputPort` capture methods, save v2),
  STM-scenes (G1b states), new SD-remap sequence, UC6, matrix, architecture README.

### G1a-3: the options screens and the title menu (branch `feat/g1a-options`) — Refs #46

- Title menu (*Play*, *Options*; a stray tap no longer starts a run); Options and Visual
  effects from the title and from the pause (the pause menu gains *Options*); switches and the
  language flip on confirm, a tap, or a new left or right direction, and only rows with a value
  flip; every change applies at once (the presenter reads the live `EffectSettings`) and reaches
  a `SceneHost` that saves it and forwards autofire and fullscreen to the input port.
- Input port: `setAutofire` (ADR-0020 decision 4), `releaseMovement` (drops a mouse or touch
  owner only, GDD v0.14 §9.1), fullscreen applied once at the next key or pointer press and
  reported in the frame; `InputEnvironment.fullscreen` in `main.ts`.
- Bugs found by the old tests and fixed: a direction held when a menu opens counted as new (a
  pause while holding right would resume at once) — `Menu.reset(now, opening)` records it, and
  the title lock uses `Menu.ignore`; left and right activated any row, *Resume* included.
- Anti-pattern review (architecture-guardian): no Must; Shoulds fixed — `LiveOptions` in
  `domain/options.ts` owns the option values and changes (the scene machine only routes), one
  `backTo` helper, scrolling read from the scene traits, a named `OpenableMenu`, the header as one
  optional object. Pre-push review: no Must; Should fixed — with autofire on, a real mouse button
  or steering finger was masked once the keyboard took the ship (test proven against the old
  code); Should kept by design — the *FULLSCREEN* row is a preference applied at the next
  gesture (GDD §9.3 since v0.4), not the browser's live state.
- Chrome check on the local build: title, Options, French, Visual effects, autofire, *Reprendre*
  by mouse with the ship staying put. Found on the way: a capture by the Chrome extension hides
  and shows the page, which the game reads as a lost focus and so drops a click not yet read —
  a tool artifact, not a game bug.

### G1a-3 design: the options screens, GDD v0.14 (branch `docs/g1a3-options-design`) — Refs #46

- Owner decision after a Chrome check of G1a-2: leaving a menu for play frees the ship's movement
  (option A, 46/50 vs 33/50 for keeping the jump): a mouse click on *Resume* no longer hands the
  ship to the mouse, so a keyboard player never sees it fly to the menu's place. Refines ADR-0018
  decision 4 through GDD v0.14 §9.1 (the ADR itself unchanged): every exit from a menu towards
  play drops a mouse or touch owner only; a keyboard or gamepad owner and held buttons are kept.
- Doc review: 4 Must fixed (the title row of the input table, five menus not six, the
  `releaseMovement` contract — copying the lost-focus path would have re-paused the game after
  *Resume* — and stale `MenuRow` references), 5 Should and 3 Nice applied.
- GDD v0.14: the title is a menu (*Play* first; a stray tap no longer starts a run); rows with a
  value show label left, value right; any activation, left and right included, flips it; the
  EN / FR row texts.
- CD-menus: no row-kind class (a row has a value only through its screen's `value(row)`), the
  scene machine owns the live `Options` and reports to a `SceneHost` (implemented by the
  composition root: save, autofire, fullscreen, movement release); `InputPort` gains
  `setAutofire` and `releaseMovement`. STM-scenes, UC5 (2d) and the matrix follow. Docs only.

### G1a-2: the pause menu and Confirm quit (branch `feat/g1a-pause-menu`) — Refs #46

- `menu` font (`FontId`): the title letters A–Z and space at 2×, in the 8 px hud cell, so a 28-
  character row fits the field; French in capitals without accents. Renderer, test double and
  contract tests follow.
- `IntentFrame` gains the pointer release (`releaseRegion/X/Y`: a lifted finger or the left
  button going up; none for a cancelled finger or the right button; first of a read wins) and
  the mouse hover (`hovered`, `hoverX/Y`, a new field point only); `PointerModule.takeTap`
  writes and consumes them. Documented in CD-menus as an ADR-0009 contract extension.
- `Menu<Id>` (`src/domain/scenes/menu.ts`): rows centred on the field, 16 px each; up/down on a
  new direction (stick beyond 0.5), wrapping; `Confirm`; a release activates only over the row
  its press started on; a 150 ms (9-step) re-press guard on the row just activated; hover
  highlights. The design's `PointerPress` was folded into `Menu` (one caller).
- Scene machine: `Paused` shows PAUSE and *Resume* / *Quit* (the pause icon and its palette
  token are gone); Back and the pause button still resume; `Confirm quit` (*No* first, Back →
  Paused, Pause ignored, no pause button) and *Yes* discards the run and locks the title 1 s. The
  interim tap resume is lifted. Smoke test: the pause oracle is the highlight bar
  (`Palette.menuHighlight`, distinct from every field colour) and the RESUME row resumes.
- Pre-push review: no Must; Should applied — a menu ignores any press for 150 ms after it
  opens, so a doubled tap on *Quit* never lands on *Yes*, the row then at the same height (GDD
  v0.13 §9.1 sentence added, tests; the smoke test now waits 300 ms before tapping RESUME);
  Nice applied: the renderer reads each font's own cell, the pause-button hit test runs only on
  HUD taps.
- Anti-pattern review (owner request, architecture-guardian): Musts fixed before merge — the
  presentation ↔ scenes two-way dependency (new `presentation/menu-layout.ts` with
  `MENU_ROW_HEIGHT`, `menuTop`, header gaps, `MenuView`, `MenuScreen`; `drawMenuScreen`) and the
  scene machine growing per menu (one menu-scene table, one `openMenu`). Shoulds fixed:
  `Menu.step` returns the row id, not an index read at −1; `EffectSettings` and `Options` moved to
  `domain/options.ts` (the save schema no longer depends on the presenter); `takeTap` renamed
  `takePointerEvents`; one `pauseButtonTapped` helper; the renderer reads one font table. Left for
  G1a-3, their first user: switch and choice rows, runtime options, return-to-caller.
- Visual check: headless Playwright captures, portrait and landscape, then in Chrome on the PR
  preview (pause, hover, Quit → No → Resume; no console error). Noted for later: after a mouse
  click on RESUME the mouse owns the ship, which jumps to the cursor (ADR-0018 takeover rule). Found on the way: a key pressed and released inside one frame (a synthetic
  `keyboard.press`) moves nothing, since movement is read as held; a human key tap lasts several
  frames, so no change.

### G1a-1: the save document's options (branch `feat/g1a-save`) — Refs #46

- First of the three G1a code PRs (owner choice A, 46/50: save → pause menu with the menu font and
  the pointer release → options screens). No visible change.
- `SaveStore` (`src/domain/save/save-store.ts`): `load()` reads `retro-shmup.v1` by allowlist
  (invalid JSON, wrong shapes, unknown language or a non-boolean switch → defaults; never
  throws), a newer `version` is read as defaults and never overwritten this session;
  `saveOptions()` writes the whole document once. `defaultOptions(reducedMotion)` keeps today's
  presets (the blink stays on until its non-flashing form exists).
- `LocalStorageStore` adapter wraps every access, reaching `localStorage` included, in try/catch.
- `main.ts` reads the options once at start; the effects follow them. `storage-port.ts` leaves the
  Knip ignore list (its adapter landed). Security: INPUT-1 allowlist parsing, ERR-1 no swallowed
  error beyond the documented "unavailable" outcome, no personal data (PRIV-1).

### Screens brick G1a designed: menus and options, GDD v0.13 (branch `docs/g1a-menus-options`)

- After v0.12 merged (#55), the owner was reminded that the #45 "average player" bot study had
  already been done for v0.12 (code never committed); chose not to redo it: the friends'
  playtest of v0.12 answers the open human questions (wave feel, hitbox, the power 4 → 5 cliff),
  and the bot returns as a balance guard only for a later level-1 rebalance or level 2 (#56).
- Brick G order chosen (scored 47/50; screens as one block 42, art first 35, audio first 32): G1 save, menus and options → G2 hall of fame → G3 audio →
  G4 art; G1 split into G1a (menus, simple options) and G1b (remap, already specified in §4.2).
- G1a decisions: touch and mouse activate a menu row on release over the pressed row (150 ms
  re-press guard, a visible *Back* row, hover highlights; two taps 41/50, on-screen arrows 30/50);
  options as sub-screens with *Visual effects* and *All on / All off* (scrolling list 30/50, one
  "reduced effects" switch rejected, contrary to §9.3); rows appear only with their screen.
- Docs only: GDD v0.13 (§9.1 menus, §9.3 layout, decision record), STM-scenes (`Visual effects`
  states, G1a section, build order), new CD-menus class diagram, UC5 extensions, matrix,
  architecture README. The G1a code PR follows.

### The GDD v0.12 level-1 balance applied (#55) — Refs #45

- The tuning PR of the second rebalance (GDD v0.12, #53): the Cruiser takes 1 450 level-1 shots
  (14 500 tenths; phase 2 from 9 570); `ScriptEvent.paysP` (optional, absent = true, checked at
  load: a boolean, on a formation row only), copied by the director onto the `Formation`; a
  formation with `paysP` false still publishes `FORMATION_CLEARED`, scores and counts in the
  tally, only its P is skipped; the 8 s, 50 s and 52 s formations set it to false.
- Tests re-derived from the GDD with `shots(n)`; the seeded replay goes back to seed 1 (it rolls a
  Bomb again); the boss-fight replay uses a scripted dodging, firing test ship, since a blind
  weave can no longer kill a 1 450-shot Cruiser; the limits (≤ 16 enemies, ≤ 40 enemy bullets,
  phase 2 included) stay asserted.
- Resumed in this checkout from an interrupted session's uncommitted worktree
  (`.claude/worktrees/audit-acdeff`), after an audit: the code matched GDD v0.12 with no drift;
  fixed a typecheck error (`exactOptionalPropertyTypes` in `tally-run.test.ts`), rewrapped three
  comments, and moved the docs from "designed" to "applied".

### Versioning policy decided (branch `docs/versioning`, ADR-0025)

- Owner decision after scored options: SemVer 2.0.0; public surface = the save document
  (`retro-shmup.v1`, own `version`, ADR-0006) and the URL parameters, balance and rules excluded;
  bump table (MINOR content/feature, PATCH fixes/rebalance/polish, MAJOR only on an unmigrable
  save or a removed control; pre-1.0 breaking = MINOR); `1.0.0` = itch.io public release.
- First tag `v0.1.0` after the rebalance (#53) and tuning PRs; no retroactive tags; `package.json`
  stays `0.0.0` and the changelog `[Unreleased]` until then.
- Releases are manual (release PR, signed annotated tag with the admin bypass, `gh release create`
  with the changelog section, later `butler --userversion`). release-please rejected: its workflow
  would create unsigned tags and need a bypass of the `v*` ruleset. `.github/tag-protection.md`
  wording aligned.
- Displayed version `v<version>+<short commit>` outside the canvas (`textContent`) is decided but
  implemented in a follow-up PR (GDD then code); it moves to Options / About in brick G.
- Docs only: ADR-0025, `CONTRIBUTING.md` section, `README.md` paragraph, changelog note.

### Rebalance design, GDD v0.12 (branch `docs/rebalance-v012`) — Refs #45

- Second iteration, after a measurement study with an "average player" bot (reaction 0.15 / 0.25
  / 0.40 s, 100 to 300 seeds). Owner-validated values: Cruiser 500 → 1 450 shots (14 500 tenths,
  phase 2 at 9 570); the formations at 8 s, 50 s and 52 s no longer pay the formation P (a
  per-row `pays P` property, default true; no enemy or formation removed).
- Measured on 300 seeds (good / average / beginner bot): fight 42 / 42 / 44 s, the average bot
  dies 1.45 times per run, game over 10 / 19 / 32 %, boss killed 90 / 81 / 69 %, power 5 reached
  at about 119 s, just before the boss. Rejected: HP 13 500, 14 000, 15 000, 15 500, 16 000;
  Gunner P 5 % (no effect); removing formations (contrary to "more enemies").
- Limits recorded: bots are models; power 4 → 5 rests on the 7th formation's P (a cliff to watch
  in the playtest); the waves cannot be judged by bots.
- Docs only (GDD, class and boss state diagrams, matrix, README, CHANGELOG). The tuning PR
  follows and must change, with the 21 assertions currently failing against the new values:
  `src/domain/game/tuning.ts` (Cruiser `hp` 14 500, `phase2HpThreshold` 9 570); the level script
  (`pays P` false on the 8 s, 50 s and 52 s Popcorn rows) and its type and load check in
  `level-script.ts`; `run-rules.ts` `rewardIfCleared` (skip the reward when the row says so).
  Tests: `boss.test.ts` 5, `boss-run.test.ts` 12, `level-simulation.test.ts` 3 (replay over two
  passes expects a Bomb drop that the weaker scripted weapon no longer gets; the boss fight
  replay; the Cruiser cleared by the scripted ship), `tally-run.test.ts` 1; plus new tests for the
  flag (default pays, false pays nothing, the formation still scores and counts) in
  `level-script`, `run-rules` and `level-director` tests, and the stale 5 000 / 3 300 comments.

### Over-engineering leftovers removed (branch `refactor/leftovers`)

- Behaviour-preserving refactor after the audit: `Pool<T>` interface and `FixedPool.size` deleted
  (ADR-0024), `RunConfig.script` dropped for `levels` (tests migrated), `LevelTally.reset()`
  deleted until level 2 needs it, `Body.volleys` reduced from a reserved pair to one counter,
  `sequenceAttack` no longer copies and freezes its groups (callers pass load-time data).
- Class diagram updated (`FixedPool~T~` without `size`, `volleys: number`). 865 → 863 tests (the
  `size` and `reset` cases removed with their API).

## 2026-10-13

### Mutation-gap tests (branch `test/mutation-gaps`)

- Tests only, no game code changed: strict collision edges (shots, hitbox, pickups), Laser
  piercing the boss, nearest target, shield vs death reports, `isOut` with lives left, pointer
  reach, bomb during invulnerability, drop-roll boundaries, boss diagonal entry and axis swap,
  every level-script load check. No production bug found.
- Stryker re-run on the nine core modules: mutation score 89.7 % → 95.5 % (816 killed, 39
  survived, mostly equivalent mutants in `boss.ts` and `attacks.ts`, left as they are).
- Test-auditor review: 0 Must; its Should items applied (redundant edge rows removed, the boss
  swap asserted on observable state, no magic step count, one-draw-per-kill stated as a replay
  determinism test). 865 tests.

### PR #50 merged (`7a2f2a8`) — Knip and CodeQL security-extended

- Green checks, no Codex comment. A Stryker trial on the core modules scored 89.7 % (about 93–94 % without equivalent mutants) after patching its Vitest runner locally (it ran 0 tests per mutant with Vitest 5); 15 real test gaps listed for a follow-up.

### Quality tooling — Knip and CodeQL security-extended (branch `chore/quality-tools`)

- Owner question: other tools for quality and above all security. Inventory first (already in
  place: strict TypeScript and ESLint with project rules, Prettier, commitlint, Vitest coverage,
  the browser smoke test, gitleaks, `pnpm audit`, Dependabot, Dependency Review, CodeQL,
  SonarQube, OSSF Scorecard, SHA-pinned actions, a strict CSP; pnpm 10 already blocks dependency
  install scripts; secret scanning and push protection on). Scored candidates; the owner chose
  Knip (88), CodeQL `security-extended` (84), a Stryker trial on demand (83), and GitHub's
  non-provider secret patterns (78, a repository security setting the owner switches on).
  Rejected as overlap or disproportionate here: Semgrep, Trivy, an SBOM.
- Knip 6 runs in `make verify` and CI (`pnpm knip`); its first run found a dead re-export
  (`STEP_SECONDS` in `frame-loop.ts`, removed) and, before its rule was set, the `Pool<T>` interface (its removal is pending: ADR-0024 in
  PR #49, then the refactor PR); the two ADR-required ports declared ahead of their adapters are ignored with
  a reason in `knip.jsonc`, and types used by an exported member of their own file are not
  flagged.
- CodeQL now runs the `security-extended` query suite on both languages.
### ADR-0024, retire the `Pool<T>` interface (branch `docs/adr-0024-pool`)

- Owner request: quality code without over-engineering. SonarQube on main `d486309`: quality gate
  passed, 0 bugs, 0 vulnerabilities, 0 hotspots, 0 code smells, A/A/A, coverage 97.6 % (lines
  99.7 %, branches 92.9 %), duplication 0.5 % (2 blocks, 34 lines), 0 min of debt. An
  over-engineering audit found no Must and four leftovers: `Body.volleys[1]`, `Pool<T>`,
  `RunConfig.script`, `LevelTally.reset()`; `RunPresenter` (351 lines) to watch.
- Owner decisions (scored): A (93) — one refactor PR plus this ADR for `Pool<T>`, since ADR-0002
  names it as a contract; and a Stryker mutation-testing trial, measured before any adoption.
- ADR-0024 partially supersedes ADR-0002: `FixedPool<T>` is the pool contract; an interface
  returns only with a second implementation. ADR-0002's Status now names ADR-0019 and ADR-0024;
  the class diagram, the decision index and the traceability matrix follow.

### PR #48 merged (`d486309`) — the set 18 balance applied; deployed to the testers


### Level-1 balance applied to the code — set 18 (branch `feat/rebalance-set18`, #45)

- Applies the GDD v0.11 values chosen by the headless balance study (set 18): Gunner P 30 → 10 %,
  Heavy Bomb or Shield 60 → 30 %, Gunner fire every 1.5 → 1 s, Popcorn rows at 0 s and 50 s
  ×6 → ×8, the 92 s formation → two Divers (92 s at x 60, 93 s at x 180), Cruiser 3 000 → 5 000
  tenths with phase 2 at 3 300.
- Tests re-derived from the rules (drop draws on both sides of the new rates, 3 Gunner bullets per
  hover, 1 700 tenths to the 66 % threshold, 52 Popcorn and 12 Divers per pass); the seeded replay
  moves to seed 3, the first seed whose 8 Heavies still roll a Bomb at 30 %.
- The study harness re-run on the applied code gives the study's set 18 exactly: zigzag + bombs
  15 % game over, 85 % boss kills, 2.3 deaths, power 5 at 120 s, about 8 P-red + 0.8 P-blue.
- Docs: README, CHANGELOG, class and boss-state diagrams, traceability matrix.
- Review (`review-local`): no Must; every changed test re-derived from the rules, none weakened.

### PR #47 merged (`f1a39b0`) — GDD v0.11, the level-1 rebalance design

- Green checks, a Codex review without comment; the tuning branch then took `main` in by a merge.

### Rebalance design, GDD v0.11 (branch `docs/rebalance-v011`) — Refs #45

- Owner playtest direction (friends already testing the deployed level 1): harder, more enemies,
  fewer power-ups, the ship always slightly weaker than the enemies' attack so the player plays
  strategically; the hall of fame matters (#46).
- Baseline measured headless (four scripted players, 20 seeds each): power 5 reached at 60–90 s,
  about 11 P per run, the Cruiser killed in 4–26 s of 90, deaths only during the boss.
- Owner decisions (scored): target "tense" (90); then option D (83): ship set 18 to the testers
  and build a more realistic scripted player for the next iteration. Set 18 (22 sets tried):
  Gunner P 30 → 10 %, Heavy drop 60 → 30 %, Gunner fire 1.5 → 1 s, Popcorn rows at 0 s and 50 s
  ×6 → ×8, the 92 s formation → 2 Divers, Cruiser 300 → 500 shots. Measured: about 8 P per run,
  power 5 near 120 s, an average player dies about twice (once in the waves), 15 % game over,
  85 % boss kills; a skilled player still kills the Cruiser in about 10 s (not met).
- The tuning PR follows (values, the 28 test assertions that pin them, stale comments).
- Owner ideas noted for later (brick G or game-feel PRs): nicer, more menacing enemy ships; a
  small victory animation after the boss; very rare, very discreet far-background objects
  (satellites, a distant planet) and, as a wink, the hall-of-fame number 1's name drifting far
  away; the player hitbox size after the playtest.

### PR #44 merged (`14aa215`) — F-3, the tally and the Results screen; brick F done (closed #33)

## 2026-10-12

### The end-of-level tally and the Results screen — F-3 (branch `feat/level-tally`)

- `LevelTally` (GDD v0.10 §8, ADR-0022 decision 7): a subscriber owned by `ScoreKeeper` —
  `FORMATION_CLEARED` (bomb-completed formations included), `BOMB_USED`, `PLAYER_DIED` (a shield
  absorb is `PLAYER_HIT` and keeps the no-miss), `LEVEL_CLEARED` (bombs left); `ScoreKeeper` adds
  `total()` flat at `LEVEL_CLEARED`, the chain unchanged; the boss bonus stays on
  `BOSS_DESTROYED`. Values in `TallyTuning`; `RunView.tally()` returns a read-only `TallyView`.
- The `hud` font gains a space (an empty cell) in the adapter, the `RenderPort` contract and the
  `RecordingRender` double (ADR-0022 decision 8).
- `Results` (ADR-0022 decision 9): one line every 0.5 s from the entering step, labels in the
  title font at x 8, values right-aligned on the row below with thousands grouped by a space,
  formatted once on entry; 1 s lock, then confirm or a tap; 8 s automatic exit; the title lock as
  after Game over. `ResultsTuning` is `lockSeconds`, `autoSeconds`, `lineSeconds`; the interim
  banner and `levelClearSeconds` are gone.
- Owner decision (scored 88 vs 87): a "LEVEL CLEAR" / "FIN DU NIVEAU" header above the lines
  (GDD §8 sentence added). Interim deviation recorded in `meta/05-state-scenes`: no pending pause
  in `Results` (the slice goes to the title); `LevelTally.reset()` waits for level 2.

### PR #43 merged (`1845da6`) — F-2c

- Brick F-2c on `main`; F-3 branches from it.

### The boss's game feel — F-2c (branch `feat/boss-feel`)

- Animated explosions replace the growing square (`Explosions` in `effects.ts`): a hot core
  shrinking until 40 % of the 300 ms, fragments on an ease-out radius, hot then cool, 2 × 2 then
  1 × 1, computed from the age (deterministic, no random draw, no allocation; the 16-slot ring
  keeps centre, tier and age only). Tiers small 16 px / 8, medium 32 / 12, large 56 / 16, boss
  112 / 24, debris 24 / 10 without a core (`ExplosionTier`).
- The ship explodes on `PLAYER_DIED` (medium); the turret bursts into debris on
  `BOSS_PHASE_CHANGED`; `BOSS_DESTROYED` starts `BossChain` (one boss burst, then 5 medium on fixed
  hull offsets, one per 1/3 s of wall time at most) and `SlowMotion` (`timeScale()` 0.5 for 0.5 s
  of wall time, frozen frames excluded), behind the new `EffectSettings.slowMotion`, off under
  `prefers-reduced-motion`.
- Owner decisions (scored): style A **without** the white flash — measured 12 white flashes a
  second for one Popcorn formation with it, against the 3 a second of GDD §9.7; the boss burst's
  core reduced to 0.3 × its size so the boss stays visible.

- Review (`review-local`): no Must. Fixed: the frame that runs the killing step no longer eats
  the slow motion or the chain's first gap (a long frame could halve the 0.5 s); turret debris
  only at the start of phase 2 (index 1), so a later 3-phase boss would not throw it at every
  phase. Agent's tuning kept: debris 24 px, 10 fragments, no core. The §9.7 limit is read as
  white or full-field flashes: the explosions' hot colour is not white, and the switch turns them
  all off. Checked in headless Chromium with a weakened, uncommitted Cruiser killed by one bomb.

- Codex review of #43 (two P2, both fixed): the frame loop re-reads the time scale after each
  step and re-counts the frame's remaining wall time at the new scale, so the slow motion starts
  on the killing step even in a long catch-up frame; the hull chain is 5 bursts, not 6, so it ends
  inside the destroyed sequence down to 10 frames per second without shortening the 1/3 s
  spacing (carrying the overshoot would have broken the spacing).

### PR #42 merged (`75700fd`) — the boss HUD

- Brick F-2b on `main`; F-2c branches from it.

### PR #41 merged (`b6aada7`) — the cockpit is the hitbox

- Merged first, as planned; the boss HUD branch then took `main` in by a merge (no force push).

### The cockpit is the hitbox (branch `fix/ship-core`)

- Playtest remark: "enemy bullets sometimes cross our ship without destroying it". Investigated:
  no gap in the collision (a bullet on a vulnerable ship's 4 × 4 hitbox always hits; no tunnelling,
  the ship moves 2.5 px a step against a contact window of 8 px). The cause is legibility: the
  cockpit was drawn 8 px above the centre while the hitbox is the centre square, and the hull is
  8 px wide, so a bullet could visibly cross the hull yet miss. The invulnerability windows (2 s
  after a death, the 0.5 s fly-in included, 1 s after a bomb, 0.5 s after a shield) are the
  other source.
- Decision (scored, 88/100 against 72, 68 and 63): keep the 4 × 4 hitbox (GDD §4.1, the game's
  fairness rule) and draw the cockpit exactly on it; a larger hitbox (6 × 6, an option, 8 × 8)
  waits for the friends' feedback. A full-sprite hitbox was rejected: a ring of 12 or 16 bullets
  would leave no gap.
- Owner wishes noted for later: more menacing, nicer enemy ships (sprites, brick G); a small
  explosion animation for the ships (game feel, F-2c or G).
### The boss's HUD — F-2b (branch `feat/boss-hud`)

- `drawBossBar` (`boss-hud.ts`, called by `RunPresenter`): a 224 × 4 frame at x 8, y 4 of the
  field, the fill following the HP, a tick at 66 %, the seconds left right-aligned in HUD digits
  under the bar's end, from the entry to the end of the sequence. `drawWarning` (`overlays.ts`,
  called by the scene machine under the pause veil): "WARNING" / "ATTENTION" in the title font,
  blinking twice in 3 s from `stateSteps` (so a pause freezes it); steady when the blink effect is
  off, as the announcement is information. Four palette tokens, `BossHudTuning` (0.75 s half blink,
  66 % tick), the catalogue key `warning`. 714 tests; checked in the browser with a temporary,
  uncommitted script (WARNING, then the bar and the seconds going 90 to 87).
- Decisions (scored): the blink-off banner stays steady (not hidden); one-digit seconds take the
  right-hand cell (x 226). Invented: the colours (cream frame, grey fill, amber tick), the 4 px
  bar height inside the GDD's y 4–8.

### PR #40 merged (`57d8ea4`) — RunRules extracted from Run

- Merged with a Codex comment fixed (the sequence diagrams now name a `RunRules` participant).

### Refactor: `RunRules` extracted from `Run` (branch `refactor/run-rules`)

- Pure move per ADR-0023 decision 7: `RunRules` (`src/domain/game/run-rules.ts`) realizes
  `HitRules` and `EnemySpawner` and holds the kill, drop, boss, bomb and death rules and the
  preallocated events; `Run` keeps the 8-step order, the outcome, the snapshot and the level
  list and exposes `run.rules`. `Run` 505 to 278 lines; tests only changed call sites
  (`run.X` to `run.rules.X`), 680 tests green, the seeded replay logs unchanged.

### PR #39 merged (`5238a4f`) — F-2a, the boss fight domain

- Merged as described in the F-2a entry below (674 tests at the time of the PR).

### F-2a, the boss fight domain (branch `feat/boss-domain`, merged as #39)

- Built per ADR-0023: every attack pattern is a `fire` and a `tick`, `sequenceAttack(groups)`,
  `swayMovement`, `Body.age` as movement time, `Boss` (`BossState`, `BossDefinition`,
  `BossPhaseSpec`) preallocated in `World`, the Cruiser, `BossTuning`, `World.takeSerial()`,
  `HitRules.damageBoss` (pass 1, pass 3, the bomb), events 8 to 12, `RunOutcome.LEVEL_CLEARED` /
  `RUN_CLEARED` over `RunConfig.levels`, the deferred level end, `LevelScript.warningAt` and
  `boss` required with `loopAt` removed, the boss view of the snapshot, grey rectangles, the
  interim `Results` banner; tests share `tests/support/script.ts` (674 tests).
- Findings kept for the review: the Cruiser's phase 2 peaks at 39 enemy bullets (GDD cap 40, the
  pool of 48 keeps 9 slots, not the 12 the brief asked for); `Run` is 505 lines, over the ~450
  checkpoint of ADR-0023 decision 7 (`RunRules` extraction for the next PR, not done here).

### PR #37 merged (`1a6a2c3`) — audit pass, docs and tests

- TSDoc where the audit found gaps, an EN/FR key-parity test, sturdier assertions (580 tests),
  the ADR-0022 entry in the README, the traceability scope for ADR-0016 and ADR-0017, the #35 and
  #36 log entries.

### Design of the boss fight F-2 (branch `docs/f2-design`) — ADR-0023

- The planning of F-2 against the code at `1a6a2c3` found points ADR-0022 does not settle: the
  Cruiser's phase 2 needs two periods but `Body` has one timer; the sway must continue to x 120
  across a phase change; `BossDefinition` and the bonus owner differ between the ADR and the
  diagram; the WARNING blink has no step count; F-2 as one PR is too large.
- Owner decisions (scored recommendations, deeper analysis asked twice): every pattern split into
  `fire` and `tick`; `sequenceAttack` takes groups and one timer (the triple fires on every
  second ring volley, same instants as two timers, `parallelAttack` deferred until a boss needs
  independent periods: 86 against 79); `Body.age` = steps since the current movement began;
  `BossTuning` holds 10 000 + 100 per second, `bonus` and `bonusPerSecond` leave
  `BossDefinition`; the boss view gains `stateSteps`; F-2 in three PRs (domain with a grey boss
  and an interim banner, HUD, game feel); a `Run` size checkpoint (about 450 lines or a sixth
  boss-touching method) for extracting `RunRules`.
- Changes: ADR-0023 (partially supersedes ADR-0022 decisions 1, 2, 3 and 10), the class diagram,
  `05-state-boss` (the end of the sequence no longer fires `LEVEL_CLEARED` by itself), the build
  order of `05-state-scenes`, the decision index, the README and the traceability matrix. No GDD
  rule changes.

### PR #36 merged (`76c342d`) — F-1, the Heavy and the 120 s level-1 script

- Squash-merged with 7 green checks and a Codex review without comment. The branch had been
  written in the main checkout as `feat/heavy`, unpushed; it was cherry-picked onto `origin/main`
  (after #35) in a worktree as `feat/level-heavy`, since the local `main` lagged behind.
- `review-local` found no Must. Fixed before the push: the ring-angle test around 0°, the Heavy's
  death path and an off-axis fan now tested, the 102–116 s bullet peak pinned (about 30, asserted
  between 24 and 36, of a pool of 48), `aimedAttack` counts its volleys (ADR-0022 §2), stale scene-state notes.
- Decision: the frozen-strategy test is kept; ADR-0022 requires shared strategies to be
  immutable. The merge gate hook reads the raw command, so `--repo` must be written out in full.

### PR #35 merged (`69f6c84`) — audit pass and light engine refactor

- A whole-repo audit (design, tests, documentation, project rules) found no Must; lint, typecheck
  and 541 tests were green. Applied the cheap design Should items: `World` no longer implements
  `EnemySpawner` (only `Run` is injected), `SceneMachine` takes a required `createRun`,
  `Run.publishAt` takes a `subject` (no more duplicated event filling), `Starfield` sums with an
  index loop. The class diagram now shows `Run` as the `EnemySpawner`.
- Decision: the audit also proposed removing the single-implementation `Pool<T>`; it is a
  contract of ADR-0002, so it was kept and its retirement needs a small ADR of its own (not in
  ADR-0022). `review-local` caught this and the stale UML before the push.
- Follow-ups: extract `RunRules` from `Run` before F-2 (boss); docs and tests pass (EN/FR key
  parity test, weak `toBeDefined()` assertions, TSDoc on `arbitration.ts` and the enemy
  archetypes, README ADR-0022 entry, traceability scope 0016/0017).

### The Heavy and the 120 s level-1 script — F-1 (branch `feat/level-heavy`) — Refs #33

- Commit 1, refactor with no behaviour change: `enterHoldLeave({ travelS, holdS, leaveSpeed })`
  and `aimedAttack({ periodS, speed })` build frozen strategies once at module load (ADR-0022);
  the Gunner uses them with its unchanged tuning, every existing test green.
- Commit 2: `Body.volleys` (a fixed pair, reset on spawn), `SizeTier.Large`, `ringAttack` and
  `fanAttack` (unit vectors computed at load, a volley allocates nothing, firing only while
  armed), `HEAVY_RING` and `HEAVY_FAN` (56 × 48, 40 shots, 1 000 points, 2 s in, 10 s hold, out
  at 40 px/s, Bomb or Shield at 60 %), `HeavyTuning`; `LEVEL_1` rewritten to GDD v0.10 §7.2.1 +
  §7.2.2 (Bomb Carrier gone, Divers at 40 s, 1-UP Carrier at 78 s, Heavy pair at 102 s, last
  spawn at 112.3 s), interim wrap at 120 s until F-2; the Heavy's own palette colour and a Large
  explosion size (56 px).
- Level simulation over one 120 s pass, seeds 1–6: a player who never fires peaks at 13 enemies
  and 30 enemy bullets (at 112 s, the 102 s pair); the firing scripted player at 5 enemies and
  1 to 17 bullets. Within the GDD limits (≤ 16, ≤ 40); no design value changed.
- Ambiguities flagged for the owner: the ring turns 15° per volley fired (ADR-0022 "rotateDeg ×
  its count"), which with 30° spacing alternates the two orientations — the GDD's "every other
  volley is the ring turned by 15°"; the Large explosion size (56 px) is not in the GDD.

### PR #34 merged (`412ab9e`) — F-0 design

- Three Codex findings fixed by owner choice A.

### Design of the level brick F (branch `docs/f-design`) — GDD v0.10, ADR-0022

- F-0, design only: the conception study of brick F, each GDD rule chosen by the owner from
  scored options, the technical batch validated as a whole.
  - **Level 1 length** (§7.1, §7.2): the 0–45 s opening kept without the interim Bomb Carrier, a
    45–115 s ramp, the field drains, WARNING at 120 s; load check: no spawn at or after
    `warningAt` − 4 s. A 33/35; rejected the boss at 58 s (20/35) and the first Heavy at ~100 s
    (21/35).
  - **Rows** (new §7.2.2): Divers at 40 s, ring Heavy at 45 s, mirrored formations, Gunners from
    the top then three sides, the 1-UP Carrier high at 78 s, fan Heavy at 90 s, the ring and fan
    pair at 102 s (the peak), the last formation at 110 s; ≤ 16 enemies, ≤ 40 enemy bullets by
    simulation. A 34/35; rejected less dense (29/35), denser (24/35).
  - **Heavy** (§5.2.1): 56 × 48, tier Large, 40 HP, 1 000 points; 2 s in, 10 s hold, out at
    40 px/s; ring of 12 at 60 px/s turned 15° every other volley, or fan of 5 at 75 px/s, every
    2 s; Bomb or Shield at 60 %. A 37/40; rejected a fixed ring (31/40), a 1.5 s 75 px/s ring
    (32/40).
  - **Cruiser** (§6.1): 112 × 48, 300 shots, 90 s, phase 2 at 66 %; 3 s entry; phase 1 fan and
    ring alternating; phase 2 turret debris, a turning ring of 16 every 1.5 s and an aimed
    triple; flees at power 1 by design. A 36/40; rejected one pattern per phase without debris
    (34/40), 3 phases with an escort (28/40).
  - **After level 1** (§9.1): `RUN_CLEARED` → Results → Title, Ending and name entry with brick G
    (interim deviation), a data-driven level list. A 34/35; rejected looping level 1 harder
    (15/35), Game over (11/35).
  - **Results** (§8): one line every 0.5 s, zeros shown, leave by confirm or tap after 1 s or after
    8 s; only a life lost breaks the no-miss; bomb-completed formations count; the boss bonus
    flat, boss hits 0. A 34/35; rejected all at once with zeros hidden (23/35), a counting-up
    score (29/35, revisited with audio).
  - **Batch**: waves stop at `warningAt`; WARNING / ATTENTION 3 s in two blinks; silence a no-op
    until audio; HP bar and seconds; bomb on the boss only while fighting; contact in entry and
    fight; slow motion 0.5 s behind `EffectSettings.slowMotion`; the ship keeps control during
    the 2 s explosion; no Popcorn bullet in level 1; pause and timer as elsewhere.
- ADR-0022 partially supersedes ADR-0003 (decision 1, "A `Boss` is an `Enemy`"): strategy
  factories from tuning data, `Body.volley`, `SizeTier.LARGE`, one preallocated `Boss` outside
  the enemy pool, `startBoss`, `damageBoss`, boss and level events (8 to 12), `LEVEL_CLEARED` /
  `RUN_CLEARED` over a level list, `LevelTally` as a subscriber, `Results`; `loopAt` removed.
- UML: class diagram, boss state machine (Cruiser table), new boss-fight sequence, tally hooks
  in the bomb, kill and hit sequences, UC1 9a (slice end), the scene machine's level brick
  additions (Results, interim F-2 banner, lifted loop, Bomb Carrier and 1-UP deviations, the
  v0.9 prerequisites marked done by #32) and build order F-0 to F-3, traceability matrix,
  architecture index. Mermaid checked with `mmdc`.
- Design review of F-0: 2 Must (phase 2 needs `parallelAttack`; the volley counting per
  pattern and per phase), 6 Should (pass wording, `sequenceAttack` period, the boss serial, the
  level end after a respawn, the fleeing tally line and the formation value layout, the
  ≤ 40 check over phase 2 and the pool rule) and 4 Nice fixed.
- Codex review on #34 (owner choice A on all three): a space glyph for the hud font, two volley
  counters on Body, the Results timed exits.
- PR split: F-1 factories (Gunner refactor first) + Heavy + rings and fans + the 120 s script
  (still wrapping at 120 s); F-2 the boss (interim "LEVEL CLEAR" banner, then the title); F-3
  the tally, Results and the documentation pass. Each merge playable.

### PR #32 merged (`91691e4`) — pointer fire and shot readability

- One Codex finding (a left press reported as a move while the right button is held) fixed by
  owner choice A. CI green.

### PR #31 merged (`6d99055`) — GDD v0.9, ADR-0020, ADR-0021

- One Codex finding (the Spread opacity missing from the readability table) fixed in `2e1c239` by
  owner choice A. CI green.

### Pointer fire and shot readability (branch `feat/pointer-fire`)

- ADR-0020: the mouse fires while the left button pressed on the field stays down, wherever it
  goes, and stops when it is released; a left press outside the field never fires; touch fires
  while a finger steers and stops when it lifts, a second finger bombing without touching it; a
  lost focus or a rotation stops both. The samples report `autofire = false` until the options
  screen brings the autofire option; the arbitration is unchanged.
- GDD v0.9 §3.2: enemy bullets drawn 6 × 6 with a 2 × 2 white core, Spread bullets drawn 2 × 6,
  player shots and Laser bolts at 60 % opacity; hitboxes unchanged. README device lines and the
  CHANGELOG (Changed) updated.
- Visual check: the brainstorm's scene (Spread level 3 at 22.7 s, a temporary uncommitted level)
  matches the chosen V2 capture.
- Local pre-push review: no Must. Fixed: a left press counts on a pointer down only, so after a
  lost focus a button still held never restarts the fire nor taps until it is pressed again;
  façade tests renamed to the held-fire meaning, plus tests for a held left button with the
  keyboard owning the movement, the fresh press after a lost focus and a cancelled mouse pointer;
  an explicit 60 % opacity test (Codex review on #31); the arbitration JSDoc; the Laser drawn
  through `drawBox`.
- Codex review on #32 (owner choice A): the down-only rule lost a left press reported as a move
  while the right button is held. Now a lost focus or a rotation sets a resync flag: the next
  mouse event only records the buttons, and every later press counts, by a down or a move.

### Design revision after the brick-E playtest (branch `docs/brainstorm-design`) — GDD v0.9, ADR-0020, ADR-0021

- Owner playtest after brick E: every device works (keyboard, touch, mouse, gamepad); two
  complaints — the always-on fire of touch and mouse gives no control, and the enemy bullets get
  lost in the player's own fire (shot proportions, judged on side-by-side captures).
- Brainstorm with scored options, each decision validated by the owner:
  - **Difficulty ramp by script** (GDD §7.1, §10): each level adds roles or patterns, denser and
    more aggressive; level 1 becomes a real ~120 s script up to the Heavy and the boss (brick F).
    A rank system and a harder second loop are left to after the playtests (1.x); "only more
    enemies" rejected.
  - **Named top 10** (§8, §9.1): up to 8 characters (A–Z, 0–9, space) with an arcade letter picker
    on every device, optional ("skip" stores `???`); replaces the three initials. Rejected: three
    initials, a system-keyboard text field.
  - **Country** (§9.1, §9.8): optional, preselected from the browser language's region, no
    network (PRIV-1); ISO code in the bitmap font, pixel flag with the sprites; stored for the v2
    board. Rejected: IP geolocation, the Geolocation API, no preselection, ~200 flags in 1.0,
    postponing to v2.
  - **Pointer fire** (§4.2, §9.3, ADR-0020): mouse fires while the left button is held, touch
    while a finger steers, an autofire option for touchpads and accessibility. Scores: O5 46
    (chosen), O4 44, O3 41, O1 38, O7 38, O2 35, O6 30.
  - **Shot proportions** (§3.2): enemy bullets drawn 6 × 6 with a 2 × 2 white core, Spread drawn
    2 × 6, Laser at 60 % opacity, player shots translucent; hitboxes unchanged. Rejected: waiting
    for the sprites, enemy bullets only, maximal contrast, smaller player hitboxes, a 24 × 24 ship.
- ADR-0020 partially supersedes ADR-0009 (decision 1), ADR-0015 (decisions 5 and 8) and ADR-0018
  (decision 2). Also folded in: the C2-P review N1 wording fix (GDD §4.2 mouse row, "a left press
  on the field", ADR-0018 decision 4).
- Scene machine (design revision v0.9, build order), traceability matrix, UC3 / UC4 text,
  architecture index and README updated. Delivery: pointer fire and shot proportions before or in
  F's first PR; the ramp in F; the name entry, country and autofire option in the screens brick G.
- ADR-0021 (owner choice, same PR) resolves the conflict with ADR-0006: partially supersedes
  decisions 3 and 7 and the review item on `initials` — `name` 1–8 characters or `???`, optional
  `country` against an ISO 3166-1 alpha-2 allowlist, preselection stored only on confirmation,
  failing entries dropped; first schema `version: 1`, no migration (no document shipped); fonts
  gain 0–9 and `?` in brick G. ADR-0020's rule "a held left press outside the field is a tap only
  and never fires" confirmed by the owner.
- Design review of the v0.9 docs: no Must; 6 Should and 4 Nice fixed (the Devices-together row,
  the ADR index cross-references, the mouse and keyboard fire wording, the autofire option name,
  pointer fire across scenes, focus loss and the bomb finger, the empty name, the country
  allowlist and the first-language preselection, the blank country in UC4). Owner choice: a
  held pointer fire resumes at once after the count-in, like a held key.

### PR #30 merged (`5b7d81a`) — documentation pass

- One Codex finding (the bomb protection timing in the `Player` doc) fixed in `4177ca2` by owner
  choice A.

### Documentation pass after brick E (branch `docs/brick-e`)

- Owner request 2026-10-12: keep the READMEs and the code documentation current at the end of
  each brick.
- README: the build status rewritten for the player kit (enemies with the Carriers, Spread and
  Laser on five levels, drops, pickups, bombs, shield, death rule) and every device's bomb input;
  next brick F; the quality-gate bullet aligned with ADR-0007 / ADR-0013 (audit, `ci.yml`, the
  security workflows).
- CONTRIBUTING: the garbled hooks sentence, the PR checks list (`ci.yml`, Gitleaks, CodeQL,
  Dependency Review; Scorecard non-blocking), `nvm use`, the open scopes, a hypothetical ADR in the
  commit examples, a new *Tests* section (Vitest scripts, `tests/support/` helpers, the single
  Playwright smoke test).
- CHANGELOG `[Unreleased]`: #26 to #29. Makefile: the `--no-verify` message cites ADR-0013.
  Architecture index: the status line notes the bomb sequence of #24.
- Source JSDoc, wording only: stale notes refreshed (`HitRules`, `drawHud`, `powerUp`,
  `spawnPickup`, `LevelScript`, `HUD_LAYOUTS`, the presenter's effect switches and pickups, the
  `main.ts` header) and missing docs added (`RunView`, `protectionSteps`, `NORMAL`,
  `createGameEvent`, `message`, the overlays, the logical screens); long lines rewrapped.

### PR #29 merged (`1bd7f17`) — E-4 bombs, shield and death rule

- Codex reviewed with no finding; CI green. Issue #25 closed: brick E is complete.

### PR #28 merged (`bceda86`) — E-3 Carrier and the other pickups

- Codex reviewed with no finding; CI green.

### Bomb, shield and death rule E-4 (branch `feat/bomb`) — Closes #25

- The bomb at step slot 3 (02-sequence-bomb): `Player.useBomb()` in control only, one per press,
  invulnerability max(time left, 1 s) with the blink restarted from `Vulnerable`; `BOMB_USED`
  first, every enemy bullet cancelled, 30 level-1 shots once to every enemy on the field through
  the normal kill path (score, chain, formation, drops and cargo); enemies outside the field are
  untouched.
- The shield: `HitOutcome.Absorbed` spends the charge, 0.5 s of invulnerability with the blink
  restarted; the absorbed bullet is consumed, an absorbed body survives; `PLAYER_HIT` published.
- The death rule (02-sequence-player-hit): the power drops a level (never below 1) and the bombs
  reset to 2 at once; above level 1 the lost level is released as a P of the current colour that
  rises 48 px over 0.8 s then falls at 20 px/s, published before `PLAYER_DIED`, last life included.
- Presentation: the 36 × 36 shield ring; the bomb flash (≈ 300 ms, under 3 per second) and the
  field shake (4 px, side every 33 ms, fading over 300 ms — owner choice A, GDD v0.8 §9.4 and a
  Decision record row), each behind its own `EffectSettings` switch; the scene machine applies the
  shake before the starfield and never in a frozen frame. The "E-1 to E-4" interim deviation is
  lifted.
- Visual check: with a temporary, uncommitted shield at start, the ring around the ship; on `X`,
  the tinted and shaken field (HUD still), the bomb stock 2 → 1 and two Divers destroyed.
- Local pre-push review: 1 Must fixed — GDD §9.3 turns the shake and the white and bomb flashes
  off by default under `prefers-reduced-motion`; `main.ts` now reads it once at boot (the
  non-flashing blink stays with the options). Also fixed: the shake is horizontal only, as the GDD
  sentence says; the run-level tests go through scripted level rows and `run.step` instead of
  reaching into `Run`'s private world; collision tests for an absorbed bullet, an absorbed body
  and a second hazard in the same step; the effects-on/off simulation now drops bombs; the scene
  machine's shake (on in play, still in frozen frames and on the title) is tested; the switches
  test has a positive control; the bomb flash covers the shaken field to its clip.

### PR #27 merged (`dcb736b`) — E-2 weapons L1 to L5

- One Codex finding (Laser hits in active-list order) fixed in `38089ad` by owner choice A. That
  push used `--no-verify` (ADR-0013): `pnpm audit` timed out on the npm registry in the hook;
  check and gitleaks had passed in it, the SonarQube gate passed and the audit passed on retry by
  hand, no dependency changed.

### Carrier and the other pickups E-3 (branch `feat/carrier`) — Refs #25

- `CrossMovement` (a horizontal crossing at 60 px/s, a closed form of the age, rightwards from a
  spawn left of the centre) and the `CARRIER` archetype: 32 × 32, 4 level-1 shots of HP, 500
  points, no attack, no roll, `carriesCargo`. `ScriptEvent.cargo` → `Enemy.cargo`, dropped at
  100 % instead of the roll; the load check rejects a Carrier without cargo, a cargo on another
  role, and a Carrier spawning on the field. Level 1 gains the Shield Carrier at 28 s and the
  interim Bomb Carrier at 40 s (GDD v0.8 §5.2.1, §7.2.1).
- Shield, Bomb and 1-UP pickups with the cap rule (shield held, 5 bombs, 9 lives → 1 000);
  2 bombs at the start. Interim until E-4: the shield absorbs nothing and bombs have no effect.
- Presentation: shared 8 × 8 / 16 × 16 shapes (`icons.ts`): the ship (lives, 1-UP), the plus
  (bombs) and the hollow square (shield); the Carrier in its own colour; HUD bombs and shield at
  the GDD v0.8 positions in both screens.
- Visual check: a headless run holding fire showed the Carrier entering at 29 s, then the shield
  icon in the right band at 36 s, with the ship-shaped life and the two bomb plus icons.
- Local pre-push review: no Must. Fixed: the load check also rejects a Carrier whose height
  never crosses the field (it would never enter, so never be released — noted in the class
  diagram); one `overlapsField` predicate in `geometry.ts` for the release and the load checks;
  tests for both crossing directions escaping with no drop, a recycled enemy forgetting its cargo,
  the 1 px rejection edges, and the cargo in the full simulation log; an exhaustiveness guard on
  the pickup drawing; the level-1 rows in time order; `Enemy.cargo` public in the diagram.

### Weapons L1 to L5 E-2 (branch `feat/weapons`) — Refs #25

- `WEAPONS[kind][level − 1]` tables built once at load (GDD v0.8 §4.3, ADR-0019): the Spread's
  1/3/3/5/5 streams at their angles from the nose, 6-step cooldown and 4 at level 5 (15/s), centre
  damage 10/14/19/24/20 tenths and side streams 10; the Laser's 48 px bolts at 600 px/s, their
  lower end at the nose, 2 to 8 px wide, damage 10 to 30, passing through 1/1/2/2/3. One generic
  volley replaces `SpreadPattern`, which is removed; the E-1 interim deviation is lifted.
- HP and damage in tenths of a level-1 shot: Popcorn 10, Diver 10, Gunner 80.
- `Bullet` remembers up to three serials (`canHit`, `recordHit`, reset at spawn): a bolt hits each
  body once while overlapping it, every body crossed takes the full damage, and the hit after its
  last pass-through spends it. `ShotSpec.weapon` and `Bullet.weapon` let the presenter draw Laser
  bolts in their own colour (class diagram updated). Player bullet pool 16 → 80.
- Visual check: headless captures with a temporary, uncommitted start at level 5 showed the
  Spread's five-stream fan and the Laser's pulsed 8 px bolts.
- Local pre-push review: 1 Must fixed — tests wrote raw tenths, which ADR-0019 forbids; a
  `shots(n)` test helper now expresses HP and damage in level-1 shots. Also: a test helper that
  built the wrong level, a mutation-checked test that a reused bullet slot forgets its hits, a
  one-hit Popcorn check over every shot of both tables, the hit steps in the kill sequence's
  order, one `PlayerTuning.noseOffset`, the unused enemy-bullet damage removed, and the class
  diagram and scene doc brought up to date.
- Codex review on #27 (owner choice A): a bolt overlapping more enemies than it can hit took
  them in active-list order, which is not spatial; it now hits them nearest first along its path
  (smallest position · velocity), with no allocation, and a test inserts a stack far to near.

### PR #26 merged (`57eb194`) — E-1 randomness, pickups and sources

- Codex reviewed with no finding; CI green. Merged after the pre-push review fixes and the
  SonarQube exception `e3` (owner choice D).

### Randomness, pickups and sources E-1 (branch `feat/pickups`) — Refs #25

- `Run({ script, seed, createRandom })` owns its gameplay `Random`, built for level 1 from
  `mixSeed(seed, 0)`; `main.ts` draws each run's seed; tests pass a scripted `Random` through
  `createRandom` (ADR-0019).
- Pooled `Pickup` (8): falls at 40 px/s with a ±8 px, 2 s sway as a closed form of its age, axis
  clamped to 16..224, lost below the field; `World.spawnPickup` returns false on a full pool, so
  `PICKUP_SPAWNED` is published only for a pickup that exists. Collision pass 4 catches pickups
  with the ship's 32 × 32 box after the hazards, never while `Dead`.
- `Weapon.kind` and `level` with `powerUp`: a P selects its weapon and adds a level; at level 5
  it pays a flat 1 000 (`PICKUP_COLLECTED.value`, added by `ScoreKeeper` outside the chain).
  Interim until E-2: every kind and level still fires the level-1 Spread.
- Pooled `Formation` (16), one per pass of a Popcorn row (`LevelDirector`); a member destroyed,
  escaping (a `World.sweep` pre-pass) or refused settles it; the last member destroyed drops a P
  of `LevelScript.dominantColour` (red) and publishes `FORMATION_CLEARED`. The Gunner drops a P
  at 30 % × `dropRateScale`, red or blue from the same draw. `DifficultyProfile` NORMAL replaces
  `PlayerTuning.lives`.
- HUD: the weapon badge (three dots or a bar) and five power pips (filled or outlined) in the
  right band and on the second portrait row; P capsules marked by shape on the field.
- A headless capture showed the first full formation's P caught by a ship holding fire at rest:
  two pips lit.
- Local pre-push review: 1 Must fixed — a member refused by a full enemy pool counted against
  the formation; `Formation` now counts destroyed, escaped and refused, and `Run` (the director's
  spawner) runs the completion check on every destroy and refusal, as the class diagram says.
  Also fixed: a full formation pool drops the whole group, `Weapon.powerUp` returns a boolean
  (`Player.collect` pays the cap bonus), tests for two pickups in one step, no collection after
  Game over, the formation peak over three passes, and a pinned `mixSeed`.
- The SonarQube gate failed on the first push attempt: one S7735 (negated condition, fixed) and an
  unreviewed security hotspot S2245 on the run seed's `Math.random()` in `main.ts`. Verified by
  experiment (the gate passes without the call, and with a scoped exception, and fails without
  it), then, by owner choice D, accepted as a versioned exception `e3` in
  `sonar-project.properties`, scoped to S2245 in `src/app/main.ts` with its justification, like
  e1 and e2 — rather than a "Safe" review stored only in the local SonarQube database.

### PR #24 merged (`0737abf`) — E-0 player-kit design

- Two Codex findings fixed in `5d9e11c` by owner choice A: `World.spawnPickup` returns a boolean
  so `PICKUP_SPAWNED` is never published for a refused spawn, and `RunConfig.createRandom` is the
  test seam for a scripted `Random`. Issue #25 tracks the brick with 15 acceptance criteria.

## 2026-10-11

### Design of the player-kit brick E (branch `docs/e-design`) — GDD v0.8, ADR-0019

- A conception study of the "pickups and rules" brick against GDD v0.7 and the code found one
  real gap: the death release, written as a P falling at 40 px/s from the death point, left the
  field 1.4 s after the death, before the ship returns at 2.0 s — uncatchable. It also found
  the Spread "1 → 5 streams" and the Laser "pierces up to" ambiguous, the "+40 %" rate not a
  whole number of steps, and no source for the Shield, Bomb and 1-UP pickups without a new
  enemy.
- Validated by the owner, each with a scored recommendation (all recommendations taken): scope A
  (both weapons on 5 levels, the 5 pickups, bombs, shield, death rule, drop sources, the Carrier,
  HUD items; Heavy, boss and tally to the level brick F); then ten player-facing decisions — the
  power ratio on the aimed shot and the Spread table, the Laser as pulsed bolts that pass
  through 1 to 3 enemies, the release hop (48 px up over 0.8 s, then 20 px/s), the P colours
  (formation P red in level 1, Gunner red or blue 50 / 50), the Carrier and its rows (Shield at
  28 s, an interim Bomb at 40 s, no 1-UP before F), the bomb (one step before the collisions,
  on-field enemies, in control only, flash and shake as separate switches), no touch bomb button
  yet, the shield ring and rules, the HUD icons by shape, and a batch of small pickup rules;
  then the technical batch as a whole (ADR-0019: run seed, damage in tenths, weapons as data,
  pierce memory, pooled pickups and formations, events, `collect(): number`,
  `DifficultyProfile` subset, step slot 3, Carrier data, palette and HUD layout).
- A design review (3 Must, 12 Should) fixed the build order (`dominantColour` and an interim
  level-1 weapon table in E-1), closed the release motion (linear rise, no sway), recorded the
  E-1 to E-4 interim states, and tightened the ADR-0019 status. The owner then validated as a
  batch the drafting choices left open: ADR-0019 partially supersedes ADR-0003 decision 2 and
  ADR-0002 decision 6 (a spawn on a full pickup pool is dropped, the level simulation test
  guarding it) and refines ADR-0014 decision 7; the bomb flash under 3 per second and off under
  reduced motion; `HitRules.pickupCollected`; `BOMB_USED` first; the Laser bolt from the nose;
  landscape pips at x 380; P capsules marked by shape.
- GDD v0.8 (§4.2, §4.3, §4.4, §4.5, §4.6, §5.2, §5.2.1, §7.2.1, §7.3, §8, §9.2, §9.3, §9.4, §10,
  §13, Decision record), ADR-0019 and the ADR index, the class diagram (also fixing its stale
  `LevelDirector.tick` signature and Carrier note), the kill and hit sequences, a new bomb
  sequence, the player state machine, the frame sequence, the component table, UC1 5a, the scene
  machine's player-kit section and build order (E-0 to E-4), the traceability matrix, the README
  status and the changelog.

### PR #23 merged (`69bcbb7`) — C2-G gamepad

- One Codex finding (a moved stick did not make its pad active) fixed in `90ac708` by owner
  choice A.
- The push of `4dafbd4` used `--no-verify` (ADR-0013): the SonarQube gate failed on 9 × S7735
  (negated conditions, fixed in that commit) and `pnpm audit` timed out twice on the npm
  registry; check and gitleaks passed in the hook, the SonarQube gate passed by hand, no
  dependency changed. The fix push ran the full `make verify`.
- Issue #9 closed: the devices brick C2 is complete.

### Gamepad C2-G (branch `feat/gamepad`) — Closes #9

- `GamepadModule`, polled once per read after the events (ADR-0015 decisions 5 and 7): standard
  mapping only; presses found against the previous poll, kept per pad as a button mask; the active
  pad is the last one with input, and losing it (missing, disconnected or no longer `standard`)
  pauses once; a press of a pad that is not active is dropped, never delivered later. The fixed
  roles sit on the indices — 0 `Confirm`, 1 `Back`, 9 `Confirm` — whatever the bindings
  (ADR-0018 decision 3). The d-pad wins and is normalized on diagonals; the left stick goes
  through the 0.2 radial dead zone, a rescale, a clamp to length 1 and a quantization toward zero
  to 1/256 (decision 5). A lost focus keeps the previous poll, so a held button is no new press.
- `InputTuning` gains the stick dead zone and steps; the façade gets `gamepads()` from the
  composition root and treats a throwing `getGamepads` (Permissions-Policy denied in an iframe,
  insecure context) as no pad, so the loop never dies (issue #9). No gamepad in the smoke test (Playwright cannot emulate one); the module and
  the façade are unit-tested with fake pads.
- Floating point: (0.6 − 0.2) / 0.8 is 0.49999…, so quantizing toward zero gives 127/256, one
  step below 0.5. Accepted: toward zero is what keeps the length at or under 1.

### PR #22 merged (`3304e93`) — C2-P touch and mouse

- One Codex finding (P2: a cancelled finger still delivered its pending tap) fixed in `e681c2c`
  by owner choice A. The first push used `--no-verify` (ADR-0013): `pnpm audit` timed out on the
  npm registry in the hook; check and gitleaks had passed in the hook, the audit passed on retry
  and the SonarQube gate passed by hand. The fix push ran the full `make verify`.

### Touch and mouse C2-P (branch `feat/input`) — Refs #9

- `PointerModule` (Pointer Events on the page, pen as touch): the first finger on the field steers
  32 px above it, a second finger on the field bombs, a touch outside the field is a HUD tap only;
  the mouse takes the ship only by a move to another field pixel or a left press on the field, the
  right button bombs on the field only; a HUD tap replaces a pending field tap. `DeviceInput`
  numbers every pointer event, takes `resize(layout, rect)` once per resize and pauses when the
  layout kind changes. The page suppresses the context menu (the Codex finding deferred from #21)
  and the canvas shows a crosshair.
- Domain: `PAUSE_BUTTONS` and `isPauseTap` beside `HUD_LAYOUTS`, `drawPauseButton`, the scene
  trait `pauseButton`, the scene × input table (pause-button tap, interim tap resume) and the 1 s
  lock on Game over and on the title after it; `InputTuning.touchOffsetY`.
- The lock counts like the 3 s Game over timer: the entering step is step 0, steps 1 to 60 ignore
  `Confirm` and taps, the 61st accepts them.
- The smoke test now runs the ADR-0018 script: a 390 × 844 phone at pixel ratio 2 with touch,
  then a rotation to 1280 × 900. `Paused` is detected by the white pause icon, since the veil is
  translucent and has no fixed colour.

### PR #21 merged (`3858a9a`) — C2-L portrait screen

- One Codex finding (P2, context menu not suppressed) answered inline and deferred to C2-P by
  owner choice. CI green.

### Portrait screen C2-L (branch `feat/render`) — Refs #9

- `LANDSCAPE` and `PORTRAIT` screen layouts; `computeViewport` picks the screen (larger integer
  scale, landscape on a tie, larger unclamped scale at ×1 when neither fits) and `Viewport`
  carries it; `RenderPort.layout()`; the renderer clips the field at the layout's field corner and
  resets its region and camera on resize; `HUD_LAYOUTS` per layout kind and `hud.ts` draws the
  bands or the portrait strip; the page stops scrolling, zooming and selection; the pixel ratio is
  watched. The smoke test gained a portrait leg.
- The portrait chain bar is 42 px, not the 44 px of the scene machine doc: 44 overshot the
  score's last digit by 2 px, against the validated intent "ends under the score"; the doc is
  corrected in the same commit.
- Local pre-push review (no automated reviewer): no Must; two Should (import order, a stale class
  doc) and two Nice fixed; the smoke-test sizes copied from `screen.ts` are left as they are.

### PR #20 merged (`9faf701`) — C2-A browser-free arbitration

- `arbitrate(state, samples, into)` with sequence-numbered `DeviceSample` records; no behaviour
  change. CI green, local review only.

### PR #19 merged (`c94e5f5`) — C2-0 devices brick design

- GDD v0.7 and ADR-0018 on `main`; issue #9 rewritten with 17 acceptance criteria. CI green, no
  automated reviewer (quotas); the four-pass conception review stood in.

### Design of the devices brick C2 (branch `docs/c2-design`) — GDD v0.7, ADR-0018, issue #9

- A conception study found #9 written before the enemies brick: the HUD strip had no content
  layout, the touch pause button had moved into C2, and the pause and Game over exits only took
  keyboard or gamepad `Confirm`. Ten player-facing decisions were validated one at a time with
  scored options (portrait strip in two rows; pause button top-right in both orientations; any
  tap resumes; `Start` also confirms; Game over leaves on tap or confirm after a 1 s lock;
  crosshair cursor; the mouse takes the ship only on a real move; rotation pauses; one smoke test
  running a phone then a rotation; five PRs), then a technical batch of ten as a whole. A four-pass review (2 + 2 Must, 14 Should) added seven owner choices — exact portrait strip positions, the mouse takes the ship only by a move on the field, left click for taps and right click for bombs on the field, `RenderPort.layout()` without a new interface, `hud.ts` draws the whole HUD, the tap resume as an interim deviation, the fixed gamepad roles kept after a remap with a title lock after Game over — and a mechanical batch.
- GDD v0.7 (§4.2, §4.4, §9.1, §9.2, Decision record), ADR-0018 (partially supersedes ADR-0015
  decisions 3, 4, 5, 7, 8), the scene machine's devices-brick section and build order, the
  component table, the traceability matrix.
- Pushed with `--no-verify` (ADR-0013): the npm registry timed out in `pnpm audit`; typecheck,
  lint, format, tests, gitleaks and the SonarQube gate passed.

## 2026-10-10

### PR #18 merged (`8272fc9`) — D1 S: score, HUD and effects; arcade Game over — brick D done

- The score (8 digits), the chain (×1 to ×8, inclusive 2 s window, bar), the hit flash and the
  explosions behind their switches, one presenter per run, and the arcade Game over (GDD v0.6
  §4.4 after the owner's playtest). Issue #12 closed; the whole enemies brick is online.
- No automated reviewer (quotas); a pre-push review (3 Should and 6 Nice fixed), CI green,
  pushed with `--no-verify` after gitleaks and SonarQube passed by hand (npm timeouts).

### PR #17 merged (`3b1f97d`) — D1 E: enemies, collisions, lives and game over

- Popcorn, Diver and Gunner from the looping GDD §7.2.1 script; 3 lives, a 4 × 4 hitbox,
  respawn after 1.5 s, Game over. The owner played it ("pas mal du tout"), then asked for a
  large GAME OVER over a scene that keeps moving: recorded as a GDD v0.6 change and built in
  PR S (scored options, owner choices: title font A–Z with a message catalogue; the run plays
  on without the ship, arcade style).
- No automated reviewer (quotas): a thorough pre-push review (0 Must, 2 Should and 6 Nice
  fixed), CI green, `make verify` green after fixing Sonar S1940 and S4043.
- PR S (`feat/score`) pushed with `--no-verify` (ADR-0013): the npm registry timed out in
  `pnpm audit`; typecheck, lint, format, tests (297), gitleaks and the SonarQube gate passed.

### PR #15 merged (`e75d40e`) — D1 P: Paused and Count-in

- `P` or `Esc` pauses (veil, two-bar icon, frozen field and starfield); `Enter` or `Esc` starts
  a 1 s 3-2-1 count-in whose last step hands over to play; a lost focus never resumes. The
  renderer draws the `hud` digits (3 × 5 glyphs at 2×) and fails closed on anything else.
- Merged without an automated review: Codex and Copilot had both reached their quotas. Owner
  decision on the scored option "merge now, review later": CI green, a clean pre-push review
  (3 Should and 4 Nice fixed), SonarQube green, the pause checked by hand. Follow-up: #16.

### PR #14 merged (`260d98c`) — D1 R: ActiveList, World.sweep, PlayerShotSpawner

- Pure refactor before the enemies: `ActiveList` owns its pool and is the only caller of
  `release`; `World.sweep()` is the single entry point of step 6; the ESLint rule keeps game
  rules away from presentation and scenes; tests share one `RecordingRender`.
- Review: Codex hit its usage limit and could not review; Copilot (launched by the owner)
  recommended approval with no finding; CI green.
- PR P (`feat/ui`) pushed with `--no-verify` (ADR-0013): the npm registry timed out in
  `pnpm audit`; typecheck, lint, format, tests, gitleaks and the SonarQube gate passed (after
  fixing Sonar S7758, `codePointAt`).

### PR #13 merged (`994c787`) — enemies brick design (D0)

- GDD v0.6 and the UML of the enemies brick are on `main`. The review ran over 19 commits:
  20 Codex and 6 Copilot findings plus 2 late Codex threads, each studied, scored and validated
  by the owner. Merged on the owner's request with CI green and every thread answered; Codex had
  not re-reviewed the last two commits (`c198cd3`, `7df0401`) after two requests.
- Further `--no-verify` pushes (ADR-0013, npm registry timeouts): `4ed856a` and `3c512a8`, each
  after the rest of `make verify` passed, SonarQube included.
- Next: D1 in four PRs — R (refactor), P (pause), E (enemies, lives, game over), S (score, HUD,
  effects; closes #12).

### Design of the enemies brick (branch `docs/enemies-design`) — GDD v0.6, issue #12

- Owner decisions (all recommended): roles Popcorn, Diver and Gunner; the designed
  `LevelDirector` with the first rows of level 1, looping until the level brick; HUD digits drawn
  by the renderer until the bitmap fonts; wordless Paused, Count-in and Game over; no pickup drop
  before the pickups brick, so no gameplay randomness in this brick.
- GDD v0.6 §5.2.1 records the initial values of the three roles, the enemy bullets and the pools;
  §4.4 the 3 s game-over time; §9.2 the life icons and chain bar.
- UML: the enemies-brick additions and interim deviations of the scene machine; collisions mark
  at step 5 and release at step 6 (enemy-destroyed and player-hit sequences, class notes); frozen
  scenes draw at alpha 1 (tick sequence); the touch pause button moves to C2.
- Four-pass conception review (requirements, Clean/SOLID, KISS/YAGNI/DRY, pattern fit): 9 Must,
  14 Should and 4 Nice, each validated by the owner one at a time. The ones that change the
  design:
  - script data in GDD §7.2.1 (spawn and hover points, intervals, S curve), looping at 45 s;
  - Gunners fly straight from a spawn point to a hover point, sides and top alike;
  - `entered` for despawning, `spent` with `World.sweep` as the single release point, `armed`
    for the Gunner's fire;
  - the finished run lives read-only until `Title`, one `RunPresenter` per run;
  - `ENEMY_DESTROYED` carries position and size tier;
  - `HitRules`, the split shot spawners, the subscribe-only `RunEvents`, and HUD values on the
    snapshot;
  - scene traits table, `ActiveList`, `applyDamage`, the re-entrant-publish guard on the bus,
    and an ESLint rule keeping game code away from presentation;
  - inclusive 2 s chain window, reserve-life icons;
  - recorded interim deviations: no drops, formations, bombs, boss or `Random` in this brick;
  - a wording note on ADR-0010: `Run` subscribes its own `ScoreKeeper`.
- PR #13 review (Codex, then Copilot launched by the owner): 13 Codex and 5 Copilot findings,
  each studied and scored, then validated one at a time — among them the S curve mirror, the
  Diver rows and the formation rule, the inclusive chain window (an off-by-one in our own
  analysis), the count-in handoff, `HitRules` events, refused formation members, the chain bar
  ratio and the draw-then-age effect order.
- `git push --no-verify` on `60c76d1` (ADR-0013 exception): the npm registry timed out twice in
  `pnpm audit`; typecheck, lint, format, tests, gitleaks and the SonarQube gate passed.

### PR #11 merged (`2a90e17`) and portfolio PR benoit-bremaud/benoitbremaud.fr#14 merged (`5a21024`)

- ADR-0017 is on `main`; the portfolio serves `https://benoitbremaud.fr/projets/` with the four
  categories and the retro-shmup card linking to the game (checked in production). Codex reviewed
  both with no comment, after a re-review was requested on the reworked portfolio PR.

### Games catalogue in the portfolio's projects page (branch `docs/projects-catalogue`) — ADR-0017

- While the portfolio's `/jeux/` page was in review (benoit-bremaud/benoitbremaud.fr#14), the owner
  decided that games are one category of projects among others, and that friends' projects may be
  shown too. PR #14 is reworked into a `/projets/` page grouped by category (Jeux, IoT et
  matériel, Web et infrastructure, Automatisation et data; only non-empty ones shown), with a
  "Projets d'amis" section that appears with its first card.
- **Decision**: `ADR-0017 games catalogue in the projects page` (owner, 2026-10-10) — partially
  supersedes ADR-0008 decision 3 and the catalogue address of ADR-0016; the catalogue is
  `benoitbremaud.fr/projets/#jeux`, the card thumbnail waits for sprites. GDD §13, the Decision
  record and the architecture overview follow.

### PR #10 merged (`4ef9303`) — the playable build online, ADR-0016

- Cloudflare Pages project `retro-shmup` created on 2026-10-10 at the owner's request, through the
  owner's Chrome session; the owner granted the Cloudflare Pages GitHub App access to this
  repository. Production deploys from `main`.
- After the merge, `https://retro-shmup.pages.dev` serves the game with its six security headers
  (CSP, HSTS, COOP, Permissions-Policy, nosniff, Referrer-Policy), checked with `curl -sI` and in
  the browser: the game runs under the CSP with no console error. One Codex comment (the
  portfolio pull request missing from ADR-0016's follow-ups) was fixed and answered.

## 2026-10-09

### Online playable build (branch `chore/deploy`) — ADR-0004, ADR-0008

- The owner asked for a playable build online, reached from the portfolio, before the enemies
  brick (D) and the other devices (C2). Order now: deployment, then D, then C2.
- `public/_headers` (ADR-0008 decision 4): a CSP limited to the game's own files with
  `frame-ancestors 'self' https://benoitbremaud.fr`, plus `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy` and `Strict-Transport-Security`. The page's inline style moved to a
  stylesheet so the CSP needs no `'unsafe-inline'`. Checked by serving the build locally with the
  same CSP: the game runs with no violation.
- Address: `retro-shmup.pages.dev` until the commercial title is final (ADR-0008 decision 1).
- Pages project `retro-shmup` created on 2026-10-10 (Cloudflare dashboard, GitHub App access
  granted to this repository by the owner; build `pnpm build`, output `dist`, `NODE_VERSION`
  22.23.3, `PNPM_VERSION` 10.30.3). The first production deployment, from `main` at `d8fcb73`,
  answers 200 at `https://retro-shmup.pages.dev` and is playable; it predates the headers of
  this PR, which the merge deploys.
- Codex (PR #10): ADR-0016's follow-ups now include the portfolio pull request.
- **Decision**: `ADR-0016 deploy every playable build` (owner, 2026-10-09) — partially
  supersedes ADR-0008 decision 5, which waited for the vertical slice; every merge to `main`
  now deploys, and the portfolio card says the game is in development.
- Pre-push review: added `Strict-Transport-Security` (security policy CONFIG-2), declared
  `fullscreen` and `gamepad` for the game itself, removed `data:` from the CSP with no asset
  inlined by Vite.
- Local note: `pnpm` lives in the asdf shims, which `~/.zshrc` does not load; outside an
  nvm-and-asdf shell, run `~/.asdf/shims/pnpm`.

### PR #8 merged (`d8fcb73`) — first playable build on keyboard, closes #7

- All six checks green; Codex reviewed with no comment. The owner play-tested it ("c'est
  rigolo") and opened brick C2 (issue #9: touch with the portrait screen, gamepad, mouse).

### First playable build on keyboard (branch `feat/game`) — issue #7, brick C1

- Domain: tuning records of GDD v0.5 with the seconds-to-steps conversion; `Player` (fly-in,
  one state timer, protection count for the blink, movement, field clamp); `Weapon` with Spread
  level 1 fired through a spawner parameter; `World` with a 16-bullet pool and a preallocated
  active list; `Run` (slots 2, 4, 6, 7 of the fixed order, snapshot without allocation);
  `RunPresenter` (palette-rectangle ship, interpolated bullets, blink behind an effect switch);
  `SceneMachine` subset Boot → Title → Playing with the background clock; `DEFAULT_BINDINGS`.
- Adapters: `DeviceInput` façade with the keyboard module and one injected environment record;
  lint bans `window`, `document`, `navigator` and `requestAnimationFrame` in `src/adapters`.
- Composition root wired; `EnginePreview` and `IdleInput` removed.
- Tests: TDD on the domain, the loop and the keyboard adapter (158 tests); the single Playwright
  smoke test (Chromium, built bundle; `make smoke`), proved by a mutation; script time per frame
  about 0.18 ms on the development machine, logged, not asserted.
- **Design updates made with the code** (same change, owner informed at the PR): the class
  diagram gains `Player.advanceTimers` (timers at step 7, after collisions) and
  `Weapon.tick(origin, firing, spawner)` (no `dt`: the cooldown counts steps); the scene machine
  owns the starfield's background clock, so it scrolls on the title and in play without a jump.
- Pre-push review (design, tests, correctness, security, documentation): no blocking finding
  after fixes. Fixed: `Esc` was prevented while held (one shared rule now); five test gaps
  where a real regression stayed green (full exit of a bullet, auto-repeat after a lost focus,
  prevention on repeat, linear fly-in, blink while entering); literal expected values; a fuller
  replay comparison; the frozen blink; a press through a multi-step frame. Owner decisions:
  Ctrl, Cmd and Alt key combinations are never game inputs and keep their browser action; the
  `Boot` step hands its frame to the title so an early `Enter` is not lost; the always-on blink
  is an interim deviation until the options screen. The field size moved to the game package;
  the tick sequence and the scene notes record `draw(snapshot, alpha)` and the background clock.
- SonarQube gate (seven new issues, all fixed): re-exports written as `export … from`,
  `globalThis` in the composition root, and — owner decision — `spawnPlayerBullet(x, y, shot)`
  with a constant `ShotSpec` record instead of eight positional numbers (S107), in the class
  diagram too.

### PR #6 merged (`7c390ff`) — design of the first playable build, GDD v0.5, ADR-0015

- One Codex comment (the screen choice could pick a landscape screen that overflows) and the
  22 findings of the four-pass conception review were validated one at a time by the owner and
  fixed in `5275276`; all six checks green. The project paused after the merge, then resumed
  with issue #7 (brick C1, first playable on keyboard, 14 acceptance criteria).

## 2026-10-08

### Design of the first playable build (branch `docs/input-design`) — GDD v0.5, ADR-0015

- A mapping of the design contract for the ship and device input brick (GDD, ADRs, UML, code,
  read by four parallel readers, then synthesized and checked by a critic) found that the first
  playable build could not start under "design before code": the base shot, the fly-in geometry,
  the clamp reference, the blink rate, the touch offset, the gamepad stick and device mixing were
  not decided, ADR-0014 owed the portrait-phone layout to this brick, and GDD v0.4 gave `Space`
  to both the keyboard fire and the mouse bomb.
- GDD v0.5 records the values *(initial)*; ADR-0015 records the mechanisms; the scene state
  machine gains a first-playable subset note; the class diagram gains the spawner path.
- **Decisions** (owner, 2026-10-08, all recommended options):
  - `split the brick` — C0 (this design PR), C1 (scene subset, ship, Spread L1, keyboard, the
    Playwright smoke test: first playable on keyboard), C2 (touch with the portrait screen,
    gamepad, mouse).
  - `portrait screen 240 × 352` — 32 px HUD strip above the field, chosen when its integer scale
    is larger; on a 390 CSS px phone the field doubles from about 160 to 320 CSS px.
  - `base shot` — Spread L1: 10 shots/s, 360 px/s, 2 × 8 px bullets.
  - `details` — Start = Confirm, a tap or a click; `Pause` synthesized but ignored in play until
    the enemies brick; fly-in from x 120 to y 272; whole sprite clamped; blink 3/s, its switch
    with the options screen; touch offset 32 px, first finger drives, lifting keeps the ship
    still, second-finger tap = bomb, touch buttons arrive with the bricks that give them an
    effect; radial stick dead zone 0.2, d-pad wins;
    mouse bomb = right click only; bomb secondary = left Shift; opposite keys cancel; ship drawn
    with palette rectangles; smoke test probes pixels, Chromium only, Playwright 1.63.0 (outside
    the 7-day cooldown).
- Derived, not separately chosen: a touch that starts outside the field is a tap only (the HUD
  region holds the touch buttons); a driving finger's moves are mapped wherever they fall;
  tapping never fires faster than holding; a device owns the movement from when it starts
  moving the ship.
- Not in this PR: the ADR status back-links (ADR-0001, -0002, -0003, -0007, -0009, -0010, -0014)
  stay for their dedicated PR.
- **Conception review** (four passes of the conception gate: requirements and traceability, Clean
  and SOLID, KISS/YAGNI/DRY, pattern fit) and one Codex comment, presented one at a time and
  validated by the owner on 2026-10-09 (22 findings plus the Codex one, all recommended options):
  - Codex: the screen choice keeps only screens that fit before comparing scales (a 390 px window
    at a pixel ratio of 1 overflowed in landscape).
  - Timers and cooldowns count whole steps, velocities are px/s times `dt`; converted numbers
    left the UML.
  - `DeviceInput` is a façade over per-device modules with a pure arbitration function and one
    injected environment record, the audio unlock hook included.
  - The build order and interim deviations live only in the first-playable section of the scene
    machine, with the title and smoke-test presentation; the ADR and the GDD describe the shipped
    game.
  - The spawner is passed to `Player.update` as a parameter; one `stateSteps` timer; linear
    fly-in from y 336; blink phase; shot origin, release, pool of 16, backward swap removal;
    deterministic arbitration order, held state cleared on lost focus, no automatic takeover;
    touch, mouse and gamepad edge rules; default bindings table; numbers kept in the GDD only.
  - Correction of my own proposal, validated: the title shows no ship, so the smoke test can tell
    the title from play.
- Process: the owner reminded the general rules on 2026-10-08 — reviewer comments are presented
  one at a time, and PR creation, pushes and branch deletions are asked first. PR #6 was opened
  and pushed before that reminder.

### PR #5 merged (`82596b9`) — engine for the vertical slice, ADR-0014

- Two Codex review comments verified exact and fixed in `0294385` before the merge (stale tick on
  restart, iterator allocation on the draw path); both answered on the PR. All six checks green.

### Engine for the vertical slice (branch `feat/engine`) — ADR-0014

- Fixed-step frame loop (ADR-0002): accumulator in milliseconds, 250 ms clamp, time scale for
  hit-stop and slow motion (ADR-0010), one input read per step into one reused frame (ADR-0009),
  interpolation factor passed to rendering.
- Domain: `SeededRandom` (xoshiro128**, state seeded by a SplitMix-style 32-bit mixer; the
  generator is checked against the authors' published reference vector), `FixedPool` (fails
  closed on double release), the scrolling `Starfield` (pure function of scroll time, unseeded
  presentation randomness), screen geometry and colour tokens.
- Adapters: `Canvas2DRenderer` (480 × 320 off-screen surface, field region clipped and offset,
  whole-pixel positions, integer scale with smoothing off; sprites and fonts fail closed until
  assets load), `computeViewport` (integer scale in device pixels), `PerformanceClock`.
- Composition root and a temporary `EnginePreview` target: the page shows the starfield in the
  play field between the two HUD bands. Input moved to the next brick, with its first user. The
  browser smoke test (`make smoke`) is deferred to the first playable brick.
- Tests: TDD on the domain and the loop; adapters against recording doubles. SonarQube quality
  gate passed with 0 open issue and 96 % coverage after one fix it caught (rule S7749: the
  `0x1_0000_0000` literal became `2 ** 32`).
- Pre-push review (5 dimensions, adversarial verification): fixed a double `requestAnimationFrame`
  chain on stop/start, a mocked domain object in a test (now the real `Starfield`), the ESLint ban
  on the gameplay `Random` in presentation code (promised by ADR-0010), and ADR-0014's missing
  supersession of ADR-0001.
- Codex review (PR #5): a `stop()` or restart from inside a step let the stale tick keep stepping
  and drain the restarted accumulator; a lifecycle generation counter now ends that tick. The
  starfield's `for...of` allocated an array iterator per frame: a bare loop over its three layers
  allocates on every call under Ignition and Sparkplug (Node 22) and Maglev (Node 24), and never
  with an index loop. Source code now uses index loops and ESLint bans `for...of` in `src/`. In
  the interpreted tiers the draw still boxes floating-point results; the optimizing tiers do not.
- **Decisions**:
  - `ADR-0014 logical screen` — 480 × 320 (field centred, two 120 px HUD bands), chosen by the
    owner: it keeps ×3 on 16:9 and 16:10 screens in fullscreen; integer scale in device
    pixels; partially supersedes ADR-0001 (off-screen size, scale, field-only shake); the domain `dt` is in seconds and the loop counts milliseconds, which also corrects
    the frame sequence of the UML study.
  - `accumulator starts at half a step` — the owner chose it after a 10 000-frame simulation:
    starting at 0 gave 0 or 2 steps on about a third of 60 Hz frames, half a step gives exactly
    one.
  - `input in the next brick` — the engine has no user of input yet (YAGNI); `IdleInput` keeps
    the loop contract until the device input adapter lands.

### Toolchain for the vertical slice (branch `chore/toolchain`) — ADR-0011, ADR-0012

- pnpm 10, Node 22, Vite 8, TypeScript ~6.0.3 strict, Vitest 5 with V8 coverage, ESLint 10 with
  typescript-eslint `strictTypeChecked`, Prettier on code and configuration, husky hooks
  (`pre-commit`: gitleaks on staged changes and lint-staged; `commit-msg`: commitlint with the
  project scopes; `pre-push`: `make verify`), local SonarQube scan, light `ci.yml`, Dependabot
  for npm.
- The domain port interfaces of ADR-0001/0002/0006/0009/0010 land as types only, so the domain
  boundary (no `DOM` lib, no browser globals, no `Date.now` / `Math.random`, no import from
  adapters or app) is enforced on real code from the first commit.
- **Decisions**:
  - `TypeScript 6, not 7` (ADR-0011) — typescript-eslint 8.71 supports `typescript <6.1.0`;
    Dependabot ignores TypeScript minor and major bumps until it widens its range.
  - `Prettier excludes Markdown` — it would realign every table of the GDD and the ADRs.
  - `security policy enforced mechanically` — on the owner's request: ESLint bans `eval`,
    `new Function`, `javascript:` URLs and HTML sinks (INJ-3/4); `make verify` adds
    `pnpm audit --audit-level high`; the PR template carries the security checklist.
  - `OSSF Scorecard, weekly and non-blocking` (ADR-0013) — recommended by the security CI
    baseline for a public repository; runs on `main` and weekly, never on pull requests. ADR-0007
    had rejected Scorecard: ADR-0013 partially supersedes it (CI table, audit exceptions), as
    the security review of the branch required — a validated decision is never reopened
    silently.
  - `.scannerwork/ ignored` — the SonarScanner work directory was not ignored and would have
    been committed; caught before any push.
- Pre-push review: five independent dimensions (design, configuration correctness, security and
  CI, documentation, tests and SonarQube), every Must and Should verified adversarially (36
  confirmed, none refuted). Fixed before the push:
  - commitlint rejected the project's own `docs(adr): ADR-NNNN …` subjects (`subject-case`) and
    accepted commits without a scope;
  - `sonar.tests` named an untracked folder, so `make verify` failed on a fresh clone
    (`tests/.gitkeep`);
  - CodeQL now analyses `javascript-typescript`, and `Lint, typecheck, test` plus
    `Analyze (javascript-typescript)` become required checks once they report green;
  - the domain guard is complete: no package or Node built-in import, no `Date`, no
    `globalThis`; tool configs moved to `tsconfig.node.json`, so Node types never reach browser
    code;
  - Vite `base` defaults to `./` (ADR-0004: itch.io serves from a sub-path);
  - Node floor `>= 22.22.1` (lint-staged 17); CI gets a timeout, a concurrency group and a build
    step; Dependabot gets a 7-day cooldown and keeps `@types/node` on the runtime major.
- **Decisions**:
  - `ADR-0012 binding shapes` — keyboard slots hold `KeyboardEvent.code`, gamepad slots hold
    standard-mapping indices, the primary slot is never empty; written as a new ADR because
    ADR-0009 is accepted.
  - `S6564 accepted in sonar-project.properties` — `SpriteId`, `SfxId`, `TrackId` are ADR
    vocabulary; the exception is versioned, scoped to that rule and to `src/domain/ports`.
  - `secret hygiene in the setup command` — the documented token command now reads the token
    with hidden input, so it never reaches the shell history. Rotating the token in use (local,
    scoped to this project) is deferred by the owner and stays an open follow-up (security
    policy SECRET-4).

### PR #3 merged (`bb41e6b`) — UML study for 1.0, GDD v0.4, ADR-0009 and ADR-0010

- Three automated review comments verified exact and fixed in `39411d6` before the merge:
  `SceneMachine` uses `InputPort` (bindings, capture, labels, fullscreen), a fullscreen change
  applies at the next click, tap or key press (GDD v0.4 §9.3), and `today()` is called when a high
  score is recorded (ADR-0009).

### UML study for 1.0 (branch `docs/uml-study`) — GDD v0.4, ADR-0009 and ADR-0010

- Eleven deliverables under `docs/architecture/`: C4 context and containers; use cases with
  Cockburn specifications and component diagram (PlantUML, source and SVG committed); domain
  class model in two views; three sequences (one frame, enemy destroyed, player hit); three state
  machines (player, boss, scenes); a traceability matrix. Three planned deliverables were dropped
  as redundant with ADRs or use-case text (ports class diagram, save-high-score sequence,
  data-flow diagram).
- Delivered block by block, each block reviewed by an independent read-only reviewer, corrected,
  re-reviewed, then validated by the owner. The reviews found real defects before any code: a
  double life loss in one step, the gamepad `B` pausing on every bomb, a level-end vs Game over
  race, a double kill in one step, an allocating and press-blind input contract, effect toggles
  able to change a run's outcome.
- **Decisions** (each validated by the owner):
  - `GDD v0.2–v0.4` — the rules the scenarios required: physical-key bindings with two slots,
    pause triggers and count-in, quit confirmation, Ending to name entry, per-effect switches,
    pickup cap, start weapon, contact damage, bomb kills, fly-in at every level, invulnerable ship
    untouchable, Game over after the death sequence, end-of-fight safety, chain scoring order.
  - `ADR-0009` — flat, reusable intent frame (movement, held / pressed masks, device, tap in
    region coordinates), bindings and key capture, gestures and fullscreen in the input adapter,
    audio mix control.
  - `ADR-0010` — presentation never changes the outcome: two random streams, time effects in the
    loop timed on wall clock, `RunPresenter`, one ordered bus per run, `DropTable` as data, HUD
    region.

### ADR-0008 — public hosting on benoitbremaud.fr

- The owner wants the game on the personal domain and plans several games. Verified: the
  domain's DNS is on Cloudflare, the portfolio (`benoit-bremaud/benoitbremaud.fr`) is a separate
  static Cloudflare Pages site whose `_headers` deny framing on every path.
- **Decisions**:
  - `one subdomain per game` (ADR-0008) — `<game>.benoitbremaud.fr`, own Pages project and own
    `_headers` per game; the custom domain is attached only once the commercial title is final
    (a later rename would change the origin and strand players' saves), `pages.dev` URLs until
    then. Rejected: an
    arcade subdomain with paths (routing Worker, shared storage), one repository for all games,
    the portfolio's own path (couples repositories, shares its origin and headers), nested
    subdomains (viable, but longer and inconsistent with the existing `bulle-de-je` subdomain).
  - `catalogue on the portfolio` — a static `/jeux/` page in the portfolio repository, by its own
    PR.
  - `review corrections` — two automated review comments on PR #2 were verified and accepted:
    the certificate argument against nested subdomains was wrong (Pages uses per-hostname
    Cloudflare for SaaS certificates), and a post-launch rename would lose saves.
  - `nothing deployed before the vertical slice` — no Cloudflare resource is created until a
    playable build exists; the Pages project and custom domain are then created by the owner in
    the Cloudflare dashboard.
- PR #2 squash-merged (`3ade687`) after two automated review comments were verified, fixed in
  `d560b9e` and answered inline.

### PR #1 merged (`cf10d5f`) — repo public, protections applied, security scans on

- Initial commit `46aab98` pushed to the new repository `benoit-bremaud/retro-shmup`; Gitleaks
  green on the first run. Default labels replaced by the triptych (8 `type:*`, 12 `area:*`,
  3 `priority:*`).
- Public-release checklist satisfied, then the repository was switched to **public** with the
  owner's explicit approval: Gitleaks clean on the full history (local and CI), no tracked
  secret, `.env.example` placeholders only, no development secret to rotate, secret detection
  in CI, SSH signing key already registered on the account as a signing key.
- Applied right after the switch (the Free plan refuses both on a private repository):
  - `main` protection per `.github/branch-protection.md` — PR required, `Secret scan` required,
    strict, admins included, 0 required approvals (no reviewer bot yet), no force push, no
    deletion;
  - tag ruleset `Protect release tags` (id `24704970`) on `refs/tags/v*` — creation, update and
    deletion blocked, Admin bypass `always`, per `.github/tag-protection.md`;
  - private vulnerability reporting, secret scanning with push protection, Dependabot alerts
    and Dependabot security updates.
- **Decisions**:
  - `CodeQL on the actions language first` — CodeQL fails on a language with no source file, so
    the matrix starts with `actions` (the workflows themselves, useful now);
    `javascript-typescript` joins in the PR that brings the first TypeScript code.
  - `Dependency Review active` — free on a public repository; passes trivially until the npm
    manifest arrives with the vertical slice.
  - `three required checks` — `Analyze (actions)` and `Dependency review` joined `Secret scan` in
    the `main` protection after PR #1 ran them green (branch `ci/activate-public-security-scans`,
    squash-merged).

---

## 2026-10-07

### Project inception — design brainstorming and repository bootstrap (inception session)

- Codename `retro-shmup`; the commercial title is deliberately left open (the repository will be
  renamed, GitHub keeps redirects).
- A structured brainstorming session fixed the whole design contract before any code:
  platform, scrolling, resolution, art direction, player rules (weapons, lives, shield, death,
  bombs, pickups), enemy taxonomy (5 roles / 3 sizes), drops, bosses, scoring, level scripting,
  universe, narration, audio, meta scope (1.0 / 1.x / v2), game feel, onboarding, and the
  technical constraints. Every decision and its rejected alternatives are recorded in
  [docs/design/game-design-document.md](docs/design/game-design-document.md) (*Decision record*)
  and in the ADRs under [docs/decisions/](docs/decisions/).
- **Decisions**:
  - `keep it simple first` — the first repository commit contains documentation and the security
    baseline only; application tooling (Vite, Vitest, ESLint, husky/commitlint, release-please,
    Cloudflare Pages wiring) arrives with the vertical slice, one PR per brick.
  - `rescue mechanic deferred` — the "ejected pilots / rescue allies" idea is recorded as a 1.x
    signature candidate (GDD §12); a design study is in progress and will be attached as an
    annex; no 1.0 decision.
  - `private-first, public the same day` — repository created private; the public-release
    checklist is run immediately (fresh history, no secrets, Gitleaks in CI, SSH tag signing),
    and the switch to public requires the owner's explicit approval.
  - `CodeQL and Dependency Review dormant` — both require GitHub Advanced Security on a private
    Free-plan repository and CodeQL has no code to analyse yet; the workflows are committed with
    `workflow_dispatch` only and will be activated by PR once the repository is public and
    TypeScript code exists. Gitleaks is active from the first push.
  - `local-first quality gate` (ADR-0007) — the blocking checks (gitleaks, lint, typecheck,
    tests with coverage, local SonarQube quality gate) run in husky hooks before every push; CI
    keeps only Gitleaks and a light lint/typecheck/test job. SonarCloud and a CI Sonar job on
    the colocated self-hosted runner were rejected.
  - `personal account, not the StudioB22 organisation` — the organisation is on the same Free
    plan (verified through the GitHub API), would require a `gitleaks-action` licence key, and
    hosts client work; a portfolio game belongs on the owner's profile.
- Repository bootstrap: local `git init` on `main` with SSH tag signing configured; first commit
  holds documentation and the security baseline only. The GitHub repository, the labels
  triptych, the `main` branch protection (`.github/branch-protection.md`) and the tag ruleset
  (`.github/tag-protection.md`) are created right after the first push; this entry is completed
  with their identifiers once applied.
- Commit identity: the repository commits and tags under the owner's GitHub noreply address,
  so no personal mailbox appears in the public history. The initial commit had first been
  pushed under a personal address; it was re-authored and `main` was force-pushed **once**, with
  the owner's explicit approval, as a documented exception to the no-force-push rule — the
  repository was private, held a single commit, had no clone elsewhere and no protection yet.
- Baseline review: three independent read-only reviews (cross-document consistency, convention
  compliance, security hygiene) ran before the first commit. Their blocking findings were fixed
  in place: port signatures owned by a single ADR each, one source layout (ADR-0003) for every
  path rule, Vitest named in ADR-0003, pnpm in ADR-0004, no Cloudflare credential in the repo,
  the CREDITS register shaped as ADR-0005 prescribes, release-tag creation blocked as the
  conventions require, and the gitleaks binary version pinned in CI to match the
  `[[allowlists]]` config syntax.
