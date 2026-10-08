# ADR-0005: MIT for the code, separate licences for assets

**Status:** Accepted — 2026-10-07

## Context

The repository serves two goals that pull in opposite directions (GDD §1.2):

- **Portfolio value.** The code (engine, domain, adapters, tests, UML study, ADRs) is meant to be
  read, forked and reused by recruiters and peers. That requires a public repository under a
  permissive, universally understood licence. The repository starts private and switches to
  public the same day, once the public-release checklist (`~/.claude/CLAUDE.md`,
  `project-templates/docs/conventions/security.md`) is satisfied.
- **A real, published game.** 1.0 ships on itch.io; Steam is considered later (GDD §1.2, §11).
  The custom sprites, palette, hero-ship silhouette and music produced in the custom-asset phase
  (GDD §3.2, §9.5, §11.2) are the game's identity. Under the same permissive licence as the code,
  anyone could repackage the finished game, art and music included, and publish a clone.

Two further forces fix the shape of the decision:

- **Placeholder assets come from third parties.** During development the game uses CC0 sprites
  and free chiptune tracks (GDD §3.2, §9.5, Decision record rows "Art" and "Audio"). CC0 1.0
  waives attribution; CC BY 4.0 does not — its section 3(a)(1) obliges the licensee to retain the
  creator identification, copyright notice, licence notice, a link to the material and an
  indication of modifications. A single root `LICENSE` cannot express this, and the GDD already
  commits to a `CREDITS.md` (§9.5) and to a credits screen in 1.0 (§11.1).
- **GitHub detects one licence per repository.** GitHub's detection (Licensee) reads the root
  `LICENSE` and recommends keeping it to a single known licence, documenting any complexity in
  the README. A mixed or custom root licence shows as "unknown licence" on the repository page,
  which defeats the portfolio goal.

CLAUDE.md forbids editing `LICENSE` without a dedicated PR; this ADR is the decision it implements.

## Decision

1. **`LICENSE` at the root is the MIT License**, verbatim from the OSI text, copyright line
   `Copyright (c) 2026 Benoît Bremaud`. It covers the **source code only**: `src/`, `tests/`,
   build and CI configuration, and the documentation (`docs/`, `README.md`). SPDX: `MIT`;
   `package.json` carries `"license": "MIT"` once it exists.
2. **Assets are excluded from the MIT grant.** Every file under `public/assets/` — and any future
   asset directory — is governed by `public/assets/LICENSE.md`, created in the same PR as the
   first asset. It states: third-party assets keep their original licence and attribution as
   listed in `CREDITS.md`; everything else in the directory is `All rights reserved,
   Copyright (c) 2026 Benoît Bremaud` unless its `CREDITS.md` entry says otherwise.
3. **`CREDITS.md` at the root is the single attribution register**, one entry per file or pack:

   ```text
   ## <pack or file name>
   - Files: public/assets/<path or glob>
   - Author: <name or handle>
   - Source: <URL>
   - Licence: <SPDX identifier (CC0-1.0, CC-BY-4.0) or "All rights reserved">
   - Modifications: <none | what was changed>
   ```

   The `Modifications` line exists because CC BY 4.0 section 3(a)(1)(B) requires it; it is filled
   in for CC0 material too so the register stays uniform.
4. **Third-party placeholders keep their original licence.** Only CC0 1.0 and CC BY 4.0 are
   accepted; non-commercial or share-alike clauses are refused because 1.0 is a commercial
   release. Placeholders are never relicensed or stripped of attribution, only replaced.
5. **Custom assets produced for the game are "All rights reserved"** by default. A free licence on
   a custom asset is an explicit per-entry statement in `CREDITS.md`, never a default.
6. **The README states the split in a "Licence" section**: code under MIT, assets under
   `public/assets/LICENSE.md` and `CREDITS.md`, plus one line saying that forking the repository
   grants no right on the assets.
7. **The in-game credits screen is derived from `CREDITS.md`**, never written by hand; the
   message catalogue (GDD §9.6) holds only the headings. The UI depends on a minimal interface:

   ```ts
   export interface CreditEntry {
     readonly title: string;
     readonly author: string;
     readonly licence: string; // SPDX identifier or "All rights reserved"
     readonly source: string;  // URL; empty for custom assets
   }
   export type CreditsSource = () => readonly CreditEntry[];
   ```

   How entries reach a `CreditsSource` (build-time generation or a derived JSON) is a
   vertical-slice implementation choice; the invariant is the single source of truth.

No external standard dictates rules 1–7 beyond the licence texts cited; the rationale is internal:
unambiguous GitHub detection, mechanical attribution, protected custom assets, one register.

## Alternatives considered

- **MIT for everything** — rejected because the custom art and music would become freely
  reusable, including for a competing release; the portfolio goal needs the code open, not the
  game's identity.
- **GPL-3.0 for the code** (`GPL-3.0-only`) — rejected because copyleft deters the reuse the
  portfolio goal invites (a peer's project would have to adopt the GPL) and protects nothing here.
- **Proprietary code ("All rights reserved" for the whole repository)** — rejected because it
  kills the portfolio value: a public repository nobody may legally learn from or fork is a
  showcase, not a contribution.

## Consequences

Positive:

- The repository page shows "MIT License" unambiguously; forks and code reuse are frictionless.
- Custom assets are protected from their first commit with no change to `LICENSE`.
- CC BY attribution is satisfied mechanically by `CREDITS.md`, and the credits screen cannot
  drift from it (rule 7).

Negative:

- Two licence surfaces instead of one, hence the mandatory README section.
- `CREDITS.md` is a maintenance obligation: a forgotten entry is a licence violation for CC BY
  material, not a cosmetic omission.

Follow-ups:

- **PR checklist item** (pull-request template, added with the vertical slice): "If this PR adds,
  replaces or modifies a file under `public/assets/`, `CREDITS.md` has a matching entry with an
  SPDX identifier and a `Modifications` line." Code review refuses an asset PR without it.
- **Contributor asset PRs need an explicit licence statement** in the description (own work under
  which licence, or third-party source and licence). No statement, no merge. Recorded in
  `CONTRIBUTING.md` when written (contribution workflow belongs to ADR-0004).
- **Test implied** (domain suite, ADR-0003): one unit test asserting that every `public/assets/`
  file matches a `CREDITS.md` entry and that every entry's licence is an accepted SPDX identifier
  or "All rights reserved". It fails the build on an uncredited asset; only the file-system
  boundary is mocked.
- **Unaffected**: the public-release checklist (the switch precedes any asset) and ADR-0006
  (`localStorage` content is player data, not an asset).

## References

- GDD §1.2 (goals), §3.2 (CC0 placeholders then custom assets), §9.5 (chiptune credited in
  `CREDITS.md`), §9.6 (message catalogue), §11.1 (credits screen in 1.0), §11.2 (custom art and
  music in 1.x), Decision record rows "Art" and "Audio".
- The MIT License, Open Source Initiative — https://opensource.org/license/mit
- Creative Commons Attribution 4.0 International, legal code, section 3(a) —
  https://creativecommons.org/licenses/by/4.0/legalcode
- CC0 1.0 Universal — https://creativecommons.org/publicdomain/zero/1.0/
- GNU General Public License v3.0 — https://www.gnu.org/licenses/gpl-3.0.html
- SPDX License List (`MIT`, `CC0-1.0`, `CC-BY-4.0`, `GPL-3.0-only`) — https://spdx.org/licenses/
- GitHub Docs, "Licensing a repository" —
  https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository
- Related ADRs: ADR-0001 (rendering), ADR-0002 (timestep, determinism, performance), ADR-0003
  (architecture and tests), ADR-0004 (delivery), ADR-0006 (player data).
