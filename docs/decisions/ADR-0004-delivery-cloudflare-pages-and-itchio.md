# ADR-0004: Delivery: Cloudflare Pages for previews and production, itch.io for releases

**Status:** Accepted — 2026-10-07

## Context

The game is a static web build: TypeScript compiled to a bundle plus assets, no server, no
backend in 1.0 (GDD §11.4, ADR-0006). In the owner's cross-project environments convention this is
profile A ("static"): the tier chain is `local -> staging -> prod`, `staging` is the ephemeral PR
preview rather than a long-lived branch, there is no `qa` tier, and an environment carries nothing
more than a base URL and a build target. The `.env` surface is therefore almost empty.

Forces that shape the decision:

- **Playtesting is the design loop.** Every *(initial)* tuning value in the GDD (§4, §5, §6, §8)
  is validated in playtests from the vertical slice onwards (GDD §14, question 3). A playtest
  needs a URL that can be opened on a phone — the performance target is 60 fps on a 2019
  mid-range phone (GDD §13) — before the change is merged. A per-PR preview URL is the cheapest
  way to obtain one.
- **Repository visibility.** The repository starts private on a GitHub Free plan and is switched
  to public the same day, once the public-release checklist passes (CLAUDE.md, PROJECT_LOG
  2026-10-07). The delivery pipeline must not depend on a feature that the Free plan withholds
  from private repositories.
- **Existing accounts.** The owner already operates on Cloudflare; adding a second hosting
  provider for previews would add an account, a dashboard and a secret to rotate for no gain.
- **Publication target.** 1.0 ships on itch.io as a web (HTML5) build (GDD, header table and
  §11.1). itch.io is the storefront, not the playtest host: uploads there are releases.
- **GitOps by default.** The convention merges to `main` and lets the platform deploy; releases
  are `vMAJOR.MINOR.PATCH` tags cut from `main` after the release PR merges (release-strategy
  convention, `release-tag` skill).
- **Keep it simple first.** The inception decision defers all application tooling to the vertical
  slice, one PR per brick (PROJECT_LOG 2026-10-07). This ADR fixes the target; it does not wire it.

## Decision

Three tiers, one hosting platform for the web build, one storefront for releases:

| Tier | Where | Trigger |
|---|---|---|
| `local` | Vite dev server on the developer machine | `pnpm dev` |
| `staging` | Cloudflare Pages **preview deployment** | every pull request (automatic) |
| `prod` | Cloudflare Pages **production deployment** | merge to `main` (automatic, GitOps) |
| release | itch.io, channel `html5` | push of a tag `v*.*.*` on `main` (GitHub Actions + butler) |

Rules:

1. **Cloudflare Pages is connected to the repository through the Cloudflare Workers & Pages
   GitHub App**, production branch `main`. Pages creates a unique preview URL per pull request
   (hash-based `<hash>.<project>.pages.dev`, plus a branch alias) and keeps it updated on every
   push to the branch; the production URL is unaffected by previews. The preview URL is the
   playtest URL quoted in the PR description.
2. **No deploy step lives in the repository for Pages.** The GitHub App builds and deploys;
   the CI workflows only gate the merge (tests and security baseline, ADR-0003, `security-ci-baseline`).
3. **Releases go to itch.io with butler**, from a dedicated workflow triggered by tag push:

   ```yaml
   on:
     push:
       tags: ["v*.*.*"]
   ```

   The job builds the bundle, downloads butler from its automation-friendly, permanent URL
   (`https://broth.itch.zone/butler/linux-amd64/LATEST/archive/default`), and runs
   `butler push <build-dir> <itch-user>/<game>:html5 --userversion <version>`, where
   `<version>` is the tag without its `v` prefix. The channel name `html5` is an internal
   convention; butler derives platform tags only from `win`/`linux`/`mac`/`android` substrings,
   so the "HTML5 / Playable in browser" flag is set once, by hand, on the itch.io *Edit game* page
   after the first push, together with the page kind "HTML".
4. **The butler API key is a GitHub Actions secret** named `BUTLER_API_KEY`, the variable name
   butler reads in CI. It is never committed, never printed, and is revoked and reissued if it
   ever appears in a log. Only the release workflow receives it.
5. **Base URL.** The bundle must load from the root of a Pages origin and from itch.io's embedded
   player, so assets are referenced relative to the page. `.env.example` lists at most
   `VITE_BASE_URL`, with a placeholder; no other variable is foreseen for 1.0.
6. **Wiring is deferred** to the vertical slice: Vite, the Pages project, and the release workflow
   each arrive in their own PR (PROJECT_LOG 2026-10-07, "keep it simple first").

## Alternatives considered

- **GitHub Pages** — rejected because GitHub Free includes "GitHub Pages in public repositories"
  only, and publishing a Pages site from a private repository requires an organization on GitHub
  Enterprise Cloud (GitHub plans documentation); a pipeline that only starts working after the
  repository goes public would leave the private phase without any preview. GitHub Pages also has
  no native per-PR preview — it needs a custom action publishing to a per-PR path — and project
  sites are served under `<owner>.github.io/<repository>`, the base-URL pitfall that the
  environments convention flags as the first static-site footgun. Faithful to the GDD Decision
  record ("no private-repo Pages on Free plan, no native PR previews").
- **itch.io only** — rejected because it offers no intermediate playtest URL per change: every
  playtest would be a manual upload that overwrites the public page, and feedback could not be
  tied to a pull request.

## Consequences

Positive:

- Every PR ships its own playable URL at no cost in workflow code; playtest feedback is attached
  to the change that caused it.
- Production tracks `main` with no manual step; releases are reproducible from a tag and the
  itch.io build list carries the exact version via `--userversion`.
- The repository holds one secret (the butler key) and it is scoped to one workflow.

Negative and follow-ups:

- A Cloudflare Pages project must be created and connected when the slice exists; its name is
  the public `<project>.pages.dev` hostname and should be chosen with the still-open commercial
  title in mind (GDD §14, question 1). The itch.io `<itch-user>/<game>` target has the same
  dependency.
- Preview URLs are not generated for pull requests from forks; irrelevant for a solo developer,
  to be revisited if external contributions appear.
- `localStorage` is per origin (ADR-0006): high scores and options saved on one preview URL do not
  exist on the next, nor on production or itch.io. Tests must never assume persisted data.
- Code review must check: the release workflow pins actions by full commit SHA (ci-baseline
  convention); the butler key is referenced only through `secrets.BUTLER_API_KEY`; the tag
  filter matches `vMAJOR.MINOR.PATCH` only; the build runs the test suite before pushing.
- Tests implied: the browser smoke test (ADR-0003) runs against the built bundle served from a
  non-root path to prove that asset references are relative; one dry-run of the release workflow
  (`workflow_dispatch`, no push) validates the butler download and command line before the first
  tag.
- Licensing of the bundled assets is visible on the itch.io page and in `CREDITS.md` (ADR-0005).

## References

- Environments convention — `~/.claude/skills/environments/SKILL.md` (profile A; staging =
  PR preview; Cloudflare Pages mapping; `.env.example` rules).
- GitHub, *GitHub's plans* — https://docs.github.com/en/get-started/learning-about-github/githubs-plans
  ("GitHub Pages in public repositories" under GitHub Free; private publication requires GitHub
  Enterprise Cloud).
- GitHub, *About GitHub Pages* — https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages
  (project-site URL `<owner>.github.io/<repository>`).
- Cloudflare, *Preview deployments* — https://developers.cloudflare.com/pages/configuration/preview-deployments/
- Cloudflare, *GitHub integration* — https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
- itch.io, *butler: pushing builds* — https://itch.io/docs/butler/pushing.html (command syntax,
  channel-name tagging rules, HTML5 flag set from the Edit game page, `--userversion`).
- itch.io, *butler: logging in* — https://itch.io/docs/butler/login.html (`BUTLER_API_KEY` for CI,
  key revocation).
- itch.io, *butler: installing* — https://itch.io/docs/butler/installing.html (broth permanent URL).
- Owner conventions — `project-templates/docs/conventions/release-strategy.md` (tag format,
  cut from `main`), `ci-baseline.md` (SHA-pinned actions), `security.md` (public-release checklist).
- GDD §11.1 (GitOps deployment in 1.0 scope), §13 (Delivery row), §14, Decision record
  ("Deployment" row). Related ADRs: ADR-0003 (CI gate), ADR-0005 (asset licences), ADR-0006
  (per-origin `localStorage`).
