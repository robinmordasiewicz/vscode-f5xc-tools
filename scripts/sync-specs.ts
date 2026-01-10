// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * API Spec Sync Script
 *
 * Downloads and extracts the latest F5 XC API specifications from upstream.
 *
 * Usage:
 *   npx ts-node scripts/sync-specs.ts
 *   npx ts-node scripts/sync-specs.ts --force    # Force sync even if up-to-date
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { execSync } from 'child_process';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SPECS_DIR = path.join(PROJECT_ROOT, 'docs/specifications/api');
const UPSTREAM_REPO = 'robinmordasiewicz/f5xc-api-enriched';

interface GitHubRelease {
  tag_name: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

/**
 * Fetch latest release info from GitHub API
 */
async function fetchLatestRelease(): Promise<GitHubRelease> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      'User-Agent': 'vscode-f5xc-tools',
      Accept: 'application/vnd.github.v3+json',
    };

    // Use GH_TOKEN or GITHUB_TOKEN if available (for CI rate limits)
    const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${UPSTREAM_REPO}/releases/latest`,
      method: 'GET',
      headers,
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
 * Download file from URL to destination
 */
async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    const request = (downloadUrl: string): void => {
      https
        .get(downloadUrl, (response) => {
          // Handle redirects
          if (response.statusCode === 302 || response.statusCode === 301) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              request(redirectUrl);
              return;
            }
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Download failed with status ${response.statusCode}`));
            return;
          }

          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err) => {
          fs.unlink(dest, () => {
            /* ignore */
          });
          reject(err);
        });
    };

    request(url);
  });
}

/**
 * Extract zip file using system unzip command
 */
function extractZip(zipPath: string, destDir: string): void {
  // Ensure destination exists
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Use unzip command (available on macOS, Linux, and Windows with Git Bash)
  try {
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'pipe' });
  } catch (error) {
    throw new Error(
      `Failed to extract zip: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Copy extracted specs to the specs directory
 */
function copySpecs(extractDir: string): void {
  const files = fs.readdirSync(extractDir);

  // Find and copy JSON files
  for (const file of files) {
    const srcPath = path.join(extractDir, file);
    const stat = fs.statSync(srcPath);

    if (stat.isFile() && file.endsWith('.json')) {
      const destPath = path.join(SPECS_DIR, file);
      fs.copyFileSync(srcPath, destPath);
      console.log(`  Copied: ${file}`);
    } else if (stat.isDirectory() && file === 'domains') {
      // Copy domains directory
      const domainsDir = path.join(SPECS_DIR, 'domains');
      if (!fs.existsSync(domainsDir)) {
        fs.mkdirSync(domainsDir, { recursive: true });
      }
      const domainFiles = fs.readdirSync(srcPath);
      for (const domainFile of domainFiles) {
        if (domainFile.endsWith('.json')) {
          fs.copyFileSync(path.join(srcPath, domainFile), path.join(domainsDir, domainFile));
        }
      }
      console.log(`  Copied: domains/ (${domainFiles.length} files)`);
    }
  }
}

/**
 * Convert openapi.json to openapi.yaml
 */
function generateYaml(): void {
  try {
    const openapiPath = path.join(SPECS_DIR, 'openapi.json');
    const yamlPath = path.join(SPECS_DIR, 'openapi.yaml');

    if (!fs.existsSync(openapiPath)) {
      console.log('  Skipping YAML generation (no openapi.json)');
      return;
    }

    // Use dynamic import for yaml package
    const yaml = require('yaml') as { stringify: (obj: unknown) => string };
    const content = fs.readFileSync(openapiPath, 'utf-8');
    const json = JSON.parse(content) as unknown;
    const yamlContent = yaml.stringify(json);
    fs.writeFileSync(yamlPath, yamlContent);
    console.log('  Generated: openapi.yaml');
  } catch {
    console.log('  Skipping YAML generation (yaml package not available)');
  }
}

/**
 * Clean up temporary files
 */
function cleanup(tempDir: string, zipPath: string): void {
  try {
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Main sync function
 */
async function syncSpecs(): Promise<void> {
  console.log('🔄 Fetching latest release info...');

  const release = await fetchLatestRelease();
  const version = release.tag_name.replace(/^v/, '');
  console.log(`📦 Latest version: ${version}`);

  // Find zip asset
  const zipAsset = release.assets.find((a) => a.name.endsWith('.zip'));
  if (!zipAsset) {
    throw new Error('No zip asset found in latest release');
  }

  const tempDir = path.join(PROJECT_ROOT, '.specs-temp');
  const zipPath = path.join(tempDir, 'specs.zip');
  const extractDir = path.join(tempDir, 'extracted');

  try {
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Download zip
    console.log('⬇️  Downloading specs...');
    await downloadFile(zipAsset.browser_download_url, zipPath);

    // Extract
    console.log('📂 Extracting...');
    extractZip(zipPath, extractDir);

    // Ensure specs directory exists
    if (!fs.existsSync(SPECS_DIR)) {
      fs.mkdirSync(SPECS_DIR, { recursive: true });
    }

    // Copy files
    console.log('📋 Copying specs...');
    copySpecs(extractDir);

    // Generate YAML
    generateYaml();

    console.log(`✅ Specs synced to version ${version}`);
  } finally {
    // Cleanup
    cleanup(tempDir, zipPath);
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const showHelp = args.includes('--help') || args.includes('-h');

  if (showHelp) {
    console.log(`
F5 XC API Spec Sync

Downloads and extracts the latest API specifications from upstream.

Usage:
  npx ts-node scripts/sync-specs.ts [options]

Options:
  --force   Force sync even if already up-to-date
  --help    Show this help message

The specs are downloaded from: https://github.com/${UPSTREAM_REPO}
`);
    return;
  }

  await syncSpecs();
}

main().catch((error: unknown) => {
  console.error('❌ Sync failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
