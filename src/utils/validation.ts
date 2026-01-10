// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Validation utilities for F5 XC resource operations.
 *
 * Provides pre-validation of resource payloads before API calls,
 * checking required fields and providing user-friendly warnings.
 */

import { getRequiredFields } from '../api/resourceTypes';

/**
 * Result of validating a resource payload
 */
export interface ValidationResult {
  /** Whether the payload is valid */
  valid: boolean;
  /** List of missing required fields */
  missingFields: string[];
  /** Warning messages for the user */
  warnings: string[];
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
 * @param resourceKey - The resource type key (e.g., 'http_loadbalancer')
 * @param operation - The operation type ('create' or 'update')
 * @param payload - The resource payload to validate
 * @returns Validation result with missing fields and warnings
 */
export function validateResourcePayload(
  resourceKey: string,
  operation: 'create' | 'update',
  payload: Record<string, unknown>,
): ValidationResult {
  const requiredFields = getRequiredFields(resourceKey, operation);
  const payloadFields = filterPayloadFields(requiredFields);

  const missingFields: string[] = [];
  const warnings: string[] = [];

  for (const field of payloadFields) {
    const value = getNestedValue(payload, field);
    if (!isValuePresent(value)) {
      missingFields.push(field);
    }
  }

  // Build warnings for missing fields
  if (missingFields.length > 0) {
    const fieldNames = missingFields.map(formatFieldName);
    if (missingFields.length === 1) {
      warnings.push(`Required field missing: ${fieldNames[0]}`);
    } else {
      warnings.push(`Required fields missing:\n• ${fieldNames.join('\n• ')}`);
    }
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
    warnings,
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
