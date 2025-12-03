import * as vscode from 'vscode';
import {
  AuthProvider,
  TokenAuthProvider,
  P12AuthProvider,
  TokenAuthConfig,
  P12AuthConfig,
} from '../api/auth';
import { F5XCClient } from '../api/client';
import { getLogger } from '../utils/logger';
import { ConfigurationError } from '../utils/errors';

/**
 * Profile configuration stored in VSCode settings
 */
export interface F5XCProfile {
  /** Unique profile name */
  name: string;
  /** F5 XC API URL (e.g., https://tenant.console.ves.volterra.io) */
  apiUrl: string;
  /** Authentication type */
  authType: 'token' | 'p12';
  /** Path to P12 file (for p12 auth) */
  p12Path?: string;
  /** Whether this is the active profile */
  isActive?: boolean;
}

/**
 * Internal profile with secrets resolved
 */
interface ResolvedProfile extends F5XCProfile {
  token?: string;
  p12Password?: string;
}

const PROFILES_KEY = 'f5xc.profiles';
const ACTIVE_PROFILE_KEY = 'f5xc.activeProfile';
const SECRET_PREFIX = 'f5xc.secret.';

/**
 * Manages F5 XC connection profiles with secure credential storage
 */
export class ProfileManager {
  private readonly context: vscode.ExtensionContext;
  private readonly secrets: vscode.SecretStorage;
  private readonly logger = getLogger();
  private readonly _onDidChangeProfiles = new vscode.EventEmitter<void>();
  private clientCache = new Map<string, F5XCClient>();
  private authProviderCache = new Map<string, AuthProvider>();

  readonly onDidChangeProfiles = this._onDidChangeProfiles.event;

  constructor(context: vscode.ExtensionContext, secrets: vscode.SecretStorage) {
    this.context = context;
    this.secrets = secrets;
  }

  /**
   * Get all configured profiles
   */
  getProfiles(): F5XCProfile[] {
    const profiles = this.context.globalState.get<F5XCProfile[]>(PROFILES_KEY, []);
    const activeProfile = this.getActiveProfileName();

    return profiles.map((p) => ({
      ...p,
      isActive: p.name === activeProfile,
    }));
  }

  /**
   * Get a profile by name
   */
  getProfile(name: string): F5XCProfile | undefined {
    const profiles = this.getProfiles();
    return profiles.find((p) => p.name === name);
  }

  /**
   * Get the active profile
   */
  getActiveProfile(): F5XCProfile | undefined {
    const activeProfileName = this.getActiveProfileName();
    if (!activeProfileName) {
      return undefined;
    }
    return this.getProfile(activeProfileName);
  }

  /**
   * Get active profile name
   */
  getActiveProfileName(): string | undefined {
    return this.context.globalState.get<string>(ACTIVE_PROFILE_KEY);
  }

  /**
   * Add a new profile
   */
  async addProfile(
    profile: F5XCProfile,
    credentials: { token?: string; p12Password?: string },
  ): Promise<void> {
    this.logger.info(`Adding profile: ${profile.name}`);

    const profiles = this.getProfiles();

    // Check for duplicate names
    if (profiles.some((p) => p.name === profile.name)) {
      throw new ConfigurationError(`Profile "${profile.name}" already exists`);
    }

    // Store credentials securely
    if (profile.authType === 'token' && credentials.token) {
      await this.secrets.store(`${SECRET_PREFIX}${profile.name}.token`, credentials.token);
    } else if (profile.authType === 'p12' && credentials.p12Password) {
      await this.secrets.store(
        `${SECRET_PREFIX}${profile.name}.p12Password`,
        credentials.p12Password,
      );
    }

    // Add profile to list
    profiles.push({
      name: profile.name,
      apiUrl: profile.apiUrl,
      authType: profile.authType,
      p12Path: profile.p12Path,
    });

    await this.context.globalState.update(PROFILES_KEY, profiles);

    // Set as active if it's the first profile
    if (profiles.length === 1) {
      await this.setActiveProfile(profile.name);
    }

    this._onDidChangeProfiles.fire();
    this.logger.info(`Profile "${profile.name}" added successfully`);
  }

  /**
   * Update an existing profile
   */
  async updateProfile(
    name: string,
    updates: Partial<F5XCProfile>,
    credentials?: { token?: string; p12Password?: string },
  ): Promise<void> {
    this.logger.info(`Updating profile: ${name}`);

    const profiles = this.getProfiles();
    const index = profiles.findIndex((p) => p.name === name);

    if (index === -1) {
      throw new ConfigurationError(`Profile "${name}" not found`);
    }

    // Clear cached client and auth provider
    this.clearCache(name);

    // Update credentials if provided
    if (credentials?.token) {
      await this.secrets.store(`${SECRET_PREFIX}${name}.token`, credentials.token);
    }
    if (credentials?.p12Password) {
      await this.secrets.store(`${SECRET_PREFIX}${name}.p12Password`, credentials.p12Password);
    }

    // Update profile
    const existingProfile = profiles[index];
    if (existingProfile) {
      profiles[index] = {
        ...existingProfile,
        ...updates,
        name, // Name cannot be changed
      };
    }

    await this.context.globalState.update(PROFILES_KEY, profiles);
    this._onDidChangeProfiles.fire();
    this.logger.info(`Profile "${name}" updated successfully`);
  }

  /**
   * Remove a profile
   */
  async removeProfile(name: string): Promise<void> {
    this.logger.info(`Removing profile: ${name}`);

    const profiles = this.getProfiles();
    const filteredProfiles = profiles.filter((p) => p.name !== name);

    if (filteredProfiles.length === profiles.length) {
      throw new ConfigurationError(`Profile "${name}" not found`);
    }

    // Clear cached client and auth provider
    this.clearCache(name);

    // Remove secrets
    await this.secrets.delete(`${SECRET_PREFIX}${name}.token`);
    await this.secrets.delete(`${SECRET_PREFIX}${name}.p12Password`);

    await this.context.globalState.update(PROFILES_KEY, filteredProfiles);

    // If this was the active profile, clear or set another
    const activeProfile = this.getActiveProfileName();
    if (activeProfile === name) {
      if (filteredProfiles.length > 0 && filteredProfiles[0]) {
        await this.setActiveProfile(filteredProfiles[0].name);
      } else {
        await this.context.globalState.update(ACTIVE_PROFILE_KEY, undefined);
      }
    }

    this._onDidChangeProfiles.fire();
    this.logger.info(`Profile "${name}" removed successfully`);
  }

  /**
   * Set the active profile
   */
  async setActiveProfile(name: string): Promise<void> {
    const profile = this.getProfile(name);
    if (!profile) {
      throw new ConfigurationError(`Profile "${name}" not found`);
    }

    await this.context.globalState.update(ACTIVE_PROFILE_KEY, name);
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
    const profile = this.getProfile(profileName);

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
      return cached;
    }

    const resolved = await this.resolveProfile(profileName);

    let authProvider: AuthProvider;

    if (resolved.authType === 'token') {
      if (!resolved.token) {
        throw new ConfigurationError(`No API token configured for profile "${profileName}"`);
      }

      const config: TokenAuthConfig = {
        apiUrl: resolved.apiUrl,
        token: resolved.token,
      };

      authProvider = new TokenAuthProvider(config);
    } else if (resolved.authType === 'p12') {
      if (!resolved.p12Path) {
        throw new ConfigurationError(`No P12 file path configured for profile "${profileName}"`);
      }
      if (!resolved.p12Password) {
        throw new ConfigurationError(`No P12 password configured for profile "${profileName}"`);
      }

      const config: P12AuthConfig = {
        apiUrl: resolved.apiUrl,
        p12Path: resolved.p12Path,
        p12Password: resolved.p12Password,
      };

      authProvider = new P12AuthProvider(config);
    } else {
      throw new ConfigurationError(`Unknown auth type for profile "${profileName}"`);
    }

    this.authProviderCache.set(profileName, authProvider);
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
   * Resolve profile with secrets
   */
  private async resolveProfile(name: string): Promise<ResolvedProfile> {
    const profile = this.getProfile(name);
    if (!profile) {
      throw new ConfigurationError(`Profile "${name}" not found`);
    }

    const token = await this.secrets.get(`${SECRET_PREFIX}${name}.token`);
    const p12Password = await this.secrets.get(`${SECRET_PREFIX}${name}.p12Password`);

    return {
      ...profile,
      token,
      p12Password,
    };
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
   * Dispose all resources
   */
  dispose(): void {
    for (const authProvider of this.authProviderCache.values()) {
      authProvider.dispose();
    }
    this.authProviderCache.clear();
    this.clientCache.clear();
    this._onDidChangeProfiles.dispose();
  }
}
