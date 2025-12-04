/**
 * Unit tests for the ProfileManager
 */

import { ProfileManager, F5XCProfile } from '../../config/profiles';
import { mockExtensionContext, mockSecretStorage, mockMemento } from '../__mocks__/vscode';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock the F5XCClient
jest.mock('../../api/client', () => ({
  F5XCClient: jest.fn().mockImplementation(() => ({
    list: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    replace: jest.fn(),
    delete: jest.fn(),
  })),
}));

// Mock the auth providers
jest.mock('../../api/auth', () => ({
  TokenAuthProvider: jest.fn().mockImplementation(() => ({
    type: 'token',
    getHeaders: jest.fn().mockReturnValue({ Authorization: 'APIToken test' }),
    getHttpsAgent: jest.fn().mockReturnValue(undefined),
    validate: jest.fn().mockResolvedValue(true),
    dispose: jest.fn(),
  })),
  P12AuthProvider: jest.fn().mockImplementation(() => ({
    type: 'p12',
    getHeaders: jest.fn().mockReturnValue({}),
    getHttpsAgent: jest.fn().mockReturnValue({}),
    validate: jest.fn().mockResolvedValue(true),
    dispose: jest.fn(),
  })),
}));

describe('ProfileManager', () => {
  let profileManager: ProfileManager;
  let storedProfiles: F5XCProfile[];
  let storedSecrets: Map<string, string>;
  let activeProfile: string | undefined;

  beforeEach(() => {
    // Reset stored data
    storedProfiles = [];
    storedSecrets = new Map();
    activeProfile = undefined;

    // Configure mock memento (globalState)
    mockMemento.get.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'f5xc.profiles') {
        return storedProfiles;
      }
      if (key === 'f5xc.activeProfile') {
        return activeProfile;
      }
      return defaultValue;
    });

    mockMemento.update.mockImplementation((key: string, value: unknown) => {
      if (key === 'f5xc.profiles') {
        storedProfiles = value as F5XCProfile[];
      }
      if (key === 'f5xc.activeProfile') {
        activeProfile = value as string | undefined;
      }
      return Promise.resolve();
    });

    // Configure mock secret storage
    mockSecretStorage.get.mockImplementation((key: string) => {
      return Promise.resolve(storedSecrets.get(key));
    });

    mockSecretStorage.store.mockImplementation((key: string, value: string) => {
      storedSecrets.set(key, value);
      return Promise.resolve();
    });

    mockSecretStorage.delete.mockImplementation((key: string) => {
      storedSecrets.delete(key);
      return Promise.resolve();
    });

    // Create ProfileManager instance
    profileManager = new ProfileManager(mockExtensionContext as any, mockSecretStorage as any);
  });

  afterEach(() => {
    profileManager.dispose();
    jest.clearAllMocks();
  });

  describe('getProfiles', () => {
    it('should return empty array when no profiles exist', () => {
      const profiles = profileManager.getProfiles();
      expect(profiles).toEqual([]);
    });

    it('should return all stored profiles', () => {
      storedProfiles = [
        { name: 'test1', apiUrl: 'https://test1.example.com', authType: 'token' },
        { name: 'test2', apiUrl: 'https://test2.example.com', authType: 'p12' },
      ];

      const profiles = profileManager.getProfiles();
      expect(profiles).toHaveLength(2);
      expect(profiles[0]!.name).toBe('test1');
      expect(profiles[1]!.name).toBe('test2');
    });

    it('should mark active profile correctly', () => {
      storedProfiles = [
        { name: 'test1', apiUrl: 'https://test1.example.com', authType: 'token' },
        { name: 'test2', apiUrl: 'https://test2.example.com', authType: 'p12' },
      ];
      activeProfile = 'test2';

      const profiles = profileManager.getProfiles();
      expect(profiles[0]!.isActive).toBe(false);
      expect(profiles[1]!.isActive).toBe(true);
    });
  });

  describe('getProfile', () => {
    it('should return profile by name', () => {
      storedProfiles = [{ name: 'test1', apiUrl: 'https://test1.example.com', authType: 'token' }];

      const profile = profileManager.getProfile('test1');
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('test1');
    });

    it('should return undefined for non-existent profile', () => {
      const profile = profileManager.getProfile('nonexistent');
      expect(profile).toBeUndefined();
    });
  });

  describe('getActiveProfile', () => {
    it('should return undefined when no active profile', () => {
      const profile = profileManager.getActiveProfile();
      expect(profile).toBeUndefined();
    });

    it('should return active profile when set', () => {
      storedProfiles = [{ name: 'test1', apiUrl: 'https://test1.example.com', authType: 'token' }];
      activeProfile = 'test1';

      const profile = profileManager.getActiveProfile();
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('test1');
    });
  });

  describe('addProfile', () => {
    it('should add a token-based profile', async () => {
      const profile: F5XCProfile = {
        name: 'test-profile',
        apiUrl: 'https://tenant.console.ves.volterra.io',
        authType: 'token',
      };

      await profileManager.addProfile(profile, { token: 'test-token' });

      expect(storedProfiles).toHaveLength(1);
      expect(storedProfiles[0]!.name).toBe('test-profile');
      expect(storedSecrets.get('f5xc.secret.test-profile.token')).toBe('test-token');
    });

    it('should add a p12-based profile', async () => {
      const profile: F5XCProfile = {
        name: 'test-p12-profile',
        apiUrl: 'https://tenant.console.ves.volterra.io',
        authType: 'p12',
        p12Path: '/path/to/cert.p12',
      };

      await profileManager.addProfile(profile, { p12Password: 'test-password' });

      expect(storedProfiles).toHaveLength(1);
      expect(storedProfiles[0]!.name).toBe('test-p12-profile');
      expect(storedProfiles[0]!.p12Path).toBe('/path/to/cert.p12');
      expect(storedSecrets.get('f5xc.secret.test-p12-profile.p12Password')).toBe('test-password');
    });

    it('should set first profile as active', async () => {
      const profile: F5XCProfile = {
        name: 'first-profile',
        apiUrl: 'https://tenant.console.ves.volterra.io',
        authType: 'token',
      };

      await profileManager.addProfile(profile, { token: 'test-token' });

      expect(activeProfile).toBe('first-profile');
    });

    it('should throw error for duplicate profile name', async () => {
      storedProfiles = [
        { name: 'existing', apiUrl: 'https://existing.example.com', authType: 'token' },
      ];

      const profile: F5XCProfile = {
        name: 'existing',
        apiUrl: 'https://new.example.com',
        authType: 'token',
      };

      await expect(profileManager.addProfile(profile, { token: 'test' })).rejects.toThrow(
        'Profile "existing" already exists',
      );
    });
  });

  describe('updateProfile', () => {
    it('should update profile properties', async () => {
      storedProfiles = [{ name: 'test', apiUrl: 'https://old.example.com', authType: 'token' }];

      await profileManager.updateProfile('test', { apiUrl: 'https://new.example.com' });

      expect(storedProfiles[0]!.apiUrl).toBe('https://new.example.com');
    });

    it('should update credentials when provided', async () => {
      storedProfiles = [{ name: 'test', apiUrl: 'https://test.example.com', authType: 'token' }];

      await profileManager.updateProfile('test', {}, { token: 'new-token' });

      expect(storedSecrets.get('f5xc.secret.test.token')).toBe('new-token');
    });

    it('should throw error for non-existent profile', async () => {
      await expect(
        profileManager.updateProfile('nonexistent', { apiUrl: 'https://new.example.com' }),
      ).rejects.toThrow('Profile "nonexistent" not found');
    });

    it('should not change profile name', async () => {
      storedProfiles = [
        { name: 'original', apiUrl: 'https://test.example.com', authType: 'token' },
      ];

      await profileManager.updateProfile('original', { name: 'changed' } as any);

      expect(storedProfiles[0]!.name).toBe('original');
    });
  });

  describe('removeProfile', () => {
    it('should remove profile and its secrets', async () => {
      storedProfiles = [{ name: 'test', apiUrl: 'https://test.example.com', authType: 'token' }];
      storedSecrets.set('f5xc.secret.test.token', 'test-token');

      await profileManager.removeProfile('test');

      expect(storedProfiles).toHaveLength(0);
      expect(storedSecrets.has('f5xc.secret.test.token')).toBe(false);
    });

    it('should set another profile as active when active is removed', async () => {
      storedProfiles = [
        { name: 'profile1', apiUrl: 'https://p1.example.com', authType: 'token' },
        { name: 'profile2', apiUrl: 'https://p2.example.com', authType: 'token' },
      ];
      activeProfile = 'profile1';

      await profileManager.removeProfile('profile1');

      expect(activeProfile).toBe('profile2');
    });

    it('should clear active profile when last profile is removed', async () => {
      storedProfiles = [
        { name: 'only-profile', apiUrl: 'https://test.example.com', authType: 'token' },
      ];
      activeProfile = 'only-profile';

      await profileManager.removeProfile('only-profile');

      expect(activeProfile).toBeUndefined();
    });

    it('should throw error for non-existent profile', async () => {
      await expect(profileManager.removeProfile('nonexistent')).rejects.toThrow(
        'Profile "nonexistent" not found',
      );
    });
  });

  describe('setActiveProfile', () => {
    it('should set active profile', async () => {
      storedProfiles = [
        { name: 'profile1', apiUrl: 'https://p1.example.com', authType: 'token' },
        { name: 'profile2', apiUrl: 'https://p2.example.com', authType: 'token' },
      ];

      await profileManager.setActiveProfile('profile2');

      expect(activeProfile).toBe('profile2');
    });

    it('should throw error for non-existent profile', async () => {
      await expect(profileManager.setActiveProfile('nonexistent')).rejects.toThrow(
        'Profile "nonexistent" not found',
      );
    });
  });

  describe('getClient', () => {
    it('should return cached client on subsequent calls', async () => {
      storedProfiles = [{ name: 'test', apiUrl: 'https://test.example.com', authType: 'token' }];
      storedSecrets.set('f5xc.secret.test.token', 'test-token');

      const client1 = await profileManager.getClient('test');
      const client2 = await profileManager.getClient('test');

      expect(client1).toBe(client2);
    });

    it('should throw error for non-existent profile', async () => {
      await expect(profileManager.getClient('nonexistent')).rejects.toThrow();
    });
  });

  describe('validateProfile', () => {
    it('should return true for valid token profile', async () => {
      storedProfiles = [{ name: 'test', apiUrl: 'https://test.example.com', authType: 'token' }];
      storedSecrets.set('f5xc.secret.test.token', 'valid-token');

      const isValid = await profileManager.validateProfile('test');

      expect(isValid).toBe(true);
    });

    it('should return false when validation throws', async () => {
      storedProfiles = [{ name: 'test', apiUrl: 'https://test.example.com', authType: 'token' }];
      // No token stored - should throw ConfigurationError

      const isValid = await profileManager.validateProfile('test');

      expect(isValid).toBe(false);
    });
  });

  describe('onDidChangeProfiles event', () => {
    it('should fire when profile is added', async () => {
      const listener = jest.fn();
      profileManager.onDidChangeProfiles(listener);

      await profileManager.addProfile(
        { name: 'test', apiUrl: 'https://test.example.com', authType: 'token' },
        { token: 'test' },
      );

      expect(listener).toHaveBeenCalled();
    });

    it('should fire when profile is updated', async () => {
      storedProfiles = [{ name: 'test', apiUrl: 'https://test.example.com', authType: 'token' }];
      const listener = jest.fn();
      profileManager.onDidChangeProfiles(listener);

      await profileManager.updateProfile('test', { apiUrl: 'https://new.example.com' });

      expect(listener).toHaveBeenCalled();
    });

    it('should fire when profile is removed', async () => {
      storedProfiles = [{ name: 'test', apiUrl: 'https://test.example.com', authType: 'token' }];
      const listener = jest.fn();
      profileManager.onDidChangeProfiles(listener);

      await profileManager.removeProfile('test');

      expect(listener).toHaveBeenCalled();
    });

    it('should fire when active profile changes', async () => {
      storedProfiles = [{ name: 'test', apiUrl: 'https://test.example.com', authType: 'token' }];
      const listener = jest.fn();
      profileManager.onDidChangeProfiles(listener);

      await profileManager.setActiveProfile('test');

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should clean up resources', async () => {
      storedProfiles = [{ name: 'test', apiUrl: 'https://test.example.com', authType: 'token' }];
      storedSecrets.set('f5xc.secret.test.token', 'test-token');

      // Get a client to populate cache
      await profileManager.getClient('test');

      // Should not throw
      expect(() => profileManager.dispose()).not.toThrow();
    });
  });
});
