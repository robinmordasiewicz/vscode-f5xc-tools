// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Unit tests for Authentication Providers
 */

import { TokenAuthProvider } from '../../api/auth/tokenAuth';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  getLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock https module for validation tests
jest.mock('https', () => ({
  request: jest.fn(),
}));

// Type for mock request object
interface MockRequest {
  on: jest.Mock;
  end: jest.Mock;
  destroy: jest.Mock;
}

describe('TokenAuthProvider', () => {
  const mockConfig = {
    apiUrl: 'https://tenant.console.ves.volterra.io',
    apiToken: 'test-api-token-12345',
  };

  let provider: TokenAuthProvider;

  beforeEach(() => {
    provider = new TokenAuthProvider(mockConfig);
    jest.clearAllMocks();
  });

  afterEach(() => {
    provider.dispose();
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      expect(provider).toBeInstanceOf(TokenAuthProvider);
      expect(provider.type).toBe('token');
    });
  });

  describe('getHeaders', () => {
    it('should return correct authorization header', () => {
      const headers = provider.getHeaders();

      expect(headers.Authorization).toBe('APIToken test-api-token-12345');
    });

    it('should include Content-Type header', () => {
      const headers = provider.getHeaders();

      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should include Accept header', () => {
      const headers = provider.getHeaders();

      expect(headers.Accept).toBe('application/json');
    });

    it('should return consistent headers on multiple calls', () => {
      const headers1 = provider.getHeaders();
      const headers2 = provider.getHeaders();

      expect(headers1).toEqual(headers2);
    });
  });

  describe('getHttpsAgent', () => {
    it('should return undefined for token auth', () => {
      const agent = provider.getHttpsAgent();

      expect(agent).toBeUndefined();
    });
  });

  describe('validate', () => {
    it('should return true for successful validation (mocked)', async () => {
      const https = require('https');

      // Mock successful request
      const mockRequest: MockRequest = {
        on: jest.fn((_event: string, _callback: () => void): MockRequest => mockRequest),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      const mockResponse = {
        statusCode: 200,
        resume: jest.fn(),
      };

      https.request.mockImplementation(
        (
          _options: unknown,
          callback: (res: { statusCode: number; resume: () => void }) => void,
        ) => {
          // Call callback asynchronously
          setTimeout(() => callback(mockResponse), 0);
          return mockRequest;
        },
      );

      const isValid = await provider.validate();

      expect(isValid).toBe(true);
    });

    it('should return false for 401 response', async () => {
      const https = require('https');

      const mockRequest: MockRequest = {
        on: jest.fn((): MockRequest => mockRequest),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      const mockResponse = {
        statusCode: 401,
        resume: jest.fn(),
      };

      https.request.mockImplementation(
        (
          _options: unknown,
          callback: (res: { statusCode: number; resume: () => void }) => void,
        ) => {
          setTimeout(() => callback(mockResponse), 0);
          return mockRequest;
        },
      );

      const isValid = await provider.validate();

      expect(isValid).toBe(false);
    });

    it('should return false for 403 response', async () => {
      const https = require('https');

      const mockRequest: MockRequest = {
        on: jest.fn((): MockRequest => mockRequest),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      const mockResponse = {
        statusCode: 403,
        resume: jest.fn(),
      };

      https.request.mockImplementation(
        (
          _options: unknown,
          callback: (res: { statusCode: number; resume: () => void }) => void,
        ) => {
          setTimeout(() => callback(mockResponse), 0);
          return mockRequest;
        },
      );

      const isValid = await provider.validate();

      expect(isValid).toBe(false);
    });

    it('should return false for network error', async () => {
      const https = require('https');

      const mockRequest: MockRequest = {
        on: jest.fn((event: string, callback: (err?: Error) => void): MockRequest => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Network error')), 0);
          }
          return mockRequest;
        }),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      https.request.mockImplementation(() => mockRequest);

      const isValid = await provider.validate();

      expect(isValid).toBe(false);
    });

    it('should return false for timeout', async () => {
      const https = require('https');

      const mockRequest: MockRequest = {
        on: jest.fn((event: string, callback: () => void): MockRequest => {
          if (event === 'timeout') {
            setTimeout(() => callback(), 0);
          }
          return mockRequest;
        }),
        end: jest.fn(),
        destroy: jest.fn(),
      };

      https.request.mockImplementation(() => mockRequest);

      const isValid = await provider.validate();

      expect(isValid).toBe(false);
    });
  });

  describe('dispose', () => {
    it('should not throw on dispose', () => {
      expect(() => provider.dispose()).not.toThrow();
    });

    it('should be callable multiple times', () => {
      expect(() => {
        provider.dispose();
        provider.dispose();
      }).not.toThrow();
    });
  });

  describe('type property', () => {
    it('should have type "token"', () => {
      expect(provider.type).toBe('token');
    });

    it('should be readonly', () => {
      // TypeScript enforces this at compile time
      // Runtime check that value doesn't change
      const originalType = provider.type;
      expect(provider.type).toBe(originalType);
    });
  });
});

describe('TokenAuthProvider with different configurations', () => {
  it('should handle URL with trailing slash', () => {
    const provider = new TokenAuthProvider({
      apiUrl: 'https://tenant.console.ves.volterra.io/',
      apiToken: 'test-token',
    });

    const headers = provider.getHeaders();
    expect(headers.Authorization).toBe('APIToken test-token');

    provider.dispose();
  });

  it('should handle URL without protocol prefix in token', () => {
    const provider = new TokenAuthProvider({
      apiUrl: 'https://tenant.console.ves.volterra.io',
      apiToken: 'simple-token',
    });

    const headers = provider.getHeaders();
    expect(headers.Authorization).toBe('APIToken simple-token');

    provider.dispose();
  });

  it('should preserve token format as-is', () => {
    const specialToken = 'token-with-special-chars!@#$%';
    const provider = new TokenAuthProvider({
      apiUrl: 'https://test.example.com',
      apiToken: specialToken,
    });

    const headers = provider.getHeaders();
    expect(headers.Authorization).toBe(`APIToken ${specialToken}`);

    provider.dispose();
  });

  it('should throw error for empty token', () => {
    expect(() => {
      new TokenAuthProvider({
        apiUrl: 'https://test.example.com',
        apiToken: '',
      });
    }).toThrow('API token cannot be empty');
  });

  it('should throw error for whitespace-only token', () => {
    expect(() => {
      new TokenAuthProvider({
        apiUrl: 'https://test.example.com',
        apiToken: '   ',
      });
    }).toThrow('API token cannot be empty');
  });

  it('should trim token with trailing newline', () => {
    const provider = new TokenAuthProvider({
      apiUrl: 'https://test.example.com',
      apiToken: 'test-token\n',
    });

    const headers = provider.getHeaders();
    expect(headers.Authorization).toBe('APIToken test-token');

    provider.dispose();
  });

  it('should trim token with leading and trailing whitespace', () => {
    const provider = new TokenAuthProvider({
      apiUrl: 'https://test.example.com',
      apiToken: '  test-token  \n',
    });

    const headers = provider.getHeaders();
    expect(headers.Authorization).toBe('APIToken test-token');

    provider.dispose();
  });

  it('should trim apiUrl with trailing whitespace', () => {
    const provider = new TokenAuthProvider({
      apiUrl: 'https://test.example.com  \n',
      apiToken: 'test-token',
    });

    // Validate URL was trimmed by checking it doesn't throw during construction
    expect(provider).toBeInstanceOf(TokenAuthProvider);

    provider.dispose();
  });

  it('should handle token with carriage return and newline', () => {
    const provider = new TokenAuthProvider({
      apiUrl: 'https://test.example.com',
      apiToken: 'test-token\r\n',
    });

    const headers = provider.getHeaders();
    expect(headers.Authorization).toBe('APIToken test-token');

    provider.dispose();
  });
});

describe('TokenAuthProvider validation URL construction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should construct correct validation URL', async () => {
    const https = require('https');

    const mockRequest: MockRequest = {
      on: jest.fn((): MockRequest => mockRequest),
      end: jest.fn(),
      destroy: jest.fn(),
    };

    const mockResponse = {
      statusCode: 200,
      resume: jest.fn(),
    };

    let capturedOptions: { hostname?: string; path?: string } = {};

    https.request.mockImplementation(
      (
        options: { hostname?: string; path?: string },
        callback: (res: { statusCode: number; resume: () => void }) => void,
      ) => {
        capturedOptions = options;
        setTimeout(() => callback(mockResponse), 0);
        return mockRequest;
      },
    );

    const provider = new TokenAuthProvider({
      apiUrl: 'https://mytenant.console.ves.volterra.io',
      apiToken: 'test-token',
    });

    await provider.validate();

    expect(capturedOptions.hostname).toBe('mytenant.console.ves.volterra.io');
    expect(capturedOptions.path).toBe('/api/web/namespaces');

    provider.dispose();
  });
});
