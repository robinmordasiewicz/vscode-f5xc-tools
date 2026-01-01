/**
 * XDG Base Directory paths for cross-tool compatibility with f5xc-xcsh and f5xc-api-mcp
 *
 * Structure:
 *   ~/.config/xcsh/
 *   ├── active_profile     # Plain text: active profile name
 *   └── profiles/          # Profile JSON files
 *       ├── profile-1.json
 *       └── profile-2.json
 */

import * as path from 'path';
import * as os from 'os';

/** Application name for XDG directories - matches f5xc-xcsh */
const APP_NAME = 'xcsh';

/** File permissions: owner read/write only */
export const FILE_MODE = 0o600;

/** Directory permissions: owner read/write/execute only */
export const DIR_MODE = 0o700;

/**
 * Get the XDG config directory for xcsh
 * - Windows: %APPDATA%\xcsh
 * - Unix: $XDG_CONFIG_HOME/xcsh or ~/.config/xcsh
 */
export function getConfigDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (appData) {
      return path.join(appData, APP_NAME);
    }
    return path.join(os.homedir(), APP_NAME);
  }

  const xdgConfig = process.env.XDG_CONFIG_HOME;
  if (xdgConfig) {
    return path.join(xdgConfig, APP_NAME);
  }
  return path.join(os.homedir(), '.config', APP_NAME);
}

/**
 * Get the profiles directory
 */
export function getProfilesDir(): string {
  return path.join(getConfigDir(), 'profiles');
}

/**
 * Get the path to the active profile file
 */
export function getActiveProfilePath(): string {
  return path.join(getConfigDir(), 'active_profile');
}

/**
 * Get the path to a specific profile JSON file
 */
export function getProfilePath(name: string): string {
  return path.join(getProfilesDir(), `${name}.json`);
}

/**
 * Validate profile name - must be alphanumeric, dash, underscore only
 * Max 64 characters (matches f5xc-xcsh)
 */
export function isValidProfileName(name: string): boolean {
  if (!name || name.length > 64) {
    return false;
  }
  return /^[a-zA-Z0-9_-]+$/.test(name);
}
