# ADR-0032: Keep each online run under its own storage key

**Status:** Accepted — 2026-11-13. **Amends ADR-0006 decision 3** (the `StoragePort` shape) and
**ADR-0031 decision 17** (kept runs). GDD v0.40 (§9.1, §9.3, §9.8). Issue #175, follow-up of #167.

## Context

- ADR-0031 decision 17 keeps up to 20 sent runs `{ id, token, score, sentAt, status }` in one
  `localStorage` document, `retro-shmup.online.v1`.
- Two tabs of the game each hold a copy of that document. A tab that writes after the other wrote
  saves its stale copy and drops the other tab's run, deletion token included (Codex review on
  #174, adversarial review on #167). Reading the document back after the write cannot see the
  loss: the write succeeded.
- The deletion token is the player's own way to erase a run from the game (ADR-0031 decision 17,
  leaderboard ADR-0004). Losing it silently breaks that promise.
- The online leaderboard is not released yet (it is switched on only by a release build), so no
  player holds a `retro-shmup.online.v1` document.

## Decision

1. **One key per run.** Each kept run lives under `retro-shmup.online.v1.<id>`, `<id>` its ULID,
   whose value is `{ token, score, sentAt, status }` with the formats of ADR-0031 decision 17. The
   key's `v1` is the schema version (no `v` field in the value); a schema change uses a new
   prefix. A write touches only the run it is about, so two tabs never overwrite each other's runs.
2. **Storage port.** `StoragePort` gains `keys(prefix: string): readonly string[]` (every key
   starting with `prefix`, an empty list when the storage cannot be read, a key removed during the
   scan skipped) and `remove(key: string): void`. Neither throws. A consumer that needs only
   `read` and `write` (the save store) may take `Pick<StoragePort, 'read' | 'write'>`.
3. **Reading.** The kept runs are the keys under the prefix `retro-shmup.online.v1.` whose suffix is
   a ULID and whose value parses by allowlist (ADR-0006); an invalid key or value is ignored, never
   removed by the reader, and never touches the save document. Every valid run is listed, with no
   cap, newest first by id descending (a ULID sorts by time).
4. **Limit.** The 20-run limit is checked only when the player chooses *SEND*: with 20 valid runs
   kept, *SEND* shows *ERASE AN ONLINE SCORE FIRST*. The write after a `202` never checks it again,
   so sends from several tabs at once may keep more than 20 (owner, 2026-11-13: 420/500, against
   refusing the token past 20, 370/500). A token is never dropped to make room.
5. **Status and erasure.** A status answer `unknown` (`404`) and an erasure answered `204` or `404`
   remove only their run's key. Any other status answer rewrites its run's key only while that key
   still holds a valid run, read again just before the write, so a run another tab erased is not
   recreated.
6. **No migration.** The single document `retro-shmup.online.v1` is not read; no release ever wrote
   it.

## Consequences

- The loss of a run by a concurrent tab disappears. Two tabs updating the same run apply the last
  write, which at worst loses a status that the next opening asks again. The short window between
  the read and the write of decision 5 can bring an erased run back until the next `GET` answers
  `unknown`.
- Listing scans every key of the origin (the save key included), once per event (opening *Online
  scores*, *SEND*, a request settling), never per simulation step; negligible.
- A value under the prefix that never parses stays in the storage; it is harmless and ignored.
- `KeptRuns` becomes a read-only snapshot of the parsed runs; keeping, re-statusing and forgetting
  a run are one-key operations. The UML update follows in its own PR: meta/02 (send sequence),
  meta/04 (`KeptRuns`), meta/05 (online-run state), meta/04-class-menus (`StoragePort`),
  system/03-component and the traceability matrix. The code PR updates `CHANGELOG.md`.
- GDD v0.40: §9.1 drops the "20 runs kept by another tab" refusal, §9.3 lists every kept run by
  id, §9.8 names the per-run key.

## Rejected alternatives

- **Read-modify-write with a version counter:** `localStorage` has no compare-and-set, so a check
  before the write still races.
- **`storage` event to merge copies:** a merge after the fact still lets a stale write land first,
  and adds code in every tab.
- **Web Locks API:** serialises writes but adds an async lock around a synchronous storage, for a
  rare case the per-key layout removes outright.
- **Refusing an accepted run's token past 20** (the GDD v0.36 rule): keeps a strict limit but
  leaves the player without a way to erase the run from the game (370/500).
