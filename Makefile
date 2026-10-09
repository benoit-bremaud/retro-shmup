# Local quality gate (ADR-0007). `make verify` is the pre-push hook.
SONAR_TOKEN_FILE := $(HOME)/.config/sonar-tokens/retro-shmup
SONAR_URL := http://localhost:9000

.PHONY: verify check secrets audit sonar-scan smoke

verify: check secrets audit sonar-scan

check:
	pnpm typecheck
	pnpm lint
	pnpm format:check
	pnpm test:coverage

secrets:
	gitleaks git --redact --no-banner

audit:
	pnpm audit --audit-level high

sonar-scan:
	@test -s "$(SONAR_TOKEN_FILE)" || { echo "Missing $(SONAR_TOKEN_FILE) — see CONTRIBUTING.md (SonarQube token)."; exit 1; }
	@curl -sf -m 5 "$(SONAR_URL)/api/system/status" | grep -q '"status":"UP"' || { echo "SonarQube is not UP at $(SONAR_URL) — start it, or push with --no-verify after the rest of make verify passed (ADR-0007)."; exit 1; }
	@SONAR_TOKEN="$$(cat "$(SONAR_TOKEN_FILE)")" sonar-scanner -Dsonar.host.url="$(SONAR_URL)" -Dsonar.projectVersion="$$(node -p "require('./package.json').version")"

# The single browser smoke test (ADR-0003), run by hand, not part of verify (ADR-0007).
# One-time setup: pnpm exec playwright install chromium
smoke:
	pnpm test:smoke
