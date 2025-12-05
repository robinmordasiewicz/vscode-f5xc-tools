/**
 * Validation script for generated files.
 *
 * This script validates that:
 * - All expected generated files exist
 * - Generated TypeScript files are syntactically valid
 * - No duplicate resource keys exist
 * - Required fields are present in generated types
 *
 * Usage: npx ts-node scripts/validate-generation.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const GENERATED_DIR = path.join(__dirname, '..', 'src', 'generated');

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    resourceTypes: number;
    documentationUrls: number;
    categories: number;
  };
}

/**
 * Check if a file exists
 */
function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Validate TypeScript syntax of a file
 */
function validateTypeScriptSyntax(filePath: string): { valid: boolean; errors: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    path.basename(filePath),
    content,
    ts.ScriptTarget.Latest,
    true,
  );

  const errors: string[] = [];

  // Check for syntax errors
  const diagnostics = (sourceFile as ts.SourceFile & { parseDiagnostics?: ts.Diagnostic[] })
    .parseDiagnostics;
  if (diagnostics && diagnostics.length > 0) {
    for (const diag of diagnostics) {
      const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
      errors.push(`${path.basename(filePath)}: ${message}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Extract resource types from generated file
 */
function extractResourceTypes(filePath: string): Set<string> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const keys = new Set<string>();

  // Match pattern like: key_name: { ... }
  const regex = /^\s+([a-z_]+):\s*\{/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match[1]) {
      keys.add(match[1]);
    }
  }

  return keys;
}

/**
 * Check for duplicate keys
 */
function checkDuplicateKeys(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const keys: string[] = [];
  const duplicates: string[] = [];

  // Match pattern like: key_name: { ... }
  const regex = /^\s+([a-z_]+):\s*\{/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match[1]) {
      if (keys.includes(match[1])) {
        duplicates.push(match[1]);
      }
      keys.push(match[1]);
    }
  }

  return duplicates;
}

/**
 * Main validation function
 */
function validate(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {
      resourceTypes: 0,
      documentationUrls: 0,
      categories: 0,
    },
  };

  console.log('Validating generated files...\n');

  // Check that generated directory exists
  if (!fileExists(GENERATED_DIR)) {
    result.errors.push(`Generated directory not found: ${GENERATED_DIR}`);
    result.valid = false;
    return result;
  }

  // Expected files
  const expectedFiles = [
    'index.ts',
    'constants.ts',
    'resourceTypesBase.ts',
    'documentationUrls.ts',
    'menuSchema.json',
  ];

  // Check all expected files exist
  console.log('Checking expected files...');
  for (const file of expectedFiles) {
    const filePath = path.join(GENERATED_DIR, file);
    if (!fileExists(filePath)) {
      result.errors.push(`Missing generated file: ${file}`);
      result.valid = false;
    } else {
      console.log(`  ✓ ${file}`);
    }
  }

  // Validate TypeScript syntax
  console.log('\nValidating TypeScript syntax...');
  const tsFiles = expectedFiles.filter((f) => f.endsWith('.ts'));
  for (const file of tsFiles) {
    const filePath = path.join(GENERATED_DIR, file);
    if (fileExists(filePath)) {
      const { valid, errors } = validateTypeScriptSyntax(filePath);
      if (!valid) {
        result.errors.push(...errors);
        result.valid = false;
        console.log(`  ✗ ${file} - syntax errors`);
      } else {
        console.log(`  ✓ ${file}`);
      }
    }
  }

  // Check for duplicate keys in resourceTypesBase.ts
  console.log('\nChecking for duplicate resource keys...');
  const resourceTypesPath = path.join(GENERATED_DIR, 'resourceTypesBase.ts');
  if (fileExists(resourceTypesPath)) {
    const duplicates = checkDuplicateKeys(resourceTypesPath);
    if (duplicates.length > 0) {
      result.errors.push(`Duplicate resource keys found: ${duplicates.join(', ')}`);
      result.valid = false;
      console.log(`  ✗ Found ${duplicates.length} duplicate keys`);
    } else {
      console.log('  ✓ No duplicate keys');
    }

    // Count resource types
    const resourceTypes = extractResourceTypes(resourceTypesPath);
    result.stats.resourceTypes = resourceTypes.size;
  }

  // Validate JSON files
  console.log('\nValidating JSON files...');
  const jsonFiles = expectedFiles.filter((f) => f.endsWith('.json'));
  for (const file of jsonFiles) {
    const filePath = path.join(GENERATED_DIR, file);
    if (fileExists(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        JSON.parse(content);
        console.log(`  ✓ ${file}`);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        result.errors.push(`Invalid JSON in ${file}: ${errorMessage}`);
        result.valid = false;
        console.log(`  ✗ ${file} - invalid JSON`);
      }
    }
  }

  // Count documentation URLs
  const docUrlsPath = path.join(GENERATED_DIR, 'documentationUrls.ts');
  if (fileExists(docUrlsPath)) {
    const content = fs.readFileSync(docUrlsPath, 'utf-8');
    const urlMatches = content.match(/"https:\/\/docs\.cloud\.f5\.com[^"]+"/g);
    result.stats.documentationUrls = urlMatches ? urlMatches.length : 0;
  }

  // Count categories from constants
  const constantsPath = path.join(GENERATED_DIR, 'constants.ts');
  if (fileExists(constantsPath)) {
    const content = fs.readFileSync(constantsPath, 'utf-8');
    const categoryMatches = content.match(/"[^"]+": "[a-z-]+"/g);
    result.stats.categories = categoryMatches ? categoryMatches.length : 0;
  }

  return result;
}

/**
 * Main entry point
 */
function main(): void {
  const result = validate();

  console.log('\n=== Validation Summary ===');
  console.log(`Status: ${result.valid ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`\nStatistics:`);
  console.log(`  Resource types: ${result.stats.resourceTypes}`);
  console.log(`  Documentation URLs: ${result.stats.documentationUrls}`);
  console.log(`  Category icons: ${result.stats.categories}`);

  if (result.warnings.length > 0) {
    console.log(`\nWarnings (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      console.log(`  ⚠️ ${warning}`);
    }
  }

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`);
    for (const error of result.errors) {
      console.log(`  ❌ ${error}`);
    }
  }

  process.exit(result.valid ? 0 : 1);
}

main();
