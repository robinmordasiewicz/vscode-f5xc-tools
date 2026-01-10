// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * API Spec Freshness Check Script
 *
 * Checks if local F5 XC API specifications are up-to-date with upstream.
 * Can optionally auto-sync if outdated.
 *
 * Usage:
 *   npx ts-node scripts/check-specs.ts              # Check and exit with code 0/1
 *   npx ts-node scripts/check-specs.ts --check      # Same as default
 *   npx ts-node scripts/check-specs.ts --sync       # Auto-sync if outdated
 *   npx ts-node scripts/check-specs.ts --json       # Output JSON status
 *   npx ts-node scripts/check-specs.ts --warn       # Warn only, don't fail
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OPENAPI_PATH = path.join(PROJECT_ROOT, 'docs/specifications/api/openapi.json');
const UPSTREAM_REPO = 'robinmordasiewicz/f5xc-api-enriched';

interface SpecStatus {
  currentVersion: string;
  latestVersion: string;
  isUpToDate: boolean;
  upstreamUrl: string;
  error?: string;
}

interface GitHubRelease {
  tag_name: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
  html_url: string;
}

/**
 * Get current spec version from local openapi.json
 */
function getCurrentVersion(): string {
  try {
    if (!fs.existsSync(OPENAPI_PATH)) {
      return 'none';
    }
    const content = fs.readFileSync(OPENAPI_PATH, 'utf-8');
    const spec = JSON.parse(content) as { info?: { version?: string } };
    return spec.info?.version || 'unknown';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error reading local specs: ${message}`);
    return 'error';
  }
}

/**
 * Fetch latest release info from GitHub API
 */
async function fetchLatestRelease(): Promise<GitHubRelease> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${UPSTREAM_REPO}/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': 'vscode-f5xc-tools',
        Accept: 'application/vnd.github.v3+json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data) as GitHubRelease);
          } catch {
            reject(new Error('Failed to parse GitHub API response'));
          }
        } else if (res.statusCode === 404) {
          reject(new Error('No releases found in upstream repository'));
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Check spec freshness by comparing local and upstream versions
 */
async function checkSpecFreshness(): Promise<SpecStatus> {
  const currentVersion = getCurrentVersion();

  try {
    const release = await fetchLatestRelease();
    const latestVersion = release.tag_name.replace(/^v/, '');

    return {
      currentVersion,
      latestVersion,
      isUpToDate: currentVersion === latestVersion,
      upstreamUrl: release.html_url,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      currentVersion,
      latestVersion: 'unknown',
      isUpToDate: false,
      upstreamUrl: `https://github.com/${UPSTREAM_REPO}/releases/latest`,
      error: message,
    };
  }
}

/**
 * Run sync-specs script to update specs
 */
async function runSync(): Promise<boolean> {
  const { spawn } = await import('child_process');

  return new Promise((resolve) => {
    console.log('🔄 Syncing specs from upstream...');

    const child = spawn('npx', ['ts-node', path.join(__dirname, 'sync-specs.ts')], {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldSync = args.includes('--sync');
  const jsonOutput = args.includes('--json');
  const warnOnly = args.includes('--warn');
  const showHelp = args.includes('--help') || args.includes('-h');

  if (showHelp) {
    console.log(`
F5 XC API Spec Freshness Check

Usage:
  npx ts-node scripts/check-specs.ts [options]

Options:
  --check   Check freshness and exit with code 0 (up-to-date) or 1 (outdated)
  --sync    Auto-sync specs if outdated
  --json    Output status as JSON
  --warn    Print warning but exit with code 0 even if outdated
  --help    Show this help message

Examples:
  npx ts-node scripts/check-specs.ts              # Check and fail if outdated
  npx ts-node scripts/check-specs.ts --sync       # Auto-sync if outdated
  npx ts-node scripts/check-specs.ts --json       # Get JSON status
`);
    return;
  }

  const status = await checkSpecFreshness();

  if (jsonOutput) {
    console.log(JSON.stringify(status, null, 2));
    process.exit(status.isUpToDate ? 0 : 1);
  }

  if (status.error) {
    console.warn(`⚠️  Warning: ${status.error}`);
    console.log(`   Current version: ${status.currentVersion}`);
    console.log(`   Unable to check upstream version`);
    // Don't fail on network errors - allow build to proceed
    process.exit(0);
  }

  if (status.isUpToDate) {
    console.log(`✅ Specs are up-to-date (version ${status.currentVersion})`);
    process.exit(0);
  }

  // Specs are outdated
  console.log(`📦 Specs outdated: ${status.currentVersion} → ${status.latestVersion}`);

  if (shouldSync) {
    const success = await runSync();
    if (success) {
      console.log(`✅ Specs synced to version ${status.latestVersion}`);
      process.exit(0);
    } else {
      console.error('❌ Failed to sync specs');
      process.exit(1);
    }
  } else if (warnOnly) {
    console.warn(`⚠️  Warning: Specs are outdated. Run 'npm run specs:sync' to update.`);
    process.exit(0);
  } else {
    console.log(`   Run 'npm run specs:sync' to update`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error('Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
