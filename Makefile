# Local quality gate (ADR-0007). `make verify` is the pre-push hook.
SONAR_TOKEN_FILE := $(HOME)/.config/sonar-tokens/retro-shmup
SONAR_URL := http://localhost:9000

.PHONY: verify check doc-coverage secrets audit sonar-scan smoke

verify: check secrets audit sonar-scan

check:
	pnpm typecheck
	pnpm lint
	pnpm knip
	pnpm format:check
	pnpm test:coverage
	$(MAKE) --no-print-directory doc-coverage

# Documentation coverage: exports of src/ preceded by a doc block, floor 90 % (owner rule
# 2026-10-16). Companion `type X = (typeof X)[keyof typeof X]` lines and re-exports are not
# counted: the const's doc is theirs.
doc-coverage:
	@git ls-files 'src/**/*.ts' | xargs awk ' \
	  /^export (type [A-Za-z]+ = \(typeof|\{)/ { next } \
	  /^export / { total++; if (prev !~ /\*\/[[:space:]]*$$/) missing++ } \
	  !/^[[:space:]]*$$/ { prev = $$0 } \
	  END { pct = (total - missing) * 100 / total; \
	        printf "doc coverage: %d/%d exports documented (%.1f %%, floor 90)\n", total - missing, total, pct; \
	        exit (pct < 90) }'

secrets:
	gitleaks git --redact --no-banner

audit:
	pnpm audit --audit-level high

sonar-scan:
	@test -s "$(SONAR_TOKEN_FILE)" || { echo "Missing $(SONAR_TOKEN_FILE) — see CONTRIBUTING.md (SonarQube token)."; exit 1; }
	@curl -sf -m 5 "$(SONAR_URL)/api/system/status" | grep -q '"status":"UP"' || { echo "SonarQube is not UP at $(SONAR_URL) — start it, or push with --no-verify after the rest of make verify passed (ADR-0013)."; exit 1; }
	@SONAR_TOKEN="$$(cat "$(SONAR_TOKEN_FILE)")" sonar-scanner -Dsonar.host.url="$(SONAR_URL)" -Dsonar.projectVersion="$$(node -p "require('./package.json').version")"

# The single browser smoke test (ADR-0003) in Chromium, Firefox and WebKit (ADR-0026), run by
# hand, not part of verify (ADR-0007). Engines: pnpm exec playwright install chromium firefox webkit
smoke:
	pnpm test:smoke
