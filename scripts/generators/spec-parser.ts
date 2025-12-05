/**
 * OpenAPI specification parsing utilities for F5 XC resource type generation.
 *
 * This module provides functions to parse OpenAPI spec files and extract
 * resource type information for code generation.
 */

import * as fs from 'fs';
import * as path from 'path';

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
  /** API base: 'config' or 'web' */
  apiBase: 'config' | 'web';
  /** Full API path pattern */
  fullApiPath: string;
  /** Schema file name */
  schemaFile: string;
  /** Schema ID (e.g., 'ves.io.schema.views.http_loadbalancer') */
  schemaId: string;
  /** Whether resource is namespace-scoped */
  namespaceScoped: boolean;
  /** Documentation URL if available */
  documentationUrl?: string;
}

/**
 * OpenAPI spec structure (minimal interface for what we need)
 */
interface OpenAPISpec {
  info?: {
    title?: string;
    description?: string;
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

interface Operation {
  externalDocs?: {
    url?: string;
  };
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
 * Extract the primary API path and base from OpenAPI paths object.
 * Looks for standard CRUD paths like /api/config/namespaces/{ns}/resources
 */
export function extractApiInfo(paths: Record<string, PathItem> | undefined): {
  fullPath: string | null;
  apiBase: 'config' | 'web';
  apiPathSuffix: string | null;
  namespaceScoped: boolean;
} {
  if (!paths) {
    return { fullPath: null, apiBase: 'config', apiPathSuffix: null, namespaceScoped: false };
  }

  const pathKeys = Object.keys(paths);

  // Look for standard CRUD paths first (most common pattern)
  // Pattern: /api/config/namespaces/{ns}/resource_types
  const configNamespacePattern =
    /^\/api\/config\/namespaces\/\{[^}]+\}\/([a-z_]+)(?:\/\{[^}]+\})?$/;
  const webNamespacePattern = /^\/api\/web\/namespaces\/\{[^}]+\}\/([a-z_]+)(?:\/\{[^}]+\})?$/;

  // Pattern for tenant-level resources: /api/config/resource_types
  const configTenantPattern = /^\/api\/config\/([a-z_]+)(?:\/\{[^}]+\})?$/;
  const webTenantPattern = /^\/api\/web\/([a-z_]+)(?:\/\{[^}]+\})?$/;

  for (const pathKey of pathKeys) {
    // Check namespace-scoped config paths
    let match = pathKey.match(configNamespacePattern);
    if (match && match[1]) {
      return {
        fullPath: pathKey,
        apiBase: 'config',
        apiPathSuffix: match[1],
        namespaceScoped: true,
      };
    }

    // Check namespace-scoped web paths
    match = pathKey.match(webNamespacePattern);
    if (match && match[1]) {
      return {
        fullPath: pathKey,
        apiBase: 'web',
        apiPathSuffix: match[1],
        namespaceScoped: true,
      };
    }
  }

  // Check tenant-level paths (no namespace)
  for (const pathKey of pathKeys) {
    let match = pathKey.match(configTenantPattern);
    if (match && match[1]) {
      return {
        fullPath: pathKey,
        apiBase: 'config',
        apiPathSuffix: match[1],
        namespaceScoped: false,
      };
    }

    match = pathKey.match(webTenantPattern);
    if (match && match[1]) {
      return {
        fullPath: pathKey,
        apiBase: 'web',
        apiPathSuffix: match[1],
        namespaceScoped: false,
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
        return {
          fullPath: pathKey,
          apiBase: pathKey.includes('/api/web/') ? 'web' : 'config',
          apiPathSuffix: lastPart,
          namespaceScoped: pathKey.includes('/namespaces/'),
        };
      }
    }
  }

  return { fullPath: null, apiBase: 'config', apiPathSuffix: null, namespaceScoped: false };
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

  return {
    resourceKey,
    apiPath,
    displayName,
    description: spec.info?.description || '',
    apiBase: apiInfo.apiBase,
    fullApiPath: apiInfo.fullPath || `/api/${apiInfo.apiBase}/namespaces/{ns}/${apiPath}`,
    schemaFile: filename,
    schemaId,
    namespaceScoped: apiInfo.namespaceScoped,
    documentationUrl,
  };
}

/**
 * Parse all OpenAPI spec files in a directory.
 */
export function parseAllSpecs(specDir: string): ParsedSpecInfo[] {
  if (!fs.existsSync(specDir)) {
    console.error(`Spec directory not found: ${specDir}`);
    return [];
  }

  const specFiles = fs.readdirSync(specDir).filter((f) => f.endsWith('.json'));
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
