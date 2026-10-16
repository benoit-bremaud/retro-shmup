# Local review — retro-shmup (branch feat/version-label, version label code)

- Date: 2026-10-16
- Scope: branch diff `origin/main...HEAD` (vite.config.ts, src/app/version-label.ts, build-constants.d.ts, main.ts, index.html, style.css, test, QA screenshots)
- Checks run: design · security · correctness · tests (architecture-guardian, full scope) · `make verify` · `make smoke` · QA
- Verdict: ship · Must 0 · Should 1 (fixed) · Nice 3 (fixed)

## Pre-merge gate
| Step | Result |
|---|---|
| 1 Tests | ✅ Vitest (1305) · ✅ `make smoke` (Playwright, 2 projects) |
| 2 Coverage | 99.27 % stmts / 95.67 % branches / 100 % funcs / 99.9 % lines (ratchet kept) · docs 100 % |
| 3 SonarQube | ✅ PASSED (`make verify`, pre-push) |
| 4 Secrets | ✅ gitleaks clean · no tracked .env · diff read: nothing sensitive (public SHA only) |
| 5 QA pass | ✅ `vite preview` build, label `v0.0.0+<sha>` bottom-right, `pointer-events: none`, console clean · screenshots `qa/2026-10-16-version-label-{portrait,landscape}.png` |

## Fixed
- Should: UML `Main` listed a `showVersion` operation that the code does inline → diagram aligned.
- Nice: 40-char SHA test; build fails if package.json has no version; git stderr silenced.

## Disagree / Intentional
- `versionLabel` in `src/app/` (build metadata, not a game rule); full SHA in bundle, cut at run time (public repo); missing `#version` never stops the game.
