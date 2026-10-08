# Project Log — retro-shmup

Reverse-chronological operational logbook (most recent first). It complements `git log` with the
human context: what was done, why, and by which PR. Not the release changelog (see
[CHANGELOG.md](CHANGELOG.md)).

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
