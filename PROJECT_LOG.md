# Project Log — retro-shmup

Reverse-chronological operational logbook (most recent first). It complements `git log` with the
human context: what was done, why, and by which PR. Not the release changelog (see
[CHANGELOG.md](CHANGELOG.md)).

---

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
