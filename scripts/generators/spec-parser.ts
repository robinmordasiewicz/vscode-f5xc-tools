/**
 * OpenAPI specification parsing utilities for F5 XC resource type generation.
 *
 * This module provides functions to parse OpenAPI spec files and extract
 * resource type information for code generation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { normalizeDescription } from './description-normalizer';

/**
 * Namespace scope type - which namespaces can contain this resource
 * - 'any': Available in user namespaces (shared, default, custom) but NOT system
 * - 'system': Only available in system namespace (literal /namespaces/system/ paths)
 * - 'shared': Only available in shared namespace (literal /namespaces/shared/ paths)
 *
 * Note: Resources with parameterized {namespace} paths get 'any' scope because they
 * can be created in user namespaces. The system namespace is reserved for system-level
 * resources like Sites and IAM objects which have literal /namespaces/system/ paths.
 */
export type NamespaceScope = 'any' | 'system' | 'shared';

/**
 * Danger level for operations - indicates risk level and affects UI behavior
 */
export type DangerLevel = 'low' | 'medium' | 'high';

/**
 * Common error information from x-ves-operation-metadata
 */
export interface CommonError {
  code: number;
  message: string;
  solution: string;
}

/**
 * Performance impact information from x-ves-operation-metadata
 */
export interface PerformanceImpact {
  latency: string;
  resourceUsage: string;
}

/**
 * Side effects information from x-ves-operation-metadata
 */
export interface SideEffects {
  creates?: string[];
  updates?: string[];
  deletes?: string[];
  invalidates?: string[];
}

/**
 * Operation metadata extracted from x-ves-operation-metadata extension.
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
 * Parsed information from an OpenAPI spec file
 */
export interface ParsedSpecInfo {
  /** Resource key (e.g., 'http_loadbalancer') */
  resourceKey: string;
  /** API path suffix (e.g., 'http_loadbalancers') */
  apiPath: string;
  /** Display name for UI (e.g., 'HTTP Load Balancers') */
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
  /** Documentation URL if available */
  documentationUrl?: string;
  /** Domain from x-ves-cli-domain extension (e.g., 'waf', 'virtual', 'dns') */
  domain?: string;
  /** Operation metadata extracted from x-ves-operation-metadata extensions */
  operationMetadata?: ResourceOperationMetadata;
}

/**
 * OpenAPI spec structure (minimal interface for what we need)
 */
interface OpenAPISpec {
  info?: {
    title?: string;
    description?: string;
    'x-ves-cli-domain'?: string;
  };
  paths?: Record<string, PathItem>;
  externalDocs?: {
    url?: string;
  };
}

interface PathItem {
  'x-displayname'?: string;
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
}

/**
 * Raw operation metadata from OpenAPI spec x-ves-operation-metadata extension
 */
interface RawOperationMetadata {
  purpose?: string;
  danger_level?: string;
  confirmation_required?: boolean;
  required_fields?: string[];
  optional_fields?: string[];
  conditions?: {
    prerequisites?: string[];
    postconditions?: string[];
  };
  side_effects?: {
    creates?: string[];
    updates?: string[];
    deletes?: string[];
    invalidates?: string[];
  };
  common_errors?: Array<{
    code: number;
    message: string;
    solution: string;
  }>;
  performance_impact?: {
    latency?: string;
    resource_usage?: string;
  };
}

interface Operation {
  operationId?: string;
  description?: string;
  externalDocs?: {
    url?: string;
  };
  'x-ves-operation-metadata'?: RawOperationMetadata;
  'x-ves-danger-level'?: string;
}

/**
 * Extract schema identifier from spec filename.
 * Example: "docs-cloud-f5-com.0073.public.ves.io.schema.views.http_loadbalancer.ves-swagger.json"
 * Returns: "ves.io.schema.views.http_loadbalancer"
 */
export function extractSchemaId(filename: string): string | null {
  const match = filename.match(/^docs-cloud-f5-com\.\d+\.public\.(.+)\.ves-swagger\.json$/);
  return match && match[1] ? match[1] : null;
}

/**
 * Derive the resource key from schema ID.
 * Example: "ves.io.schema.views.http_loadbalancer" -> "http_loadbalancer"
 * Example: "ves.io.schema.app_firewall" -> "app_firewall"
 */
export function deriveResourceKey(schemaId: string): string | null {
  const parts = schemaId.split('.');
  const schemaIndex = parts.indexOf('schema');
  if (schemaIndex === -1 || schemaIndex >= parts.length - 1) {
    return null;
  }

  // Get everything after 'schema'
  const afterSchema = parts.slice(schemaIndex + 1);

  // Skip 'views.' prefix if present
  if (afterSchema[0] === 'views' && afterSchema.length > 1) {
    return afterSchema.slice(1).join('_');
  }

  // Handle nested schemas like 'api_sec.api_crawler'
  return afterSchema.join('_');
}

/**
 * Derive the API path suffix from schema ID (pluralized form).
 * Example: "http_loadbalancer" -> "http_loadbalancers"
 */
export function deriveApiPathSuffix(resourceKey: string): string {
  // Most resources just add 's' for plural
  // Special case: already ends in 's' (rare)
  if (resourceKey.endsWith('s')) {
    return resourceKey + 'es';
  }
  // Handle 'y' ending -> 'ies' (e.g., 'policy' -> 'policies')
  // But F5 XC uses 'policys' not 'policies'
  return resourceKey + 's';
}

/**
 * Derive namespace scope from API path patterns.
 *
 * Key insight: The {namespace} placeholder is a variable that can be substituted
 * with ANY namespace name (system, shared, or custom). It does NOT mean
 * "custom namespaces only".
 *
 * - Literal /namespaces/system/ = system-only resources (e.g., Sites, IAM)
 * - Literal /namespaces/shared/ = shared-only resources (rare, ~3 paths)
 * - Parameterized {namespace} or {metadata.namespace} = ALL namespaces
 * - No namespace pattern = tenant-level, available in any namespace
 */
export function deriveNamespaceScope(fullPath: string | null): NamespaceScope {
  if (!fullPath) {
    return 'any';
  }

  // Check for literal /namespaces/system/ - system-only resources
  // These resources can ONLY exist in the system namespace
  if (fullPath.includes('/namespaces/system/')) {
    return 'system';
  }

  // Check for literal /namespaces/shared/ - shared-only resources
  // These resources can ONLY exist in the shared namespace (rare)
  if (fullPath.includes('/namespaces/shared/')) {
    return 'shared';
  }

  // Parameterized namespace placeholders ({namespace}, {metadata.namespace}, {ns})
  // work with ANY namespace - system, shared, or custom
  // Tenant-level resources (no namespace in path) are also available everywhere
  return 'any';
}

/**
 * Extract the primary API path and base from OpenAPI paths object.
 * Supports all F5 XC API bases including: config, web, gen-ai, ai_data, data,
 * bigipconnector, discovery, gia, infraprotect, nginx, observability, operate,
 * shape, terraform, scim, secret_management, and others.
 */
export function extractApiInfo(paths: Record<string, PathItem> | undefined): {
  fullPath: string | null;
  apiBase: string;
  serviceSegment?: string;
  apiPathSuffix: string | null;
  namespaceScoped: boolean;
  namespaceScope: NamespaceScope;
} {
  if (!paths) {
    return {
      fullPath: null,
      apiBase: 'config',
      apiPathSuffix: null,
      namespaceScoped: false,
      namespaceScope: 'any',
    };
  }

  const pathKeys = Object.keys(paths);

  // Universal pattern for extended paths with service segment
  // Matches: /api/{base}/{service}/namespaces/{ns}/resource_types
  // Example: /api/config/dns/namespaces/{ns}/dns_zones
  const extendedPattern =
    /^\/api\/([a-z_-]+)\/([a-z_]+)\/namespaces\/(?:\{[^}]+\}|[a-z]+)\/([a-z_]+)(?:\/\{[^}]+\})?$/;

  // Universal pattern for standard namespace-scoped paths
  // Matches: /api/{base}/namespaces/{ns}/resource_types
  // Example: /api/infraprotect/namespaces/{ns}/infraprotect_asns
  const namespacePattern =
    /^\/api\/([a-z_-]+)\/namespaces\/(?:\{[^}]+\}|[a-z]+)\/([a-z_]+)(?:\/\{[^}]+\})?$/;

  // Universal pattern for tenant-level resources (no namespace)
  // Matches: /api/{base}/resource_types
  const tenantPattern = /^\/api\/([a-z_-]+)\/([a-z_]+)(?:\/\{[^}]+\})?$/;

  // First priority: Look for extended paths with service segments
  for (const pathKey of pathKeys) {
    const match = pathKey.match(extendedPattern);
    if (match && match[1] && match[2] && match[3]) {
      return {
        fullPath: pathKey,
        apiBase: match[1],
        serviceSegment: match[2],
        apiPathSuffix: match[3],
        namespaceScoped: true,
        namespaceScope: deriveNamespaceScope(pathKey),
      };
    }
  }

  // Second priority: Standard namespace-scoped paths
  for (const pathKey of pathKeys) {
    const match = pathKey.match(namespacePattern);
    if (match && match[1] && match[2]) {
      return {
        fullPath: pathKey,
        apiBase: match[1],
        apiPathSuffix: match[2],
        namespaceScoped: true,
        namespaceScope: deriveNamespaceScope(pathKey),
      };
    }
  }

  // Third priority: Check tenant-level paths (no namespace)
  for (const pathKey of pathKeys) {
    const match = pathKey.match(tenantPattern);
    if (match && match[1] && match[2]) {
      // Skip if it matches a namespace pattern (would have matched above)
      if (pathKey.includes('/namespaces/')) {
        continue;
      }
      return {
        fullPath: pathKey,
        apiBase: match[1],
        apiPathSuffix: match[2],
        namespaceScoped: false,
        namespaceScope: 'any',
      };
    }
  }

  // Fallback: try to find any path that looks like a resource collection
  for (const pathKey of pathKeys) {
    if (pathKey.startsWith('/api/')) {
      const parts = pathKey.split('/');
      const lastPart = parts[parts.length - 1];
      // Skip if it's a path parameter or undefined
      if (lastPart && !lastPart.startsWith('{')) {
        // Extract API base from path (second segment after /api/)
        const apiBaseMatch = pathKey.match(/^\/api\/([a-z_-]+)\//);
        const apiBase = apiBaseMatch?.[1] || 'config';
        // Check for extended paths in fallback
        const extendedMatch = pathKey.match(/^\/api\/([a-z_-]+)\/([a-z_]+)\/namespaces\//);
        return {
          fullPath: pathKey,
          apiBase,
          serviceSegment: extendedMatch?.[2],
          apiPathSuffix: lastPart,
          namespaceScoped: pathKey.includes('/namespaces/'),
          namespaceScope: deriveNamespaceScope(pathKey),
        };
      }
    }
  }

  return {
    fullPath: null,
    apiBase: 'config',
    apiPathSuffix: null,
    namespaceScoped: false,
    namespaceScope: 'any',
  };
}

/**
 * Format a display name from schema title or resource key.
 * Cleans up the F5 XC API title format to user-friendly names.
 */
export function formatDisplayName(title: string | undefined, resourceKey: string): string {
  if (title) {
    // Remove "F5 Distributed Cloud Services API for " prefix
    let cleaned = title.replace(/^F5 Distributed Cloud Services API for\s+/i, '');

    // Remove schema path prefix (e.g., "ves.io.schema.views.")
    cleaned = cleaned.replace(/^ves\.io\.schema\.(views\.)?/, '');

    // Convert underscores to spaces and title case
    cleaned = cleaned
      .split(/[._]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    // Pluralize if it looks like a singular resource name
    if (!cleaned.endsWith('s') && !cleaned.endsWith('ing')) {
      cleaned += 's';
    }

    return cleaned;
  }

  // Fallback: format from resource key
  return (
    resourceKey
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + 's'
  );
}

/**
 * Extract documentation URL from spec.
 */
export function extractDocUrl(spec: OpenAPISpec): string | undefined {
  // Check top-level externalDocs
  if (spec.externalDocs?.url) {
    return spec.externalDocs.url;
  }

  // Check first path operation for externalDocs
  if (spec.paths) {
    for (const pathObj of Object.values(spec.paths)) {
      for (const method of ['get', 'post', 'put', 'delete'] as const) {
        const operation = pathObj[method];
        if (operation?.externalDocs?.url) {
          return operation.externalDocs.url;
        }
      }
    }
  }

  return undefined;
}

/**
 * Transform an operation-specific URL to a general documentation URL.
 */
export function transformToGeneralDocUrl(operationUrl: string, schemaId: string): string {
  const parts = schemaId.split('.');
  const schemaIndex = parts.indexOf('schema');
  if (schemaIndex === -1) {
    return operationUrl;
  }

  const afterSchema = parts.slice(schemaIndex + 1);
  const docPath = afterSchema.join('-').replace(/_/g, '-');

  return `https://docs.cloud.f5.com/docs-v2/api/${docPath}`;
}

/**
 * Parse a single OpenAPI spec file and return structured resource info.
 */
export function parseSpecFile(filePath: string): ParsedSpecInfo | null {
  const filename = path.basename(filePath);
  const schemaId = extractSchemaId(filename);

  if (!schemaId) {
    return null;
  }

  const resourceKey = deriveResourceKey(schemaId);
  if (!resourceKey) {
    return null;
  }

  let spec: OpenAPISpec;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    spec = JSON.parse(content) as OpenAPISpec;
  } catch (e) {
    console.error(`Error parsing spec file ${filename}:`, e);
    return null;
  }

  const apiInfo = extractApiInfo(spec.paths);
  const apiPath = apiInfo.apiPathSuffix || deriveApiPathSuffix(resourceKey);
  const displayName = formatDisplayName(spec.info?.title, resourceKey);

  // Get documentation URL
  const operationUrl = extractDocUrl(spec);
  const documentationUrl = operationUrl
    ? transformToGeneralDocUrl(operationUrl, schemaId)
    : undefined;

  // Build the fullApiPath with service segment if present
  let fullApiPath: string;
  if (apiInfo.fullPath) {
    fullApiPath = apiInfo.fullPath;
  } else if (apiInfo.serviceSegment) {
    fullApiPath = `/api/${apiInfo.apiBase}/${apiInfo.serviceSegment}/namespaces/{ns}/${apiPath}`;
  } else {
    fullApiPath = `/api/${apiInfo.apiBase}/namespaces/{ns}/${apiPath}`;
  }

  return {
    resourceKey,
    apiPath,
    displayName,
    description: normalizeDescription(spec.info?.description || ''),
    apiBase: apiInfo.apiBase,
    serviceSegment: apiInfo.serviceSegment,
    fullApiPath,
    schemaFile: filename,
    schemaId,
    namespaceScoped: apiInfo.namespaceScoped,
    namespaceScope: apiInfo.namespaceScope,
    documentationUrl,
  };
}

/**
 * Parse all OpenAPI spec files in a directory.
 * Files are sorted alphabetically for deterministic processing order.
 * @deprecated Use parseAllDomainFiles for new domain-based format
 */
export function parseAllSpecs(specDir: string): ParsedSpecInfo[] {
  if (!fs.existsSync(specDir)) {
    console.error(`Spec directory not found: ${specDir}`);
    return [];
  }

  // Sort spec files alphabetically for deterministic processing order
  const specFiles = fs
    .readdirSync(specDir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  console.log(`Found ${specFiles.length} spec files`);

  const results: ParsedSpecInfo[] = [];
  const seen = new Set<string>();

  for (const filename of specFiles) {
    const filePath = path.join(specDir, filename);
    const info = parseSpecFile(filePath);

    if (info && !seen.has(info.resourceKey)) {
      seen.add(info.resourceKey);
      results.push(info);
    }
  }

  console.log(`Successfully parsed ${results.length} unique resource types`);
  return results;
}

// ============================================================================
// Domain-based parsing functions for new merged spec format
// ============================================================================

/**
 * Derive resource key from API path suffix.
 * Example: "http_loadbalancers" -> "http_loadbalancer"
 * Example: "app_firewalls" -> "app_firewall"
 */
export function deriveResourceKeyFromApiPath(apiPath: string): string {
  // Remove trailing 's' for singular form
  if (apiPath.endsWith('ies')) {
    // policies -> policy (but F5 XC uses policys, so this may not apply)
    return apiPath.slice(0, -3) + 'y';
  }
  if (apiPath.endsWith('ses')) {
    // classes -> class
    return apiPath.slice(0, -2);
  }
  if (apiPath.endsWith('s')) {
    return apiPath.slice(0, -1);
  }
  return apiPath;
}

/**
 * Derive schema ID from API path and operation ID.
 * Example: operationId "ves.io.schema.app_firewall.API.Create" -> "ves.io.schema.app_firewall"
 */
function deriveSchemaIdFromPath(apiPath: string, pathItem: PathItem): string {
  // Try to get operationId from any method
  for (const method of ['post', 'get', 'put', 'delete'] as const) {
    const operation = pathItem[method] as { operationId?: string } | undefined;
    if (operation?.operationId) {
      // Extract schema ID from operationId
      // "ves.io.schema.app_firewall.API.Create" -> "ves.io.schema.app_firewall"
      const match = operation.operationId.match(/^(ves\.io\.schema\.[^.]+(?:\.[^.]+)*?)\.API\./);
      if (match && match[1]) {
        return match[1];
      }
    }
  }
  // Fallback: construct from apiPath
  const resourceKey = deriveResourceKeyFromApiPath(apiPath);
  return `ves.io.schema.${resourceKey}`;
}

/**
 * Convert raw operation metadata from spec to normalized OperationMetadata
 */
function convertRawMetadata(raw: RawOperationMetadata | undefined): OperationMetadata | undefined {
  if (!raw) {
    return undefined;
  }

  const result: OperationMetadata = {};

  if (raw.purpose) {
    result.purpose = raw.purpose;
  }

  if (raw.danger_level) {
    const level = raw.danger_level.toLowerCase();
    if (level === 'low' || level === 'medium' || level === 'high') {
      result.dangerLevel = level;
    }
  }

  if (raw.confirmation_required !== undefined) {
    result.confirmationRequired = raw.confirmation_required;
  }

  if (raw.required_fields && raw.required_fields.length > 0) {
    result.requiredFields = raw.required_fields;
  }

  if (raw.optional_fields && raw.optional_fields.length > 0) {
    result.optionalFields = raw.optional_fields;
  }

  if (raw.conditions?.prerequisites && raw.conditions.prerequisites.length > 0) {
    result.prerequisites = raw.conditions.prerequisites;
  }

  if (raw.conditions?.postconditions && raw.conditions.postconditions.length > 0) {
    result.postconditions = raw.conditions.postconditions;
  }

  if (raw.side_effects) {
    const sideEffects: SideEffects = {};
    if (raw.side_effects.creates?.length) {
      sideEffects.creates = raw.side_effects.creates;
    }
    if (raw.side_effects.updates?.length) {
      sideEffects.updates = raw.side_effects.updates;
    }
    if (raw.side_effects.deletes?.length) {
      sideEffects.deletes = raw.side_effects.deletes;
    }
    if (raw.side_effects.invalidates?.length) {
      sideEffects.invalidates = raw.side_effects.invalidates;
    }
    if (Object.keys(sideEffects).length > 0) {
      result.sideEffects = sideEffects;
    }
  }

  if (raw.common_errors && raw.common_errors.length > 0) {
    result.commonErrors = raw.common_errors.map((e) => ({
      code: e.code,
      message: e.message,
      solution: e.solution,
    }));
  }

  if (raw.performance_impact) {
    const impact: PerformanceImpact = {
      latency: raw.performance_impact.latency || 'unknown',
      resourceUsage: raw.performance_impact.resource_usage || 'unknown',
    };
    result.performanceImpact = impact;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Extract operation metadata from a path item (including x-ves-danger-level fallback)
 */
function extractOperationMetadata(operation: Operation | undefined): OperationMetadata | undefined {
  if (!operation) {
    return undefined;
  }

  const metadata = convertRawMetadata(operation['x-ves-operation-metadata']);

  // Fallback to x-ves-danger-level if not in operation metadata
  if (metadata && !metadata.dangerLevel && operation['x-ves-danger-level']) {
    const level = operation['x-ves-danger-level'].toLowerCase();
    if (level === 'low' || level === 'medium' || level === 'high') {
      metadata.dangerLevel = level;
    }
  }

  return metadata;
}

/**
 * Parse a domain file and extract all resource types.
 * Domain files contain multiple resource types grouped by domain.
 */
export function parseDomainFile(filePath: string): ParsedSpecInfo[] {
  const filename = path.basename(filePath);
  const results: ParsedSpecInfo[] = [];

  let spec: OpenAPISpec;
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    spec = JSON.parse(content) as OpenAPISpec;
  } catch (e) {
    console.error(`Error parsing domain file ${filename}:`, e);
    return [];
  }

  const domain = spec.info?.['x-ves-cli-domain'];
  const paths = spec.paths;

  if (!paths) {
    return [];
  }

  // Pattern for list endpoints (plural resource path)
  // Matches: /api/config/namespaces/{metadata.namespace}/http_loadbalancers
  // Also matches extended paths: /api/config/dns/namespaces/{ns}/dns_zones
  const listEndpointPattern =
    /^\/api\/([a-z_-]+)(?:\/([a-z_]+))?\/namespaces\/(?:\{[^}]+\}|system|shared)\/([a-z_]+)$/;

  const seen = new Set<string>();

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    const match = pathKey.match(listEndpointPattern);
    if (!match) {
      continue;
    }

    const apiBase = match[1];
    const serviceSegment = match[2]; // May be undefined
    const apiPath = match[3];

    // Skip if required parts are missing
    if (!apiBase || !apiPath) {
      continue;
    }

    // Skip if this is an item endpoint (ends with /{name})
    if (pathKey.endsWith('}')) {
      continue;
    }

    const resourceKey = deriveResourceKeyFromApiPath(apiPath);

    // Skip duplicates (same resource may appear in different namespace patterns)
    if (seen.has(resourceKey)) {
      continue;
    }
    seen.add(resourceKey);

    // Get display name from x-displayname extension
    const displayNameRaw = pathItem['x-displayname'] || resourceKey;
    // Clean up display name (remove trailing period, add 's' for plural)
    let displayName = displayNameRaw.replace(/\.$/, '');
    if (!displayName.endsWith('s') && !displayName.endsWith('ing')) {
      displayName += 's';
    }

    // Get description from first operation
    let description = '';
    for (const method of ['get', 'post'] as const) {
      const operation = pathItem[method] as { description?: string } | undefined;
      if (operation?.description) {
        description = normalizeDescription(operation.description);
        break;
      }
    }

    // Derive namespace scope from path
    const namespaceScope = deriveNamespaceScope(pathKey);

    // Build full API path
    const fullApiPath = pathKey;

    // Derive schema ID
    const schemaId = deriveSchemaIdFromPath(apiPath, pathItem);

    // Extract operation metadata from list endpoint (GET=list, POST=create)
    // and item endpoint (GET=get, PUT=update, DELETE=delete)
    const operationMetadata: ResourceOperationMetadata = {};

    // List endpoint operations
    const listOp = extractOperationMetadata(pathItem.get);
    if (listOp) {
      operationMetadata.list = listOp;
    }

    const createOp = extractOperationMetadata(pathItem.post);
    if (createOp) {
      operationMetadata.create = createOp;
    }

    // Look for item endpoint (pathKey + /{name})
    const itemPathKey = `${pathKey}/{name}`;
    const itemPathItem = paths[itemPathKey];
    if (itemPathItem) {
      const getOp = extractOperationMetadata(itemPathItem.get);
      if (getOp) {
        operationMetadata.get = getOp;
      }

      const updateOp = extractOperationMetadata(itemPathItem.put);
      if (updateOp) {
        operationMetadata.update = updateOp;
      }

      const deleteOp = extractOperationMetadata(itemPathItem.delete);
      if (deleteOp) {
        operationMetadata.delete = deleteOp;
      }
    }

    const result: ParsedSpecInfo = {
      resourceKey,
      apiPath,
      displayName,
      description,
      apiBase,
      serviceSegment,
      fullApiPath,
      schemaFile: filename,
      schemaId,
      namespaceScoped: true,
      namespaceScope,
      domain,
    };

    // Only include operationMetadata if we have at least one operation
    if (Object.keys(operationMetadata).length > 0) {
      result.operationMetadata = operationMetadata;
    }

    results.push(result);
  }

  return results;
}

/**
 * Parse all domain files in a directory.
 * Domain files contain merged specs grouped by F5 XC domain (waf, virtual, dns, etc.)
 */
export function parseAllDomainFiles(domainDir: string): ParsedSpecInfo[] {
  if (!fs.existsSync(domainDir)) {
    console.error(`Domain directory not found: ${domainDir}`);
    return [];
  }

  // Sort domain files alphabetically for deterministic processing order
  const domainFiles = fs
    .readdirSync(domainDir)
    .filter((f) => f.endsWith('.json'))
    .sort();
  console.log(`Found ${domainFiles.length} domain files`);

  const results: ParsedSpecInfo[] = [];
  const seen = new Set<string>();

  for (const filename of domainFiles) {
    const filePath = path.join(domainDir, filename);
    const domainResults = parseDomainFile(filePath);

    for (const info of domainResults) {
      // Handle duplicates across domain files (prefer first occurrence)
      if (!seen.has(info.resourceKey)) {
        seen.add(info.resourceKey);
        results.push(info);
      }
    }
  }

  console.log(`Successfully parsed ${results.length} unique resource types from domain files`);
  return results;
}
