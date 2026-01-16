# Automated API Specification Updates

This document describes the automated system for detecting and deploying F5
Distributed Cloud API specification updates.

## Overview

The extension automatically tracks upstream API specification releases and
triggers rebuilds when new versions are published.

**Upstream Source:**
[robinmordasiewicz/f5xc-api-enriched](https://github.com/robinmordasiewicz/f5xc-api-enriched)

## Architecture

### Ephemeral Generation Model

This project uses an ephemeral generation approach:

```text
┌─────────────────────────────────────────────────────────┐
│  Upstream: robinmordasiewicz/f5xc-api-enriched          │
│  - OpenAPI specs for F5 XC domains                      │
│  - Enriched with metadata and documentation             │
│  - Released as GitHub releases (e.g., v2.0.27)          │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Scheduled Check (Daily)
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Spec Update Check Workflow                             │
│  - Runs daily at 2 AM UTC                               │
│  - Compares local vs upstream versions                  │
│  - Creates commit if outdated                           │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Push to main (if update needed)
                     ▼
┌─────────────────────────────────────────────────────────┐
│  CI/CD Pipeline                                          │
│  1. Sync specs from upstream                            │
│  2. Generate TypeScript resource types                  │
│  3. Run validation and tests                            │
│  4. Build production VSIX                               │
│  5. Create GitHub release                               │
└─────────────────────────────────────────────────────────┘
```

### Why Specs Are Not Committed

**Specs and generated code are gitignored because:**

1. **Single Source of Truth:** Upstream repository is the authoritative source
2. **Build-Time Generation:** Code is generated fresh during CI/CD
3. **No Drift:** Ensures every build uses latest specs
4. **Smaller Repository:** No large spec files in git history
5. **Automatic Updates:** No manual spec update PRs needed

## Automated Workflow

### 1. Scheduled Check (`.github/workflows/spec-update-check.yml`)

**Trigger:** Daily at 2 AM UTC (configurable)

**Process:**

1. Fetches latest release from upstream repository
2. Compares with current local version (from last build)
3. If outdated:
   - Creates marker file `.github/spec-update-trigger`
   - Commits with descriptive message
   - Pushes to main
4. If up-to-date:
   - Logs status and exits

**Example Commit Message:**

```text
build: trigger rebuild for API spec v2.0.27

Detected new upstream API specification version.
- Previous: v2.0.21
- Latest: v2.0.27
- Upstream: https://github.com/robinmordasiewicz/f5xc-api-enriched/releases/tag/v2.0.27

This commit triggers the CI/CD pipeline to:
- Sync latest API specs from upstream
- Regenerate resource types and documentation
- Run full test suite
- Build and publish new VSIX package

Co-Authored-By: github-actions[bot] <github-actions[bot]@users.noreply.github.com>
```

### 2. CI/CD Pipeline (`.github/workflows/ci.yml`)

**Trigger:** Push to main (including automated spec update commits)

**Process:**

#### Validation Phase

1. **Sync Specs:** `npm run specs:ensure`
   - Downloads latest specs from upstream
   - Extracts to `docs/specifications/api/`

2. **Generate Code:** `npm run generate`
   - Parses 38+ domain OpenAPI specs
   - Generates TypeScript resource types
   - Creates domain categories and documentation URLs
   - Produces menu schema

3. **Verify Idempotency:**
   - Runs generation twice
   - Compares file hashes
   - Ensures deterministic output

#### Testing Phase

1. **Multi-Platform Tests:**
   - Ubuntu, macOS, Windows
   - Lint, type check, unit tests
   - Integration tests with VSCode

2. **Security Audit:**
   - `npm audit` for vulnerabilities
   - Dependency scanning

#### Build Phase

1. **Webpack Production Build:**
   - Bundles extension code
   - Minifies and tree-shakes
   - Generates source maps

2. **Package VSIX:**
   - Creates installable extension package
   - Uploads as artifact

#### Release Phase (Main branch only)

1. **Version Generation:**
   - Format: `2.YYMM.DDHHMMSS`
   - Example: `2.2601.161430` (2026-01-16 14:30)
   - Includes upstream spec version in metadata

2. **GitHub Release:**
   - Creates git tag
   - Publishes VSIX to GitHub Releases
   - Includes changelog and upstream version

3. **Marketplace Publish:**
   - Triggers release workflow
   - Publishes to VS Code Marketplace (if configured)

## Manual Operations

### Check Spec Status

```bash
npm run specs:status
```

**Output:**

```json
{
  "currentVersion": "2.0.21",
  "latestVersion": "2.0.27",
  "isUpToDate": false,
  "upstreamUrl": "https://github.com/robinmordasiewicz/f5xc-api-enriched/releases/tag/v2.0.27"
}
```

### Sync Specs Manually

```bash
npm run specs:sync
```

Downloads latest specs from upstream and extracts to `docs/specifications/api/`.

### Trigger Build Manually

```bash
# Via GitHub UI: Actions → CI → Run workflow

# Via GitHub CLI:
gh workflow run ci.yml
```

### Force Spec Update Check

```bash
# Via GitHub UI: Actions → API Spec Update Check → Run workflow

# Via GitHub CLI:
gh workflow run spec-update-check.yml
```

## Configuration

### Schedule Frequency

Edit `.github/workflows/spec-update-check.yml`:

```yaml
on:
  schedule:
    # Daily at 2 AM UTC
    - cron: '0 2 * * *'

    # Weekly on Monday at 3 AM UTC
    # - cron: '0 3 * * 1'

    # Twice daily at 2 AM and 2 PM UTC
    # - cron: '0 2,14 * * *'
```

### Upstream Repository

Edit `scripts/check-specs.ts`:

```typescript
const UPSTREAM_REPO = 'robinmordasiewicz/f5xc-api-enriched';
```

## Monitoring

### Workflow Status

**View recent runs:**

```bash
gh run list --workflow=spec-update-check.yml --limit 5
```

**Watch specific run:**

```bash
gh run watch <run-id>
```

### GitHub Actions Dashboard

Navigate to: `Actions` → `API Spec Update Check`

**Status indicators:**

- ✅ Green: Specs up-to-date or update deployed successfully
- 🟡 Yellow: Running
- ❌ Red: Check or deployment failed

### Notifications

**Configure in Repository Settings → Notifications:**

- Email on workflow failure
- Slack/Teams webhook integration
- GitHub mobile app notifications

## Troubleshooting

### Spec Check Fails

**Issue:** Workflow fails to check upstream version

**Common Causes:**

- GitHub API rate limit exceeded
- Upstream repository unavailable
- Network connectivity issues

**Solution:**

```bash
# Manual check with detailed output
npm run specs:status

# Check GitHub API rate limit
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit
```

### Build Fails After Spec Update

**Issue:** CI/CD pipeline fails after automated spec update

**Common Causes:**

- Breaking changes in upstream API
- New resource types missing metadata
- Test failures due to API changes

**Solution:**

1. Review failed workflow logs
2. Identify breaking changes
3. Update code to handle new API patterns
4. Run tests locally:

   ```bash
   npm run specs:sync
   npm run generate
   npm run test
   ```

### Validation Fails (Non-Deterministic Generation)

**Issue:** Idempotency check fails

**Cause:** Generated files differ between runs

**Solution:**

1. Check generator scripts for randomness
2. Ensure stable sorting/ordering
3. Fix timestamps or UUIDs in output
4. Test locally:

   ```bash
   npm run generate
   shasum -a 256 src/generated/*.ts > /tmp/hash1.txt
   npm run generate
   shasum -a 256 src/generated/*.ts > /tmp/hash2.txt
   diff /tmp/hash1.txt /tmp/hash2.txt
   ```

### Merge Conflicts

**Issue:** Automated commit conflicts with manual changes

**Rare but possible if:**

- Manual push happens during automated check
- Multiple spec updates detected simultaneously

**Solution:**

```bash
# Fetch latest
git fetch origin main

# Rebase if conflicts
git rebase origin/main

# Resolve conflicts
git add <resolved-files>
git rebase --continue
```

## Security

### Permissions

**Spec Update Check workflow requires:**

- `contents: write` - Create commits
- `actions: write` - Trigger workflows (if using workflow_dispatch)

### Secrets

**Required:**

- `GITHUB_TOKEN` - Automatically provided by GitHub Actions
- `RELEASE_PAT` - Personal Access Token for releases (if marketplace publishing
  enabled)

**Not required:**

- No API keys needed for upstream spec fetching (public GitHub releases)

### Safety Measures

1. **Conventional Commits:** All automated commits follow format
2. **Bot Attribution:** Commits clearly marked as bot-generated
3. **Idempotency Checks:** Ensures deterministic builds
4. **Test Suite:** Full validation before deployment
5. **Audit Trail:** All actions logged in GitHub Actions

## Metrics

### Current Statistics

**As of last check:**

- API Spec Version: 2.0.27
- Resource Types: 517
- Domains: 38
- Update Frequency: ~2 weeks average
- Build Time: ~10-15 minutes

### Historical

Track in GitHub Release notes:

```bash
gh release list --limit 10
```

## Future Enhancements

### Potential Improvements

1. **Slack Notifications:** Alert team on spec updates
2. **Regression Reports:** Automated diff summaries
3. **Rollback Mechanism:** Auto-revert on test failures
4. **Preview Releases:** Beta channel for spec updates
5. **Changelog Generation:** Auto-generate from spec changes

### Contributing

To enhance the automated update system:

1. Edit workflows in `.github/workflows/`
2. Update generator scripts in `scripts/`
3. Test locally before committing
4. Document changes in this file

## References

- [GitHub Actions Cron Syntax](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
- [Upstream API Specs](https://github.com/robinmordasiewicz/f5xc-api-enriched)
- [CI/CD Workflow](.github/workflows/ci.yml)
- [Spec Check Script](../scripts/check-specs.ts)
- [Spec Sync Script](../scripts/sync-specs.ts)
