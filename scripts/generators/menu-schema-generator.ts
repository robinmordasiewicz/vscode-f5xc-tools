/**
 * Menu Schema Generator
 *
 * Analyzes OpenAPI specs to generate a deterministic menu schema
 * for different namespace types (system, shared, default, custom).
 *
 * This script produces a JSON schema that defines exactly which
 * resource types appear in each namespace context.
 *
 * The process:
 * 1. Parse all OpenAPI specs and derive namespace scope from API paths
 * 2. Apply manual overrides from namespace-scope-overrides.json
 * 3. Generate menu schema showing resources per namespace type
 */

import * as fs from 'fs';
import * as path from 'path';
import { normalizeDescription } from './description-normalizer';

/**
 * Manual override configuration structure
 */
interface ScopeOverrides {
  overrides: {
    system: { resources: string[] };
    shared: { resources: string[] };
    any: { resources: string[] };
  };
}

/**
 * Namespace scope derived from API path patterns
 */
type NamespaceScope = 'system' | 'shared' | 'any';

/**
 * API path analysis result
 */
interface PathAnalysis {
  path: string;
  hasSystemLiteral: boolean;
  hasSharedLiteral: boolean;
  hasNamespaceParam: boolean;
  hasMetadataNamespaceParam: boolean;
  isNamespaceScoped: boolean;
}

/**
 * Resource type with all its API paths analyzed
 */
interface ResourceAnalysis {
  resourceKey: string;
  displayName: string;
  description: string;
  apiBase: 'config' | 'web';
  schemaFile: string;
  paths: PathAnalysis[];
  derivedScope: NamespaceScope;
  scopeReason: string;
}

/**
 * Menu schema for a specific namespace type
 */
interface NamespaceMenuSchema {
  namespaceType: 'system' | 'shared' | 'default' | 'custom';
  description: string;
  categories: {
    [category: string]: {
      icon: string;
      resources: {
        key: string;
        displayName: string;
        apiPath: string;
        scope: NamespaceScope;
      }[];
    };
  };
  resourceCount: number;
}

/**
 * Complete menu schema output
 */
interface MenuSchemaOutput {
  totalSpecs: number;
  totalResources: number;
  scopeSummary: {
    system: number;
    shared: number;
    any: number;
  };
  namespaceSchemas: {
    system: NamespaceMenuSchema;
    shared: NamespaceMenuSchema;
    default: NamespaceMenuSchema;
    custom: NamespaceMenuSchema;
  };
  resourceAnalysis: ResourceAnalysis[];
}

/**
 * Category configuration - maps resource patterns to categories
 */
const CATEGORY_MAPPINGS: { pattern: RegExp; category: string; icon: string }[] = [
  // Load Balancing
  {
    pattern: /loadbalancer|origin_pool|healthcheck|route|endpoint/i,
    category: 'Load Balancing',
    icon: 'server-process',
  },
  // Security
  {
    pattern: /firewall|waf|security|policy|malicious|bot_defense/i,
    category: 'Security',
    icon: 'shield',
  },
  // Networking
  {
    pattern: /network|virtual_network|vn_|segment|route_table|interface/i,
    category: 'Networking',
    icon: 'type-hierarchy',
  },
  // Sites
  {
    pattern: /site|aws_vpc|azure_vnet|gcp_vpc|voltstack|fleet/i,
    category: 'Sites',
    icon: 'server',
  },
  // DNS
  { pattern: /dns|zone|record/i, category: 'DNS', icon: 'globe' },
  // IAM
  {
    pattern: /user|role|credential|api_credential|service_credential|namespace_role|known_label/i,
    category: 'Identity & Access',
    icon: 'account',
  },
  // Observability
  { pattern: /alert|log|metric|monitor|trace/i, category: 'Observability', icon: 'graph' },
  // Cloud Connect
  {
    pattern: /cloud_connect|cloud_link|aws_tgw|azure_vwan/i,
    category: 'Cloud Connect',
    icon: 'cloud',
  },
  // API Protection
  {
    pattern: /api_definition|api_discovery|api_endpoint/i,
    category: 'API Protection',
    icon: 'lock',
  },
  // Service Mesh
  { pattern: /service_mesh|mesh|sidecar/i, category: 'Service Mesh', icon: 'extensions' },
  // Default
  { pattern: /.*/, category: 'Configuration', icon: 'settings-gear' },
];

/**
 * Extract schema ID from spec filename
 */
function extractSchemaId(filename: string): string | null {
  const match = filename.match(/public\.(ves\.io\.schema\.[^.]+(?:\.[^.]+)*?)\.ves-swagger\.json$/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

/**
 * Convert schema ID to resource key
 */
function schemaIdToResourceKey(schemaId: string): string {
  const parts = schemaId.split('.');
  const lastPart = parts[parts.length - 1] || schemaId;
  return lastPart.replace(/-/g, '_');
}

/**
 * Analyze a single API path for namespace patterns
 */
function analyzePath(apiPath: string): PathAnalysis {
  return {
    path: apiPath,
    hasSystemLiteral: apiPath.includes('/namespaces/system/'),
    hasSharedLiteral: apiPath.includes('/namespaces/shared/'),
    hasNamespaceParam: apiPath.includes('/namespaces/{namespace}/'),
    hasMetadataNamespaceParam: apiPath.includes('/namespaces/{metadata.namespace}/'),
    isNamespaceScoped: apiPath.includes('/namespaces/'),
  };
}

/**
 * Derive namespace scope from analyzed paths
 */
function deriveScope(paths: PathAnalysis[]): { scope: NamespaceScope; reason: string } {
  const hasSystemLiteral = paths.some((p) => p.hasSystemLiteral);
  const hasSharedLiteral = paths.some((p) => p.hasSharedLiteral);
  const hasNamespaceParam = paths.some((p) => p.hasNamespaceParam || p.hasMetadataNamespaceParam);
  const isNamespaceScoped = paths.some((p) => p.isNamespaceScoped);

  // If has parameterized namespace path, it's available in user namespaces
  if (hasNamespaceParam) {
    return {
      scope: 'any',
      reason:
        'Has parameterized {namespace} path - available in user namespaces (shared, default, custom)',
    };
  }

  // If only has literal /namespaces/system/ path
  if (hasSystemLiteral && !hasSharedLiteral && !hasNamespaceParam) {
    return {
      scope: 'system',
      reason: 'Only has literal /namespaces/system/ path - system namespace only',
    };
  }

  // If only has literal /namespaces/shared/ path
  if (hasSharedLiteral && !hasSystemLiteral && !hasNamespaceParam) {
    return {
      scope: 'shared',
      reason: 'Only has literal /namespaces/shared/ path - shared namespace only',
    };
  }

  // If not namespace scoped at all (tenant-level)
  if (!isNamespaceScoped) {
    return {
      scope: 'system',
      reason: 'No namespace in path - tenant-level resource, shown in system namespace',
    };
  }

  // Default to 'any' for other cases
  return {
    scope: 'any',
    reason: 'Default scope - available in user namespaces',
  };
}

/**
 * Determine category for a resource
 */
function getCategory(resourceKey: string, displayName: string): { category: string; icon: string } {
  const searchText = `${resourceKey} ${displayName}`.toLowerCase();

  for (const mapping of CATEGORY_MAPPINGS) {
    if (mapping.pattern.test(searchText)) {
      return { category: mapping.category, icon: mapping.icon };
    }
  }

  return { category: 'Configuration', icon: 'settings-gear' };
}

/**
 * OpenAPI spec structure (minimal interface for what we need)
 */
interface OpenAPISpec {
  info?: {
    title?: string;
    description?: string;
  };
  paths?: Record<string, unknown>;
}

/**
 * Parse an OpenAPI spec file
 */
function parseSpec(filePath: string): ResourceAnalysis | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const spec = JSON.parse(content) as OpenAPISpec;
    const filename = path.basename(filePath);

    const schemaId = extractSchemaId(filename);
    if (!schemaId) {
      return null;
    }

    const resourceKey = schemaIdToResourceKey(schemaId);

    // Extract display name and description
    const displayName =
      spec.info?.title ||
      resourceKey.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const descriptionRaw = spec.info?.description || '';

    // Determine API base from paths
    const pathKeys = Object.keys(spec.paths || {});
    const apiBase: 'config' | 'web' = pathKeys.some((p) => p.startsWith('/api/web'))
      ? 'web'
      : 'config';

    // Analyze all paths
    const paths = pathKeys.map(analyzePath);

    // Derive scope
    const { scope, reason } = deriveScope(paths);

    return {
      resourceKey,
      displayName,
      description: normalizeDescription(descriptionRaw.substring(0, 200)),
      apiBase,
      schemaFile: filename,
      paths,
      derivedScope: scope,
      scopeReason: reason,
    };
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return null;
  }
}

/**
 * Check if a resource should appear in a given namespace type
 */
function isResourceAvailableForNamespace(
  resource: ResourceAnalysis,
  namespaceType: 'system' | 'shared' | 'default' | 'custom',
): boolean {
  switch (resource.derivedScope) {
    case 'system':
      // System-scoped resources only appear in system namespace
      return namespaceType === 'system';
    case 'shared':
      // Shared-scoped resources only appear in shared namespace
      return namespaceType === 'shared';
    case 'any':
    default:
      // 'any' scope means user namespaces (shared, default, custom) but NOT system
      return namespaceType !== 'system';
  }
}

/**
 * Build menu schema for a specific namespace type
 */
function buildNamespaceSchema(
  resources: ResourceAnalysis[],
  namespaceType: 'system' | 'shared' | 'default' | 'custom',
): NamespaceMenuSchema {
  const categories: NamespaceMenuSchema['categories'] = {};

  const descriptions: Record<'system' | 'shared' | 'default' | 'custom', string> = {
    system: 'System namespace - contains tenant-level system resources like Sites and IAM objects',
    shared: 'Shared namespace - resources shared across all namespaces',
    default: 'Default namespace - standard user namespace for application resources',
    custom: 'Custom namespaces - user-created namespaces for organizing application resources',
  };

  let resourceCount = 0;

  for (const resource of resources) {
    if (!isResourceAvailableForNamespace(resource, namespaceType)) {
      continue;
    }

    const { category, icon } = getCategory(resource.resourceKey, resource.displayName);

    if (!categories[category]) {
      categories[category] = {
        icon,
        resources: [],
      };
    }

    categories[category].resources.push({
      key: resource.resourceKey,
      displayName: resource.displayName,
      apiPath: resource.resourceKey + 's', // Simplified - actual apiPath would need more logic
      scope: resource.derivedScope,
    });

    resourceCount++;
  }

  // Sort resources within each category
  for (const cat of Object.values(categories)) {
    cat.resources.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  return {
    namespaceType,
    description: descriptions[namespaceType],
    categories,
    resourceCount,
  };
}

/**
 * Load manual scope overrides
 */
function loadOverrides(overridesPath: string): ScopeOverrides | null {
  try {
    const content = fs.readFileSync(overridesPath, 'utf-8');
    return JSON.parse(content) as ScopeOverrides;
  } catch {
    console.warn(`Warning: Could not load overrides from ${overridesPath}`);
    return null;
  }
}

/**
 * Apply manual overrides to resources
 */
function applyOverrides(resources: ResourceAnalysis[], overrides: ScopeOverrides): number {
  let overrideCount = 0;

  for (const resource of resources) {
    // Check system overrides
    if (overrides.overrides.system.resources.includes(resource.resourceKey)) {
      if (resource.derivedScope !== 'system') {
        resource.derivedScope = 'system';
        resource.scopeReason = 'Manual override: system-only resource per business rules';
        overrideCount++;
      }
      continue;
    }

    // Check shared overrides
    if (overrides.overrides.shared.resources.includes(resource.resourceKey)) {
      if (resource.derivedScope !== 'shared') {
        resource.derivedScope = 'shared';
        resource.scopeReason = 'Manual override: shared-only resource per business rules';
        overrideCount++;
      }
      continue;
    }

    // Check any overrides
    if (overrides.overrides.any.resources.includes(resource.resourceKey)) {
      if (resource.derivedScope !== 'any') {
        resource.derivedScope = 'any';
        resource.scopeReason = 'Manual override: user namespace resource per business rules';
        overrideCount++;
      }
    }
  }

  return overrideCount;
}

/**
 * Main generator function
 */
function generateMenuSchema(specsDir: string, outputPath: string, overridesPath: string): void {
  console.log('Generating menu schema from OpenAPI specs...\n');

  // Find all spec files
  const specFiles = fs
    .readdirSync(specsDir)
    .filter((f) => f.endsWith('.json') && f.includes('ves-swagger'))
    .map((f) => path.join(specsDir, f));

  console.log(`Found ${specFiles.length} spec files\n`);

  // Parse all specs
  const resources: ResourceAnalysis[] = [];
  for (const file of specFiles) {
    const analysis = parseSpec(file);
    if (analysis) {
      resources.push(analysis);
    }
  }

  // Sort by resource key
  resources.sort((a, b) => a.resourceKey.localeCompare(b.resourceKey));

  console.log(`Successfully parsed ${resources.length} resource types\n`);

  // Load and apply overrides
  const overrides = loadOverrides(overridesPath);
  if (overrides) {
    const overrideCount = applyOverrides(resources, overrides);
    console.log(`Applied ${overrideCount} manual scope overrides\n`);
  }

  // Count by scope (after overrides)
  const scopeCounts = {
    system: resources.filter((r) => r.derivedScope === 'system').length,
    shared: resources.filter((r) => r.derivedScope === 'shared').length,
    any: resources.filter((r) => r.derivedScope === 'any').length,
  };

  console.log('Scope distribution (after overrides):');
  console.log(`  system: ${scopeCounts.system} resources`);
  console.log(`  shared: ${scopeCounts.shared} resources`);
  console.log(`  any (user namespaces): ${scopeCounts.any} resources\n`);

  // Build namespace schemas (no timestamp for deterministic output)
  const output: MenuSchemaOutput = {
    totalSpecs: specFiles.length,
    totalResources: resources.length,
    scopeSummary: scopeCounts,
    namespaceSchemas: {
      system: buildNamespaceSchema(resources, 'system'),
      shared: buildNamespaceSchema(resources, 'shared'),
      default: buildNamespaceSchema(resources, 'default'),
      custom: buildNamespaceSchema(resources, 'custom'),
    },
    resourceAnalysis: resources,
  };

  // Write output
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Generated: ${outputPath}`);

  // Print summary
  console.log('\nMenu schema summary:');
  console.log(
    `  system namespace: ${output.namespaceSchemas.system.resourceCount} resources in ${Object.keys(output.namespaceSchemas.system.categories).length} categories`,
  );
  console.log(
    `  shared namespace: ${output.namespaceSchemas.shared.resourceCount} resources in ${Object.keys(output.namespaceSchemas.shared.categories).length} categories`,
  );
  console.log(
    `  default namespace: ${output.namespaceSchemas.default.resourceCount} resources in ${Object.keys(output.namespaceSchemas.default.categories).length} categories`,
  );
  console.log(
    `  custom namespaces: ${output.namespaceSchemas.custom.resourceCount} resources in ${Object.keys(output.namespaceSchemas.custom.categories).length} categories`,
  );
}

// Main execution
const specsDir = path.join(__dirname, '../../docs/specifications/api');
const outputPath = path.join(__dirname, '../../src/generated/menuSchema.json');
const overridesPath = path.join(__dirname, 'namespace-scope-overrides.json');

generateMenuSchema(specsDir, outputPath, overridesPath);

console.log('\n=== Generation Complete ===');
