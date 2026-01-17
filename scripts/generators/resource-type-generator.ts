// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Resource type generator for F5 XC extension.
 *
 * Generates the base resource types from OpenAPI specifications.
 * These generated types serve as the foundation that can be extended
 * with manual overrides for UI-specific properties like icons and categories.
 *
 * Namespace scope overrides from namespace-scope-overrides.json are applied
 * during generation to ensure scope corrections are part of the generated output.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ParsedSpecInfo,
  parseAllSpecs,
  parseAllDomainFiles,
  NamespaceScope,
  ResourceOperationMetadata,
} from './spec-parser';

// Re-export types that are used in generated output
export type {
  OperationMetadata,
  DangerLevel,
  CommonError,
  PerformanceImpact,
  SideEffects,
  ResourceOperationMetadata,
  ResourceFieldMetadata,
  FieldMetadata,
  FieldRequiredFor,
} from './spec-parser';

/**
 * Structure of the namespace scope overrides file
 */
interface NamespaceScopeOverrides {
  overrides: {
    system: { resources: string[] };
    shared: { resources: string[] };
    any: { resources: string[] };
  };
}

/**
 * Structure of the display name overrides file
 */
interface DisplayNameOverride {
  displayName: string;
  reason?: string;
}

interface DisplayNameOverrides {
  overrides: Record<string, DisplayNameOverride>;
}

/**
 * Load namespace scope overrides from JSON file
 */
function loadScopeOverrides(overridesPath: string): NamespaceScopeOverrides | null {
  if (!fs.existsSync(overridesPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(overridesPath, 'utf-8');
    return JSON.parse(content) as NamespaceScopeOverrides;
  } catch (error) {
    console.warn(`Warning: Could not load scope overrides from ${overridesPath}:`, error);
    return null;
  }
}

/**
 * Load display name overrides from JSON file
 */
function loadDisplayNameOverrides(overridesPath: string): DisplayNameOverrides | null {
  if (!fs.existsSync(overridesPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(overridesPath, 'utf-8');
    return JSON.parse(content) as DisplayNameOverrides;
  } catch (error) {
    console.warn(`Warning: Could not load display name overrides from ${overridesPath}:`, error);
    return null;
  }
}

/**
 * Apply namespace scope overrides to parsed specs
 */
function applyScopeOverrides(specs: ParsedSpecInfo[], overrides: NamespaceScopeOverrides): number {
  let count = 0;
  const systemResources = new Set(overrides.overrides.system.resources);
  const sharedResources = new Set(overrides.overrides.shared.resources);
  const anyResources = new Set(overrides.overrides.any.resources);

  for (const spec of specs) {
    if (systemResources.has(spec.resourceKey)) {
      spec.namespaceScope = 'system';
      count++;
    } else if (sharedResources.has(spec.resourceKey)) {
      spec.namespaceScope = 'shared';
      count++;
    } else if (anyResources.has(spec.resourceKey)) {
      spec.namespaceScope = 'any';
      count++;
    }
  }

  return count;
}

/**
 * Apply display name overrides to parsed specs
 */
function applyDisplayNameOverrides(
  specs: ParsedSpecInfo[],
  overrides: DisplayNameOverrides,
): number {
  let count = 0;

  for (const spec of specs) {
    const override = overrides.overrides[spec.resourceKey];
    if (override) {
      spec.displayName = override.displayName;
      count++;
    }
  }

  return count;
}

// Re-export types for use by other modules
export { ParsedSpecInfo, NamespaceScope } from './spec-parser';

/**
 * Serializable field metadata for generated output.
 * Contains only fields with meaningful metadata (defaults or required-for).
 */
export interface GeneratedFieldMetadata {
  /** Server-provided default value for this field */
  default?: unknown;
  /** Whether server applies a default for this field */
  serverDefault?: boolean;
  /** When this field is required */
  requiredFor?: {
    create?: boolean;
    update?: boolean;
  };
}

/**
 * Generated resource type interface matching what can be extracted from specs
 */
export interface GeneratedResourceTypeInfo {
  /** API path suffix (e.g., 'http_loadbalancers') */
  apiPath: string;
  /** Display name for UI */
  displayName: string;
  /** Description from spec */
  description: string;
  /** API base (e.g., 'config', 'web', 'infraprotect', 'shape', etc.) */
  apiBase: string;
  /** Service segment for extended API paths (e.g., 'dns' for /api/config/dns/namespaces/...) */
  serviceSegment?: string;
  /** Full API path pattern */
  fullApiPath: string;
  /** Schema file name */
  schemaFile: string;
  /** Schema ID */
  schemaId: string;
  /** Whether resource is namespace-scoped */
  namespaceScoped: boolean;
  /** Namespace scope - derived from API path patterns */
  namespaceScope: NamespaceScope;
  /** Documentation URL */
  documentationUrl?: string;
  /** Domain from x-f5xc-cli-domain extension (e.g., 'waf', 'virtual', 'dns') */
  domain?: string;
  /** Operation metadata for CRUD operations (from x-f5xc-operation-metadata) */
  operationMetadata?: ResourceOperationMetadata;
  /** Field metadata for server defaults and required fields */
  fieldMetadata?: {
    /** Map of field paths to their metadata */
    fields: Record<string, GeneratedFieldMetadata>;
    /** List of field paths that have server defaults */
    serverDefaultFields?: string[];
    /** List of field paths that user must provide at creation */
    userRequiredFields?: string[];
  };
}

/**
 * Convert parsed spec info to generated resource type info
 */
function toGeneratedTypeInfo(info: ParsedSpecInfo): GeneratedResourceTypeInfo {
  const result: GeneratedResourceTypeInfo = {
    apiPath: info.apiPath,
    displayName: info.displayName,
    description: info.description,
    apiBase: info.apiBase,
    fullApiPath: info.fullApiPath,
    schemaFile: info.schemaFile,
    schemaId: info.schemaId,
    namespaceScoped: info.namespaceScoped,
    namespaceScope: info.namespaceScope,
    documentationUrl: info.documentationUrl,
  };

  // Only include serviceSegment if it's defined
  if (info.serviceSegment) {
    result.serviceSegment = info.serviceSegment;
  }

  // Only include domain if it's defined
  if (info.domain) {
    result.domain = info.domain;
  }

  // Only include operationMetadata if it's defined and has content
  if (info.operationMetadata && Object.keys(info.operationMetadata).length > 0) {
    result.operationMetadata = info.operationMetadata;
  }

  // Only include fieldMetadata if it's defined and has fields
  if (info.fieldMetadata && Object.keys(info.fieldMetadata.fields).length > 0) {
    // Convert FieldMetadata to GeneratedFieldMetadata (strip unnecessary properties)
    const generatedFields: Record<string, GeneratedFieldMetadata> = {};

    for (const [path, meta] of Object.entries(info.fieldMetadata.fields)) {
      const genMeta: GeneratedFieldMetadata = {};

      if (meta.default !== undefined) {
        genMeta.default = meta.default;
      }
      if (meta.serverDefault) {
        genMeta.serverDefault = true;
      }
      if (meta.requiredFor) {
        const reqFor: { create?: boolean; update?: boolean } = {};
        if (meta.requiredFor.create !== undefined) {
          reqFor.create = meta.requiredFor.create;
        }
        if (meta.requiredFor.update !== undefined) {
          reqFor.update = meta.requiredFor.update;
        }
        if (Object.keys(reqFor).length > 0) {
          genMeta.requiredFor = reqFor;
        }
      }

      // Only include if there's meaningful metadata
      if (Object.keys(genMeta).length > 0) {
        generatedFields[path] = genMeta;
      }
    }

    // Only include if we have fields after filtering
    if (Object.keys(generatedFields).length > 0) {
      result.fieldMetadata = {
        fields: generatedFields,
      };

      // Include arrays only if they have items
      if (info.fieldMetadata.serverDefaultFields.length > 0) {
        result.fieldMetadata.serverDefaultFields = info.fieldMetadata.serverDefaultFields;
      }
      if (info.fieldMetadata.userRequiredFields.length > 0) {
        result.fieldMetadata.userRequiredFields = info.fieldMetadata.userRequiredFields;
      }
    }
  }

  return result;
}

/**
 * Generate the resourceTypesBase.ts file content
 */
export function generateResourceTypesContent(specs: ParsedSpecInfo[]): string {
  // Sort specs by resourceKey for deterministic output
  const sortedSpecs = [...specs].sort((a, b) => a.resourceKey.localeCompare(b.resourceKey));

  // Build the GENERATED_RESOURCE_TYPES object with sorted keys
  const resourceTypes: Record<string, GeneratedResourceTypeInfo> = {};
  for (const spec of sortedSpecs) {
    resourceTypes[spec.resourceKey] = toGeneratedTypeInfo(spec);
  }

  // Build the API_PATH_TO_RESOURCE_KEY reverse lookup (sorted for deterministic output)
  const apiPathToKey: Record<string, string> = {};
  for (const spec of sortedSpecs) {
    apiPathToKey[spec.apiPath] = spec.resourceKey;
  }

  // Pretty print with proper TypeScript formatting
  // Keep double quotes for values since they're properly escaped by JSON.stringify
  // Only remove quotes from keys that are valid JS identifiers (no dots, dashes, etc.)
  const resourceTypesJson = JSON.stringify(resourceTypes, null, 2).replace(
    /"([a-zA-Z_$][a-zA-Z0-9_$]*)":/g,
    '$1:',
  );

  const apiPathToKeyJson = JSON.stringify(apiPathToKey, null, 2).replace(/"([^"]+)":/g, "'$1':"); // Use single quotes for keys in reverse lookup

  return `/**
 * Auto-generated resource types from F5 XC OpenAPI specifications.
 * DO NOT EDIT - This file is generated by scripts/generate-resource-types.ts
 *
 * Total resource types: ${sortedSpecs.length}
 */

/**
 * Namespace scope type - which namespaces can contain this resource
 * - 'any': Available in user namespaces (shared, default, custom) but NOT system
 * - 'system': Only available in system namespace (literal /namespaces/system/ paths)
 * - 'shared': Only available in shared namespace (literal /namespaces/shared/ paths)
 */
export type NamespaceScope = 'any' | 'system' | 'shared';

/**
 * Danger level for operations - indicates risk level and affects UI behavior
 */
export type DangerLevel = 'low' | 'medium' | 'high';

/**
 * Common error information from x-f5xc-operation-metadata
 */
export interface CommonError {
  code: number;
  message: string;
  solution: string;
}

/**
 * Performance impact information from x-f5xc-operation-metadata
 */
export interface PerformanceImpact {
  latency: string;
  resourceUsage: string;
}

/**
 * Side effects information from x-f5xc-operation-metadata
 */
export interface SideEffects {
  creates?: string[];
  updates?: string[];
  deletes?: string[];
  invalidates?: string[];
}

/**
 * Operation metadata extracted from x-f5xc-operation-metadata extension.
 * Provides rich context about API operations for UX enhancements.
 */
export interface OperationMetadata {
  /** Human-readable purpose of the operation */
  purpose?: string;
  /** Risk level of the operation */
  dangerLevel?: DangerLevel;
  /** Whether user confirmation should be required */
  confirmationRequired?: boolean;
  /** Required fields for the operation */
  requiredFields?: string[];
  /** Optional fields for the operation */
  optionalFields?: string[];
  /** Prerequisites that must be met before operation */
  prerequisites?: string[];
  /** Expected outcomes after successful operation */
  postconditions?: string[];
  /** Side effects the operation may cause */
  sideEffects?: SideEffects;
  /** Common errors and their solutions */
  commonErrors?: CommonError[];
  /** Performance impact information */
  performanceImpact?: PerformanceImpact;
}

/**
 * Collection of operation metadata for all CRUD operations on a resource
 */
export interface ResourceOperationMetadata {
  list?: OperationMetadata;
  get?: OperationMetadata;
  create?: OperationMetadata;
  update?: OperationMetadata;
  delete?: OperationMetadata;
}

/**
 * Metadata for a single field in a resource schema.
 * Contains server default and required-for information.
 */
export interface GeneratedFieldMetadata {
  /** Server-provided default value for this field */
  default?: unknown;
  /** Whether server applies a default for this field (from x-f5xc-server-default) */
  serverDefault?: boolean;
  /** When this field is required (from x-f5xc-required-for) */
  requiredFor?: {
    create?: boolean;
    update?: boolean;
  };
}

/**
 * Complete field metadata for a resource type.
 * Provides information about server defaults and user requirements.
 */
export interface ResourceFieldMetadata {
  /** Map of field paths to their metadata */
  fields: Record<string, GeneratedFieldMetadata>;
  /** List of field paths that have server defaults */
  serverDefaultFields?: string[];
  /** List of field paths that user must provide at creation */
  userRequiredFields?: string[];
}

/**
 * Information about a generated resource type.
 * Contains data that can be extracted directly from OpenAPI specs.
 */
export interface GeneratedResourceTypeInfo {
  /** API path suffix (e.g., 'http_loadbalancers') */
  apiPath: string;
  /** Display name for UI */
  displayName: string;
  /** Description from spec */
  description: string;
  /** API base (e.g., 'config', 'web', 'infraprotect', 'shape', etc.) */
  apiBase: string;
  /** Service segment for extended API paths (e.g., 'dns' for /api/config/dns/namespaces/...) */
  serviceSegment?: string;
  /** Full API path pattern */
  fullApiPath: string;
  /** Schema file name */
  schemaFile: string;
  /** Schema ID (e.g., 'ves.io.schema.views.http_loadbalancer') */
  schemaId: string;
  /** Whether resource is namespace-scoped */
  namespaceScoped: boolean;
  /** Namespace scope - derived from API path patterns */
  namespaceScope: NamespaceScope;
  /** Documentation URL */
  documentationUrl?: string;
  /** Domain from x-f5xc-cli-domain extension (e.g., 'waf', 'virtual', 'dns') */
  domain?: string;
  /** Operation metadata for CRUD operations (from x-f5xc-operation-metadata) */
  operationMetadata?: ResourceOperationMetadata;
  /** Field metadata for server defaults and required fields */
  fieldMetadata?: ResourceFieldMetadata;
}

/**
 * Auto-generated resource types from OpenAPI specifications.
 * This is the base data that gets merged with manual overrides.
 */
export const GENERATED_RESOURCE_TYPES: Record<string, GeneratedResourceTypeInfo> = ${resourceTypesJson};

/**
 * Reverse lookup: API path suffix -> resource key
 * Useful for parsing API responses back to resource types.
 */
export const API_PATH_TO_RESOURCE_KEY: Record<string, string> = ${apiPathToKeyJson};

/**
 * Get the resource key from an API path suffix.
 *
 * @param apiPath - The API path suffix (e.g., 'http_loadbalancers')
 * @returns The resource key or undefined if not found
 */
export function getResourceKeyFromApiPath(apiPath: string): string | undefined {
  return API_PATH_TO_RESOURCE_KEY[apiPath];
}

/**
 * Get the generated resource type info for a key.
 *
 * @param key - The resource key (e.g., 'http_loadbalancer')
 * @returns The generated resource type info or undefined
 */
export function getGeneratedResourceType(key: string): GeneratedResourceTypeInfo | undefined {
  return GENERATED_RESOURCE_TYPES[key];
}

/**
 * Get all generated resource type keys.
 *
 * @returns Array of all resource type keys
 */
export function getAllGeneratedResourceKeys(): string[] {
  return Object.keys(GENERATED_RESOURCE_TYPES);
}
`;
}

/**
 * Generate resource types from spec files and write to output file
 * @param specDir - Directory containing OpenAPI spec files
 * @param outputPath - Path for generated TypeScript file
 * @param scopeOverridesPath - Optional path to namespace scope overrides JSON file
 * @param displayNameOverridesPath - Optional path to display name overrides JSON file
 */
export function generateResourceTypesFile(
  specDir: string,
  outputPath: string,
  scopeOverridesPath?: string,
  displayNameOverridesPath?: string,
): ParsedSpecInfo[] {
  const specs = parseAllSpecs(specDir);

  if (specs.length === 0) {
    console.error('No specs parsed successfully');
    return [];
  }

  // Apply namespace scope overrides if provided
  if (scopeOverridesPath) {
    const overrides = loadScopeOverrides(scopeOverridesPath);
    if (overrides) {
      const overrideCount = applyScopeOverrides(specs, overrides);
      console.log(`Applied ${overrideCount} namespace scope overrides`);
    }
  }

  // Apply display name overrides if provided
  if (displayNameOverridesPath) {
    const overrides = loadDisplayNameOverrides(displayNameOverridesPath);
    if (overrides) {
      const overrideCount = applyDisplayNameOverrides(specs, overrides);
      console.log(`Applied ${overrideCount} display name overrides`);
    }
  }

  const content = generateResourceTypesContent(specs);
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(`Generated: ${outputPath} with ${specs.length} resource types`);

  return specs;
}

/**
 * Generate resource types from domain files and write to output file.
 * Domain files are merged OpenAPI specs organized by x-f5xc-cli-domain.
 *
 * @param domainDir - Directory containing domain-based OpenAPI spec files
 * @param outputPath - Path for generated TypeScript file
 * @param scopeOverridesPath - Optional path to namespace scope overrides JSON file
 * @param displayNameOverridesPath - Optional path to display name overrides JSON file
 */
export function generateResourceTypesFromDomainFiles(
  domainDir: string,
  outputPath: string,
  scopeOverridesPath?: string,
  displayNameOverridesPath?: string,
): ParsedSpecInfo[] {
  const specs = parseAllDomainFiles(domainDir);

  if (specs.length === 0) {
    console.error('No specs parsed successfully from domain files');
    return [];
  }

  console.log(`Parsed ${specs.length} resource types from domain files`);

  // Apply namespace scope overrides if provided
  if (scopeOverridesPath) {
    const overrides = loadScopeOverrides(scopeOverridesPath);
    if (overrides) {
      const overrideCount = applyScopeOverrides(specs, overrides);
      console.log(`Applied ${overrideCount} namespace scope overrides`);
    }
  }

  // Apply display name overrides if provided
  if (displayNameOverridesPath) {
    const overrides = loadDisplayNameOverrides(displayNameOverridesPath);
    if (overrides) {
      const overrideCount = applyDisplayNameOverrides(specs, overrides);
      console.log(`Applied ${overrideCount} display name overrides`);
    }
  }

  const content = generateResourceTypesContent(specs);
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, content, 'utf-8');
  console.log(`Generated: ${outputPath} with ${specs.length} resource types`);

  return specs;
}
