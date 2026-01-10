// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * XDG Base Directory paths for cross-tool compatibility with F5 XC tools
 *
 * Structure:
 *   ~/.config/f5xc/
 *   ├── active_profile     # Plain text: active profile name
 *   └── profiles/          # Profile JSON files
 *       ├── profile-1.json
 *       └── profile-2.json
 */

import * as path from 'path';
import * as os from 'os';

/** Application name for XDG directories - shared across F5 XC tools */
const APP_NAME = 'f5xc';

/** File permissions: owner read/write only */
export const FILE_MODE = 0o600;

/** Directory permissions: owner read/write/execute only */
export const DIR_MODE = 0o700;

/**
 * Get the XDG config directory for F5 XC tools
 * - Windows: %APPDATA%\f5xc
 * - Unix: $XDG_CONFIG_HOME/f5xc or ~/.config/f5xc
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
 * Max 64 characters
 */
export function isValidProfileName(name: string): boolean {
  if (!name || name.length > 64) {
    return false;
  }
  return /^[a-zA-Z0-9_-]+$/.test(name);
}
