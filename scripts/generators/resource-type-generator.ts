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
import { ParsedSpecInfo, parseAllSpecs, NamespaceScope } from './spec-parser';

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

// Re-export types for use by other modules
export { ParsedSpecInfo, NamespaceScope } from './spec-parser';

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
  /** API base: 'config' or 'web' */
  apiBase: 'config' | 'web';
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
  const resourceTypesJson = JSON.stringify(resourceTypes, null, 2)
    .replace(/"([^"]+)":/g, '$1:') // Remove quotes from keys
    .replace(/: "config"/g, ": 'config'") // Use single quotes for string literals
    .replace(/: "web"/g, ": 'web'");

  const apiPathToKeyJson = JSON.stringify(apiPathToKey, null, 2).replace(/"([^"]+)":/g, "'$1':"); // Use single quotes for keys

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
  /** API base: 'config' or 'web' */
  apiBase: 'config' | 'web';
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
 * @param overridesPath - Optional path to namespace scope overrides JSON file
 */
export function generateResourceTypesFile(
  specDir: string,
  outputPath: string,
  overridesPath?: string,
): ParsedSpecInfo[] {
  const specs = parseAllSpecs(specDir);

  if (specs.length === 0) {
    console.error('No specs parsed successfully');
    return [];
  }

  // Apply namespace scope overrides if provided
  if (overridesPath) {
    const overrides = loadScopeOverrides(overridesPath);
    if (overrides) {
      const overrideCount = applyScopeOverrides(specs, overrides);
      console.log(`Applied ${overrideCount} namespace scope overrides`);
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
