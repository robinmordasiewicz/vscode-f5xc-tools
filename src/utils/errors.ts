import * as vscode from 'vscode';
import { getLogger } from './logger';

/**
 * Custom error class for F5 XC API errors
 */
export class F5XCApiError extends Error {
  public readonly statusCode: number;
  public readonly body: string;
  public readonly resourcePath?: string;

  constructor(statusCode: number, body: string, resourcePath?: string) {
    super(`API Error ${statusCode}: ${body}`);
    this.name = 'F5XCApiError';
    this.statusCode = statusCode;
    this.body = body;
    this.resourcePath = resourcePath;
  }

  get isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  get isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  get isConflict(): boolean {
    return this.statusCode === 409;
  }

  get isServerError(): boolean {
    return this.statusCode >= 500;
  }

  get userFriendlyMessage(): string {
    if (this.isAuthError) {
      return 'Authentication failed. Please check your credentials.';
    }
    if (this.isNotFound) {
      return 'Resource not found.';
    }
    if (this.isRateLimited) {
      return 'Rate limit exceeded. Please wait and try again.';
    }
    if (this.isConflict) {
      return 'Resource conflict. The resource may have been modified.';
    }
    if (this.isServerError) {
      return 'Server error. Please try again later.';
    }

    // Try to parse error body for more details
    try {
      const parsed = JSON.parse(this.body) as { message?: string; error?: string };
      if (parsed.message) {
        return parsed.message;
      }
      if (parsed.error) {
        return parsed.error;
      }
    } catch {
      // Body is not JSON
    }

    return this.message;
  }
}

/**
 * Custom error for configuration errors
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Custom error for authentication errors
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Wrapper for error handling with user notification
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T | undefined> {
  const logger = getLogger();

  try {
    return await operation();
  } catch (error) {
    logger.error(`${context} failed`, error as Error);

    if (error instanceof F5XCApiError) {
      if (error.isAuthError) {
        const action = await vscode.window.showErrorMessage(
          error.userFriendlyMessage,
          'Configure Profile',
        );
        if (action === 'Configure Profile') {
          await vscode.commands.executeCommand('f5xc.editProfile');
        }
      } else if (error.isRateLimited) {
        void vscode.window.showWarningMessage(error.userFriendlyMessage);
      } else {
        void vscode.window.showErrorMessage(`${context}: ${error.userFriendlyMessage}`);
      }
    } else if (error instanceof ConfigurationError) {
      const action = await vscode.window.showErrorMessage(error.message, 'Open Settings');
      if (action === 'Open Settings') {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'f5xc');
      }
    } else if (error instanceof AuthenticationError) {
      const action = await vscode.window.showErrorMessage(error.message, 'Configure Profile');
      if (action === 'Configure Profile') {
        await vscode.commands.executeCommand('f5xc.addProfile');
      }
    } else if (error instanceof Error) {
      void vscode.window.showErrorMessage(`${context}: ${error.message}`);
    } else {
      void vscode.window.showErrorMessage(`${context}: An unexpected error occurred`);
    }

    return undefined;
  }
}

/**
 * Show error notification without throwing
 */
export function showError(message: string, error?: Error): void {
  const logger = getLogger();
  logger.error(message, error);

  const displayMessage = error ? `${message}: ${error.message}` : message;
  void vscode.window.showErrorMessage(displayMessage);
}

/**
 * Show warning notification
 */
export function showWarning(message: string): void {
  const logger = getLogger();
  logger.warn(message);
  void vscode.window.showWarningMessage(message);
}

/**
 * Show info notification
 */
export function showInfo(message: string): void {
  const logger = getLogger();
  logger.info(message);
  void vscode.window.showInformationMessage(message);
}
