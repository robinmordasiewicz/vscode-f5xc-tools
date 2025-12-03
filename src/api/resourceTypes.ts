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
}

/**
 * Complete registry of F5 XC resource types
 * Based on analysis of 269 OpenAPI specifications
 */
export const RESOURCE_TYPES: Record<string, ResourceTypeInfo> = {
  // =====================================================
  // Load Balancing
  // =====================================================
  http_loadbalancer: {
    apiPath: 'http_loadbalancers',
    displayName: 'HTTP Load Balancers',
    category: ResourceCategory.LoadBalancing,
    supportsCustomOps: true,
    icon: 'globe',
    description: 'Layer 7 HTTP/HTTPS load balancers with advanced routing',
    schemaFile:
      'docs-cloud-f5-com.0073.public.ves.io.schema.views.http_loadbalancer.ves-swagger.json',
    supportsLogs: true,
    supportsMetrics: true,
  },
  tcp_loadbalancer: {
    apiPath: 'tcp_loadbalancers',
    displayName: 'TCP Load Balancers',
    category: ResourceCategory.LoadBalancing,
    supportsCustomOps: false,
    icon: 'plug',
    description: 'Layer 4 TCP load balancers',
    schemaFile:
      'docs-cloud-f5-com.0078.public.ves.io.schema.views.tcp_loadbalancer.ves-swagger.json',
    supportsLogs: true,
    supportsMetrics: true,
  },
  udp_loadbalancer: {
    apiPath: 'udp_loadbalancers',
    displayName: 'UDP Load Balancers',
    category: ResourceCategory.LoadBalancing,
    supportsCustomOps: false,
    icon: 'broadcast',
    description: 'Layer 4 UDP load balancers',
    schemaFile:
      'docs-cloud-f5-com.0079.public.ves.io.schema.views.udp_loadbalancer.ves-swagger.json',
    supportsMetrics: true,
  },
  origin_pool: {
    apiPath: 'origin_pools',
    displayName: 'Origin Pools',
    category: ResourceCategory.LoadBalancing,
    supportsCustomOps: false,
    icon: 'server-environment',
    description: 'Backend server groups for load balancing',
    schemaFile: 'docs-cloud-f5-com.0177.public.ves.io.schema.views.origin_pool.ves-swagger.json',
    supportsMetrics: true,
  },
  cdn_loadbalancer: {
    apiPath: 'cdn_loadbalancers',
    displayName: 'CDN Load Balancers',
    category: ResourceCategory.LoadBalancing,
    supportsCustomOps: false,
    icon: 'cloud',
    description: 'CDN-integrated load balancers',
    schemaFile:
      'docs-cloud-f5-com.0042.public.ves.io.schema.views.cdn_loadbalancer.ves-swagger.json',
  },
  healthcheck: {
    apiPath: 'healthchecks',
    displayName: 'Health Checks',
    category: ResourceCategory.LoadBalancing,
    supportsCustomOps: false,
    icon: 'heart',
    description: 'Backend health check configurations',
    schemaFile: 'docs-cloud-f5-com.0124.public.ves.io.schema.healthcheck.ves-swagger.json',
  },

  // =====================================================
  // Security
  // =====================================================
  app_firewall: {
    apiPath: 'app_firewalls',
    displayName: 'App Firewalls',
    category: ResourceCategory.Security,
    supportsCustomOps: true,
    icon: 'shield',
    description: 'Web Application Firewall (WAF) configurations',
    schemaFile: 'docs-cloud-f5-com.0019.public.ves.io.schema.app_firewall.ves-swagger.json',
    supportsMetrics: true,
  },
  service_policy: {
    apiPath: 'service_policys',
    displayName: 'Service Policies',
    category: ResourceCategory.Security,
    supportsCustomOps: false,
    icon: 'checklist',
    description: 'Access control and security policies',
    schemaFile: 'docs-cloud-f5-com.0208.public.ves.io.schema.service_policy.ves-swagger.json',
  },
  rate_limiter: {
    apiPath: 'rate_limiters',
    displayName: 'Rate Limiters',
    category: ResourceCategory.Security,
    supportsCustomOps: false,
    icon: 'dashboard',
    description: 'Rate limiting configurations',
    schemaFile: 'docs-cloud-f5-com.0190.public.ves.io.schema.rate_limiter.ves-swagger.json',
  },
  rate_limiter_policy: {
    apiPath: 'rate_limiter_policys',
    displayName: 'Rate Limiter Policies',
    category: ResourceCategory.Security,
    supportsCustomOps: false,
    icon: 'law',
    description: 'Rate limiter policy configurations',
    schemaFile:
      'docs-cloud-f5-com.0191.public.ves.io.schema.views.rate_limiter_policy.ves-swagger.json',
  },
  malicious_user_mitigation: {
    apiPath: 'malicious_user_mitigations',
    displayName: 'Malicious User Mitigation',
    category: ResourceCategory.Security,
    supportsCustomOps: false,
    icon: 'report',
    description: 'Malicious user detection and mitigation',
    schemaFile:
      'docs-cloud-f5-com.0152.public.ves.io.schema.malicious_user_mitigation.ves-swagger.json',
  },
  user_identification: {
    apiPath: 'user_identifications',
    displayName: 'User Identification',
    category: ResourceCategory.Security,
    supportsCustomOps: false,
    icon: 'account',
    description: 'User identification methods',
    schemaFile: 'docs-cloud-f5-com.0253.public.ves.io.schema.user_identification.ves-swagger.json',
  },
  waf_exclusion_policy: {
    apiPath: 'waf_exclusion_policys',
    displayName: 'WAF Exclusion Policies',
    category: ResourceCategory.Security,
    supportsCustomOps: false,
    icon: 'exclude',
    description: 'WAF exclusion rules',
    schemaFile: 'docs-cloud-f5-com.0263.public.ves.io.schema.waf_exclusion_policy.ves-swagger.json',
  },
  sensitive_data_policy: {
    apiPath: 'sensitive_data_policys',
    displayName: 'Sensitive Data Policies',
    category: ResourceCategory.DataProtection,
    supportsCustomOps: false,
    icon: 'lock',
    description: 'Data loss prevention policies',
    schemaFile:
      'docs-cloud-f5-com.0206.public.ves.io.schema.sensitive_data_policy.ves-swagger.json',
  },

  // =====================================================
  // Bot Defense
  // =====================================================
  bot_defense_app_infrastructure: {
    apiPath: 'bot_defense_app_infrastructures',
    displayName: 'Bot Defense Infrastructure',
    category: ResourceCategory.BotDefense,
    supportsCustomOps: false,
    icon: 'robot',
    description: 'Bot defense application infrastructure',
    schemaFile:
      'docs-cloud-f5-com.0035.public.ves.io.schema.views.bot_defense_app_infrastructure.ves-swagger.json',
  },
  protected_application: {
    apiPath: 'protected_applications',
    displayName: 'Protected Applications',
    category: ResourceCategory.BotDefense,
    supportsCustomOps: false,
    icon: 'verified',
    description: 'Applications protected by bot defense',
    schemaFile:
      'docs-cloud-f5-com.0184.public.ves.io.schema.shape.bot_defense.protected_application.ves-swagger.json',
  },

  // =====================================================
  // API Protection
  // =====================================================
  api_definition: {
    apiPath: 'api_definitions',
    displayName: 'API Definitions',
    category: ResourceCategory.APIProtection,
    supportsCustomOps: false,
    icon: 'symbol-interface',
    description: 'API schema definitions for protection',
    schemaFile: 'docs-cloud-f5-com.0002.public.ves.io.schema.views.api_definition.ves-swagger.json',
  },
  api_group: {
    apiPath: 'api_groups',
    displayName: 'API Groups',
    category: ResourceCategory.APIProtection,
    supportsCustomOps: false,
    icon: 'symbol-namespace',
    description: 'API endpoint groupings',
    schemaFile: 'docs-cloud-f5-com.0004.public.ves.io.schema.api_group.ves-swagger.json',
  },

  // =====================================================
  // Networking
  // =====================================================
  virtual_network: {
    apiPath: 'virtual_networks',
    displayName: 'Virtual Networks',
    category: ResourceCategory.Networking,
    supportsCustomOps: false,
    icon: 'type-hierarchy',
    description: 'Virtual network configurations',
    schemaFile: 'docs-cloud-f5-com.0259.public.ves.io.schema.virtual_network.ves-swagger.json',
  },
  network_connector: {
    apiPath: 'network_connectors',
    displayName: 'Network Connectors',
    category: ResourceCategory.Networking,
    supportsCustomOps: false,
    icon: 'link',
    description: 'Network connectivity configurations',
    schemaFile: 'docs-cloud-f5-com.0169.public.ves.io.schema.network_connector.ves-swagger.json',
  },
  network_firewall: {
    apiPath: 'network_firewalls',
    displayName: 'Network Firewalls',
    category: ResourceCategory.Networking,
    supportsCustomOps: false,
    icon: 'flame',
    description: 'Layer 3/4 network firewall rules',
    schemaFile: 'docs-cloud-f5-com.0170.public.ves.io.schema.network_firewall.ves-swagger.json',
  },
  network_policy: {
    apiPath: 'network_policys',
    displayName: 'Network Policies',
    category: ResourceCategory.Networking,
    supportsCustomOps: false,
    icon: 'list-filter',
    description: 'Network policy configurations',
    schemaFile: 'docs-cloud-f5-com.0172.public.ves.io.schema.network_policy.ves-swagger.json',
  },
  enhanced_firewall_policy: {
    apiPath: 'enhanced_firewall_policys',
    displayName: 'Enhanced Firewall Policies',
    category: ResourceCategory.Networking,
    supportsCustomOps: false,
    icon: 'shield',
    description: 'Enhanced firewall policy rules',
    schemaFile:
      'docs-cloud-f5-com.0103.public.ves.io.schema.enhanced_firewall_policy.ves-swagger.json',
  },
  forward_proxy_policy: {
    apiPath: 'forward_proxy_policys',
    displayName: 'Forward Proxy Policies',
    category: ResourceCategory.Networking,
    supportsCustomOps: false,
    icon: 'arrow-right',
    description: 'Forward proxy configurations',
    schemaFile:
      'docs-cloud-f5-com.0071.public.ves.io.schema.views.forward_proxy_policy.ves-swagger.json',
  },

  // =====================================================
  // Sites
  // =====================================================
  aws_vpc_site: {
    apiPath: 'aws_vpc_sites',
    displayName: 'AWS VPC Sites',
    category: ResourceCategory.Sites,
    supportsCustomOps: true,
    icon: 'cloud',
    description: 'AWS VPC-based edge sites',
    schemaFile: 'docs-cloud-f5-com.0066.public.ves.io.schema.views.aws_vpc_site.ves-swagger.json',
  },
  aws_tgw_site: {
    apiPath: 'aws_tgw_sites',
    displayName: 'AWS TGW Sites',
    category: ResourceCategory.Sites,
    supportsCustomOps: true,
    icon: 'cloud',
    description: 'AWS Transit Gateway sites',
    schemaFile: 'docs-cloud-f5-com.0065.public.ves.io.schema.views.aws_tgw_site.ves-swagger.json',
  },
  azure_vnet_site: {
    apiPath: 'azure_vnet_sites',
    displayName: 'Azure VNET Sites',
    category: ResourceCategory.Sites,
    supportsCustomOps: true,
    icon: 'cloud',
    description: 'Azure Virtual Network sites',
    schemaFile:
      'docs-cloud-f5-com.0068.public.ves.io.schema.views.azure_vnet_site.ves-swagger.json',
  },
  gcp_vpc_site: {
    apiPath: 'gcp_vpc_sites',
    displayName: 'GCP VPC Sites',
    category: ResourceCategory.Sites,
    supportsCustomOps: true,
    icon: 'cloud',
    description: 'GCP Virtual Private Cloud sites',
    schemaFile: 'docs-cloud-f5-com.0072.public.ves.io.schema.views.gcp_vpc_site.ves-swagger.json',
  },
  voltstack_site: {
    apiPath: 'voltstack_sites',
    displayName: 'Voltstack Sites',
    category: ResourceCategory.Sites,
    supportsCustomOps: true,
    icon: 'server',
    description: 'Voltstack (AppStack) edge sites',
    schemaFile: 'docs-cloud-f5-com.0067.public.ves.io.schema.views.voltstack_site.ves-swagger.json',
  },
  securemesh_site: {
    apiPath: 'securemesh_sites',
    displayName: 'SecureMesh Sites',
    category: ResourceCategory.Sites,
    supportsCustomOps: true,
    icon: 'server-process',
    description: 'SecureMesh edge sites',
    schemaFile:
      'docs-cloud-f5-com.0076.public.ves.io.schema.views.securemesh_site.ves-swagger.json',
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
    description: 'DNS zone configurations',
    schemaFile: 'docs-cloud-f5-com.0091.public.ves.io.schema.dns_zone.ves-swagger.json',
  },
  dns_load_balancer: {
    apiPath: 'dns_load_balancers',
    displayName: 'DNS Load Balancers',
    category: ResourceCategory.DNS,
    supportsCustomOps: false,
    icon: 'split-horizontal',
    description: 'Global server load balancing via DNS',
    schemaFile: 'docs-cloud-f5-com.0087.public.ves.io.schema.dns_load_balancer.ves-swagger.json',
  },
  dns_lb_pool: {
    apiPath: 'dns_lb_pools',
    displayName: 'DNS LB Pools',
    category: ResourceCategory.DNS,
    supportsCustomOps: false,
    icon: 'layers',
    description: 'DNS load balancer pools',
    schemaFile: 'docs-cloud-f5-com.0089.public.ves.io.schema.dns_lb_pool.ves-swagger.json',
  },
  dns_lb_health_check: {
    apiPath: 'dns_lb_health_checks',
    displayName: 'DNS LB Health Checks',
    category: ResourceCategory.DNS,
    supportsCustomOps: false,
    icon: 'pulse',
    description: 'DNS load balancer health checks',
    schemaFile: 'docs-cloud-f5-com.0088.public.ves.io.schema.dns_lb_health_check.ves-swagger.json',
  },

  // =====================================================
  // IAM & Configuration
  // =====================================================
  namespace: {
    apiPath: 'namespaces',
    displayName: 'Namespaces',
    category: ResourceCategory.IAM,
    supportsCustomOps: true,
    icon: 'folder',
    description: 'Logical workspaces for resource organization',
    schemaFile: 'docs-cloud-f5-com.0166.public.ves.io.schema.namespace.ves-swagger.json',
  },
  user: {
    apiPath: 'users',
    displayName: 'Users',
    category: ResourceCategory.IAM,
    supportsCustomOps: false,
    icon: 'person',
    description: 'User accounts',
    schemaFile: 'docs-cloud-f5-com.0251.public.ves.io.schema.user.ves-swagger.json',
  },
  role: {
    apiPath: 'roles',
    displayName: 'Roles',
    category: ResourceCategory.IAM,
    supportsCustomOps: false,
    icon: 'organization',
    description: 'Access control roles',
    schemaFile: 'docs-cloud-f5-com.0195.public.ves.io.schema.role.ves-swagger.json',
  },
  api_credential: {
    apiPath: 'api_credentials',
    displayName: 'API Credentials',
    category: ResourceCategory.IAM,
    supportsCustomOps: false,
    icon: 'key',
    description: 'API access credentials',
    schemaFile: 'docs-cloud-f5-com.0007.public.ves.io.schema.api_credential.ves-swagger.json',
  },
  cloud_credentials: {
    apiPath: 'cloud_credentials',
    displayName: 'Cloud Credentials',
    category: ResourceCategory.CloudConnect,
    supportsCustomOps: false,
    icon: 'key',
    description: 'Cloud provider credentials',
    schemaFile: 'docs-cloud-f5-com.0059.public.ves.io.schema.cloud_credentials.ves-swagger.json',
  },
  certificate: {
    apiPath: 'certificates',
    displayName: 'Certificates',
    category: ResourceCategory.Configuration,
    supportsCustomOps: false,
    icon: 'file-certificate',
    description: 'TLS/SSL certificates',
    schemaFile: 'docs-cloud-f5-com.0048.public.ves.io.schema.certificate.ves-swagger.json',
  },
  trusted_ca_list: {
    apiPath: 'trusted_ca_lists',
    displayName: 'Trusted CA Lists',
    category: ResourceCategory.Configuration,
    supportsCustomOps: false,
    icon: 'verified-filled',
    description: 'Trusted certificate authority lists',
    schemaFile: 'docs-cloud-f5-com.0196.public.ves.io.schema.trusted_ca_list.ves-swagger.json',
  },

  // =====================================================
  // Observability
  // =====================================================
  alert_policy: {
    apiPath: 'alert_policys',
    displayName: 'Alert Policies',
    category: ResourceCategory.Observability,
    supportsCustomOps: false,
    icon: 'bell',
    description: 'Alerting policy configurations',
    schemaFile: 'docs-cloud-f5-com.0012.public.ves.io.schema.alert_policy.ves-swagger.json',
  },
  alert_receiver: {
    apiPath: 'alert_receivers',
    displayName: 'Alert Receivers',
    category: ResourceCategory.Observability,
    supportsCustomOps: false,
    icon: 'bell-dot',
    description: 'Alert notification receivers',
    schemaFile: 'docs-cloud-f5-com.0013.public.ves.io.schema.alert_receiver.ves-swagger.json',
  },
  global_log_receiver: {
    apiPath: 'global_log_receivers',
    displayName: 'Global Log Receivers',
    category: ResourceCategory.Observability,
    supportsCustomOps: false,
    icon: 'output',
    description: 'Log forwarding configurations',
    schemaFile: 'docs-cloud-f5-com.0122.public.ves.io.schema.global_log_receiver.ves-swagger.json',
  },
  synthetic_monitor: {
    apiPath: 'synthetic_monitors',
    displayName: 'Synthetic Monitors',
    category: ResourceCategory.Observability,
    supportsCustomOps: false,
    icon: 'pulse',
    description: 'Synthetic monitoring configurations',
    schemaFile:
      'docs-cloud-f5-com.0226.public.ves.io.schema.observability.synthetic_monitor.ves-swagger.json',
  },
};

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
