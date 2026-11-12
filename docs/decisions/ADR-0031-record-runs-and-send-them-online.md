# ADR-0031: Record each run and send it, at the player's choice, to the online leaderboard

**Status:** Accepted — 2026-11-12. **Partially supersedes ADR-0006** (decision 1, "no network
call in 1.0", and the matching consequence: the game now makes HTTPS calls to one origin, the
online leaderboard, and only after the player chooses to send a run). **Amends ADR-0008** (the
CSP `connect-src` gains the leaderboard origin). **Supersedes the GDD lines** that kept the online
leaderboard for version 2 (§8, §11.3, §11.4, the *Meta 1.0* row of the decision record) for this
one service. Values are GDD v0.35 values (§9.1 *Send online*, §9.3, §9.8). Issue #167, epic #166.
Server contract: benoit-bremaud/retro-leaderboard ADR-0001 (replay on the homelab), ADR-0003
(request guards), ADR-0004 (personal data, deletion token), ADR-0005 (game id, mode, version);
server follow-up benoit-bremaud/retro-leaderboard#14.

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
  10 800 steps, the three-level 1.0 run about 32 400. Measured by the pre-push review with
  `node:zlib` on a synthetic touch path (5-byte records, base64url): one level 18–37 KiB with
  records row by row, but 20 minutes 121–254 KiB; storing the columns apart with delta-coded
  coordinates before DEFLATE gives about 41 KiB for 32 400 steps. Estimates on synthetic input;
  the implementation PR measures recorded runs.
- `package.json` is at `0.0.0` and no release is tagged yet. The leaderboard accepts only a
  `MAJOR.MINOR.PATCH` version on its allowlist (ADR-0005).
- The hall-of-fame name is trimmed, 1–8 characters of A–Z, 0–9 and space, **or `???`** for a
  skipped entry (`high-scores.ts`); the leaderboard refuses `???`. A run that missed the top 10 has
  no name.
- `localStorage` belongs to one origin: a deletion token kept on `*.pages.dev` is lost on the
  final `<game>.benoitbremaud.fr` (ADR-0008), and itch.io serves the game from its own origin.
- The domain never imports the browser (CLAUDE.md): its `tsconfig` has no DOM library, so
  `CompressionStream` and `fetch` belong to adapters; the domain never awaits a promise.

## Decision

### Recording

1. **What is recorded.** From the first `Run.step` to the step whose outcome becomes `GAME_OVER`
   or `RUN_CLEARED`, included, one **record** per call of `Run.step`, nothing else (no pause, no
   menu, none of the steps the Game over screen keeps playing: leaderboard ADR-0001 decision 8).
   The **claimed score** is the run's score at that outcome step (a test proves the later steps
   never change it). A run quit from the pause is never sendable. The seed is the one the
   composition root already draws (`main.ts`).
2. **Quantised intents.** Before each `Run.step` the scene machine passes the frame through
   `quantizeIntent(frame, out)` and gives the simulation `out`, never the raw frame, so the record
   is exactly what the simulation read. `out` keeps only the fields above: `held` and `pressed`
   masked to `Fire` and `Bomb`; `direction`: `moveX`, `moveY` rounded to a multiple of 1/127;
   `target`: rounded to a multiple of 1/4 px and clamped to [-512, 511.75]; `none`: zeros.
3. **Record** (5 bytes, game-owned, the canonical form): byte 0 = bit 0 fire held, bit 1 bomb
   pressed, bits 2–3 move kind (0 none, 1 direction, 2 target), other bits 0; bytes 1–2 and 3–4 =
   x and y as signed 16-bit little-endian integers (`direction`: value × 127; `target`: value × 4;
   `none`: 0). A record is valid only if no reserved bit is set, the kind is not 3, `none` has
   x = y = 0, `direction` values lie in [-127, 127] and `target` values in [-2048, 2047]: one valid
   record maps to exactly one simulation input.
4. **Buffer.** `RunRecorder` writes into one `Uint8Array` preallocated once for
   `MAX_RECORDED_STEPS` = 72 000 steps (20 minutes, 360 000 bytes) and reused (`reset`) by every
   run; no allocation in the loop. A run longer than that is *overflowed* and not sendable.
   `maxFrames` on the leaderboard allowlist is 72 000. Decision 6 may still refuse a shorter run.

### Run codec 1 (owner MCDA below)

5. **Wire layout.** The records are transposed into three columns — the `frames` flag bytes, then
   the x values, then the y values, each coordinate stored as its 16-bit difference from the
   previous record's (the first from 0, wrapping modulo 2¹⁶, little-endian) — and the result is
   compressed with **raw DEFLATE** (RFC 1951) and written as base64url without padding. The body
   carries `codec: 1`, `frames` and `inputs`. Transposition and delta are pure byte functions in
   the domain (`RecordColumns`); DEFLATE and base64url live in adapters: `CompressionStream
   ('deflate-raw')` in the browser, `node:zlib` in the replay CLI.
6. **Size guard.** The game sends only when the encoded `inputs` holds at most 60 000 characters
   (the rest of the body fits in the remaining 5 KiB); otherwise *RUN TOO LONG TO SEND*.
7. **Decoding** (Worker, verifier, replay CLI): strict base64url, inflate with an output cap of
   `frames × 5 + 1` bytes and `maxFrames × 5 + 1` at most (a decompression bomb stops at the
   cap), require exactly `frames × 5` bytes and the end of the DEFLATE stream, undo the columns,
   then check every record (decision 3). Any failure is a stable error code, never an escaping
   throw.
8. **Canonical form.** The canonical inputs of the run digest are the **decoded records** in row
   order, not the compressed bytes: two DEFLATE implementations may compress the same input
   differently.
9. **One specification, copies tested against vectors.** The codec 1 specification and golden
   vectors (records, their encoding, each expected decode error) live in retro-leaderboard
   (follow-up retro-leaderboard#14); the game keeps its own encoder and decoder and runs the same
   vectors in its tests. A change of the layout is a new `codec` number in both repositories.

### Determinism across engines

10. **No implementation-approximated math in the simulation.** `src/domain/game` and
    `src/domain/random` use `detSin`, `detCos` (a 4 096-entry quarter-wave table built once from
    integer arithmetic and a fixed polynomial, linear interpolation, error below 1e-6) and
    `detHypot(x, y)` = `Math.sqrt(x * x + y * y)`. ESLint allows there only the `Math` members that
    ECMAScript defines exactly — `abs`, `ceil`, `floor`, `round`, `trunc`, `sign`, `min`, `max`,
    `sqrt`, `fround`, `imul`, `clz32`, `PI` — and bans `**` on non-literal operands. Presentation
    code is not concerned. Balance tests and the measurement bot are re-run.
11. **Cross-engine test.** The one browser smoke test file (ADR-0026) replays a committed recorded
    run in Chromium, Firefox and WebKit and compares the score with the Node replay.

### Sending (GDD v0.35 §9.1)

12. **Where.** Only on the final origin `<game>.benoitbremaud.fr` (ADR-0008): the build constant
    `__LEADERBOARD_URL__` (an `https:` origin, checked at build time) is set only in that Pages
    project's production environment, and only when `package.json` holds a strict `X.Y.Z` above
    `0.0.0` (the release PR sets it, the signed tag `vX.Y.Z` marks the same commit). Empty
    constant = feature absent: no offer, no options row, no request. itch.io waits for its own ADR.
13. **Explicit opt-in, after the hall of fame.** The run's end becomes
    `Ending | Game over → [Name entry → High scores] → [Send online] → Feedback offer → Title`.
    *Send online* shows only when the feature is present, the run ended by `GAME_OVER` or
    `RUN_CLEARED`, its recording did not overflow and its score is above 0. The screen shows the
    actual score, name and flag, the words *INPUTS SENT FOR CHECKING*, *RETENTION IN PRIVACY*, and
    offers *SEND*, *PRIVACY* (opens `GET /privacy` in a new tab, ADR-0027 gesture rule) and
    *NOT NOW* (the cursor starts there; also `back` and 20 s without input). Nothing is sent
    without *SEND*.
14. **The name.** The entry's name of this run; a run without an entry, or with `???`, first opens
    the name entry (its result is not added to the local table; *OK* on an empty name and `back`
    return to the offer). The country is the saved choice, or none.
15. **Requests.** `POST /v1/runs` with `{ game: "shmup", mode: "arcade", version, seed, codec,
    frames, inputs, score, name, country? }`, success `202 Accepted` with the run id and deletion
    token; `GET /v1/runs/{id}` for the status, `404` when the run is unknown or erased;
    `DELETE /v1/runs/{id}` with `Authorization: Bearer <deletion token>`. JSON only, no cookie,
    `credentials: 'omit'`, a 10 s timeout, the response parsed by allowlist (ADR-0006 rules): a
    2xx whose body fails the parse is an error. Errors map to lines by the server's stable code:
    `409 duplicate-run`, `400 unknown-version`, `400` name refused, `400` body too large, other
    `400`, `429` with `Retry-After`, `5xx`, offline, timeout. No automatic retry of a `POST`.
16. **Status.** After a `202` the screen shows *PENDING VERIFICATION* and asks `GET` every 15 s
    while it stays open, 2 minutes at most, then shows *VERIFIED*, *REJECTED*, *UNVERIFIABLE* or
    *EXPIRED*, or stays pending; it never blocks the return to the title.
17. **Kept runs.** A separate `localStorage` key `retro-shmup.online.v1` holds at most 20
    `{ id, token, score, sentAt, status }`: `id` a ULID, `token` 64 lowercase hex characters
    (256 bits), `status` one of `pending`, `verified`, `rejected`, `unverifiable`, `expired`,
    `sentAt` an ISO date; parsed by allowlist without throwing, an invalid item dropped, never
    touching the save document. With 20 kept, *SEND* shows *ERASE AN ONLINE SCORE FIRST*.
    A token is never dropped to make room: it is the player's own way to erase the run (the
    privacy page's contact address is the other, leaderboard ADR-0004).
18. **Options → Online scores.** A new options row, present with the feature, lists the kept runs
    (score, status, date); on opening it asks `GET` for **every** kept run, one at a time, and
    drops a run answered `404` (erased by its retention, leaderboard ADR-0004); it erases one after
    a confirmation (default *No*): `DELETE`, then the item leaves the list on `204` or `404`.
19. **Lost token.** A `POST` that timed out may have stored the run; a re-send then answers `409`.
    In both cases the line adds *TO ERASE SEE PRIVACY*.
20. **Port.** `LeaderboardPort` (`submit`, `status`, `erase`) returns a request handle the domain
    polls each step (`pending`, `done` with a parsed result, `failed` with a code); no promise in
    the domain. `submit` takes the records and their count; the `FetchLeaderboard` adapter
    encodes them (decisions 5–6), sends, and parses the answer.
21. **CSP.** `public/_headers` gets `connect-src 'self' <leaderboard origin>`, that origin only.

### Headless simulation for the verifier

22. **A CLI bundle.** `pnpm build:replay` builds `src/replay/cli.ts` into one dependency-free
    `dist-replay/replay.mjs` (Vite library mode, Node target). It reads one JSON document on stdin
    `{ seed, codec, frames, inputs }` (1 MiB at most) and writes one JSON line on stdout:
    `{ ok: true, score, outcome: "game-over" | "run-cleared", framesRead }` or
    `{ ok: false, error: "decode" | "trailing-frames" | "unfinished" | "overflow" }`, exit code 0
    in both cases (a crash or a non-zero code is the verifier's `replay-error`). It uses the same
    `Run`, `quantizeIntent` (identity on decoded records), `RecordColumns` and level list as the
    game; no browser global is touched.
23. **Release tags and the build on the homelab.** Every release is a signed annotated tag
    `vX.Y.Z` (skill `release-tag`). The verifier checks it with `git verify-tag` against an
    **allowed-signers file pinned on the homelab**, outside the checkout (the repository's own
    `.github/allowed_signers` is never trusted for this), then runs
    `pnpm install --frozen-lockfile --ignore-scripts` and `pnpm build:replay` in the same
    sandbox as the replay, without any secret in its environment.

## MCDA (owner-validated, 2026-11-12)

| Question | Chosen (score /500) | Against |
|---|---|---|
| Frame format (fits 64 KiB 30, simplicity 25, safety 25, portability 20) | **Quantised records + raw DEFLATE, capped inflate** (405) | RLE + delta varint (390), RLE only (380: 87 KB for one touch level) |
| Codec layout after review (a full 1.0 run fits 35, simplicity 25, DEFLATE kept 20, safety 20) | **Columns with delta-coded x and y, then DEFLATE, a size guard** (450) | rows + size guard (360: a touch player cannot send past about 5 minutes), brotli (300) |
| Codec home (single source 30, supply chain 30, independent releases 20, effort 20) | **Spec + golden vectors in retro-leaderboard, copies tested against them** (420) | git dependency on a signed tag (360), npm package (310) |
| Cross-engine determinism (integrity 35, gameplay kept 25, simplicity 25, performance 15) | **Own deterministic sin / cos / hypot, ESLint allowlist** (450) | accept the risk (360), replay in the player's engine (320) |
| Erasure and status UI (GDPR 35, clarity 25, simplicity 25, scope 15) | **Results flow + Options → Online scores** (395) | Options without status (385), results screen only (345: no erasure later) |
| Headless core (sandbox fit 30, simplicity 25, no added dependency 25, stable contract 20) | **CLI bundle, JSON on stdin and stdout** (475) | ES module import (400), TypeScript run by tsx (285) |
| Token storage (failure isolation 30, single source 30, migration 20, simplicity 20) | **Separate key with its own parser** (420) | inside the save document, version 3 (330) |
| Retention line (true 35, informative at a glance 30, fits 20, stays true 15) | **RETENTION IN PRIVACY + the PRIVACY row** (380) | durations on screen (315: incomplete, the top 100 is kept without limit) |
| Channels (tokens kept 30, CORS and CSP simplicity 25, reach 25, effort 20) | **The final origin only** (430) | every Pages origin (340: tokens lost on the move), Pages + itch.io (305) |

Sensitivity: for the first frame-format question, raising simplicity to 35 and lowering the fit
weight to 20 would put RLE first (420 against 385), but RLE fails the 64 KiB guard for a touch
player, a hard constraint; the review then refined DEFLATE into the column layout.

## Consequences

- The game's first network calls: one origin, only after *SEND* or from *Online scores*; offline
  play is unchanged and the leaderboard being down never blocks a screen.
- The simulation changes slightly (quantised stick and target, deterministic trigonometry): the
  balance tests and the measurement bot are re-run in the implementation PR.
- Server follow-up retro-leaderboard#14: `202` and `404` as above, codec 1 and its vectors, the
  digest over decoded records, `maxFrames` 72 000 for `shmup`, the token as 64 lowercase hex,
  `Authorization` in the CORS allowed headers, the pinned signer file and `--ignore-scripts`.
- The feature stays absent until the final origin and a release version exist.
- The implementation PR updates the texts that still say "no network": `README.md` (roadmap,
  privacy paragraph), `SECURITY.md`, `.env.example` (the leaderboard address variable).
- With 20 runs kept the current run cannot be sent: the player erases one in *Online scores*
  first. Accepted for a first version.
- Tests: quantiser, recorder (overflow, stop at the outcome, score frozen after it), record
  validation, columns and delta, codec against the vectors (bombs, truncation, excess data,
  reserved bits, non-canonical records), the size guard, the deterministic functions (bounds,
  symmetry, error), the replay CLI (each error code, a recorded level-1 run), the kept-runs parser,
  the send and erase flows with a mocked `LeaderboardPort`, the CSP in `_headers`, the smoke replay
  in three engines.

## Rejected alternatives

- **Recording raw floating-point intents**: 8 bytes per value, far over 64 KiB, and the device
  arbitration would have to be replayed too.
- **Recording device events**: the replay would need the input adapters, which touch the browser.
- **A server-issued seed**: refused by the owner for the leaderboard (offline play kept).
- See the MCDA table for the scored alternatives.
