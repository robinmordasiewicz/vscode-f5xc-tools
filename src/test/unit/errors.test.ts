// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

import {
  F5XCApiError,
  ConfigurationError,
  AuthenticationError,
  withErrorHandling,
  showError,
  showWarning,
  showInfo,
} from '../../utils/errors';
import * as vscode from 'vscode';

// Mock vscode
jest.mock('vscode', () => ({
  window: {
    showErrorMessage: jest.fn().mockResolvedValue(undefined),
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    createOutputChannel: jest.fn(() => ({
      appendLine: jest.fn(),
      show: jest.fn(),
      dispose: jest.fn(),
    })),
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn().mockReturnValue('info'),
    })),
  },
  commands: {
    executeCommand: jest.fn().mockResolvedValue(undefined),
  },
}));

describe('F5XCApiError', () => {
  describe('constructor', () => {
    it('should create error with status code and body', () => {
      const error = new F5XCApiError(404, 'Not found');
      expect(error.statusCode).toBe(404);
      expect(error.body).toBe('Not found');
      expect(error.name).toBe('F5XCApiError');
      expect(error.message).toBe('API Error 404: Not found');
    });

    it('should create error with resource path', () => {
      const error = new F5XCApiError(500, 'Server error', '/api/resource');
      expect(error.resourcePath).toBe('/api/resource');
    });

    it('should create error without resource path', () => {
      const error = new F5XCApiError(400, 'Bad request');
      expect(error.resourcePath).toBeUndefined();
    });
  });

  describe('isAuthError', () => {
    it('should return true for 401', () => {
      const error = new F5XCApiError(401, 'Unauthorized');
      expect(error.isAuthError).toBe(true);
    });

    it('should return true for 403', () => {
      const error = new F5XCApiError(403, 'Forbidden');
      expect(error.isAuthError).toBe(true);
    });

    it('should return false for other status codes', () => {
      const error = new F5XCApiError(404, 'Not found');
      expect(error.isAuthError).toBe(false);
    });
  });

  describe('isNotFound', () => {
    it('should return true for 404', () => {
      const error = new F5XCApiError(404, 'Not found');
      expect(error.isNotFound).toBe(true);
    });

    it('should return false for other status codes', () => {
      const error = new F5XCApiError(500, 'Server error');
      expect(error.isNotFound).toBe(false);
    });
  });

  describe('isRateLimited', () => {
    it('should return true for 429', () => {
      const error = new F5XCApiError(429, 'Too many requests');
      expect(error.isRateLimited).toBe(true);
    });

    it('should return false for other status codes', () => {
      const error = new F5XCApiError(400, 'Bad request');
      expect(error.isRateLimited).toBe(false);
    });
  });

  describe('isConflict', () => {
    it('should return true for 409', () => {
      const error = new F5XCApiError(409, 'Conflict');
      expect(error.isConflict).toBe(true);
    });

    it('should return false for other status codes', () => {
      const error = new F5XCApiError(400, 'Bad request');
      expect(error.isConflict).toBe(false);
    });
  });

  describe('isServerError', () => {
    it('should return true for 500', () => {
      const error = new F5XCApiError(500, 'Internal server error');
      expect(error.isServerError).toBe(true);
    });

    it('should return true for 502', () => {
      const error = new F5XCApiError(502, 'Bad gateway');
      expect(error.isServerError).toBe(true);
    });

    it('should return true for 503', () => {
      const error = new F5XCApiError(503, 'Service unavailable');
      expect(error.isServerError).toBe(true);
    });

    it('should return false for client errors', () => {
      const error = new F5XCApiError(400, 'Bad request');
      expect(error.isServerError).toBe(false);
    });
  });

  describe('isUnauthorized', () => {
    it('should return true for 401', () => {
      const error = new F5XCApiError(401, 'Unauthorized');
      expect(error.isUnauthorized).toBe(true);
    });

    it('should return false for 403', () => {
      const error = new F5XCApiError(403, 'Forbidden');
      expect(error.isUnauthorized).toBe(false);
    });

    it('should return false for other status codes', () => {
      const error = new F5XCApiError(404, 'Not found');
      expect(error.isUnauthorized).toBe(false);
    });
  });

  describe('isForbidden', () => {
    it('should return true for 403', () => {
      const error = new F5XCApiError(403, 'Forbidden');
      expect(error.isForbidden).toBe(true);
    });

    it('should return false for 401', () => {
      const error = new F5XCApiError(401, 'Unauthorized');
      expect(error.isForbidden).toBe(false);
    });

    it('should return false for other status codes', () => {
      const error = new F5XCApiError(404, 'Not found');
      expect(error.isForbidden).toBe(false);
    });
  });

  describe('userFriendlyMessage', () => {
    it('should return auth failed message for 401', () => {
      const error = new F5XCApiError(401, 'Unauthorized');
      expect(error.userFriendlyMessage).toBe(
        'Authentication failed. Please check your credentials or re-authenticate.',
      );
    });

    it('should return permission denied message for 403', () => {
      const error = new F5XCApiError(403, 'Forbidden');
      expect(error.userFriendlyMessage).toBe(
        'Permission denied. You do not have access to perform this operation.',
      );
    });

    it('should return not found message for 404', () => {
      const error = new F5XCApiError(404, 'Not found');
      expect(error.userFriendlyMessage).toBe('Resource not found.');
    });

    it('should return rate limit message for 429', () => {
      const error = new F5XCApiError(429, 'Too many requests');
      expect(error.userFriendlyMessage).toBe('Rate limit exceeded. Please wait and try again.');
    });

    it('should return conflict message for 409', () => {
      const error = new F5XCApiError(409, 'Conflict');
      expect(error.userFriendlyMessage).toBe(
        'Resource conflict. The resource may have been modified.',
      );
    });

    it('should return server error message for 500+', () => {
      const error = new F5XCApiError(500, 'Internal server error');
      expect(error.userFriendlyMessage).toBe('Server error. Please try again later.');
    });

    it('should parse JSON body message field', () => {
      const error = new F5XCApiError(400, '{"message": "Invalid field"}');
      expect(error.userFriendlyMessage).toBe('Invalid field');
    });

    it('should parse JSON body error field', () => {
      const error = new F5XCApiError(400, '{"error": "Bad format"}');
      expect(error.userFriendlyMessage).toBe('Bad format');
    });

    it('should return raw message for non-JSON body', () => {
      const error = new F5XCApiError(400, 'Plain text error');
      expect(error.userFriendlyMessage).toBe('API Error 400: Plain text error');
    });

    it('should return raw message for JSON without message/error', () => {
      const error = new F5XCApiError(400, '{"code": "ERR001"}');
      expect(error.userFriendlyMessage).toBe('API Error 400: {"code": "ERR001"}');
    });
  });
});

describe('ConfigurationError', () => {
  it('should create error with message', () => {
    const error = new ConfigurationError('Missing API URL');
    expect(error.message).toBe('Missing API URL');
    expect(error.name).toBe('ConfigurationError');
  });

  it('should be an instance of Error', () => {
    const error = new ConfigurationError('Test');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('AuthenticationError', () => {
  it('should create error with message', () => {
    const error = new AuthenticationError('Token expired');
    expect(error.message).toBe('Token expired');
    expect(error.name).toBe('AuthenticationError');
  });

  it('should be an instance of Error', () => {
    const error = new AuthenticationError('Test');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('withErrorHandling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the result of successful operation', async () => {
    const operation = jest.fn().mockResolvedValue('success');
    const result = await withErrorHandling(operation, 'Test operation');
    expect(result).toBe('success');
  });

  it('should return undefined on F5XCApiError', async () => {
    const error = new F5XCApiError(500, 'Server error');
    const operation = jest.fn().mockRejectedValue(error);
    const result = await withErrorHandling(operation, 'Test operation');
    expect(result).toBeUndefined();
    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
  });

  it('should show warning for rate limited errors', async () => {
    const error = new F5XCApiError(429, 'Rate limited');
    const operation = jest.fn().mockRejectedValue(error);
    await withErrorHandling(operation, 'Test operation');
    expect(vscode.window.showWarningMessage).toHaveBeenCalled();
  });

  it('should handle ConfigurationError', async () => {
    const error = new ConfigurationError('Missing config');
    const operation = jest.fn().mockRejectedValue(error);
    const result = await withErrorHandling(operation, 'Test operation');
    expect(result).toBeUndefined();
    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
  });

  it('should handle AuthenticationError', async () => {
    const error = new AuthenticationError('Auth failed');
    const operation = jest.fn().mockRejectedValue(error);
    const result = await withErrorHandling(operation, 'Test operation');
    expect(result).toBeUndefined();
    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
  });

  it('should handle generic Error', async () => {
    const error = new Error('Generic error');
    const operation = jest.fn().mockRejectedValue(error);
    const result = await withErrorHandling(operation, 'Test operation');
    expect(result).toBeUndefined();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Test operation: Generic error');
  });

  it('should handle non-Error objects', async () => {
    const operation = jest.fn().mockRejectedValue('string error');
    const result = await withErrorHandling(operation, 'Test operation');
    expect(result).toBeUndefined();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Test operation: An unexpected error occurred',
    );
  });
});

describe('showError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show error message without error object', () => {
    showError('Something went wrong');
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Something went wrong');
  });

  it('should show error message with error object', () => {
    const error = new Error('Detailed error');
    showError('Operation failed', error);
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Operation failed: Detailed error');
  });
});

describe('showWarning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show warning message', () => {
    showWarning('This is a warning');
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('This is a warning');
  });
});

describe('showInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show information message', () => {
    showInfo('This is info');
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('This is info');
  });
});
