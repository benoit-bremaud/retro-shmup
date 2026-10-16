# Local review — retro-shmup (GDD v0.21, design/levels-density)

- Date: 2026-10-16
- Commit: 236f49a
- Scope: branch diff main...HEAD — `docs/design/game-design-document.md` only (§7.2.3, status line, decision record)
- Checks run: docs consistency (read by hand) · secrets · execution checks through the pre-push `make verify`. Design / tests / security / correctness agents not spawned: the diff is prose only, with no code or test change to audit.
- Verdict: ship as-is · Must 0 · Should 0 · Nice 1

## Pre-merge gate (head SHA 236f49a)
| Step | Result |
|---|---|
| 1 Tests | run by the pre-push hook (`make verify`); the rows of §7.2.3 were measured on an uncommitted prototype: level simulation and balance guard green |
| 2 Coverage | unchanged (no code in the diff) — measured by `make verify` |
| 3 SonarQube | run by the pre-push hook |
| 4 Secrets | gitleaks clean on the commit · only `.env.example` tracked (placeholders) · diff read: nothing sensitive |
| 5 QA pass | not applicable before the code PR (no runtime change); full pass and `make smoke` come with the code PR |
- Gate: **push authorised**; merge after green CI

## 🔴 Must Have
_None._

## 🟡 Should Have
_None._

## 🔵 Nice to Have
- `docs/design/game-design-document.md:708` `[docs]` · §7.2.2 still says "Of the seven formations": still true for the formations of §7.2.1/§7.2.2. §7.2.3 adds formations that all pay no P, so the P count does not change · keep as is.

## ⚪ Disagree / Intentional
- No UML change: the level script is data inside the existing `LevelScript` / `ScriptEvent` types (04-class-domain); no class, state or sequence changes.

## Per-dimension summary
- Design: no structure touched · Docs: §7.2.3 consistent with §7.1, §7.2.1, §7.2.2 (ceilings, calm, P curve, last spawn 112.3 s) · Tests: guard band of 70 s specified for the code PR · Security: n/a · Correctness: row table matches the measured prototype.
