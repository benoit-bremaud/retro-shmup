# ADR-0031: Record each run and send it, at the player's choice, to the online leaderboard

**Status:** Accepted — 2026-11-12. **Partially supersedes ADR-0006** (decision 1, "no network
call in 1.0", and the matching consequence: the game now makes HTTPS calls to one origin, the
online leaderboard, and only after the player chooses to send a run). **Amends ADR-0008** (the
CSP `connect-src` gains the leaderboard origin). **Supersedes the GDD §11.3 line** "Online
leaderboard (Cloudflare Worker + KV)" and the §11.4 line "any backend in 1.0" for this one
service. Values are GDD v0.35 values (§9.1 *Send online*, §9.3, §9.8). Issue #167, epic #166.
Server contract: benoit-bremaud/retro-leaderboard ADR-0001 (replay on the homelab), ADR-0003
(request guards), ADR-0004 (personal data, deletion token), ADR-0005 (game id, mode, version).

## Context

- The leaderboard accepts a score only after a homelab verifier has replayed the run from its seed
  and its recorded inputs with the game's own simulation, built from the game's signed release tag
  (leaderboard ADR-0001). The game must therefore record a run exactly as the simulation read it,
  send it, and ship a headless simulation the verifier can build and run.
- The simulation is deterministic within one engine (fixed 60 Hz step, seeded random, ADR-0002,
  ADR-0019). It reads from each `IntentFrame` only `held & Fire`, `pressed & Bomb`, `moveKind`,
  `moveX`, `moveY` (`Run.step`, `PlayerShip.update`). `moveX` and `moveY` are floating-point: a
  stick in [-1, 1] or a play-field target in pixels.
- **Cross-engine risk** (found in this study): the simulation calls `Math.sin`, `Math.cos` and
  `Math.hypot` (weapon spread, movements, attacks, world, player). ECMAScript leaves their results
  implementation-approximated: V8 (the verifier's Node), SpiderMonkey and JavaScriptCore may
  differ in the last bit. One flipped collision and an honest Firefox or Safari run is `rejected`.
  `Math.sqrt` and the four operations are correctly rounded everywhere.
- The `POST /v1/runs` body is JSON of 64 KiB at most (leaderboard ADR-0003). Level 1 lasts about
  10 800 steps; a touch player's target moves almost every step, so 5 raw bytes per step,
  run-length encoded and in base64, reach about 87 KB: too big already for one level.
- `package.json` is at `0.0.0` and no release is tagged yet. The leaderboard accepts only a
  `MAJOR.MINOR.PATCH` version on its allowlist (ADR-0005): a development build cannot send.
- The hall-of-fame name allows a leading or trailing space (`^[A-Z\d ]{1,8}$`); the leaderboard
  refuses them (`^[A-Z0-9](?:[A-Z0-9 ]{0,6}[A-Z0-9])?$`). A run that missed the top 10 has no name.
- The domain never imports the browser (CLAUDE.md): the network goes through a port.

## Decision

### Recording

1. **What is recorded.** From the first `Run.step` to the step whose outcome becomes `GAME_OVER`
   or `RUN_CLEARED`, included, one **record** per call of `Run.step`, nothing else (no pause, no
   menu, no step after the outcome: leaderboard ADR-0001 decision 8). A run quit from the pause is
   never sendable. The seed is the one the composition root already draws (`main.ts`).
2. **Quantised intents.** Before each `Run.step` the scene machine passes the frame through
   `quantizeIntent(frame, out)` and gives the simulation `out`, never the raw frame, so the record
   is exactly what the simulation read. `out` keeps only the fields above: `held` and `pressed`
   masked to `Fire` and `Bomb`; `direction`: `moveX`, `moveY` rounded to a multiple of 1/127;
   `target`: rounded to a multiple of 1/4 px and clamped to [-512, 511.75]; `none`: zeros.
3. **Record layout** (5 bytes, game-owned): byte 0 = bit 0 fire held, bit 1 bomb pressed, bits 2–3
   move kind (0 none, 1 direction, 2 target), other bits 0; bytes 1–2 and 3–4 = x and y as signed
   16-bit little-endian integers (`direction`: value × 127; `target`: value × 4; `none`: 0). A
   decoder refuses a set reserved bit, kind 3, or a `direction` value outside [-127, 127].
4. **Buffer.** `RunRecorder` writes into one `Uint8Array` preallocated for `MAX_RECORDED_STEPS` =
   72 000 steps (20 minutes, 360 000 bytes), no allocation in the loop. A run longer than that is
   marked *overflowed* and is not sendable. `maxFrames` on the leaderboard allowlist is 72 000.

### Run codec (shared container, MCDA B and A below)

5. **Encoding.** `inputs` = base64url without padding of the **raw DEFLATE** (RFC 1951,
   `CompressionStream('deflate-raw')`) of the concatenated records; the body also carries
   `codec: 1` and `frames` (the record count). Measured order of magnitude: level 1 of a touch
   player compresses well under the 64 KiB body.
6. **Decoding** (Worker, verifier, replay CLI): base64url strictly, inflate with an **output cap**
   of `frames × 5` bytes and `maxFrames × 5` at most (a decompression bomb stops at the cap),
   require exactly `frames × 5` bytes, then check every record (decision 3). Any failure is a
   stable error code, never a throw that escapes.
7. **Canonical form.** The canonical inputs of the run digest are the **decoded records**, not the
   compressed bytes: two DEFLATE implementations may compress the same records differently.
8. **One specification, copies tested against vectors.** The container specification and golden
   test vectors (records, encoding, the expected decode errors) live in retro-leaderboard; the
   game keeps its own small encoder and decoder and runs the same vectors in its tests. A change
   of the container is a new `codec` number in both repositories.

### Determinism across engines (MCDA A below)

9. **No implementation-approximated math in the simulation.** `src/domain/game` and
   `src/domain/random` use `detSin`, `detCos` (a 4 096-entry quarter-wave table built once from
   integer arithmetic and a fixed polynomial, linear interpolation) and `detHypot(x, y)` =
   `Math.sqrt(x * x + y * y)`. ESLint bans `Math.sin`, `cos`, `tan`, `asin`, `acos`, `atan`,
   `atan2`, `exp`, `log`, `pow`, `hypot`, `cbrt` and `**` on non-literals there. Presentation code
   is not concerned. Balance tests are re-run: angles move by less than 1e-4 rad.
10. **Cross-engine test.** The browser smoke test (ADR-0026) replays a committed recorded run in
    Chromium, Firefox and WebKit and compares the score with the Node replay.

### Sending (GDD v0.35 §9.1)

11. **Explicit opt-in, after the hall of fame.** The run's end becomes
    `Ending | Game over → [Name entry → High scores] → [Send online] → Feedback offer → Title`.
    *Send online* shows only when the build has a leaderboard address and a release version, the
    run ended by `GAME_OVER` or `RUN_CLEARED`, its recording did not overflow and its score is
    above 0. The screen states what is sent (score, name, country, inputs) and the retention, and
    offers *SEND*, *PRIVACY* (opens `GET /privacy` in a new tab, ADR-0027 gesture rule) and
    *NOT NOW* (also `back` and 20 s without input). Nothing is sent without *SEND*.
12. **The name.** The entry's name of this run, trimmed; a run without an entry first opens the
    name entry (its result is not added to the local table). The country is the saved choice, or
    none.
13. **Requests.** `POST /v1/runs` with `{ game: "shmup", mode: "arcade", version, seed, codec,
    frames, inputs, score, name, country? }`; `GET /v1/runs/{id}` to read the status;
    `DELETE /v1/runs/{id}` with `Authorization: Bearer <deletion token>`. JSON only, no cookie,
    `credentials: 'omit'`, a 10 s timeout, the response parsed by allowlist (ADR-0006 rules);
    errors map to messages by their stable code (`409 duplicate-run`, `400 unknown-version`, `429`
    with `Retry-After`, offline). No retry loop on `POST`.
14. **Status.** After a `201` the screen shows *PENDING VERIFICATION* and polls `GET` every 15 s
    while it stays open, 2 minutes at most, then *VERIFIED*, *REJECTED*, *UNVERIFIABLE*,
    *EXPIRED* or still pending; it never blocks the return to the title.
15. **Kept runs** (MCDA B below). A separate `localStorage` key `retro-shmup.online.v1` holds at
    most 20 `{ id, token, score, sentAt, status }`: `id` a ULID, `token` 64 lowercase hex
    characters (256 bits), `status` one of the five statuses, `sentAt` an ISO date; parsed by
    allowlist without throwing, a failing item dropped, never touching the save document.
    With 20 kept, *SEND* is refused with *ERASE AN ONLINE SCORE FIRST*: a token is never dropped
    silently, since it is the only way to erase the run.
16. **Options → Online scores** (MCDA B below). A new options row lists the kept runs (score,
    status, date), refreshes their statuses when opened (one `GET` per run, sequential), and erases
    one after a confirmation (default *No*): `DELETE`, then the item leaves the list on `204` or
    `404`. The row shows only in a build with a leaderboard address.
17. **Port.** `LeaderboardPort` (`submit`, `status`, `erase`) is implemented by a `fetch` adapter;
    the domain sees completed results through a polled request handle, no promise in the domain.
    The base URL is the build constant `__LEADERBOARD_URL__`, an `https:` origin checked at build
    time; empty = feature absent. The release version is `__APP_VERSION__` when the build runs on
    an exact signed tag `vX.Y.Z` (`__APP_RELEASE__` true), else the feature is absent.
18. **CSP.** `public/_headers` gets `connect-src 'self' <leaderboard origin>`, that origin only.

### Headless simulation for the verifier (MCDA A below)

19. **A CLI bundle.** `pnpm build:replay` builds `src/replay/cli.ts` into one dependency-free
    `dist-replay/replay.mjs` (Vite library mode, Node target). It reads one JSON document on stdin
    `{ seed, codec, frames, inputs }` (1 MiB at most) and writes one JSON line on stdout:
    `{ ok: true, score, outcome: "game-over" | "run-cleared", framesRead }` or
    `{ ok: false, error: "decode" | "trailing-frames" | "unfinished" | "overflow" }`, exit code 0
    in both cases (a crash or a non-zero code is the verifier's `replay-error`). The replay uses the
    same `Run`, `quantizeIntent` (identity on decoded records) and level list as the game; no
    browser global is touched.
20. **Release tags.** Every release is a signed annotated tag `vX.Y.Z` (skill `release-tag`); the
    verifier checks it with `git verify-tag` against `.github/allowed_signers`, then
    `pnpm install --frozen-lockfile && pnpm build:replay`.

## MCDA (owner-validated, 2026-11-12)

| Question | Chosen (score /500) | Against |
|---|---|---|
| Frame format (fits 64 KiB 30, simplicity 25, safety 25, portability 20) | **Quantised records + raw DEFLATE, capped inflate** (405) | RLE + delta varint (390: too big for several levels), RLE only (380: 87 KB for one touch level) |
| Codec home (single source 30, supply chain 30, independent releases 20, effort 20) | **Spec + golden vectors in retro-leaderboard, copies tested against them** (420) | git dependency on a signed tag (360), npm package (310) |
| Cross-engine determinism (integrity 35, gameplay kept 25, simplicity 25, performance 15) | **Own deterministic sin / cos / hypot, ESLint ban** (450) | accept the risk (360), replay in the player's engine (320) |
| Erasure and status UI (GDPR 35, clarity 25, simplicity 25, scope 15) | **Results flow + Options → Online scores** (395) | Options without status (385), results screen only (345: no erasure later) |
| Headless core (sandbox fit 30, simplicity 25, no added dependency 25, stable contract 20) | **CLI bundle, JSON on stdin and stdout** (475) | ES module import (400), TypeScript run by tsx (285) |
| Token storage (failure isolation 30, single source 30, migration 20, simplicity 20) | **Separate key with its own parser** (420) | inside the save document, version 3 (330) |

Sensitivity: with simplicity at 35 for the frame format, RLE only leads (420 against 385), but it
fails the 64 KiB guard for a touch player, a hard constraint; DEFLATE stays.

## Consequences

- The game's first network calls: one origin, only after *SEND* or from *Online scores*; offline
  play is unchanged and the leaderboard being down never blocks a screen.
- The simulation changes slightly (quantised stick and target, deterministic trigonometry): the
  balance tests and the measurement bot are re-run in the implementation PR.
- The leaderboard repository gets a follow-up: the codec 1 specification, its vectors, the digest
  over decoded records (decision 7), `maxFrames` 72 000 for `shmup`.
- The deployed origin of the leaderboard is fixed with its deployment; until then
  `__LEADERBOARD_URL__` is empty and the feature is absent from every build.
- Tests: quantiser, recorder (overflow, stop at the outcome), codec against the vectors (bombs,
  truncation, reserved bits), the deterministic functions (bounds, symmetry, error < 1e-6),
  the replay CLI (each error code, a recorded level-1 run), the kept-runs parser, the send flow
  with a mocked `LeaderboardPort`, the CSP in `_headers`, the smoke replay in three engines.

## Rejected alternatives

- **Recording raw floating-point intents**: 8 bytes per value, far over 64 KiB, and the device
  arbitration would have to be replayed too.
- **Recording device events**: the replay would need the input adapters, which touch the browser.
- **A server-issued seed**: refused by the owner for the leaderboard (offline play kept).
- See the MCDA table for the scored alternatives.
