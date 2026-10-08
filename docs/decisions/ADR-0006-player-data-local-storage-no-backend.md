# ADR-0006: Player data in localStorage, versioned, no backend in 1.0

**Status:** Accepted — 2026-10-07

## Context

The 1.0 release must persist two things between browser sessions (GDD §9.3, §8, §9.8):

- **Options** — music and SFX volumes, keyboard and gamepad remaps, language (EN / FR), the
  accessibility toggles (screen shake, white flashes), fullscreen preference.
- **A local top-10 table** — three-letter initials from the arcade name-entry screen, score, level
  reached (1–3), date.

The forces that shape the decision:

- **Data volume is tiny.** Ten entries of `{initials, score, level, date}` serialise to roughly
  60 bytes each in JSON (3-character initials, integer score, one-digit level, 10-character ISO
  date, field names), so under 1 KB for the table; the options object, remaps included, is of the
  same order. About 2 KB in all, three orders of magnitude below the per-origin Web Storage quota
  (commonly about 5 MiB, browser-dependent).
- **No backend in 1.0.** The GDD *Decision record* ("Meta 1.0") rejects the online leaderboard for
  1.0 because of the backend, the impossibility of client-side anti-cheat and the GDPR obligations,
  and defers it to v2 (GDD §11.3: Cloudflare Worker + KV). CLAUDE.md forbids any backend, account
  system or network call in 1.0 without an explicit owner request.
- **Data minimisation.** GDPR Art. 5(1)(c) requires that personal data be limited to what is
  necessary. The game needs no account and no identity; the GDD fixes "no personal data beyond
  three letters" (§9.8). The less the game stores, the less it has to protect, explain or export.
- **Storage is not guaranteed.** Browsers can deny Web Storage (private browsing in older Safari,
  "block all cookies" settings, partitioned iframes such as itch.io's). `window.localStorage` may
  throw `SecurityError`; `setItem` may throw `QuotaExceededError`. The game must still play.
- **The domain never imports the browser** (CLAUDE.md, ADR-0003). Whatever persists must sit
  behind a port, like rendering (ADR-0001), audio and input.
- **Deterministic simulation** (ADR-0002): no `Date.now()` inside the simulation. The date stored
  with a high score therefore has to be captured outside the simulation, at name-entry time.

## Decision

1. **Web Storage (`localStorage`) is the only persistence mechanism in 1.0.** Nothing is
   transmitted anywhere; there is no account, no telemetry, no network call.
2. **One key, one versioned JSON document.** Key `retro-shmup.v1` (GDD §9.8) holds a single
   document `{ version, options, highScores }`. The key suffix names the storage namespace; the
   `version` field inside the document is the authoritative schema revision and is what
   migrations read.
3. **A `StoragePort` in the domain, a `localStorage` adapter in the shell.** The port is
   string-in / string-out so the domain owns the schema and the serialisation; the adapter owns
   nothing but the browser call. Minimal shape:

   ```ts
   export interface StoragePort {
     read(key: string): string | null;        // null: absent or unavailable
     write(key: string, value: string): boolean; // false: persistence unavailable, not an error
   }

   export const SAVE_KEY = 'retro-shmup.v1';

   export interface HighScoreEntry {
     readonly initials: string; // exactly 3 characters from the name-entry alphabet
     readonly score: number;
     readonly level: 1 | 2 | 3;
     readonly date: string;     // ISO 8601 calendar date, YYYY-MM-DD, captured by the shell
   }

   export interface SaveDocumentV1 {
     readonly version: 1;
     readonly options: Options;
     readonly highScores: readonly HighScoreEntry[]; // at most 10, sorted by score descending
   }

   export function parseSaveDocument(raw: string | null): SaveDocumentV1; // never throws
   ```

4. **One migration function per version bump.** A schema change bumps `version` and adds a pure
   function `migrateVnToVn+1(doc): SaveDocumentVn+1`; `parseSaveDocument` runs the chain from the
   stored `version` to the current one. A document that cannot be parsed (invalid JSON, unknown
   version, missing fields) resolves to the defaults; it is never a fatal error.
5. **Graceful degradation.** The adapter wraps every `localStorage` access in `try/catch` and
   reports `null` / `false`. When storage is unavailable the game runs with default options and an
   empty top 10, and simply does not persist: no prompt, no error screen.
6. **Writes happen at discrete moments only** — when an option changes and when a name is
   entered — never inside the fixed-timestep loop (ADR-0002: no allocation, no I/O in the loop).
7. **No personal data beyond three initials.** Initials come from a constrained arcade alphabet
   (no free-text input); the document stores no identifier, no device information, no timestamp
   finer than the day. This is the project's reading of GDPR Art. 5(1)(c). Keeping a preference
   the player explicitly asked to keep falls under the ePrivacy Directive Art. 5(3) "strictly
   necessary" exemption, so no consent banner is introduced.

## Alternatives considered

- **IndexedDB** — rejected because it is asynchronous, transactional and schema-managed storage
  designed for large structured data; for a ~2 KB document it adds an API surface, an upgrade
  protocol and test complexity with no benefit.
- **Cookies** — rejected because cookies are sent to the server on every request; they are the
  wrong tool for client-only state, cap at about 4 KB, and would needlessly turn local data into
  transmitted data.
- **A backend / online leaderboard now** — rejected (GDD *Decision record*, "Meta 1.0") because
  anti-cheat is impossible client-side, an online table carries GDPR obligations (controller role,
  privacy notice, retention, erasure), and it is a service to run and maintain; deferred to v2.
- **Multiple keys (one per concern)** — rejected: options and scores could drift to different
  schema versions; one document, one version, one migration chain.

## Consequences

Positive:
- Zero infrastructure, zero cost, zero privacy surface in 1.0; nothing leaves the device.
- The domain is testable with an in-memory fake; the browser adapter is a few lines.
- Schema evolution is explicit and replayable: every version has a fixture and a migration.

Negative:
- Scores are per browser profile and per origin; clearing site data erases them. Accepted for 1.0.
- `localStorage` is synchronous; acceptable only because writes are rare and tiny (rule 6).
- Versioning discipline is a standing obligation: forgetting a migration silently resets players.

Follow-ups this decision creates:
- **Code review must check**: `localStorage`, `window` and `document` appear only in the adapter;
  every change to `SaveDocument` bumps `version`, adds a migration and a fixture; `initials` is
  validated against the name-entry alphabet and length 3; no new field carries personal data;
  no `write` call inside the simulation.
- **Tests implied** (ADR-0003 pyramid): unit tests of `parseSaveDocument` with fixtures for each
  version, for corrupt JSON and for an unknown version; a `FakeStoragePort` (in-memory `Map`) for
  domain tests; an adapter test with a throwing `Storage` double proving `read` returns `null`
  and `write` returns `false` on `SecurityError` and `QuotaExceededError`; a round-trip test on
  the top-10 insertion (sorted, capped at 10, ties resolved by earlier entry).
- **The v2 online leaderboard needs its own ADR and a privacy notice** before any score leaves
  the device; it adds to this decision and supersedes nothing in it.

## References

- GDD §8 Scoring, §9.3 Options, §9.7 Accessibility, §9.8 Save data, §11.3 Version 2,
  §11.4 Explicitly out, §13 Technical constraints, *Decision record* row "Meta 1.0".
- CLAUDE.md (project): "The domain never imports the browser"; no backend or network call in 1.0.
- ADR-0001 (render port), ADR-0002 (timestep, no I/O in the loop), ADR-0003 (ports, test pyramid).
- WHATWG HTML Living Standard, "Web storage": https://html.spec.whatwg.org/multipage/webstorage.html
- MDN, `Window.localStorage` (exceptions): https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
  and "Storage quotas and eviction criteria":
  https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- Regulation (EU) 2016/679 (GDPR), Art. 5(1)(c) data minimisation; Directive 2002/58/EC
  (ePrivacy), Art. 5(3) storage on terminal equipment.
- Michael Nygard, "Documenting Architecture Decisions" (2011) — the ADR format used here.
- The single-document rule and the write-at-discrete-moments rule are internal rationale (derived
  from ADR-0002 and the data volume above); no external standard is cited for them.
