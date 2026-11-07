# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| `main` (HEAD) | Yes |
| Anything else | No |

Only the current state of `main` receives security fixes. Tagged releases are snapshots; a fix
ships as a new release from `main`.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Use GitHub's private vulnerability reporting: on the repository page, open the **Security** tab
and click **Report a vulnerability**. The report is visible only to the repository owner, who
enables this feature in the repository settings. Include:

- a description of the vulnerability and its potential impact;
- steps to reproduce, or a proof of concept;
- the commit or release where you observed it.

You will receive an acknowledgment within **72 hours**. A fix is prioritised by severity and
disclosed through a GitHub security advisory once released.

## Security practices

- **Secret detection** — gitleaks runs on every commit (staged files), on every push (full
  history) and every night, with TruffleHog nightly (ADR-0029). Any finding fails the tier; there
  is no advisory mode for secrets.
- **Static analysis and dependencies** — Semgrep Community Edition and `pnpm audit` (high and
  above) run before every push; no GitHub workflow runs, so there is no Action to pin.
- **Attested merges** — `main` requires the `gate` status, written only by `just gate` together
  with an SSH-signed note on the exact head SHA (`.github/allowed_signers`).
- **Dependency monitoring** — Dependabot alerts and update PRs are enabled for the repository.
- **No backend, no personal data** — version 1.0 is a static web game with no server, no account
  and no network call. Player data (options and the local top 10) stays in the browser's
  `localStorage` and holds nothing personal beyond three-letter initials (ADR-0006).
- **No secrets in the repository** — the only credential the project uses is the itch.io butler
  key (`BUTLER_API_KEY`, ADR-0004), not provisioned until the first itch.io release; Cloudflare
  Pages deploys through its GitHub App with no repository-held credential and no GitHub Actions
  secret exists. `.env.example` holds placeholders only; real dotenv files are gitignored.

Thank you for helping keep the project secure.
