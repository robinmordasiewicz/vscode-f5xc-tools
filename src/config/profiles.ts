/**
 * ProfileManager - XDG-compliant profile management
 * Shared across F5 XC tools
 */

import * as vscode from 'vscode';
import {
  AuthProvider,
  TokenAuthProvider,
  CertAuthProvider,
  TokenAuthConfig,
  CertAuthConfig,
} from '../api/auth';
import { F5XCClient } from '../api/client';
import { getLogger } from '../utils/logger';
import { ConfigurationError } from '../utils/errors';
import { Profile, XDGProfileManager, xdgProfileManager } from './xdgProfiles';
import { getProfilesDir, getActiveProfilePath } from './paths';

// Re-export Profile for consumers
export type { Profile } from './xdgProfiles';

/**
 * Manages F5 XC connection profiles with XDG-compliant file storage
 * Shared across F5 XC tools (VS Code extension, CLI, MCP servers)
 */
export class ProfileManager {
  private readonly xdg: XDGProfileManager;
  private readonly logger = getLogger();
  private readonly _onDidChangeProfiles = new vscode.EventEmitter<void>();
  private clientCache = new Map<string, F5XCClient>();
  private authProviderCache = new Map<string, AuthProvider>();
  private watchers: vscode.FileSystemWatcher[] = [];

  readonly onDidChangeProfiles = this._onDidChangeProfiles.event;

  constructor() {
    this.xdg = xdgProfileManager;
    this.initFileWatcher();
  }

  /**
   * Initialize file watcher for cross-tool sync
   * Detects changes made by other F5 XC tools
   */
  private initFileWatcher(): void {
    const profilesDir = getProfilesDir();
    const activeProfilePath = getActiveProfilePath();

    try {
      // Watch for profile JSON file changes
      const profilesWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(vscode.Uri.file(profilesDir), '*.json'),
      );

      // Watch for active profile file changes
      const activeWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(
          vscode.Uri.file(activeProfilePath).with({
            path: activeProfilePath.replace(/[^/]+$/, ''),
          }),
          'active_profile',
        ),
      );

      const handleChange = () => {
        this.logger.debug('Profile files changed externally');
        // Clear caches on external change
        this.clearAllCaches();
        this._onDidChangeProfiles.fire();
      };

      // Set up event handlers for both watchers
      for (const watcher of [profilesWatcher, activeWatcher]) {
        watcher.onDidChange(handleChange);
        watcher.onDidCreate(handleChange);
        watcher.onDidDelete(handleChange);
        this.watchers.push(watcher);
      }

      this.logger.debug('Profile file watcher initialized');
    } catch (error) {
      this.logger.warn('Failed to initialize file watcher', error as Error);
    }
  }

  /**
   * Get all configured profiles
   */
  async getProfiles(): Promise<Profile[]> {
    const profiles = await this.xdg.list();
    const activeName = await this.xdg.getActive();

    // Sort profiles alphabetically, with active profile first
    return profiles.sort((a, b) => {
      if (a.name === activeName) {
        return -1;
      }
      if (b.name === activeName) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Get a profile by name
   */
  async getProfile(name: string): Promise<Profile | null> {
    return this.xdg.get(name);
  }

  /**
   * Get the active profile
   */
  async getActiveProfile(): Promise<Profile | null> {
    return this.xdg.getActiveProfile();
  }

  /**
   * Get the active profile with environment variable overrides
   */
  async getActiveProfileWithEnvOverrides(): Promise<Profile | null> {
    return this.xdg.getActiveProfileWithEnvOverrides();
  }

  /**
   * Get active profile name
   */
  async getActiveProfileName(): Promise<string | null> {
    return this.xdg.getActive();
  }

  /**
   * Add a new profile
   */
  async addProfile(profile: Profile): Promise<void> {
    this.logger.info(`Adding profile: ${profile.name}`);

    // Check for duplicate names
    if (await this.xdg.exists(profile.name)) {
      throw new ConfigurationError(`Profile "${profile.name}" already exists`);
    }

    await this.xdg.save(profile);

    // Set as active if it's the first profile
    const profiles = await this.xdg.list();
    if (profiles.length === 1) {
      await this.setActiveProfile(profile.name);
    }

    this._onDidChangeProfiles.fire();
    this.logger.info(`Profile "${profile.name}" added successfully`);
  }

  /**
   * Update an existing profile
   */
  async updateProfile(name: string, updates: Partial<Profile>): Promise<void> {
    this.logger.info(`Updating profile: ${name}`);

    const existing = await this.xdg.get(name);
    if (!existing) {
      throw new ConfigurationError(`Profile "${name}" not found`);
    }

    // Clear cached client and auth provider
    this.clearCache(name);

    // Merge updates (name cannot be changed)
    const updated: Profile = {
      ...existing,
      ...updates,
      name, // Preserve original name
    };

    await this.xdg.save(updated);
    this._onDidChangeProfiles.fire();
    this.logger.info(`Profile "${name}" updated successfully`);
  }

  /**
   * Remove a profile
   */
  async removeProfile(name: string): Promise<void> {
    this.logger.info(`Removing profile: ${name}`);

    if (!(await this.xdg.exists(name))) {
      throw new ConfigurationError(`Profile "${name}" not found`);
    }

    // Clear cached client and auth provider
    this.clearCache(name);

    // Check if this is the active profile
    const activeName = await this.xdg.getActive();
    const isActive = activeName === name;

    await this.xdg.delete(name);

    // If this was the active profile, set another one
    if (isActive) {
      const profiles = await this.xdg.list();
      if (profiles.length > 0 && profiles[0]) {
        await this.setActiveProfile(profiles[0].name);
      }
    }

    this._onDidChangeProfiles.fire();
    this.logger.info(`Profile "${name}" removed successfully`);
  }

  /**
   * Set the active profile
   */
  async setActiveProfile(name: string): Promise<void> {
    if (!(await this.xdg.exists(name))) {
      throw new ConfigurationError(`Profile "${name}" not found`);
    }

    await this.xdg.setActive(name);
    this._onDidChangeProfiles.fire();
    this.logger.info(`Active profile set to "${name}"`);
  }

  /**
   * Get an authenticated API client for a profile
   */
  async getClient(profileName: string): Promise<F5XCClient> {
    // Check cache first
    const cached = this.clientCache.get(profileName);
    if (cached) {
      return cached;
    }

    const authProvider = await this.getAuthProvider(profileName);
    const profile = await this.getProfile(profileName);

    if (!profile) {
      throw new ConfigurationError(`Profile "${profileName}" not found`);
    }

    const client = new F5XCClient(profile.apiUrl, authProvider);
    this.clientCache.set(profileName, client);

    return client;
  }

  /**
   * Get an auth provider for a profile
   */
  async getAuthProvider(profileName: string): Promise<AuthProvider> {
    // Check cache first
    const cached = this.authProviderCache.get(profileName);
    if (cached) {
      this.logger.debug(`Using cached auth provider for profile: ${profileName}`);
      return cached;
    }

    this.logger.debug(`Creating new auth provider for profile: ${profileName}`);

    // Only apply env overrides for the active profile
    const activeName = await this.xdg.getActive();
    let profile: Profile | null;

    if (profileName === activeName) {
      // Active profile: apply environment variable overrides
      profile = await this.xdg.getActiveProfileWithEnvOverrides();
    } else {
      // Non-active profile: get directly without env overrides
      profile = await this.xdg.get(profileName);
    }

    if (!profile) {
      throw new ConfigurationError(`Profile "${profileName}" not found`);
    }

    return this.createAuthProvider(profile);
  }

  /**
   * Create an auth provider for a profile
   */
  private createAuthProvider(profile: Profile): AuthProvider {
    let authProvider: AuthProvider;

    // Determine auth type based on available credentials
    if (profile.apiToken) {
      const config: TokenAuthConfig = {
        apiUrl: profile.apiUrl,
        apiToken: profile.apiToken,
      };
      authProvider = new TokenAuthProvider(config);
    } else if (profile.p12Bundle || (profile.cert && profile.key)) {
      const config: CertAuthConfig = {
        apiUrl: profile.apiUrl,
        p12Bundle: profile.p12Bundle,
        cert: profile.cert,
        key: profile.key,
      };
      authProvider = new CertAuthProvider(config);
    } else {
      throw new ConfigurationError(
        `No valid credentials configured for profile "${profile.name}". ` +
          'Provide apiToken, p12Bundle, or both cert and key.',
      );
    }

    this.authProviderCache.set(profile.name, authProvider);
    return authProvider;
  }

  /**
   * Validate profile credentials
   */
  async validateProfile(profileName: string): Promise<boolean> {
    try {
      const authProvider = await this.getAuthProvider(profileName);
      return await authProvider.validate();
    } catch (error) {
      this.logger.error(`Profile validation failed: ${profileName}`, error as Error);
      return false;
    }
  }

  /**
   * Clear cached client and auth provider for a profile
   */
  private clearCache(profileName: string): void {
    const authProvider = this.authProviderCache.get(profileName);
    if (authProvider) {
      authProvider.dispose();
      this.authProviderCache.delete(profileName);
    }
    this.clientCache.delete(profileName);
  }

  /**
   * Clear all caches (used when external changes detected)
   */
  private clearAllCaches(): void {
    for (const authProvider of this.authProviderCache.values()) {
      authProvider.dispose();
    }
    this.authProviderCache.clear();
    this.clientCache.clear();
  }

  /**
   * Public method to clear all auth caches (for troubleshooting)
   * Use when credentials have been updated but cached auth is stale
   */
  clearAllCachesPublic(): void {
    this.logger.info('Manually clearing all auth provider and client caches');
    this.clearAllCaches();
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.clearAllCaches();
    this._onDidChangeProfiles.dispose();
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
  }
}
