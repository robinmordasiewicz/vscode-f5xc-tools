/**
 * Version generation script for F5 XC Tools
 *
 * Generates version strings based on upstream API version and timestamp.
 *
 * Formats:
 * - Release: v{upstream}-YYMMDDHHMM (e.g., v1.0.77-2501011430)
 * - Beta/Local: v{upstream}-YYMMDDHHMM-BETA
 *
 * Usage:
 *   npx ts-node scripts/version.ts           # Output current version
 *   npx ts-node scripts/version.ts --beta    # Output beta version
 *   npx ts-node scripts/version.ts --update  # Update package.json
 *   npx ts-node scripts/version.ts --json    # Output JSON format
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OPENAPI_PATH = path.join(PROJECT_ROOT, 'docs/specifications/api/openapi.json');
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, 'package.json');

interface OpenApiInfo {
  info: {
    version: string;
  };
}

interface PackageJson {
  version: string;
  [key: string]: unknown;
}

interface VersionInfo {
  upstream: string;
  timestamp: string;
  version: string;
  betaVersion: string;
  semver: string;
}

/**
 * Get upstream API version from OpenAPI spec
 */
function getUpstreamVersion(): string {
  try {
    const content = fs.readFileSync(OPENAPI_PATH, 'utf-8');
    const spec = JSON.parse(content) as OpenApiInfo;
    const version = spec.info?.version;

    if (!version) {
      throw new Error('info.version not found in OpenAPI spec');
    }

    return version;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error reading OpenAPI spec: ${message}`);
    process.exit(1);
  }
}

/**
 * Generate timestamp in YYMMDDHHMM format (UTC)
 */
function generateTimestamp(): string {
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');

  return `${yy}${mm}${dd}${hh}${min}`;
}

/**
 * Convert to semver-compatible format for package.json
 * VSCode requires semver format: major.minor.patch
 * We use: upstream.timestamp where timestamp becomes the patch version
 */
function toSemver(upstream: string, timestamp: string): string {
  // upstream is like "1.0.77"
  // timestamp is like "2501011430"
  // Convert timestamp to a numeric patch version
  // Use the full timestamp as a build identifier isn't valid for VSCode
  // So we'll use the timestamp as a patch-like number

  const parts = upstream.split('.');
  if (parts.length < 2) {
    return `${upstream}.${timestamp}`;
  }

  // Use upstream major.minor and timestamp as extended patch
  // Format: major.minor.timestampNumber
  // e.g., 1.0.2501011430
  const major = parts[0];
  const minor = parts[1];

  return `${major}.${minor}.${timestamp}`;
}

/**
 * Generate all version information
 */
function generateVersionInfo(isBeta: boolean = false): VersionInfo {
  const upstream = getUpstreamVersion();
  const timestamp = generateTimestamp();
  const version = `${upstream}-${timestamp}`;
  const betaVersion = `${version}-BETA`;

  return {
    upstream,
    timestamp,
    version: isBeta ? betaVersion : version,
    betaVersion,
    semver: toSemver(upstream, timestamp),
  };
}

/**
 * Update package.json with new version
 */
function updatePackageJson(version: string): void {
  try {
    const content = fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8');
    const pkg = JSON.parse(content) as PackageJson;

    // For package.json, we need semver-compatible format
    // Extract just the numeric parts for semver
    const versionInfo = generateVersionInfo(version.includes('BETA'));
    pkg.version = versionInfo.semver;

    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    console.log(`Updated package.json version to: ${pkg.version}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error updating package.json: ${message}`);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
function main(): void {
  const args = process.argv.slice(2);
  const isBeta = args.includes('--beta');
  const shouldUpdate = args.includes('--update');
  const jsonOutput = args.includes('--json');
  const showHelp = args.includes('--help') || args.includes('-h');

  if (showHelp) {
    console.log(`
F5 XC Tools Version Generator

Usage:
  npx ts-node scripts/version.ts [options]

Options:
  --beta    Generate beta version (adds -BETA suffix)
  --update  Update package.json with generated version
  --json    Output in JSON format
  --help    Show this help message

Examples:
  npx ts-node scripts/version.ts           # Output: 1.0.77-2501011430
  npx ts-node scripts/version.ts --beta    # Output: 1.0.77-2501011430-BETA
  npx ts-node scripts/version.ts --update  # Updates package.json
`);
    return;
  }

  const info = generateVersionInfo(isBeta);

  if (shouldUpdate) {
    updatePackageJson(info.version);
    return;
  }

  if (jsonOutput) {
    console.log(JSON.stringify(info, null, 2));
  } else {
    console.log(info.version);
  }
}

main();
