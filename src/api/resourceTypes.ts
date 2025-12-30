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
  DangerLevel,
  OperationMetadata,
  ResourceOperationMetadata,
  SideEffects,
  CommonError,
} from '../generated/resourceTypesBase';

// Re-export operation metadata types for use by other modules
export type { DangerLevel, OperationMetadata, ResourceOperationMetadata, SideEffects, CommonError };

/**
 * CRUD operation types for metadata lookup
 */
export type CrudOperation = 'list' | 'get' | 'create' | 'update' | 'delete';
import {
  BUILT_IN_NAMESPACES,
  API_ENDPOINTS,
  isBuiltInNamespace as generatedIsBuiltInNamespace,
} from '../generated/constants';
import {
  getLocalCategoryForDomain,
  isPreviewDomain,
  getDomainTierRequirement,
} from '../generated/domainCategories';

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
 * API base path type - different F5 XC APIs use different base paths.
 * Supports all F5 XC API bases including: config, web, gen-ai, ai_data, data,
 * bigipconnector, discovery, gia, infraprotect, nginx, observability, operate,
 * shape, terraform, scim, secret_management, and others.
 */
export type ApiBase = string;

/**
 * Known API bases for F5 XC APIs.
 * This list is informational and not exhaustive - new API bases may be added.
 */
export const KNOWN_API_BASES = [
  'config',
  'web',
  'ai_data',
  'bigipconnector',
  'data',
  'data-intelligence',
  'discovery',
  'gen-ai',
  'gia',
  'infraprotect',
  'maurice',
  'mobile',
  'nginx',
  'object_store',
  'observability',
  'operate',
  'register',
  'report',
  'scim',
  'secret_management',
  'shape',
  'terraform',
  'tpm',
] as const;

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
  // New categories for extended API support
  BigIPConnector = 'BIG-IP Connector',
  InfraProtection = 'Infrastructure Protection',
  NGINXOne = 'NGINX One',
  ClientSideDefense = 'Client-Side Defense',
  Kubernetes = 'Kubernetes',
  Discovery = 'Discovery',
  AI = 'AI & Automation',
  Routing = 'Routing',
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
  /** Custom get endpoint path (overrides standard path construction, use {namespace} and {name} placeholders) */
  customGetPath?: string;
  /** HTTP method for list operation - some APIs use POST instead of GET (default: 'GET') */
  listMethod?: 'GET' | 'POST';
  /** Whether this is a tenant-level resource (no namespace in path) */
  tenantLevel?: boolean;
  /** Response field containing list items (default: 'items') */
  listResponseField?: string;
  /** Skip namespace filtering for non-standard APIs (e.g., SCIM) that don't include namespace in response */
  skipNamespaceFilter?: boolean;
  /** Use cached list data for describe instead of making a GET call (for APIs without GET endpoint) */
  useListDataForDescribe?: boolean;
  /** Resource requires SCIM Bearer token authentication (not standard API token) */
  requiresScimAuth?: boolean;
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
  /** Category for tree view grouping (optional if domain provides category) */
  category?: ResourceCategory;
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
  /** Custom get endpoint path */
  customGetPath?: string;
  /** HTTP method for list operation */
  listMethod?: 'GET' | 'POST';
  /** Whether this is a tenant-level resource */
  tenantLevel?: boolean;
  /** Response field containing list items */
  listResponseField?: string;
  /** Skip namespace filtering for non-standard APIs */
  skipNamespaceFilter?: boolean;
  /** Use cached list data for describe instead of making a GET call */
  useListDataForDescribe?: boolean;
  /** Resource requires SCIM Bearer token authentication */
  requiresScimAuth?: boolean;
}

/**
 * Manual overrides for resource types.
 * These provide UI-specific properties that cannot be derived from OpenAPI specs.
 */
const RESOURCE_TYPE_OVERRIDES: Record<string, ResourceTypeOverride> = {
  // =====================================================
  // Load Balancing (domain: virtual → LoadBalancing)
  // =====================================================
  http_loadbalancer: {
    displayName: 'HTTP Load Balancers',
    // category auto-populated from domain: virtual
    supportsCustomOps: true,
    icon: 'globe',
    supportsLogs: true,
    supportsMetrics: true,
  },
  tcp_loadbalancer: {
    // category auto-populated from domain: virtual
    supportsCustomOps: false,
    icon: 'plug',
    supportsLogs: true,
    supportsMetrics: true,
  },
  udp_loadbalancer: {
    // category auto-populated from domain: virtual
    supportsCustomOps: false,
    icon: 'broadcast',
    supportsMetrics: true,
  },
  origin_pool: {
    // category auto-populated from domain: virtual
    supportsCustomOps: false,
    icon: 'server-environment',
    supportsMetrics: true,
  },
  cdn_loadbalancer: {
    // category auto-populated from domain: virtual
    supportsCustomOps: false,
    icon: 'cloud',
  },
  healthcheck: {
    // category auto-populated from domain: virtual
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
    // DNS API uses /api/config/dns/namespaces/{namespace}/... path
    customListPath: '/api/config/dns/namespaces/{namespace}/dns_zones',
    customGetPath: '/api/config/dns/namespaces/{namespace}/dns_zones/{name}',
    // Note: namespaceScope='system' comes from generated base via namespace-scope-overrides.json
  },
  dns_load_balancer: {
    apiPath: 'dns_load_balancers',
    displayName: 'DNS Load Balancers',
    category: ResourceCategory.DNS,
    supportsCustomOps: false,
    icon: 'split-horizontal',
    // DNS API uses /api/config/dns/namespaces/{namespace}/... path
    customListPath: '/api/config/dns/namespaces/{namespace}/dns_load_balancers',
    customGetPath: '/api/config/dns/namespaces/{namespace}/dns_load_balancers/{name}',
  },
  dns_lb_pool: {
    apiPath: 'dns_lb_pools',
    displayName: 'DNS LB Pools',
    category: ResourceCategory.DNS,
    supportsCustomOps: false,
    icon: 'layers',
    customListPath: '/api/config/dns/namespaces/{namespace}/dns_lb_pools',
    customGetPath: '/api/config/dns/namespaces/{namespace}/dns_lb_pools/{name}',
  },
  dns_lb_health_check: {
    apiPath: 'dns_lb_health_checks',
    displayName: 'DNS LB Health Checks',
    category: ResourceCategory.DNS,
    supportsCustomOps: false,
    icon: 'pulse',
    customListPath: '/api/config/dns/namespaces/{namespace}/dns_lb_health_checks',
    customGetPath: '/api/config/dns/namespaces/{namespace}/dns_lb_health_checks/{name}',
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
    customListPath: '/api/web/custom/namespaces/{namespace}/user_roles',
    listMethod: 'GET',
    skipNamespaceFilter: true,
    useListDataForDescribe: true,
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

  // =====================================================
  // Cloud Connect (P1)
  // =====================================================
  cloud_credentials: {
    category: ResourceCategory.CloudConnect,
    supportsCustomOps: false,
    icon: 'key',
    namespaceScope: 'system',
  },
  cloud_link: {
    category: ResourceCategory.CloudConnect,
    supportsCustomOps: false,
    icon: 'link',
  },
  cloud_connect: {
    category: ResourceCategory.CloudConnect,
    supportsCustomOps: false,
    icon: 'cloud',
  },
  cloud_elastic_ip: {
    category: ResourceCategory.CloudConnect,
    supportsCustomOps: false,
    icon: 'globe',
  },

  // =====================================================
  // Kubernetes / Edge Stack (P1)
  // =====================================================
  cluster: {
    category: ResourceCategory.Kubernetes,
    supportsCustomOps: false,
    icon: 'symbol-namespace',
  },
  fleet: {
    category: ResourceCategory.Kubernetes,
    supportsCustomOps: false,
    icon: 'layers',
  },
  virtual_site: {
    category: ResourceCategory.Kubernetes,
    supportsCustomOps: false,
    icon: 'organization',
  },
  site_mesh_group: {
    category: ResourceCategory.ServiceMesh,
    supportsCustomOps: false,
    icon: 'git-merge',
  },

  // =====================================================
  // API Security (P1)
  // =====================================================
  api_sec_api_crawler: {
    displayName: 'API Crawler',
    category: ResourceCategory.APIProtection,
    supportsCustomOps: false,
    icon: 'search',
  },
  api_sec_api_discovery: {
    displayName: 'API Discovery',
    category: ResourceCategory.APIProtection,
    supportsCustomOps: false,
    icon: 'telescope',
  },
  api_sec_api_testing: {
    displayName: 'API Testing',
    category: ResourceCategory.APIProtection,
    supportsCustomOps: false,
    icon: 'beaker',
  },

  // =====================================================
  // Discovery (P1)
  // =====================================================
  discovered_service: {
    category: ResourceCategory.Discovery,
    supportsCustomOps: false,
    icon: 'symbol-method',
  },
  discovery: {
    category: ResourceCategory.Discovery,
    supportsCustomOps: false,
    icon: 'search',
  },

  // =====================================================
  // Routing (P1)
  // =====================================================
  bgp: {
    displayName: 'BGP Configuration',
    category: ResourceCategory.Routing,
    supportsCustomOps: false,
    icon: 'arrow-swap',
  },
  bgp_asn_set: {
    displayName: 'BGP ASN Sets',
    category: ResourceCategory.Routing,
    supportsCustomOps: false,
    icon: 'list-ordered',
  },
  bgp_routing_policy: {
    displayName: 'BGP Routing Policies',
    category: ResourceCategory.Routing,
    supportsCustomOps: false,
    icon: 'list-filter',
  },

  // =====================================================
  // BIG-IP Connector (P1)
  // =====================================================
  bigip_irule: {
    displayName: 'BIG-IP iRules',
    category: ResourceCategory.BigIPConnector,
    supportsCustomOps: false,
    icon: 'file-code',
  },
  bigip_virtual_server: {
    displayName: 'BIG-IP Virtual Servers',
    category: ResourceCategory.BigIPConnector,
    supportsCustomOps: false,
    icon: 'server',
  },
  bigip_apm: {
    displayName: 'BIG-IP APM',
    category: ResourceCategory.BigIPConnector,
    supportsCustomOps: false,
    icon: 'verified',
  },
  // P2: Additional BIG-IP Connector resources (#51)
  bigcne_data_group: {
    displayName: 'BIG-CNE Data Groups',
    category: ResourceCategory.BigIPConnector,
    supportsCustomOps: false,
    icon: 'database',
  },
  bigcne_irule: {
    displayName: 'BIG-CNE iRules',
    category: ResourceCategory.BigIPConnector,
    supportsCustomOps: false,
    icon: 'file-code',
  },

  // =====================================================
  // Infrastructure Protection (P1)
  // =====================================================
  infraprotect: {
    displayName: 'Infrastructure Protection',
    category: ResourceCategory.InfraProtection,
    supportsCustomOps: false,
    icon: 'shield',
  },
  infraprotect_asn: {
    displayName: 'ASN Protection',
    category: ResourceCategory.InfraProtection,
    supportsCustomOps: false,
    icon: 'list-ordered',
  },
  infraprotect_firewall_rule: {
    displayName: 'Firewall Rules',
    category: ResourceCategory.InfraProtection,
    supportsCustomOps: false,
    icon: 'flame',
  },
  infraprotect_tunnel: {
    displayName: 'Protection Tunnels',
    category: ResourceCategory.InfraProtection,
    supportsCustomOps: false,
    icon: 'arrow-right',
  },
  // P2: Additional Infrastructure Protection resources (#52)
  infraprotect_asn_prefix: {
    displayName: 'ASN Prefix Protection',
    category: ResourceCategory.InfraProtection,
    supportsCustomOps: false,
    icon: 'list-ordered',
  },
  infraprotect_deny_list_rule: {
    displayName: 'Deny List Rules',
    category: ResourceCategory.InfraProtection,
    supportsCustomOps: false,
    icon: 'circle-slash',
  },
  infraprotect_firewall_rule_group: {
    displayName: 'Firewall Rule Groups',
    category: ResourceCategory.InfraProtection,
    supportsCustomOps: false,
    icon: 'folder',
  },
  infraprotect_firewall_ruleset: {
    displayName: 'Firewall Rulesets',
    category: ResourceCategory.InfraProtection,
    supportsCustomOps: false,
    icon: 'checklist',
  },
  infraprotect_information: {
    displayName: 'Protection Information',
    category: ResourceCategory.InfraProtection,
    supportsCustomOps: false,
    icon: 'info',
  },
  infraprotect_internet_prefix_advertisement: {
    displayName: 'Internet Prefix Advertisements',
    category: ResourceCategory.InfraProtection,
    supportsCustomOps: false,
    icon: 'broadcast',
  },

  // =====================================================
  // NGINX One (P1)
  // =====================================================
  nginx_one_nginx_instance: {
    displayName: 'NGINX Instances',
    category: ResourceCategory.NGINXOne,
    supportsCustomOps: false,
    icon: 'server',
  },
  nginx_one_nginx_server: {
    displayName: 'NGINX Servers',
    category: ResourceCategory.NGINXOne,
    supportsCustomOps: false,
    icon: 'server-process',
  },
  // P2: Additional NGINX One resources (#53)
  nginx_one_nginx_csg: {
    displayName: 'NGINX Cloud Service Gateway',
    category: ResourceCategory.NGINXOne,
    supportsCustomOps: false,
    icon: 'cloud',
  },
  nginx_one_nginx_service_discovery: {
    displayName: 'NGINX Service Discovery',
    category: ResourceCategory.NGINXOne,
    supportsCustomOps: false,
    icon: 'search',
  },
  nginx_one_subscription: {
    displayName: 'NGINX One Subscriptions',
    category: ResourceCategory.NGINXOne,
    supportsCustomOps: false,
    icon: 'credit-card',
    apiPath: 'nginx_one_subscribe', // Unique path to avoid conflict with other 'subscribe' paths
  },

  // =====================================================
  // Client-Side Defense (P1)
  // =====================================================
  shape_client_side_defense: {
    displayName: 'Client-Side Defense',
    category: ResourceCategory.ClientSideDefense,
    supportsCustomOps: false,
    icon: 'browser',
  },
  shape_client_side_defense_protected_domain: {
    displayName: 'Protected Domains',
    category: ResourceCategory.ClientSideDefense,
    supportsCustomOps: false,
    icon: 'globe',
  },
  // P2: Additional Client-Side Defense resources (#54)
  shape_client_side_defense_allowed_domain: {
    displayName: 'Allowed Domains',
    category: ResourceCategory.ClientSideDefense,
    supportsCustomOps: false,
    icon: 'check',
  },
  shape_client_side_defense_mitigated_domain: {
    displayName: 'Mitigated Domains',
    category: ResourceCategory.ClientSideDefense,
    supportsCustomOps: false,
    icon: 'shield',
  },
  shape_client_side_defense_subscription: {
    displayName: 'CSD Subscriptions',
    category: ResourceCategory.ClientSideDefense,
    supportsCustomOps: false,
    icon: 'credit-card',
    apiPath: 'csd_subscribe', // Unique path to avoid conflict with other 'subscribe' paths
  },

  // =====================================================
  // AI & Automation (P1)
  // =====================================================
  ai_assistant: {
    displayName: 'AI Assistant',
    category: ResourceCategory.AI,
    supportsCustomOps: false,
    icon: 'sparkle',
  },
  gia: {
    displayName: 'Global Infrastructure Analytics',
    category: ResourceCategory.AI,
    supportsCustomOps: false,
    icon: 'graph',
  },

  // =====================================================
  // Shape Bot Defense Extended (P2) (#55)
  // =====================================================
  shape_bot_defense_bot_allowlist_policy: {
    displayName: 'Bot Allowlist Policies',
    category: ResourceCategory.BotDefense,
    supportsCustomOps: false,
    icon: 'check',
  },
  shape_bot_defense_bot_endpoint_policy: {
    displayName: 'Bot Endpoint Policies',
    category: ResourceCategory.BotDefense,
    supportsCustomOps: false,
    icon: 'link',
  },
  shape_bot_defense_bot_network_policy: {
    displayName: 'Bot Network Policies',
    category: ResourceCategory.BotDefense,
    supportsCustomOps: false,
    icon: 'type-hierarchy',
  },
  shape_bot_defense_instance: {
    displayName: 'Bot Defense Instances',
    category: ResourceCategory.BotDefense,
    supportsCustomOps: false,
    icon: 'server',
  },
  shape_bot_defense_protected_application: {
    displayName: 'Shape Protected Applications',
    category: ResourceCategory.BotDefense,
    supportsCustomOps: false,
    icon: 'verified',
  },
  shape_bot_defense_reporting: {
    displayName: 'Bot Defense Reporting',
    category: ResourceCategory.BotDefense,
    supportsCustomOps: false,
    icon: 'graph',
  },
  shape_bot_defense_threat_intelligence_bot_detection_rule: {
    displayName: 'Threat Intelligence Rules',
    category: ResourceCategory.BotDefense,
    supportsCustomOps: false,
    icon: 'lightbulb',
  },

  // =====================================================
  // Routing Extended (P2) (#56)
  // =====================================================
  route: {
    displayName: 'Static Routes',
    category: ResourceCategory.Routing,
    supportsCustomOps: false,
    icon: 'arrow-right',
  },
  nat_policy: {
    displayName: 'NAT Policies',
    category: ResourceCategory.Routing,
    supportsCustomOps: false,
    icon: 'arrow-swap',
  },
  policy_based_routing: {
    displayName: 'Policy-Based Routing',
    category: ResourceCategory.Routing,
    supportsCustomOps: false,
    icon: 'list-filter',
  },
  policer: {
    displayName: 'Traffic Policers',
    category: ResourceCategory.Routing,
    supportsCustomOps: false,
    icon: 'dashboard',
  },
  forwarding_class: {
    displayName: 'Forwarding Classes',
    category: ResourceCategory.Routing,
    supportsCustomOps: false,
    icon: 'layers',
  },

  // =====================================================
  // Secret Management (P3) (#57)
  // =====================================================
  secret_management: {
    displayName: 'Secret Management',
    category: ResourceCategory.Configuration,
    supportsCustomOps: false,
    icon: 'lock',
  },
  secret_management_access: {
    displayName: 'Secret Access Policies',
    category: ResourceCategory.Configuration,
    supportsCustomOps: false,
    icon: 'key',
  },
  secret_policy: {
    displayName: 'Secret Policies',
    category: ResourceCategory.Configuration,
    supportsCustomOps: false,
    icon: 'law',
  },
  secret_policy_rule: {
    displayName: 'Secret Policy Rules',
    category: ResourceCategory.Configuration,
    supportsCustomOps: false,
    icon: 'checklist',
  },

  // =====================================================
  // Data & Analytics (P3) (#58)
  // =====================================================
  data_privacy_geo_config: {
    displayName: 'Data Privacy Geo Config',
    category: ResourceCategory.DataProtection,
    supportsCustomOps: false,
    icon: 'globe',
  },
  data_privacy_lma_region: {
    displayName: 'LMA Region Config',
    category: ResourceCategory.DataProtection,
    supportsCustomOps: false,
    icon: 'map',
  },
  data_type: {
    displayName: 'Data Types',
    category: ResourceCategory.DataProtection,
    supportsCustomOps: false,
    icon: 'symbol-class',
  },
  flow: {
    displayName: 'Flow Data',
    category: ResourceCategory.Observability,
    supportsCustomOps: false,
    icon: 'pulse',
    apiPath: 'flow_subscribe', // Unique path to avoid conflict with other 'subscribe' paths
  },
  flow_anomaly: {
    displayName: 'Flow Anomaly Detection',
    category: ResourceCategory.Observability,
    supportsCustomOps: false,
    icon: 'warning',
  },

  // =====================================================
  // Terraform Integration (P3) (#59)
  // =====================================================
  terraform_parameters: {
    displayName: 'Terraform Parameters',
    category: ResourceCategory.Configuration,
    supportsCustomOps: false,
    icon: 'code',
  },
};

/**
 * Get category from domain mapping, or undefined if not mapped.
 * Uses generated domain→upstream_category→local_category mapping from upstream index.json.
 */
function getCategoryFromDomain(domain: string | undefined): ResourceCategory | undefined {
  if (!domain) {
    return undefined;
  }
  const localCategory = getLocalCategoryForDomain(domain);
  if (!localCategory) {
    return undefined;
  }
  // Convert string to ResourceCategory enum value
  // Check if localCategory is a valid ResourceCategory value
  const categoryValues = Object.values(ResourceCategory) as string[];
  if (categoryValues.includes(localCategory)) {
    return localCategory as ResourceCategory;
  }
  return undefined;
}

/**
 * Merge generated resource type info with manual overrides.
 * Override values take precedence over generated values.
 * Category is determined in priority order: override > domain mapping > Configuration fallback
 */
function mergeResourceType(
  key: string,
  generated: GeneratedResourceTypeInfo | undefined,
  override: ResourceTypeOverride,
): ResourceTypeInfo {
  // Determine category: override > domain mapping > Configuration fallback
  const domainCategory = getCategoryFromDomain(generated?.domain);
  const category = override.category ?? domainCategory ?? ResourceCategory.Configuration;

  // Start with defaults
  // For namespaceScope: use override first, then generated, then default to 'any'
  const result: ResourceTypeInfo = {
    apiPath: override.apiPath || generated?.apiPath || key + 's',
    displayName: override.displayName || generated?.displayName || key,
    description: generated?.description,
    schemaFile: generated?.schemaFile,
    category,
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
    customGetPath: override.customGetPath,
    listMethod: override.listMethod,
    tenantLevel: override.tenantLevel,
    listResponseField: override.listResponseField,
    skipNamespaceFilter: override.skipNamespaceFilter,
    useListDataForDescribe: override.useListDataForDescribe,
    requiresScimAuth: override.requiresScimAuth,
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
    // New category icons
    [ResourceCategory.BigIPConnector]: 'plug',
    [ResourceCategory.InfraProtection]: 'shield',
    [ResourceCategory.NGINXOne]: 'server',
    [ResourceCategory.ClientSideDefense]: 'browser',
    [ResourceCategory.Kubernetes]: 'symbol-namespace',
    [ResourceCategory.Discovery]: 'search',
    [ResourceCategory.AI]: 'sparkle',
    [ResourceCategory.Routing]: 'arrow-swap',
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

// =====================================================
// Operation Metadata Helper Functions
// =====================================================

/**
 * Get the operation metadata for a resource type and CRUD operation.
 *
 * @param resourceKey - The resource type key (e.g., 'http_loadbalancer')
 * @param operation - The CRUD operation type
 * @returns The operation metadata or undefined if not available
 */
export function getOperationMetadata(
  resourceKey: string,
  operation: CrudOperation,
): OperationMetadata | undefined {
  const generated = GENERATED_RESOURCE_TYPES[resourceKey];
  return generated?.operationMetadata?.[operation];
}

/**
 * Get the danger level for a specific operation on a resource type.
 * Returns 'medium' as default if not specified (conservative default).
 *
 * @param resourceKey - The resource type key (e.g., 'http_loadbalancer')
 * @param operation - The CRUD operation type (default: 'delete' as most common use case)
 * @returns The danger level ('low', 'medium', or 'high')
 */
export function getDangerLevel(
  resourceKey: string,
  operation: CrudOperation = 'delete',
): DangerLevel {
  const metadata = getOperationMetadata(resourceKey, operation);
  return metadata?.dangerLevel ?? 'medium';
}

/**
 * Get the purpose description for an operation.
 *
 * @param resourceKey - The resource type key
 * @param operation - The CRUD operation type
 * @returns The purpose string or undefined
 */
export function getOperationPurpose(
  resourceKey: string,
  operation: CrudOperation,
): string | undefined {
  const metadata = getOperationMetadata(resourceKey, operation);
  return metadata?.purpose;
}

/**
 * Get required fields for a create or update operation.
 *
 * @param resourceKey - The resource type key
 * @param operation - The CRUD operation ('create' or 'update')
 * @returns Array of required field paths
 */
export function getRequiredFields(resourceKey: string, operation: 'create' | 'update'): string[] {
  const metadata = getOperationMetadata(resourceKey, operation);
  return metadata?.requiredFields ?? [];
}

/**
 * Get side effects for an operation.
 *
 * @param resourceKey - The resource type key
 * @param operation - The CRUD operation type
 * @returns Side effects object or undefined
 */
export function getSideEffects(
  resourceKey: string,
  operation: CrudOperation,
): SideEffects | undefined {
  const metadata = getOperationMetadata(resourceKey, operation);
  return metadata?.sideEffects;
}

/**
 * Get common errors and solutions for an operation.
 *
 * @param resourceKey - The resource type key
 * @param operation - The CRUD operation type
 * @returns Array of common errors with solutions
 */
export function getCommonErrors(resourceKey: string, operation: CrudOperation): CommonError[] {
  const metadata = getOperationMetadata(resourceKey, operation);
  return metadata?.commonErrors ?? [];
}

/**
 * Get a smart error message for a given status code.
 * Looks up the common errors for the operation and returns a user-friendly solution.
 *
 * @param resourceKey - The resource type key
 * @param operation - The CRUD operation type
 * @param statusCode - The HTTP status code
 * @returns The solution message or undefined if no match found
 */
export function getSmartErrorMessage(
  resourceKey: string,
  operation: CrudOperation,
  statusCode: number,
): string | undefined {
  const errors = getCommonErrors(resourceKey, operation);
  const match = errors.find((e) => e.code === statusCode);
  return match?.solution;
}

/**
 * Check if an operation requires user confirmation.
 *
 * @param resourceKey - The resource type key
 * @param operation - The CRUD operation type
 * @returns True if confirmation is required (or defaults to true for high danger)
 */
export function requiresConfirmation(resourceKey: string, operation: CrudOperation): boolean {
  const metadata = getOperationMetadata(resourceKey, operation);
  // If explicitly set, use that value
  if (metadata?.confirmationRequired !== undefined) {
    return metadata.confirmationRequired;
  }
  // Default: require confirmation for high danger operations
  const dangerLevel = getDangerLevel(resourceKey, operation);
  return dangerLevel === 'high';
}

/**
 * Get prerequisites for an operation.
 *
 * @param resourceKey - The resource type key
 * @param operation - The CRUD operation type
 * @returns Array of prerequisite descriptions
 */
export function getPrerequisites(resourceKey: string, operation: CrudOperation): string[] {
  const metadata = getOperationMetadata(resourceKey, operation);
  return metadata?.prerequisites ?? [];
}

/**
 * Get all operation metadata for a resource type.
 *
 * @param resourceKey - The resource type key
 * @returns The full ResourceOperationMetadata or undefined
 */
export function getAllOperationMetadata(
  resourceKey: string,
): ResourceOperationMetadata | undefined {
  const generated = GENERATED_RESOURCE_TYPES[resourceKey];
  return generated?.operationMetadata;
}

// =====================================================
// Domain and Preview Status Helper Functions
// =====================================================

/**
 * Get the domain for a resource type.
 *
 * @param resourceKey - The resource type key
 * @returns The domain name or undefined
 */
export function getResourceDomain(resourceKey: string): string | undefined {
  const generated = GENERATED_RESOURCE_TYPES[resourceKey];
  return generated?.domain;
}

/**
 * Check if a resource type is in preview/beta status.
 * Uses the domain's is_preview flag from upstream metadata.
 *
 * @param resourceKey - The resource type key
 * @returns True if the resource type's domain is in preview
 */
export function isResourceTypePreview(resourceKey: string): boolean {
  const domain = getResourceDomain(resourceKey);
  if (!domain) {
    return false;
  }
  return isPreviewDomain(domain);
}

/**
 * Get the tier requirement for a resource type.
 * Uses the domain's requires_tier from upstream metadata.
 *
 * @param resourceKey - The resource type key
 * @returns The tier requirement (e.g., "advanced", "enterprise") or undefined
 */
export function getResourceTypeTierRequirement(resourceKey: string): string | undefined {
  const domain = getResourceDomain(resourceKey);
  if (!domain) {
    return undefined;
  }
  return getDomainTierRequirement(domain);
}
