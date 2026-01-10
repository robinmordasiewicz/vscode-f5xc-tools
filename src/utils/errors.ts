// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

import * as vscode from 'vscode';
import { getLogger } from './logger';
import { getSmartErrorMessage } from '../api/resourceTypes';

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

  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  get isForbidden(): boolean {
    return this.statusCode === 403;
  }

  get isAuthError(): boolean {
    return this.isUnauthorized || this.isForbidden;
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
    if (this.isUnauthorized) {
      return 'Authentication failed. Please check your credentials or re-authenticate.';
    }
    if (this.isForbidden) {
      return 'Permission denied. You do not have access to perform this operation.';
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
 * Options for error handling with resource context
 */
export interface ErrorHandlingOptions {
  /** The resource type key (e.g., 'http_loadbalancer') for smart error messages */
  resourceTypeKey?: string;
  /** The operation being performed (for smart error messages) */
  operation?: 'list' | 'get' | 'create' | 'update' | 'delete';
}

/**
 * Wrapper for error handling with user notification
 * @param operation - The async operation to execute
 * @param context - Human-readable context for error messages
 * @param options - Optional error handling options for smart error messages
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  options?: ErrorHandlingOptions,
): Promise<T | undefined> {
  const logger = getLogger();

  try {
    return await operation();
  } catch (error) {
    logger.error(`${context} failed`, error as Error);

    if (error instanceof F5XCApiError) {
      // Try to get a smart error message if we have resource context
      let smartMessage: string | undefined;
      if (options?.resourceTypeKey && options?.operation) {
        smartMessage = getSmartErrorMessage(
          options.resourceTypeKey,
          options.operation,
          error.statusCode,
        );
      }

      if (error.isUnauthorized) {
        // 401 - Authentication failed, offer to configure profile or clear cache
        const message = smartMessage || error.userFriendlyMessage;
        const action = await vscode.window.showErrorMessage(
          `${message}\n\nIf you recently updated credentials, try clearing the auth cache.`,
          'Configure Profile',
          'Clear Auth Cache',
        );
        if (action === 'Configure Profile') {
          await vscode.commands.executeCommand('f5xc.editProfile');
        } else if (action === 'Clear Auth Cache') {
          await vscode.commands.executeCommand('f5xc.clearAuthCache');
        }
      } else if (error.isForbidden) {
        // 403 - Permission denied, show smart message if available
        const message = smartMessage || error.userFriendlyMessage;
        void vscode.window.showErrorMessage(`${context}: ${message}`);
      } else if (error.isRateLimited) {
        const message = smartMessage || error.userFriendlyMessage;
        void vscode.window.showWarningMessage(message);
      } else if (error.isConflict) {
        // 409 - Conflict, use smart message for better guidance
        const message = smartMessage || error.userFriendlyMessage;
        void vscode.window.showErrorMessage(`${context}: ${message}`);
      } else {
        // For other errors, prefer smart message if available
        const message = smartMessage || error.userFriendlyMessage;
        void vscode.window.showErrorMessage(`${context}: ${message}`);
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
