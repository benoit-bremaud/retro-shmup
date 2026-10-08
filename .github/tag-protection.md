# Tag protection — release tags `v*`

Release tags are immutable once created: a GitHub repository ruleset on
`refs/tags/v*` blocks `creation`, `update` and `deletion` (admin bypass only). This file documents the ruleset
and the exact commands; the configuration itself lives on GitHub.

## Tag pattern

- `v*` — strict semver with the `v` prefix (`v0.1.0`, `v1.0.0`, `v1.0.1-rc1`).
  A single package, so one tag is one release. Tags are cut from `main` only,
  after the release PR has merged, and via the CLI
  (`git tag -s vX.Y.Z && git push origin vX.Y.Z`), never from the web UI.

## Ruleset policy

- Rules: **`creation`**, **`update`**, **`deletion`** — blocked
- Enforcement: `active`
- Bypass: `RepositoryRole: Admin` (`actor_id: 5`), mode `always` — the owner
  keeps routine-release rights and an emergency escape hatch

Per the cross-project release convention, the admin bypass is the only way to
create, move or delete a `v*` tag. Release automation (release-please, with the
vertical slice) runs with the owner's credentials and therefore inherits the
bypass; if it ever moves to a GitHub App, the App is added to `bypass_actors`
in the same PR. A failed publish keeps its tag as an audit marker; the next
attempt bumps the number, never reuses it.

## Apply (one-time, by owner)

```bash
gh api repos/benoit-bremaud/retro-shmup/rulesets \
  --method POST \
  --input - <<'EOF'
{
  "name": "Protect release tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/tags/v*"],
      "exclude": []
    }
  },
  "rules": [
    { "type": "creation" },
    { "type": "update" },
    { "type": "deletion" }
  ],
  "bypass_actors": [
    {
      "actor_id": 5,
      "actor_type": "RepositoryRole",
      "bypass_mode": "always"
    }
  ]
}
EOF
```

## Verify

```bash
gh api repos/benoit-bremaud/retro-shmup/rulesets \
  --jq '.[] | select(.target=="tag") | {id, name, enforcement}'
```

Expected:

```json
{
  "id": <ruleset-id>,
  "name": "Protect release tags",
  "enforcement": "active"
}
```

To inspect the rules and the bypass actors of the ruleset:

```bash
gh api repos/benoit-bremaud/retro-shmup/rulesets/<ruleset-id> \
  --jq '{rules: [.rules[].type], bypass: .bypass_actors, refs: .conditions.ref_name.include}'
```

## Remove (emergency only)

```bash
RULESET_ID=$(gh api repos/benoit-bremaud/retro-shmup/rulesets \
  --jq '.[] | select(.name=="Protect release tags") | .id')

gh api "repos/benoit-bremaud/retro-shmup/rulesets/$RULESET_ID" \
  --method DELETE
```

Re-apply immediately after the emergency; log the reason in `PROJECT_LOG.md`.

## Signing

Tag signing is configured locally with an **SSH** key
(`gpg.format = ssh`, `tag.gpgsign = true`, `user.signingkey` pointing to the
owner's ed25519 public key), so every `git tag` is signed by default.

GitHub shows a tag as `Verified` only if the same public key is registered on
the account as a **signing key** (Settings → SSH and GPG keys → New SSH key →
key type *Signing Key*; an authentication key does not count). This
registration is part of the public-release checklist: it must be done
**before the repository goes public**, so that the first release tag is
`Verified` on day one.
