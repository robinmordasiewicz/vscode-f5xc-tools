/**
 * Validates that healthcheck form defaults match API spec recommendations
 *
 * This script ensures alignment between:
 * - Form defaults in src/providers/healthcheckFormProvider.ts
 * - API spec recommendations in src/generated/resourceTypesBase.ts
 *
 * Exit codes:
 * - 0: All defaults match spec recommendations
 * - 1: Mismatches found or validation errors
 */

import { GENERATED_RESOURCE_TYPES } from '../src/generated/resourceTypesBase';
import * as fs from 'fs';
import * as path from 'path';

const FORM_FILE = path.join(__dirname, '../src/providers/healthcheckFormProvider.ts');

interface FormDefault {
  fieldName: string;
  formValue: string;
  specValue: unknown;
  lineNumber: number;
}

/**
 * Extract form field defaults from HTML
 */
function extractFormDefaults(): FormDefault[] {
  const content = fs.readFileSync(FORM_FILE, 'utf-8');
  const lines = content.split('\n');
  const defaults: FormDefault[] = [];

  // Pattern 1: Direct value attributes (e.g., <vscode-text-field id="path" value="/health">)
  const valueRegex = /id="([^"]+)".*value="([^"]+)"/;

  // Pattern 2: Status codes in repeatable list
  const statusCodeRegex = /class="status-code-input".*value="([^"]+)"/;

  lines.forEach((line, index) => {
    // Check for status codes specifically
    const statusMatch = line.match(statusCodeRegex);
    if (statusMatch && statusMatch[1]) {
      defaults.push({
        fieldName: 'expected-status-codes',
        formValue: statusMatch[1],
        specValue: undefined,
        lineNumber: index + 1,
      });
      return;
    }

    // Check for regular fields
    const match = line.match(valueRegex);
    if (match && match[1] && match[2]) {
      const id = match[1];
      const value = match[2];
      // Skip non-healthcheck fields
      if (
        ![
          'interval',
          'timeout',
          'jitter',
          'healthy-threshold',
          'unhealthy-threshold',
          'path',
        ].includes(id)
      ) {
        return;
      }
      defaults.push({
        fieldName: id,
        formValue: value,
        specValue: undefined,
        lineNumber: index + 1,
      });
    }
  });

  return defaults;
}

/**
 * Get API spec recommendation for a field
 */
function getSpecRecommendation(fieldName: string): unknown {
  const healthcheckMetadata = GENERATED_RESOURCE_TYPES.healthcheck?.fieldMetadata;
  if (!healthcheckMetadata?.fields) {
    return undefined;
  }

  // Map form field IDs to spec field paths
  // The field paths in metadata use dot notation as keys (e.g., "spec.interval")
  const fieldMap: Record<string, string> = {
    interval: 'spec.interval',
    timeout: 'spec.timeout',
    jitter: 'spec.jitter_percent',
    'healthy-threshold': 'spec.healthy_threshold',
    'unhealthy-threshold': 'spec.unhealthy_threshold',
    path: 'spec.http_health_check.path',
    'expected-status-codes': 'spec.http_health_check.expected_status_codes',
  };

  const specPath = fieldMap[fieldName];
  if (!specPath) {
    return undefined;
  }

  // Access the field metadata using the full path as a key
  const fieldMeta = healthcheckMetadata.fields[specPath];
  return fieldMeta?.recommendedValue;
}

/**
 * Compare form value with spec recommendation
 */
function valuesMatch(formValue: string, specValue: unknown): boolean {
  if (specValue === undefined) {
    return true; // No spec to compare against
  }

  // Handle array spec values (e.g., ["200"])
  if (Array.isArray(specValue)) {
    // Expected status codes: form has single value, spec has array with one element
    if (specValue.length === 1) {
      return formValue === String(specValue[0]);
    }
    // For other arrays, convert form value to array and compare
    return JSON.stringify([formValue]) === JSON.stringify(specValue);
  }

  // Handle numeric spec values
  if (typeof specValue === 'number') {
    return formValue === String(specValue);
  }

  // Handle string spec values
  if (typeof specValue === 'string') {
    return formValue === specValue;
  }

  // Fallback: stringify both
  return formValue === JSON.stringify(specValue);
}

/**
 * Main validation function
 */
function validateDefaults(): boolean {
  const formDefaults = extractFormDefaults();
  let hasErrors = false;

  console.log('\n=== Healthcheck Form Defaults Validation ===\n');
  console.log('Field                    | Form Value | Spec Value     | Status');
  console.log('-------------------------|------------|----------------|--------');

  formDefaults.forEach((field) => {
    field.specValue = getSpecRecommendation(field.fieldName);

    if (field.specValue === undefined) {
      console.log(
        `${field.fieldName.padEnd(24)} | ${field.formValue.padEnd(10)} | (no spec)      | SKIP`,
      );
      return;
    }

    const specStr = Array.isArray(field.specValue)
      ? JSON.stringify(field.specValue)
      : String(field.specValue);

    const match = valuesMatch(field.formValue, field.specValue);
    const status = match ? '✅ MATCH' : '❌ MISMATCH';

    console.log(
      `${field.fieldName.padEnd(24)} | ${field.formValue.padEnd(10)} | ${specStr.padEnd(14)} | ${status}`,
    );

    if (!match) {
      hasErrors = true;
      console.log(`  → Line ${field.lineNumber}: Expected ${specStr}, got "${field.formValue}"`);
    }
  });

  console.log('\n');

  if (hasErrors) {
    console.log('❌ Validation failed: Form defaults do not match API spec recommendations');
    console.log('   Fix mismatches in src/providers/healthcheckFormProvider.ts');
  } else {
    console.log('✅ All form defaults match API spec recommendations');
  }

  return !hasErrors;
}

// Run validation
try {
  const isValid = validateDefaults();
  process.exit(isValid ? 0 : 1);
} catch (error) {
  console.error('❌ Validation error:', error);
  process.exit(1);
}
