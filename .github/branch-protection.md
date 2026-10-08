# Branch protection — `main`

`main` only moves through pull requests with green checks. This file documents
the protection to apply and the exact commands; the configuration itself lives
on GitHub, not in the repository.

## Policy

| Setting | Value |
|---|---|
| Require a pull request before merging | yes |
| Required status checks | `Secret scan` (the Gitleaks job in [`workflows/gitleaks.yml`](workflows/gitleaks.yml)), branch up to date before merge (`strict`) |
| Required approving reviews | see below |
| Dismiss stale approvals on new commits | yes |
| Apply to administrators (`enforce_admins`) | yes — the owner is bound by the gate he can satisfy |
| Force push | blocked |
| Branch deletion | blocked |
| Push restrictions | none (solo repository) |

The required check name is the job `name` in the workflow, `Secret scan`, not
the workflow name `Gitleaks`. Renaming the job means re-applying the
protection.

Checks that arrive later (lint, typecheck, unit tests and headless simulation
with the vertical slice; CodeQL and Dependency review once activated) are
appended to `checks` in their own PR.

### Required reviews: 0 now, 1 once a reviewer bot exists

The cross-project convention is 1 required review. On this repository there is
one human and, for now, no reviewer bot: with `required_approving_review_count`
at 1 every PR would be unmergeable without an admin bypass, and a gate that is
bypassed on every merge is worse than none.

- **Recommended default (now): `0`.** A PR is still mandatory, `Secret scan`
  must be green, and the local pre-push review gate runs before every push.
- **Switch to `1`** as soon as a reviewer bot (Copilot or Codex) is configured
  and counts as an approval. Only the count changes; re-run the apply command.

### When to apply

Per the GitHub documentation, protected branches are available on a private
repository only with GitHub Pro or higher; on GitHub Free they are available
in public repositories. The owner's account is on GitHub Free, so the `PUT`
below is refused while the repository is private. Apply it immediately after
the switch to public (same day per the project log), then verify.

## Apply (one-time, by owner)

Recommended default (0 required approvals):

```bash
gh api repos/benoit-bremaud/retro-shmup/branches/main/protection \
  --method PUT \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "Secret scan" }
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

With a reviewer bot (1 required approval) — same body, one value changed:

```bash
gh api repos/benoit-bremaud/retro-shmup/branches/main/protection \
  --method PUT \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "Secret scan" }
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF
```

Notes on the request body (REST API, `2022-11-28`):

- `required_status_checks`, `enforce_admins`, `required_pull_request_reviews`
  and `restrictions` are mandatory keys of this endpoint (each nullable), which
  is why `restrictions` is sent explicitly as `null`.
- `checks[].context` is the current field for a required check; the older
  `contexts` string array carries a closing-down notice in the documentation.
  `app_id` is omitted so GitHub accepts the check from whichever app last
  reported it (GitHub Actions here).

## Verify

```bash
gh api repos/benoit-bremaud/retro-shmup/branches/main/protection \
  --jq '{
    checks: [.required_status_checks.checks[].context],
    strict: .required_status_checks.strict,
    reviews: .required_pull_request_reviews.required_approving_review_count,
    admins: .enforce_admins.enabled,
    force_push: .allow_force_pushes.enabled,
    deletion: .allow_deletions.enabled
  }'
```

Expected:

```json
{
  "checks": ["Secret scan"],
  "strict": true,
  "reviews": 0,
  "admins": true,
  "force_push": false,
  "deletion": false
}
```

(`"reviews": 1` once the bot-reviewer variant is applied.)

## Remove (emergency only)

```bash
gh api repos/benoit-bremaud/retro-shmup/branches/main/protection \
  --method DELETE
```

Re-apply immediately after the emergency; log the reason in `PROJECT_LOG.md`.
