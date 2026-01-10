// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Subscription and quota API types and methods
 *
 * API Endpoints:
 * - GET /api/web/namespaces/system/usage_plans/current - Current plan info
 * - GET /api/web/namespaces/{namespace}/quota/usage - Quota limits and usage
 * - GET /api/web/namespaces/{namespace}/quota/limits - Quota limits only
 */

import { F5XCClient } from './client';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Subscription tier - F5 XC has Standard and Advanced tiers
 */
export type SubscriptionTier = 'standard' | 'advanced';

/**
 * Addon service information
 * Addon names follow pattern: f5xc_{service}_{tier}
 * e.g., f5xc_bot_defense_advanced, f5xc_waap_standard
 */
export interface AddonService {
  name: string;
  displayName: string;
  tier: SubscriptionTier;
  category: AddonCategory;
}

/**
 * Addon service categories
 */
export type AddonCategory =
  | 'bot_defense'
  | 'waap'
  | 'securemesh'
  | 'appstack'
  | 'dns'
  | 'observability'
  | 'other';

/**
 * Current plan information from /api/web/namespaces/system/usage_plans/current
 */
export interface PlanInfo {
  name: string;
  title: string;
  subtitle?: string;
  description?: string;
  tier: SubscriptionTier;
  allowedAddonServices: AddonService[];
  includedAddonServices: AddonService[];
}

/**
 * Quota item with limit and current usage
 */
export interface QuotaItem {
  key: string;
  displayName: string;
  description?: string;
  limit: number;
  usage: number;
  percentUsed: number;
}

/**
 * Quota usage response
 */
export interface QuotaUsage {
  objects: QuotaItem[];
  resources: QuotaItem[];
  apis: QuotaItem[];
}

/**
 * API addon service object structure
 * API returns addon services as objects with name and display_name, not strings
 */
interface ApiAddonService {
  name?: string;
  display_name?: string;
  description?: string;
  tier?: string;
}

/**
 * API response structures from F5 XC
 * Based on actual API responses from /api/web/namespaces/system/usage_plans/current
 * and /api/web/namespaces/{namespace}/quota/usage
 */
interface UsagePlanItem {
  name?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  tenant_type?: string;
  billing_disabled?: boolean;
  flat_price?: number;
  current?: boolean;
  allowed_addon_services?: ApiAddonService[];
  included_addon_services?: ApiAddonService[];
  default_quota?: {
    object_limits?: Record<string, { maximum?: number }>;
  };
}

interface UsagePlanResponse {
  locale?: string;
  plans?: UsagePlanItem[];
  // Legacy structure fallback
  plan?: UsagePlanItem;
}

interface QuotaUsageItem {
  limit?: {
    maximum?: number;
  };
  usage?: {
    current?: number;
  };
  display_name?: string;
  description?: string;
}

interface QuotaUsageResponse {
  quota_usage?: Record<string, QuotaUsageItem>;
  // Legacy structure fallback
  objects?: Record<string, QuotaUsageItem>;
  resources?: Record<string, QuotaUsageItem>;
  apis?: Record<string, QuotaUsageItem>;
}

/**
 * Parse addon service to extract tier and category
 * Handles both string format (legacy) and object format (current API)
 * String format: f5xc_{category}_{tier} or f5xc_{category}_{subcategory}_{tier}
 * Object format: { name: string, display_name: string, ... }
 */
function parseAddonService(service: ApiAddonService | string): AddonService {
  // Handle both string and object inputs
  const name = typeof service === 'string' ? service : service.name || '';
  const displayNameFromApi = typeof service === 'object' ? service.display_name : undefined;

  const lowerName = name.toLowerCase();

  // Determine tier from name suffix
  let tier: SubscriptionTier = 'standard';
  if (lowerName.includes('_advanced') || lowerName.includes('advanced')) {
    tier = 'advanced';
  }

  // Determine category from name
  let category: AddonCategory = 'other';
  let derivedDisplayName = name;

  if (lowerName.includes('bot_defense') || lowerName.includes('bot-defense')) {
    category = 'bot_defense';
    derivedDisplayName = tier === 'advanced' ? 'Bot Defense Advanced' : 'Bot Defense Standard';
  } else if (lowerName.includes('waap')) {
    category = 'waap';
    derivedDisplayName =
      tier === 'advanced' ? 'Web App & API Protection Advanced' : 'Web App & API Protection';
  } else if (lowerName.includes('securemesh')) {
    category = 'securemesh';
    derivedDisplayName = tier === 'advanced' ? 'SecureMesh Advanced' : 'SecureMesh Standard';
  } else if (lowerName.includes('appstack')) {
    category = 'appstack';
    derivedDisplayName = tier === 'advanced' ? 'App Stack Advanced' : 'App Stack Standard';
  } else if (lowerName.includes('dns')) {
    category = 'dns';
    derivedDisplayName = 'DNS Services';
  } else if (lowerName.includes('observability')) {
    category = 'observability';
    derivedDisplayName = 'Observability';
  } else {
    // Format unknown names nicely
    derivedDisplayName = name
      .replace(/^f5xc_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Use API display_name if available, otherwise use derived name
  const finalDisplayName = displayNameFromApi || derivedDisplayName;

  return {
    name,
    displayName: finalDisplayName,
    tier,
    category,
  };
}

/**
 * Convert quota records to QuotaItem arrays
 * Handles both new format (limit.maximum, usage.current) and legacy format
 */
function parseQuotaItems(items: Record<string, QuotaUsageItem>): QuotaItem[] {
  return Object.entries(items)
    .filter(([, value]) => {
      // Filter out items with -1 limit (unlimited/disabled)
      const limit = value.limit?.maximum ?? 0;
      return limit > 0;
    })
    .map(([key, value]) => {
      // Handle new format: limit.maximum, usage.current
      const limit = value.limit?.maximum ?? 0;
      const usage = value.usage?.current ?? 0;
      const percentUsed = limit > 0 ? Math.round((usage / limit) * 100) : 0;

      return {
        key,
        // The key itself is the display name in the new API format
        displayName:
          value.display_name || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        description: value.description,
        limit,
        usage,
        percentUsed,
      };
    })
    .sort((a, b) => b.percentUsed - a.percentUsed); // Sort by usage percentage descending
}

/**
 * Get current subscription plan information
 */
export async function getCurrentPlan(client: F5XCClient): Promise<PlanInfo> {
  logger.debug('Fetching current usage plan');

  const response = await client.customRequest<UsagePlanResponse>(
    '/api/web/namespaces/system/usage_plans/current',
  );

  // Find the current plan from the plans array (new format) or use plan object (legacy format)
  let plan: UsagePlanItem | undefined;

  if (response.plans && response.plans.length > 0) {
    // New format: array of plans, find the one with current: true
    plan = response.plans.find((p) => p.current === true) || response.plans[0];
  } else if (response.plan) {
    // Legacy format: single plan object
    plan = response.plan;
  }

  if (!plan) {
    plan = {};
  }

  // Determine tier from tenant_type or plan name
  let tier: SubscriptionTier = 'standard';
  const tenantType = (plan.tenant_type || '').toLowerCase();
  const planName = (plan.name || plan.title || '').toLowerCase();

  if (
    tenantType === 'enterprise' ||
    planName.includes('organization') ||
    planName.includes('advanced')
  ) {
    tier = 'advanced';
  }

  // Parse addon services
  const allowedAddonServices = (plan.allowed_addon_services || []).map(parseAddonService);
  const includedAddonServices = (plan.included_addon_services || []).map(parseAddonService);

  return {
    name: plan.name || 'Unknown',
    title: plan.title || 'Unknown Plan',
    subtitle: plan.subtitle,
    description: plan.description,
    tier,
    allowedAddonServices,
    includedAddonServices,
  };
}

/**
 * Get quota usage for a namespace
 */
export async function getQuotaUsage(
  client: F5XCClient,
  namespace: string = 'system',
): Promise<QuotaUsage> {
  logger.debug(`Fetching quota usage for namespace: ${namespace}`);

  const response = await client.customRequest<QuotaUsageResponse>(
    `/api/web/namespaces/${namespace}/quota/usage`,
  );

  // New API format: all quotas are in quota_usage object
  if (response.quota_usage) {
    const allItems = parseQuotaItems(response.quota_usage);
    // Split into categories based on item names (heuristic)
    const objects = allItems.filter(
      (item) =>
        !item.key.toLowerCase().includes('api') ||
        item.key.toLowerCase().includes('api credential') ||
        item.key.toLowerCase().includes('api definition') ||
        item.key.toLowerCase().includes('api group'),
    );
    const apis = allItems.filter(
      (item) =>
        item.key.toLowerCase().includes('api') &&
        !item.key.toLowerCase().includes('api credential') &&
        !item.key.toLowerCase().includes('api definition') &&
        !item.key.toLowerCase().includes('api group'),
    );

    return {
      objects,
      resources: [], // No separate resources category in new API
      apis,
    };
  }

  // Legacy format fallback
  return {
    objects: parseQuotaItems(response.objects || {}),
    resources: parseQuotaItems(response.resources || {}),
    apis: parseQuotaItems(response.apis || {}),
  };
}

/**
 * Static mapping from RESOURCE_TYPES apiPath keys to known quota key patterns
 * This provides reliable matching for common F5 XC resource types
 */
const QUOTA_KEY_MAPPINGS: Record<string, string[]> = {
  // HTTP Load Balancers are called "Virtual Host" in the quota API
  http_loadbalancers: ['virtual host', 'virtual_host', 'virtualhost'],
  // TCP/Network load balancers use network_loadbalancer in quota API
  tcp_loadbalancers: ['network_loadbalancer', 'network loadbalancer', 'networkloadbalancer'],
  origin_pools: ['origin pool', 'origin_pool', 'originpool'],
  // App firewalls are "Application Firewall" in quota API
  app_firewalls: ['application firewall', 'app firewall', 'app_firewall'],
  healthchecks: ['healthcheck', 'health check', 'health_check'],
  api_definitions: ['api definition', 'api_definition', 'apidefinition'],
  service_policies: ['service policy', 'service_policy', 'servicepolicy'],
  rate_limiter_policys: ['rate limiter', 'rate_limiter', 'ratelimiter'],
  ip_prefix_sets: ['ip prefix set', 'ip_prefix_set', 'ipprefixset'],
  routes: ['route', 'routes'],
  virtual_hosts: ['virtual host', 'virtual_host', 'virtualhost'],
  certificates: ['tls certificate', 'certificate', 'certificates'],
  dns_zones: ['dns zone', 'dns_zone', 'dnszone'],
  virtual_networks: ['virtual network', 'virtual_network', 'virtualnetwork'],
  network_connectors: ['network connector', 'network_connector', 'networkconnector'],
  network_firewalls: ['network firewall', 'network_firewall', 'networkfirewall'],
  sites: ['site', 'sites'],
  virtual_sites: ['virtual site', 'virtual_site', 'virtualsite'],
  namespaces: ['namespace', 'namespaces'],
  // CDN load balancers
  cdn_loadbalancers: ['cdn_loadbalancer', 'cdn loadbalancer', 'cdnloadbalancer'],
};

/**
 * Get quota usage for a specific resource type
 * Returns the quota item matching the resource type, or undefined if not found
 * Uses static mapping first, then fuzzy matching to handle different naming conventions between
 * RESOURCE_TYPES keys (e.g., 'http_loadbalancers') and API quota keys (e.g., 'HTTP Load Balancer')
 */
export async function getQuotaForResourceType(
  client: F5XCClient,
  resourceTypeKey: string,
  namespace: string = 'system',
): Promise<QuotaItem | undefined> {
  const quotaUsage = await getQuotaUsage(client, namespace);

  // Combine all quota items for search
  const allItems = [...quotaUsage.objects, ...quotaUsage.resources];

  logger.info(`Looking for quota match for key: ${resourceTypeKey}`);
  logger.info(
    `Available quota items (${allItems.length}): ${allItems.map((i) => `${i.key}(${i.displayName})`).join(', ')}`,
  );

  // First, try static mapping for known resource types
  const mappedKeys = QUOTA_KEY_MAPPINGS[resourceTypeKey.toLowerCase()];
  if (mappedKeys) {
    logger.info(`Using static mapping for ${resourceTypeKey}: [${mappedKeys.join(', ')}]`);
    const staticMatch = allItems.find((item) => {
      const itemKeyLower = item.key.toLowerCase();
      const itemDisplayLower = item.displayName.toLowerCase();
      return (
        mappedKeys.some((k) => itemKeyLower.includes(k)) ||
        mappedKeys.some((k) => itemDisplayLower.includes(k))
      );
    });
    if (staticMatch) {
      logger.info(
        `Found quota via static mapping: ${staticMatch.key} (${staticMatch.displayName})`,
      );
      return staticMatch;
    }
  }

  // Fall back to fuzzy matching
  // Create multiple normalized versions for matching
  const keyLower = resourceTypeKey.toLowerCase();
  const keyNoUnderscores = keyLower.replace(/_/g, ''); // httploadbalancers
  const keyWithSpaces = keyLower.replace(/_/g, ' '); // http loadbalancers
  const keySingular = keyWithSpaces.replace(/s$/, ''); // http loadbalancer
  const keyNoSpacesSingular = keyNoUnderscores.replace(/s$/, ''); // httploadbalancer

  logger.info(
    `Fuzzy matching with variants: [${keyNoUnderscores}, ${keyWithSpaces}, ${keySingular}, ${keyNoSpacesSingular}]`,
  );

  // Search with fuzzy matching
  const match = allItems.find((item) => {
    const itemKeyLower = item.key.toLowerCase();
    const itemNoSpaces = itemKeyLower.replace(/ /g, '');
    const itemDisplayLower = item.displayName.toLowerCase();
    const itemDisplayNoSpaces = itemDisplayLower.replace(/ /g, '');

    // Multiple matching strategies
    const matches =
      // Exact match (normalized)
      itemKeyLower === keySingular ||
      itemDisplayLower === keySingular ||
      // No-spaces match
      itemNoSpaces === keyNoSpacesSingular ||
      itemDisplayNoSpaces === keyNoSpacesSingular ||
      // Contains match
      itemKeyLower.includes(keySingular) ||
      itemDisplayLower.includes(keySingular) ||
      keySingular.includes(itemKeyLower.replace(/s$/, '')) ||
      // No-spaces contains match
      itemNoSpaces.includes(keyNoSpacesSingular) ||
      itemDisplayNoSpaces.includes(keyNoSpacesSingular);

    if (matches) {
      logger.info(`Found quota via fuzzy match: ${item.key} (${item.displayName})`);
    }
    return matches;
  });

  if (!match) {
    logger.info(`No quota match found for ${resourceTypeKey}`);
  }

  return match;
}

// ===========================
// Addon Activation Types & APIs
// ===========================

/**
 * Addon service activation state
 */
export type ActivationState = 'AS_NONE' | 'AS_PENDING' | 'AS_SUBSCRIBED' | 'AS_ERROR';

/**
 * Access status - determines if user can activate addon
 */
export type AccessStatus =
  | 'AS_AC_NONE'
  | 'AS_AC_ALLOWED'
  | 'AS_AC_PBAC_DENY'
  | 'AS_AC_PBAC_DENY_UPGRADE_PLAN'
  | 'AS_AC_PBAC_DENY_CONTACT_SALES'
  | 'AS_AC_PBAC_DENY_AS_AC_EOL';

/**
 * Subscription state
 */
export type SubscriptionState =
  | 'SUBSCRIPTION_PENDING'
  | 'SUBSCRIPTION_ENABLED'
  | 'SUBSCRIPTION_DISABLE_PENDING'
  | 'SUBSCRIPTION_DISABLED';

/**
 * Full activation status for an addon service
 */
export interface ActivationStatus {
  state: ActivationState;
  accessStatus?: AccessStatus;
  tier?: SubscriptionTier;
  displayName?: string;
}

/**
 * Subscription creation response
 */
export interface SubscriptionResponse {
  metadata: {
    name: string;
    namespace: string;
    uid?: string;
  };
  spec: {
    status: SubscriptionState;
    addon_service?: {
      name: string;
      namespace: string;
    };
  };
}

/**
 * API response for activation status endpoint
 */
interface ActivationStatusResponse {
  state?: string;
}

/**
 * API response for all tiers activation status
 */
interface AllTiersActivationStatusResponse {
  activation_states?: Record<
    string,
    {
      name?: string;
      display_name?: string;
      addon_service_status?: string;
      access_status?: string;
      tier?: string;
    }
  >;
}

/**
 * API request body for creating addon subscription
 */
interface CreateAddonSubscriptionRequest {
  metadata: {
    name: string;
    namespace: string;
  };
  spec: {
    addon_service: {
      name: string;
      namespace: string;
    };
  };
}

/**
 * Get activation status for an addon service
 * Returns state (AS_NONE, AS_PENDING, AS_SUBSCRIBED, AS_ERROR)
 */
export async function getAddonActivationStatus(
  client: F5XCClient,
  addonServiceName: string,
): Promise<ActivationStatus> {
  logger.debug(`Fetching activation status for addon: ${addonServiceName}`);

  try {
    // First try the all-activation-status endpoint for more detailed info
    const allStatusResponse = await client.customRequest<AllTiersActivationStatusResponse>(
      `/api/web/namespaces/system/addon_services/${addonServiceName}/all-activation-status`,
    );

    if (allStatusResponse.activation_states) {
      // Find the matching addon in activation states
      const states = allStatusResponse.activation_states;
      const addonKey = Object.keys(states).find(
        (key) => key === addonServiceName || states[key]?.name === addonServiceName,
      );

      if (addonKey && states[addonKey]) {
        const addonState = states[addonKey];
        return {
          state: (addonState.addon_service_status as ActivationState) || 'AS_NONE',
          accessStatus: addonState.access_status as AccessStatus,
          tier: addonState.tier?.toLowerCase() === 'advanced' ? 'advanced' : 'standard',
          displayName: addonState.display_name,
        };
      }
    }

    // Fallback to simple activation-status endpoint
    const response = await client.customRequest<ActivationStatusResponse>(
      `/api/web/namespaces/system/addon_services/${addonServiceName}/activation-status`,
    );

    return {
      state: (response.state as ActivationState) || 'AS_NONE',
    };
  } catch (error) {
    logger.warn(`Failed to get activation status for ${addonServiceName}:`, error as Error);
    return {
      state: 'AS_NONE',
    };
  }
}

/**
 * Create addon subscription (request activation)
 * Creates a subscription in SUBSCRIPTION_PENDING state
 */
export async function createAddonSubscription(
  client: F5XCClient,
  addonServiceName: string,
  namespace: string = 'system',
): Promise<SubscriptionResponse> {
  logger.info(`Creating addon subscription for: ${addonServiceName}`);

  // Generate a unique subscription name based on addon service name
  const subscriptionName = `${addonServiceName.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}-subscription`;

  const requestBody: CreateAddonSubscriptionRequest = {
    metadata: {
      name: subscriptionName,
      namespace: namespace,
    },
    spec: {
      addon_service: {
        name: addonServiceName,
        namespace: 'shared', // Addon services are typically in shared namespace
      },
    },
  };

  const response = await client.customRequest<SubscriptionResponse>(
    `/api/web/namespaces/${namespace}/addon_subscriptions`,
    {
      method: 'POST',
      body: requestBody,
    },
  );

  logger.info(
    `Addon subscription created: ${response.metadata?.name}, status: ${response.spec?.status}`,
  );

  return response;
}
