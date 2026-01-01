/**
 * XDG-compliant ProfileManager for cross-tool compatibility
 * Compatible with f5xc-xcsh and f5xc-api-mcp
 *
 * Profiles stored at: ~/.config/xcsh/profiles/{name}.json
 * Active profile at: ~/.config/xcsh/active_profile
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  getConfigDir,
  getProfilesDir,
  getActiveProfilePath,
  getProfilePath,
  isValidProfileName,
  FILE_MODE,
  DIR_MODE,
} from './paths';

/**
 * Profile interface - must match f5xc-xcsh exactly
 */
export interface Profile {
  name: string;
  apiUrl: string;
  apiToken?: string;
  p12Bundle?: string;
  cert?: string;
  key?: string;
  defaultNamespace?: string;
}

/**
 * XDG-compliant ProfileManager
 * File-based storage with atomic writes and proper permissions
 */
export class XDGProfileManager {
  /**
   * Ensure config directories exist with proper permissions
   */
  async ensureDirectories(): Promise<void> {
    const configDir = getConfigDir();
    const profilesDir = getProfilesDir();

    for (const dir of [configDir, profilesDir]) {
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true, mode: DIR_MODE });
      }
    }
  }

  /**
   * List all profiles
   */
  async list(): Promise<Profile[]> {
    const profilesDir = getProfilesDir();

    if (!fs.existsSync(profilesDir)) {
      return [];
    }

    const files = await fs.promises.readdir(profilesDir);
    const profiles: Profile[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }

      const name = path.basename(file, '.json');
      const profile = await this.get(name);
      if (profile) {
        profiles.push(profile);
      }
    }

    return profiles;
  }

  /**
   * Get a profile by name
   */
  async get(name: string): Promise<Profile | null> {
    if (!isValidProfileName(name)) {
      return null;
    }

    const profilePath = getProfilePath(name);

    if (!fs.existsSync(profilePath)) {
      return null;
    }

    try {
      const content = await fs.promises.readFile(profilePath, 'utf-8');
      const profile = JSON.parse(content) as Profile;

      // Ensure name matches filename
      profile.name = name;
      return profile;
    } catch {
      // Malformed JSON - skip profile, don't crash
      console.warn(`Skipping malformed profile: ${name}`);
      return null;
    }
  }

  /**
   * Save a profile (create or update)
   * Uses atomic write: temp file + rename
   */
  async save(profile: Profile): Promise<void> {
    if (!isValidProfileName(profile.name)) {
      throw new Error(
        `Invalid profile name: ${profile.name}. Must be alphanumeric, dash, or underscore only (max 64 chars).`,
      );
    }

    await this.ensureDirectories();

    const profilePath = getProfilePath(profile.name);
    const tempPath = `${profilePath}.tmp.${process.pid}`;

    try {
      // Write to temp file first
      await fs.promises.writeFile(tempPath, JSON.stringify(profile, null, 2), {
        encoding: 'utf-8',
        mode: FILE_MODE,
      });

      // Atomic rename
      await fs.promises.rename(tempPath, profilePath);
    } catch (error) {
      // Clean up temp file on failure
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Delete a profile by name
   */
  async delete(name: string): Promise<void> {
    if (!isValidProfileName(name)) {
      throw new Error(`Invalid profile name: ${name}`);
    }

    const profilePath = getProfilePath(name);

    if (fs.existsSync(profilePath)) {
      await fs.promises.unlink(profilePath);
    }

    // Clear active profile if this was the active one
    const active = await this.getActive();
    if (active === name) {
      await this.clearActive();
    }
  }

  /**
   * Check if a profile exists
   */
  async exists(name: string): Promise<boolean> {
    if (!isValidProfileName(name)) {
      return false;
    }

    const profilePath = getProfilePath(name);
    try {
      await fs.promises.access(profilePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the active profile name
   */
  async getActive(): Promise<string | null> {
    const activePath = getActiveProfilePath();

    if (!fs.existsSync(activePath)) {
      return null;
    }

    try {
      const content = await fs.promises.readFile(activePath, 'utf-8');
      const name = content.trim();

      if (!name || !isValidProfileName(name)) {
        return null;
      }

      // Verify the profile actually exists
      if (!(await this.exists(name))) {
        return null;
      }

      return name;
    } catch {
      return null;
    }
  }

  /**
   * Set the active profile
   */
  async setActive(name: string): Promise<void> {
    if (!isValidProfileName(name)) {
      throw new Error(`Invalid profile name: ${name}`);
    }

    // Verify profile exists
    if (!(await this.exists(name))) {
      throw new Error(`Profile not found: ${name}`);
    }

    await this.ensureDirectories();

    const activePath = getActiveProfilePath();
    const tempPath = `${activePath}.tmp.${process.pid}`;

    try {
      await fs.promises.writeFile(tempPath, name, {
        encoding: 'utf-8',
        mode: FILE_MODE,
      });
      await fs.promises.rename(tempPath, activePath);
    } catch (error) {
      try {
        await fs.promises.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Clear the active profile
   */
  async clearActive(): Promise<void> {
    const activePath = getActiveProfilePath();

    if (fs.existsSync(activePath)) {
      await fs.promises.unlink(activePath);
    }
  }

  /**
   * Get the active profile (full profile object)
   */
  async getActiveProfile(): Promise<Profile | null> {
    const name = await this.getActive();

    if (!name) {
      return null;
    }

    return this.get(name);
  }

  /**
   * Get profile with environment variable overrides applied
   * Environment variables take precedence over profile settings
   */
  async getActiveProfileWithEnvOverrides(): Promise<Profile | null> {
    const profile = await this.getActiveProfile();

    if (!profile) {
      // Check if we can construct a profile purely from env vars
      const envApiUrl = process.env.F5XC_API_URL;
      const envApiToken = process.env.F5XC_API_TOKEN;

      if (envApiUrl && envApiToken) {
        return {
          name: 'env',
          apiUrl: envApiUrl,
          apiToken: envApiToken,
          defaultNamespace: process.env.F5XC_NAMESPACE,
        };
      }

      return null;
    }

    // Apply environment variable overrides
    return {
      ...profile,
      apiUrl: process.env.F5XC_API_URL || profile.apiUrl,
      apiToken: process.env.F5XC_API_TOKEN || profile.apiToken,
      p12Bundle: process.env.F5XC_P12_BUNDLE || profile.p12Bundle,
      cert: process.env.F5XC_CERT || profile.cert,
      key: process.env.F5XC_KEY || profile.key,
      defaultNamespace: process.env.F5XC_NAMESPACE || profile.defaultNamespace,
    };
  }
}

// Singleton instance for convenience
export const xdgProfileManager = new XDGProfileManager();
