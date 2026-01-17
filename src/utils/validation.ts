// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Validation utilities for F5 XC resource operations.
 *
 * Provides pre-validation of resource payloads before API calls,
 * checking required fields and providing user-friendly warnings.
 * Server-defaulted fields are handled gracefully with hints.
 */

import {
  getRequiredFields,
  isFieldServerDefaulted,
  getUserRequiredFields,
  getServerDefaultFields,
} from '../api/resourceTypes';

/**
 * Result of validating a resource payload
 */
export interface ValidationResult {
  /** Whether the payload is valid */
  valid: boolean;
  /** List of missing required fields that user must provide */
  missingFields: string[];
  /** List of missing fields that server will provide defaults for */
  serverDefaultedFields: string[];
  /** Warning messages for the user */
  warnings: string[];
  /** Informational hints about server defaults */
  hints: string[];
}

/**
 * Get the value at a nested path in an object.
 * Supports dot notation (e.g., "metadata.name").
 *
 * @param obj - The object to traverse
 * @param path - The dot-separated path
 * @returns The value at the path, or undefined if not found
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Check if a value is considered "present" (not empty).
 *
 * @param value - The value to check
 * @returns True if the value is present and non-empty
 */
function isValuePresent(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return false;
  }
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  return true;
}

/**
 * Filter out path-based required fields (e.g., "path.namespace").
 * These are URL path parameters, not payload fields.
 *
 * @param fields - Array of required field paths
 * @returns Filtered array without path-based fields
 */
function filterPayloadFields(fields: string[]): string[] {
  return fields.filter((field) => !field.startsWith('path.'));
}

/**
 * Format a field path for display (e.g., "metadata.name" -> "Metadata Name").
 *
 * @param path - The field path
 * @returns Human-readable field name
 */
function formatFieldName(path: string): string {
  return path
    .split('.')
    .map((part) => part.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(' → ');
}

/**
 * Validate a resource payload before create or update operation.
 *
 * Uses the new field metadata system to distinguish between:
 * - Fields user must provide (required AND not server-defaulted)
 * - Fields server will provide defaults for (server-defaulted)
 *
 * @param resourceKey - The resource type key (e.g., 'http_loadbalancer')
 * @param operation - The operation type ('create' or 'update')
 * @param payload - The resource payload to validate
 * @returns Validation result with missing fields, server-defaulted fields, and hints
 */
export function validateResourcePayload(
  resourceKey: string,
  operation: 'create' | 'update',
  payload: Record<string, unknown>,
): ValidationResult {
  // Get fields user must provide (required AND not server-defaulted)
  const userRequiredFields = getUserRequiredFields(resourceKey, operation);
  const payloadUserRequired = filterPayloadFields(userRequiredFields);

  // Get fields that are "required" by spec but have server defaults
  const requiredFields = getRequiredFields(resourceKey, operation);
  const payloadRequired = filterPayloadFields(requiredFields);

  // Get all server-defaulted fields for this resource
  const allServerDefaults = getServerDefaultFields(resourceKey);

  const missingFields: string[] = [];
  const serverDefaultedFields: string[] = [];
  const warnings: string[] = [];
  const hints: string[] = [];

  // Check user-required fields (truly required, no server defaults)
  for (const field of payloadUserRequired) {
    const value = getNestedValue(payload, field);
    if (!isValuePresent(value)) {
      missingFields.push(field);
    }
  }

  // Check fields that are required but server-defaulted
  // These won't block validation but we inform the user
  for (const field of payloadRequired) {
    // Skip if already in user required (not server-defaulted)
    if (payloadUserRequired.includes(field)) {
      continue;
    }

    const value = getNestedValue(payload, field);
    if (!isValuePresent(value) && isFieldServerDefaulted(resourceKey, field)) {
      serverDefaultedFields.push(field);
    }
  }

  // Build warnings for truly missing required fields
  if (missingFields.length > 0) {
    const fieldNames = missingFields.map(formatFieldName);
    if (missingFields.length === 1) {
      warnings.push(`Required field missing: ${fieldNames[0]}`);
    } else {
      warnings.push(`Required fields missing:\n• ${fieldNames.join('\n• ')}`);
    }
  }

  // Build hints for server-defaulted fields
  if (serverDefaultedFields.length > 0) {
    const fieldNames = serverDefaultedFields.map(formatFieldName);
    if (serverDefaultedFields.length === 1) {
      hints.push(`Server will provide default for: ${fieldNames[0]}`);
    } else {
      hints.push(`Server will provide defaults for:\n• ${fieldNames.join('\n• ')}`);
    }
  }

  // Add hint about available server defaults if there are any
  if (allServerDefaults.length > 0 && Object.keys(payload.spec || {}).length === 0) {
    hints.push(
      `This resource type has ${allServerDefaults.length} field(s) with server defaults. ` +
        `You can omit these fields and the server will provide values.`,
    );
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
    serverDefaultedFields,
    warnings,
    hints,
  };
}

/**
 * Check if a specific field is required for an operation.
 *
 * @param resourceKey - The resource type key
 * @param operation - The operation type
 * @param fieldPath - The field path to check
 * @returns True if the field is required
 */
export function isFieldRequired(
  resourceKey: string,
  operation: 'create' | 'update',
  fieldPath: string,
): boolean {
  const requiredFields = getRequiredFields(resourceKey, operation);
  return requiredFields.includes(fieldPath);
}

/**
 * Get a user-friendly summary of required fields for an operation.
 *
 * @param resourceKey - The resource type key
 * @param operation - The operation type
 * @returns Array of human-readable required field names
 */
export function getRequiredFieldsSummary(
  resourceKey: string,
  operation: 'create' | 'update',
): string[] {
  const requiredFields = getRequiredFields(resourceKey, operation);
  const payloadFields = filterPayloadFields(requiredFields);
  return payloadFields.map(formatFieldName);
}
