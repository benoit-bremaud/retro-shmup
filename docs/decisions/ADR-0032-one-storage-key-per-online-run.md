# ADR-0032: Keep each online run under its own storage key

**Status:** Accepted — 2026-11-13. **Amends ADR-0031 decision 17** (kept runs). Issue #175,
follow-up of #167.

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
   whose value is `{ token, score, sentAt, status }` with the formats of ADR-0031 decision 17. A
   write touches only the run it is about, so two tabs never overwrite each other's runs.
2. **Storage port.** `StoragePort` gains `keys(prefix)` (the keys starting with `prefix`, an empty
   list when the storage cannot be read) and `remove(key)`. Neither throws.
3. **Reading.** The kept runs are the keys under the prefix `retro-shmup.online.v1.` whose suffix is
   a ULID and whose value parses by allowlist (ADR-0006); an invalid key or value is ignored, never
   removed by the reader, and never touches the save document.
4. **Limit.** The 20-run limit counts the valid kept runs at the moment of *SEND*. Two tabs sending
   at the same time may keep 21: a token is never dropped to make room, so the limit is a guard,
   not an invariant.
5. **Status and erasure.** A status answer rewrites only its run's key; an erasure answered `204`
   or `404` removes only its run's key.
6. **No migration.** The single document `retro-shmup.online.v1` is not read; no release ever wrote
   it.

## Consequences

- The loss of a run by a concurrent tab disappears; two tabs updating the same run still apply the
  last write, which only loses a status the next opening asks again.
- Listing costs one scan of the storage keys; at 20 runs this is negligible.
- `KeptRuns` (meta/04), the send sequence (meta/02) and the online-run state machine (meta/05)
  name the per-run key; the UML update follows in its own PR, then the code.
- GDD §9.8 (v0.35 paragraph) names the per-run key; no player-facing rule changes.

## Rejected

- **Read-modify-write with a version counter:** `localStorage` has no compare-and-set, so a check
  before the write still races.
- **`storage` event to merge copies:** a merge after the fact still lets a stale write land first,
  and adds code in every tab.
- **Web Locks API:** serialises writes but adds an async lock around a synchronous storage, for a
  rare case the per-key layout removes outright.
