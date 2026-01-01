/**
 * Unit tests for the ProfileManager with XDG-compliant storage
 */

import { ProfileManager, Profile } from '../../config/profiles';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock vscode
jest.mock('vscode', () => ({
  EventEmitter: class {
    event = jest.fn();
    fire = jest.fn();
    dispose = jest.fn();
  },
  workspace: {
    createFileSystemWatcher: jest.fn(() => ({
      onDidChange: jest.fn(),
      onDidCreate: jest.fn(),
      onDidDelete: jest.fn(),
      dispose: jest.fn(),
    })),
  },
  RelativePattern: jest.fn(),
  Uri: {
    file: jest.fn((path: string) => ({ path, with: jest.fn(() => ({ path })) })),
  },
}));

// Mock the xdgProfiles module
const mockProfiles: Map<string, Profile> = new Map();
let mockActiveProfile: string | null = null;

jest.mock('../../config/xdgProfiles', () => ({
  xdgProfileManager: {
    list: jest.fn(() => Promise.resolve(Array.from(mockProfiles.values()))),
    get: jest.fn((name: string) => Promise.resolve(mockProfiles.get(name) || null)),
    save: jest.fn((profile: Profile) => {
      mockProfiles.set(profile.name, profile);
      return Promise.resolve();
    }),
    delete: jest.fn((name: string) => {
      mockProfiles.delete(name);
      return Promise.resolve();
    }),
    getActive: jest.fn(() => Promise.resolve(mockActiveProfile)),
    setActive: jest.fn((name: string) => {
      mockActiveProfile = name;
      return Promise.resolve();
    }),
    getActiveProfile: jest.fn(() => {
      if (!mockActiveProfile) {
        return Promise.resolve(null);
      }
      return Promise.resolve(mockProfiles.get(mockActiveProfile) || null);
    }),
    getActiveProfileWithEnvOverrides: jest.fn(() => {
      if (!mockActiveProfile) {
        return Promise.resolve(null);
      }
      return Promise.resolve(mockProfiles.get(mockActiveProfile) || null);
    }),
    exists: jest.fn((name: string) => Promise.resolve(mockProfiles.has(name))),
  },
  XDGProfileManager: jest.fn(),
  Profile: jest.fn(),
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
  CertAuthProvider: jest.fn().mockImplementation(() => ({
    type: 'cert',
    getHeaders: jest.fn().mockReturnValue({}),
    getHttpsAgent: jest.fn().mockReturnValue({}),
    validate: jest.fn().mockResolvedValue(true),
    dispose: jest.fn(),
  })),
}));

// Mock paths module
jest.mock('../../config/paths', () => ({
  getProfilesDir: jest.fn(() => '/mock/config/xcsh/profiles'),
  getActiveProfilePath: jest.fn(() => '/mock/config/xcsh/active_profile'),
  getConfigDir: jest.fn(() => '/mock/config/xcsh'),
}));

describe('ProfileManager', () => {
  let profileManager: ProfileManager;

  beforeEach(() => {
    // Reset mock state
    mockProfiles.clear();
    mockActiveProfile = null;
    jest.clearAllMocks();

    // Create ProfileManager instance
    profileManager = new ProfileManager();
  });

  afterEach(() => {
    profileManager.dispose();
  });

  describe('getProfiles', () => {
    it('should return empty array when no profiles exist', async () => {
      const profiles = await profileManager.getProfiles();
      expect(profiles).toEqual([]);
    });

    it('should return all stored profiles', async () => {
      mockProfiles.set('test1', {
        name: 'test1',
        apiUrl: 'https://test1.example.com',
        apiToken: 'token1',
      });
      mockProfiles.set('test2', {
        name: 'test2',
        apiUrl: 'https://test2.example.com',
        p12Bundle: '/path/to/cert.p12',
      });

      const profiles = await profileManager.getProfiles();
      expect(profiles).toHaveLength(2);
    });

    it('should sort profiles with active profile first', async () => {
      mockProfiles.set('alpha', {
        name: 'alpha',
        apiUrl: 'https://alpha.example.com',
        apiToken: 'token-alpha',
      });
      mockProfiles.set('beta', {
        name: 'beta',
        apiUrl: 'https://beta.example.com',
        apiToken: 'token-beta',
      });
      mockActiveProfile = 'beta';

      const profiles = await profileManager.getProfiles();
      expect(profiles[0]?.name).toBe('beta');
      expect(profiles[1]?.name).toBe('alpha');
    });
  });

  describe('getProfile', () => {
    it('should return profile by name', async () => {
      mockProfiles.set('test1', {
        name: 'test1',
        apiUrl: 'https://test1.example.com',
        apiToken: 'token1',
      });

      const profile = await profileManager.getProfile('test1');
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('test1');
    });

    it('should return null for non-existent profile', async () => {
      const profile = await profileManager.getProfile('nonexistent');
      expect(profile).toBeNull();
    });
  });

  describe('getActiveProfile', () => {
    it('should return null when no active profile', async () => {
      const profile = await profileManager.getActiveProfile();
      expect(profile).toBeNull();
    });

    it('should return active profile when set', async () => {
      mockProfiles.set('test1', {
        name: 'test1',
        apiUrl: 'https://test1.example.com',
        apiToken: 'token1',
      });
      mockActiveProfile = 'test1';

      const profile = await profileManager.getActiveProfile();
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('test1');
    });
  });

  describe('addProfile', () => {
    it('should add a token-based profile', async () => {
      const profile: Profile = {
        name: 'test-profile',
        apiUrl: 'https://tenant.console.ves.volterra.io',
        apiToken: 'test-token',
      };

      await profileManager.addProfile(profile);

      expect(mockProfiles.has('test-profile')).toBe(true);
      expect(mockProfiles.get('test-profile')?.apiToken).toBe('test-token');
    });

    it('should add a p12-based profile', async () => {
      const profile: Profile = {
        name: 'test-p12-profile',
        apiUrl: 'https://tenant.console.ves.volterra.io',
        p12Bundle: '/path/to/cert.p12',
      };

      await profileManager.addProfile(profile);

      expect(mockProfiles.has('test-p12-profile')).toBe(true);
      expect(mockProfiles.get('test-p12-profile')?.p12Bundle).toBe('/path/to/cert.p12');
    });

    it('should add a cert+key profile', async () => {
      const profile: Profile = {
        name: 'test-cert-profile',
        apiUrl: 'https://tenant.console.ves.volterra.io',
        cert: '/path/to/cert.pem',
        key: '/path/to/key.pem',
      };

      await profileManager.addProfile(profile);

      expect(mockProfiles.has('test-cert-profile')).toBe(true);
      expect(mockProfiles.get('test-cert-profile')?.cert).toBe('/path/to/cert.pem');
      expect(mockProfiles.get('test-cert-profile')?.key).toBe('/path/to/key.pem');
    });

    it('should set first profile as active', async () => {
      const profile: Profile = {
        name: 'first-profile',
        apiUrl: 'https://tenant.console.ves.volterra.io',
        apiToken: 'test-token',
      };

      await profileManager.addProfile(profile);

      expect(mockActiveProfile).toBe('first-profile');
    });

    it('should throw error for duplicate profile name', async () => {
      mockProfiles.set('existing', {
        name: 'existing',
        apiUrl: 'https://existing.example.com',
        apiToken: 'token',
      });

      const profile: Profile = {
        name: 'existing',
        apiUrl: 'https://new.example.com',
        apiToken: 'new-token',
      };

      await expect(profileManager.addProfile(profile)).rejects.toThrow(
        'Profile "existing" already exists',
      );
    });
  });

  describe('updateProfile', () => {
    it('should update profile properties', async () => {
      mockProfiles.set('test', {
        name: 'test',
        apiUrl: 'https://old.example.com',
        apiToken: 'token',
      });

      await profileManager.updateProfile('test', { apiUrl: 'https://new.example.com' });

      expect(mockProfiles.get('test')?.apiUrl).toBe('https://new.example.com');
    });

    it('should throw error for non-existent profile', async () => {
      await expect(
        profileManager.updateProfile('nonexistent', { apiUrl: 'https://new.example.com' }),
      ).rejects.toThrow('Profile "nonexistent" not found');
    });

    it('should not change profile name', async () => {
      mockProfiles.set('original', {
        name: 'original',
        apiUrl: 'https://test.example.com',
        apiToken: 'token',
      });

      await profileManager.updateProfile('original', { name: 'changed' } as Partial<Profile>);

      expect(mockProfiles.has('original')).toBe(true);
      expect(mockProfiles.get('original')?.name).toBe('original');
    });
  });

  describe('removeProfile', () => {
    it('should remove profile', async () => {
      mockProfiles.set('test', {
        name: 'test',
        apiUrl: 'https://test.example.com',
        apiToken: 'token',
      });

      await profileManager.removeProfile('test');

      expect(mockProfiles.has('test')).toBe(false);
    });

    it('should set another profile as active when active is removed', async () => {
      mockProfiles.set('profile1', {
        name: 'profile1',
        apiUrl: 'https://p1.example.com',
        apiToken: 'token1',
      });
      mockProfiles.set('profile2', {
        name: 'profile2',
        apiUrl: 'https://p2.example.com',
        apiToken: 'token2',
      });
      mockActiveProfile = 'profile1';

      await profileManager.removeProfile('profile1');

      expect(mockActiveProfile).toBe('profile2');
    });

    it('should throw error for non-existent profile', async () => {
      await expect(profileManager.removeProfile('nonexistent')).rejects.toThrow(
        'Profile "nonexistent" not found',
      );
    });
  });

  describe('setActiveProfile', () => {
    it('should set active profile', async () => {
      mockProfiles.set('profile1', {
        name: 'profile1',
        apiUrl: 'https://p1.example.com',
        apiToken: 'token1',
      });
      mockProfiles.set('profile2', {
        name: 'profile2',
        apiUrl: 'https://p2.example.com',
        apiToken: 'token2',
      });

      await profileManager.setActiveProfile('profile2');

      expect(mockActiveProfile).toBe('profile2');
    });

    it('should throw error for non-existent profile', async () => {
      await expect(profileManager.setActiveProfile('nonexistent')).rejects.toThrow(
        'Profile "nonexistent" not found',
      );
    });
  });

  describe('getClient', () => {
    it('should return cached client on subsequent calls', async () => {
      mockProfiles.set('test', {
        name: 'test',
        apiUrl: 'https://test.example.com',
        apiToken: 'test-token',
      });
      mockActiveProfile = 'test';

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
      mockProfiles.set('test', {
        name: 'test',
        apiUrl: 'https://test.example.com',
        apiToken: 'valid-token',
      });
      mockActiveProfile = 'test';

      const isValid = await profileManager.validateProfile('test');

      expect(isValid).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should clean up resources', async () => {
      mockProfiles.set('test', {
        name: 'test',
        apiUrl: 'https://test.example.com',
        apiToken: 'test-token',
      });
      mockActiveProfile = 'test';

      // Get a client to populate cache
      await profileManager.getClient('test');

      // Should not throw
      expect(() => profileManager.dispose()).not.toThrow();
    });
  });
});
