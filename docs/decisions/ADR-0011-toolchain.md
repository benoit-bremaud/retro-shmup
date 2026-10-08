# ADR-0011: Toolchain — pnpm, Vite, TypeScript 6, Vitest, ESLint, local quality hooks

**Status:** Accepted — 2026-10-08

## Context

- The vertical slice starts the code. ADR-0003 names Vitest and Playwright; ADR-0007 fixes a
  local-first quality gate (husky hooks, local SonarQube) and a light CI; CONTRIBUTING.md names
  pnpm and Node 22 LTS. The remaining tools and their versions were open.
- Versions checked on 2026-10-08 (npm registry, Context7 documentation): Vite 8.3, Vitest 5.0,
  ESLint 10.12, typescript-eslint 8.71, TypeScript 7.0 (latest) and 6.0.3 (latest 6.x), Prettier
  3.9, husky 9.1, lint-staged 17.6, commitlint 21.2. Vite 8 requires Node ≥ 20.19 or ≥ 22.12.
- **typescript-eslint 8.71 declares `typescript >=4.8.4 <6.1.0` as its peer range**: TypeScript 7
  (the native compiler) is not supported by the type-aware lint rules yet.

## Decision

| Concern | Tool | Notes |
|---|---|---|
| Package manager | pnpm 10 (`packageManager` field) | lockfile committed, `--frozen-lockfile` in CI; pnpm 10 does not run dependencies' install scripts unless allowed (supply chain) |
| Runtime | Node 22 LTS (`.nvmrc`, `engines >= 22.12`) | Vite 8 minimum |
| Language | TypeScript **~6.0.3**, strict plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` | pinned below 6.1 for typescript-eslint; Dependabot ignores TypeScript minor and major bumps until supported |
| Domain boundary | `tsconfig.domain.json` (no `DOM` lib) + ESLint `no-restricted-globals`, `no-restricted-properties` (`Date.now`, `Math.random`), `no-restricted-imports` | enforces ADR-0002 / ADR-0003 mechanically |
| Bundler, dev server | Vite 8 | `base` from `VITE_BASE_URL` (ADR-0004, ADR-0008) |
| Tests | Vitest 5, Node environment, V8 coverage (`text`, `lcov`) | lcov feeds SonarQube; Playwright arrives with the smoke test |
| Lint | ESLint 10 flat config, `typescript-eslint` `strictTypeChecked` + `stylisticTypeChecked`, named exports only, security bans (`no-eval`, `no-new-func`, `no-script-url`, HTML sinks) | `defineConfig` (the `tseslint.config` helper is deprecated); security rules map to the owner's security policy INJ-3/INJ-4 |
| Format | Prettier 3 on code and configuration | Markdown excluded: documentation keeps its hand-aligned tables |
| Hooks | husky 9: `pre-commit` (gitleaks on staged changes, lint-staged), `commit-msg` (commitlint, project scopes), `pre-push` (`make verify`) | ADR-0007 |
| Local gate | `make verify` = typecheck, lint, format check, tests with coverage, gitleaks, `pnpm audit --audit-level high`, SonarQube scan with quality-gate wait and the package version | token in `~/.config/sonar-tokens/retro-shmup`, never in the repository |
| CI | `ci.yml` "Lint, typecheck, test" + the security workflows (Gitleaks, CodeQL, Dependency Review; OSSF Scorecard weekly and on `main`, non-blocking) | no coverage upload, no Sonar (ADR-0007) |

## Alternatives considered

- **TypeScript 7** — rejected for now: outside typescript-eslint's supported range, so the
  strict type-aware rules would run on an unsupported compiler. Revisit when typescript-eslint
  widens its peer range.
- **npm or Yarn** — rejected: pnpm is the documented choice (CONTRIBUTING.md), faster installs, a
  strict `node_modules` layout that surfaces undeclared dependencies.
- **Jest** — rejected: Vitest shares Vite's transform pipeline and needs no separate TypeScript
  setup (ADR-0003 already names it).
- **Biome instead of ESLint + Prettier** — rejected: no equivalent of typescript-eslint's
  type-aware rules (`strictTypeChecked`), which carry most of the value for a strict domain.
- **Prettier on Markdown** — rejected: it would realign every table of the GDD and the ADRs.

## Consequences

- The architecture rules are enforced by the compiler and the linter, not only by review.
- A TypeScript upgrade is a deliberate change: check typescript-eslint's peer range, then lift
  the Dependabot ignore in the same PR.
- The pre-push hook needs the local SonarQube running and its token file; CONTRIBUTING.md
  documents the one-time setup and the `--no-verify` exception of ADR-0007.

## References

- ADR-0002, ADR-0003, ADR-0004, ADR-0007, ADR-0008; CONTRIBUTING.md.
- typescript-eslint, supported TypeScript versions:
  https://typescript-eslint.io/users/dependency-versions
- Vite, Node.js support: https://vite.dev/guide/
- husky: https://typicode.github.io/husky/
