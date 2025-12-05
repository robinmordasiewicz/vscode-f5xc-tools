/**
 * Resource types registry for F5 XC extension.
 *
 * This module combines auto-generated resource type data from OpenAPI specs
 * with manual overrides for UI-specific properties like categories, icons,
 * and special behaviors.
 *
 * The generated base types provide: apiPath, displayName, description, apiBase, schemaFile
 * Manual overrides provide: category, icon, supportsCustomOps, supportsLogs, supportsMetrics, etc.
 */

import {
  GENERATED_RESOURCE_TYPES,
  GeneratedResourceTypeInfo,
} from '../generated/resourceTypesBase';
import {
  BUILT_IN_NAMESPACES,
  API_ENDPOINTS,
  isBuiltInNamespace as generatedIsBuiltInNamespace,
} from '../generated/constants';

/**
 * Namespace scope - which namespaces can access this resource type
 * - 'any': Available in user namespaces (shared, default, custom) but NOT system
 * - 'system': Only available in system namespace (literal /namespaces/system/ paths)
 * - 'shared': Only available in shared namespace (literal /namespaces/shared/ paths)
 *
 * Note: Resources with parameterized {namespace} paths get 'any' scope, meaning they
 * can be created in user namespaces (shared, default, custom). The system namespace
 * is reserved for system-level resources like Sites and IAM objects.
 */
export type NamespaceScope = 'any' | 'system' | 'shared';

/**
 * API base path type - different F5 XC APIs use different base paths
 */
export type ApiBase = 'config' | 'web';

/**
 * Resource categories for organizing the tree view
 */
export enum ResourceCategory {
  LoadBalancing = 'Load Balancing',
  Security = 'Security',
  Networking = 'Networking',
  Sites = 'Sites',
  CloudConnect = 'Cloud Connect',
  DNS = 'DNS',
  Observability = 'Observability',
  IAM = 'Identity & Access',
  BotDefense = 'Bot Defense',
  APIProtection = 'API Protection',
  DataProtection = 'Data Protection',
  EdgeStack = 'Edge Stack',
  ServiceMesh = 'Service Mesh',
  MultiCloud = 'Multi-Cloud',
  Configuration = 'Configuration',
}

/**
 * Information about a resource type
 */
export interface ResourceTypeInfo {
  /** API path suffix (e.g., 'http_loadbalancers') */
  apiPath: string;
  /** Display name for UI */
  displayName: string;
  /** Category for grouping */
  category: ResourceCategory;
  /** Whether the resource supports custom operations */
  supportsCustomOps: boolean;
  /** Icon name (codicon) */
  icon: string;
  /** Description for tooltips */
  description?: string;
  /** OpenAPI spec file name */
  schemaFile?: string;
  /** Whether the resource supports logs */
  supportsLogs?: boolean;
  /** Whether the resource supports metrics */
  supportsMetrics?: boolean;
  /** Namespace scope - which namespaces can access this resource (default: 'any') */
  namespaceScope?: NamespaceScope;
  /** API base path - 'config' for /api/config or 'web' for /api/web (default: 'config') */
  apiBase?: ApiBase;
  /** Service segment for extended API paths (e.g., 'dns' for /api/config/dns/namespaces/...) */
  serviceSegment?: string;
  /** Custom list endpoint path (overrides standard path construction) */
  customListPath?: string;
  /** HTTP method for list operation - some APIs use POST instead of GET (default: 'GET') */
  listMethod?: 'GET' | 'POST';
  /** Whether this is a tenant-level resource (no namespace in path) */
  tenantLevel?: boolean;
  /** Response field containing list items (default: 'items') */
  listResponseField?: string;
}

/**
 * Override configuration for UI-specific properties.
 * These values cannot be derived from OpenAPI specs.
 */
interface ResourceTypeOverride {
  /** Override the generated apiPath if it was incorrectly parsed */
  apiPath?: string;
  /** Override the generated displayName */
  displayName?: string;
  /** Category for tree view grouping (required) */
  category: ResourceCategory;
  /** Whether the resource supports custom operations */
  supportsCustomOps?: boolean;
  /** Icon name (codicon) */
  icon: string;
  /** Whether the resource supports logs */
  supportsLogs?: boolean;
  /** Whether the resource supports metrics */
  supportsMetrics?: boolean;
  /** Namespace scope */
  namespaceScope?: NamespaceScope;
  /** Override API base */
  apiBase?: ApiBase;
  /** Custom list endpoint path */
  customListPath?: string;
  /** HTTP method for list operation */
  listMethod?: 'GET' | 'POST';
  /** Whether this is a tenant-level resource */
  tenantLevel?: boolean;
  /** Response field containing list items */
  listResponseField?: string;
}

/**
 * Manual overrides for resource types.
 * These provide UI-specific properties that cannot be derived from OpenAPI specs.
 */
const RESOURCE_TYPE_OVERRIDES: Record<string, ResourceTypeOverride> = {
  // =====================================================
  // Load Balancing
  // =====================================================
  http_loadbalancer: {
    displayName: 'HTTP Load Balancers',
    category: ResourceCategory.LoadBalancing,
    supportsCustomOps: true,
    icon: 'globe',
    supportsLogs: true,
    supportsMetrics: true,
  },
  tcp_loadbalancer: {
    category: ResourceCategory.LoadBalancing,
    supportsCustomOps: false,
    icon: 'plug',
    supportsLogs: true,
    supportsMetrics: true,
  },
  udp_loadbalancer: {
    category: ResourceCategory.LoadBalancing,
    supportsCustomOps: false,
    icon: 'broadcast',
    supportsMetrics: true,
  },
  origin_pool: {
    category: ResourceCategory.LoadBalancing,
    supportsCustomOps: false,
    icon: 'server-environment',
    supportsMetrics: true,
  },
  cdn_loadbalancer: {
    category: ResourceCategory.LoadBalancing,
    supportsCustomOps: false,
    icon: 'cloud',
  },
  healthcheck: {
    category: ResourceCategory.LoadBalancing,
    supportsCustomOps: false,
    icon: 'heart',
  },

  // =====================================================
  // Security
  // =====================================================
  app_firewall: {
    category: ResourceCategory.Security,
    supportsCustomOps: true,
    icon: 'shield',
    supportsMetrics: true,
  },
  service_policy: {
    category: ResourceCategory.Security,
    supportsCustomOps: false,
    icon: 'checklist',
  },
  rate_limiter: {
    category: ResourceCategory.Security,
    supportsCustomOps: false,
    icon: 'dashboard',
  },
  rate_limiter_policy: {
    category: ResourceCategory.Security,
    supportsCustomOps: false,
    icon: 'law',
  },
  malicious_user_mitigation: {
    category: ResourceCategory.Security,
    supportsCustomOps: false,
    icon: 'report',
  },
  user_identification: {
    category: ResourceCategory.Security,
    supportsCustomOps: false,
    icon: 'account',
  },
  waf_exclusion_policy: {
    category: ResourceCategory.Security,
    supportsCustomOps: false,
    icon: 'exclude',
  },
  sensitive_data_policy: {
    category: ResourceCategory.DataProtection,
    supportsCustomOps: false,
    icon: 'lock',
  },

  // =====================================================
  // Bot Defense
  // =====================================================
  bot_defense_app_infrastructure: {
    category: ResourceCategory.BotDefense,
    supportsCustomOps: false,
    icon: 'robot',
  },
  protected_application: {
    category: ResourceCategory.BotDefense,
    supportsCustomOps: false,
    icon: 'verified',
  },

  // =====================================================
  // API Protection
  // =====================================================
  api_definition: {
    category: ResourceCategory.APIProtection,
    supportsCustomOps: false,
    icon: 'symbol-interface',
  },
  api_group: {
    category: ResourceCategory.APIProtection,
    supportsCustomOps: false,
    icon: 'symbol-namespace',
  },

  // =====================================================
  // Networking
  // =====================================================
  virtual_network: {
    category: ResourceCategory.Networking,
    supportsCustomOps: false,
    icon: 'type-hierarchy',
  },
  network_connector: {
    category: ResourceCategory.Networking,
    supportsCustomOps: false,
    icon: 'link',
  },
  network_firewall: {
    category: ResourceCategory.Networking,
    supportsCustomOps: false,
    icon: 'flame',
  },
  network_policy: {
    category: ResourceCategory.Networking,
    supportsCustomOps: false,
    icon: 'list-filter',
  },
  enhanced_firewall_policy: {
    category: ResourceCategory.Networking,
    supportsCustomOps: false,
    icon: 'shield',
  },
  forward_proxy_policy: {
    category: ResourceCategory.Networking,
    supportsCustomOps: false,
    icon: 'arrow-right',
  },

  // =====================================================
  // Sites
  // =====================================================
  aws_vpc_site: {
    category: ResourceCategory.Sites,
    supportsCustomOps: true,
    icon: 'cloud',
    namespaceScope: 'system',
  },
  aws_tgw_site: {
    category: ResourceCategory.Sites,
    supportsCustomOps: true,
    icon: 'cloud',
    namespaceScope: 'system',
  },
  azure_vnet_site: {
    category: ResourceCategory.Sites,
    supportsCustomOps: true,
    icon: 'cloud',
    namespaceScope: 'system',
  },
  gcp_vpc_site: {
    category: ResourceCategory.Sites,
    supportsCustomOps: true,
    icon: 'cloud',
    namespaceScope: 'system',
  },
  voltstack_site: {
    category: ResourceCategory.Sites,
    supportsCustomOps: true,
    icon: 'server',
    namespaceScope: 'system',
  },
  securemesh_site: {
    category: ResourceCategory.Sites,
    supportsCustomOps: true,
    icon: 'server-process',
    namespaceScope: 'system',
  },
  securemesh_site_v2: {
    category: ResourceCategory.Sites,
    supportsCustomOps: true,
    icon: 'server-process',
    namespaceScope: 'system',
  },

  // =====================================================
  // DNS
  // =====================================================
  dns_zone: {
    apiPath: 'dns_zones',
    displayName: 'DNS Zones',
    category: ResourceCategory.DNS,
    supportsCustomOps: true,
    icon: 'globe',
    // DNS Zone is a system-level resource managed in system namespace
    namespaceScope: 'system',
  },
  dns_load_balancer: {
    apiPath: 'dns_load_balancers',
    displayName: 'DNS Load Balancers',
    category: ResourceCategory.DNS,
    supportsCustomOps: false,
    icon: 'split-horizontal',
    // DNS API uses /api/config/dns/namespaces/{namespace}/... path
    customListPath: '/api/config/dns/namespaces/{namespace}/dns_load_balancers',
  },
  dns_lb_pool: {
    apiPath: 'dns_lb_pools',
    displayName: 'DNS LB Pools',
    category: ResourceCategory.DNS,
    supportsCustomOps: false,
    icon: 'layers',
    customListPath: '/api/config/dns/namespaces/{namespace}/dns_lb_pools',
  },
  dns_lb_health_check: {
    apiPath: 'dns_lb_health_checks',
    displayName: 'DNS LB Health Checks',
    category: ResourceCategory.DNS,
    supportsCustomOps: false,
    icon: 'pulse',
    customListPath: '/api/config/dns/namespaces/{namespace}/dns_lb_health_checks',
  },

  // =====================================================
  // IAM & Configuration
  // =====================================================
  user: {
    apiPath: 'user',
    displayName: 'Users',
    category: ResourceCategory.IAM,
    supportsCustomOps: false,
    icon: 'person',
    namespaceScope: 'system',
    apiBase: 'web',
    customListPath: '/api/scim/v2/Users',
    listMethod: 'GET',
    listResponseField: 'Resources',
  },
  role: {
    category: ResourceCategory.IAM,
    supportsCustomOps: false,
    icon: 'organization',
    namespaceScope: 'system',
    apiBase: 'web',
  },
  api_credential: {
    category: ResourceCategory.IAM,
    supportsCustomOps: false,
    icon: 'key',
    namespaceScope: 'system',
    apiBase: 'web',
  },
  service_credential: {
    displayName: 'Service Credentials',
    apiPath: 'service_credentials',
    category: ResourceCategory.IAM,
    supportsCustomOps: false,
    icon: 'key',
    namespaceScope: 'system',
    apiBase: 'web',
  },
  certificate: {
    category: ResourceCategory.Configuration,
    supportsCustomOps: false,
    icon: 'file-certificate',
  },
  trusted_ca_list: {
    category: ResourceCategory.Configuration,
    supportsCustomOps: false,
    icon: 'verified-filled',
  },

  // =====================================================
  // Observability
  // =====================================================
  alert_policy: {
    category: ResourceCategory.Observability,
    supportsCustomOps: false,
    icon: 'bell',
  },
  alert_receiver: {
    category: ResourceCategory.Observability,
    supportsCustomOps: false,
    icon: 'bell-dot',
  },
  global_log_receiver: {
    category: ResourceCategory.Observability,
    supportsCustomOps: false,
    icon: 'output',
  },
  synthetic_monitor: {
    category: ResourceCategory.Observability,
    supportsCustomOps: false,
    icon: 'pulse',
  },
};

/**
 * Merge generated resource type info with manual overrides.
 * Override values take precedence over generated values.
 */
function mergeResourceType(
  key: string,
  generated: GeneratedResourceTypeInfo | undefined,
  override: ResourceTypeOverride,
): ResourceTypeInfo {
  // Start with defaults
  // For namespaceScope: use override first, then generated, then default to 'any'
  const result: ResourceTypeInfo = {
    apiPath: override.apiPath || generated?.apiPath || key + 's',
    displayName: override.displayName || generated?.displayName || key,
    description: generated?.description,
    schemaFile: generated?.schemaFile,
    category: override.category,
    supportsCustomOps: override.supportsCustomOps ?? false,
    icon: override.icon,
    supportsLogs: override.supportsLogs,
    supportsMetrics: override.supportsMetrics,
    namespaceScope:
      override.namespaceScope ?? (generated?.namespaceScope as NamespaceScope) ?? 'any',
    apiBase: override.apiBase || (generated?.apiBase as ApiBase) || 'config',
    // Include service segment for extended API paths (e.g., /api/config/dns/...)
    serviceSegment: (generated as { serviceSegment?: string } | undefined)?.serviceSegment,
    customListPath: override.customListPath,
    listMethod: override.listMethod,
    tenantLevel: override.tenantLevel,
    listResponseField: override.listResponseField,
  };

  return result;
}

/**
 * Build the complete RESOURCE_TYPES by merging generated data with overrides.
 * Only resource types that have overrides are included (curated list).
 */
function buildResourceTypes(): Record<string, ResourceTypeInfo> {
  const result: Record<string, ResourceTypeInfo> = {};

  for (const [key, override] of Object.entries(RESOURCE_TYPE_OVERRIDES)) {
    const generated = GENERATED_RESOURCE_TYPES[key];
    result[key] = mergeResourceType(key, generated, override);
  }

  return result;
}

/**
 * Complete registry of F5 XC resource types.
 * This merges auto-generated data from OpenAPI specs with manual overrides.
 */
export const RESOURCE_TYPES: Record<string, ResourceTypeInfo> = buildResourceTypes();

/**
 * Get all resource types for a category
 */
export function getResourceTypesByCategory(category: ResourceCategory): ResourceTypeInfo[] {
  return Object.values(RESOURCE_TYPES).filter((r) => r.category === category);
}

/**
 * Get all categories with their resource types
 */
export function getCategorizedResourceTypes(): Map<ResourceCategory, ResourceTypeInfo[]> {
  const categorized = new Map<ResourceCategory, ResourceTypeInfo[]>();

  for (const category of Object.values(ResourceCategory)) {
    const types = getResourceTypesByCategory(category);
    if (types.length > 0) {
      categorized.set(category, types);
    }
  }

  return categorized;
}

/**
 * Get a resource type by its API path
 */
export function getResourceTypeByApiPath(apiPath: string): ResourceTypeInfo | undefined {
  return Object.values(RESOURCE_TYPES).find((r) => r.apiPath === apiPath);
}

/**
 * Get all resource type keys
 */
export function getResourceTypeKeys(): string[] {
  return Object.keys(RESOURCE_TYPES);
}

/**
 * Get category icon
 */
export function getCategoryIcon(category: ResourceCategory): string {
  const icons: Record<ResourceCategory, string> = {
    [ResourceCategory.LoadBalancing]: 'server-process',
    [ResourceCategory.Security]: 'shield',
    [ResourceCategory.Networking]: 'type-hierarchy',
    [ResourceCategory.Sites]: 'server',
    [ResourceCategory.CloudConnect]: 'cloud',
    [ResourceCategory.DNS]: 'globe',
    [ResourceCategory.Observability]: 'graph',
    [ResourceCategory.IAM]: 'account',
    [ResourceCategory.BotDefense]: 'robot',
    [ResourceCategory.APIProtection]: 'symbol-interface',
    [ResourceCategory.DataProtection]: 'lock',
    [ResourceCategory.EdgeStack]: 'layers',
    [ResourceCategory.ServiceMesh]: 'git-merge',
    [ResourceCategory.MultiCloud]: 'cloud',
    [ResourceCategory.Configuration]: 'settings-gear',
  };

  return icons[category] || 'folder';
}

/**
 * Check if a namespace is a built-in namespace.
 * Re-exported from generated constants.
 */
export function isBuiltInNamespace(namespace: string): boolean {
  return generatedIsBuiltInNamespace(namespace);
}

/**
 * Check if a resource type is available for a given namespace.
 *
 * The filtering logic is based on the namespace scope derived from OpenAPI specs:
 * - 'system': Only available in system namespace (e.g., Sites, IAM, DNS resources)
 * - 'shared': Only available in shared namespace (rare)
 * - 'any': Available in user namespaces (shared, default, custom) but NOT system
 */
export function isResourceTypeAvailableForNamespace(
  resourceType: ResourceTypeInfo,
  namespace: string,
): boolean {
  const scope = resourceType.namespaceScope || 'any';

  switch (scope) {
    case 'system':
      // System-scoped resources only appear in system namespace
      return namespace === 'system';
    case 'shared':
      // Shared-scoped resources only appear in shared namespace
      return namespace === 'shared';
    case 'any':
    default:
      // Resources with 'any' scope (parameterized {namespace} paths) are available
      // in user namespaces (shared, default, custom) but NOT in system namespace.
      // System namespace is reserved for system-level resources with explicit overrides.
      return namespace !== 'system';
  }
}

/**
 * Get resource types filtered by namespace
 */
export function getResourceTypesForNamespace(namespace: string): Record<string, ResourceTypeInfo> {
  const filtered: Record<string, ResourceTypeInfo> = {};

  for (const [key, info] of Object.entries(RESOURCE_TYPES)) {
    if (isResourceTypeAvailableForNamespace(info, namespace)) {
      filtered[key] = info;
    }
  }

  return filtered;
}

/**
 * Get categorized resource types filtered by namespace
 */
export function getCategorizedResourceTypesForNamespace(
  namespace: string,
): Map<ResourceCategory, Array<[string, ResourceTypeInfo]>> {
  const categorized = new Map<ResourceCategory, Array<[string, ResourceTypeInfo]>>();

  for (const [key, info] of Object.entries(RESOURCE_TYPES)) {
    if (!isResourceTypeAvailableForNamespace(info, namespace)) {
      continue;
    }

    const existing = categorized.get(info.category) || [];
    existing.push([key, info]);
    categorized.set(info.category, existing);
  }

  return categorized;
}

// Re-export BUILT_IN_NAMESPACES for backwards compatibility
export { BUILT_IN_NAMESPACES, API_ENDPOINTS };
