import * as https from 'https';
import { AuthProvider } from './auth';
import { F5XCApiError } from '../utils/errors';
import { getLogger } from '../utils/logger';
import { ApiBase, ResourceTypeInfo, API_ENDPOINTS } from './resourceTypes';

/**
 * Options for list operations
 */
export interface ListOptions {
  /** API base path - 'config' or 'web' */
  apiBase?: ApiBase;
  /** Service segment for extended API paths (e.g., 'dns' for /api/config/dns/namespaces/...) */
  serviceSegment?: string;
  /** Custom list endpoint path (overrides standard path construction) */
  customListPath?: string;
  /** HTTP method for list operation - some APIs use POST instead of GET */
  listMethod?: 'GET' | 'POST';
  /** Whether this is a tenant-level resource (no namespace in path) */
  tenantLevel?: boolean;
  /** Response field containing list items (default: 'items') */
  listResponseField?: string;
  /** Label filter for filtering results */
  labelFilter?: string;
}

/**
 * Build the API path for a resource operation
 * Supports extended API paths with service segments (e.g., /api/config/dns/namespaces/...)
 */
function buildApiPath(
  namespace: string,
  resourceType: string,
  name?: string,
  apiBase: ApiBase = 'config',
  serviceSegment?: string,
): string {
  // Dynamic API base path construction - supports all 23 F5 XC API bases
  const basePath = `/api/${apiBase}`;
  // Insert service segment if present (e.g., /api/config/dns/namespaces/...)
  const baseWithService = serviceSegment ? `${basePath}/${serviceSegment}` : basePath;
  const path = name
    ? `${baseWithService}/namespaces/${namespace}/${resourceType}/${name}`
    : `${baseWithService}/namespaces/${namespace}/${resourceType}`;
  return path;
}

/**
 * HTTP response interface
 */
interface HttpResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Request options for API calls
 */
export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  queryParams?: Record<string, string | string[]>;
  timeout?: number;
}

/**
 * List response structure from F5 XC API
 */
export interface ListResponse<T> {
  items: T[];
  errors?: Array<{ message: string }>;
}

/**
 * Resource metadata structure
 */
export interface ResourceMetadata {
  name: string;
  namespace: string;
  uid?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creation_timestamp?: string;
  modification_timestamp?: string;
}

/**
 * Generic resource structure
 */
export interface Resource<TSpec = unknown> {
  metadata: ResourceMetadata;
  spec: TSpec;
  system_metadata?: Record<string, unknown>;
  status?: unknown[];
}

/**
 * Site type enumeration from F5 XC API
 */
export type SiteType = 'INVALID' | 'REGIONAL_EDGE' | 'CUSTOMER_EDGE' | 'NGINX_ONE';

/**
 * Site state enumeration
 */
export type SiteState =
  | 'ONLINE'
  | 'OFFLINE'
  | 'STANDBY'
  | 'REGISTRATION_APPROVAL_REQUIRED'
  | 'REGISTRATION_REJECTED'
  | 'DECOMMISSIONING'
  | 'WAITING_FOR_REGISTRATION'
  | 'UPGRADING'
  | 'PROVISIONING';

/**
 * Geographic coordinates
 */
export interface Coordinates {
  latitude?: number;
  longitude?: number;
}

/**
 * Site specification from F5 XC Sites API
 */
export interface SiteSpec {
  site_type?: SiteType;
  address?: string;
  region?: string;
  coordinates?: Coordinates;
  connected_re?: { name: string };
  connected_re_for_info?: { name: string };
  volterra_software_version?: string;
  operating_system_version?: string;
  inside_vip?: string;
  outside_vip?: string;
}

/**
 * Site resource from F5 XC Sites API
 */
export interface Site extends Resource<SiteSpec> {
  get_spec?: SiteSpec;
}

/**
 * F5 Distributed Cloud API Client
 */
export class F5XCClient {
  private readonly baseUrl: string;
  private readonly authProvider: AuthProvider;
  private readonly logger = getLogger();
  private readonly defaultTimeout = 30000;

  constructor(baseUrl: string, authProvider: AuthProvider) {
    // Normalize base URL (remove trailing slash)
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.authProvider = authProvider;
  }

  /**
   * Create a new resource
   */
  async create<T extends Resource>(
    namespace: string,
    resourceType: string,
    body: T,
    apiBase: ApiBase = 'config',
    serviceSegment?: string,
  ): Promise<T> {
    this.logger.debug(
      `Creating ${resourceType} in namespace ${namespace} (apiBase: ${apiBase}, serviceSegment: ${serviceSegment || 'none'})`,
    );

    return this.request<T>({
      method: 'POST',
      path: buildApiPath(namespace, resourceType, undefined, apiBase, serviceSegment),
      body,
    });
  }

  /**
   * Get a single resource
   */
  async get<T extends Resource>(
    namespace: string,
    resourceType: string,
    name: string,
    responseFormat?: string,
    apiBase: ApiBase = 'config',
    serviceSegment?: string,
  ): Promise<T> {
    this.logger.debug(
      `Getting ${resourceType}/${name} from namespace ${namespace} (apiBase: ${apiBase}, serviceSegment: ${serviceSegment || 'none'})`,
    );

    const queryParams: Record<string, string> = {};
    if (responseFormat) {
      queryParams['response_format'] = responseFormat;
    }

    return this.request<T>({
      method: 'GET',
      path: buildApiPath(namespace, resourceType, name, apiBase, serviceSegment),
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    });
  }

  /**
   * Get a single resource with advanced options for non-standard APIs
   */
  async getWithOptions<T extends Resource>(
    namespace: string,
    resourceType: string,
    name: string,
    options: {
      apiBase?: ApiBase;
      serviceSegment?: string;
      customGetPath?: string;
      responseFormat?: string;
    } = {},
  ): Promise<T> {
    const { apiBase = 'config', serviceSegment, customGetPath, responseFormat } = options;

    this.logger.debug(
      `Getting ${resourceType}/${name} from namespace ${namespace} (apiBase: ${apiBase}, customGetPath: ${customGetPath || 'none'})`,
    );

    // Build the path
    let path: string;
    if (customGetPath) {
      // Use custom path with namespace and name substitution
      path = customGetPath.replace('{namespace}', namespace).replace('{name}', name);
    } else {
      path = buildApiPath(namespace, resourceType, name, apiBase, serviceSegment);
    }

    const queryParams: Record<string, string> = {};
    if (responseFormat) {
      queryParams['response_format'] = responseFormat;
    }

    return this.request<T>({
      method: 'GET',
      path,
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    });
  }

  /**
   * List resources in a namespace
   */
  async list<T extends Resource>(
    namespace: string,
    resourceType: string,
    labelFilter?: string,
    apiBase: ApiBase = 'config',
  ): Promise<T[]> {
    return this.listWithOptions<T>(namespace, resourceType, { apiBase, labelFilter });
  }

  /**
   * List resources with advanced options for non-standard APIs
   */
  async listWithOptions<T extends Resource>(
    namespace: string,
    resourceType: string,
    options: ListOptions = {},
  ): Promise<T[]> {
    const {
      apiBase = 'config',
      serviceSegment,
      customListPath,
      listMethod = 'GET',
      tenantLevel = false,
      listResponseField = 'items',
      labelFilter,
    } = options;

    this.logger.debug(
      `Listing ${resourceType} in namespace ${namespace} (apiBase: ${apiBase}, serviceSegment: ${serviceSegment || 'none'}, tenantLevel: ${tenantLevel}, method: ${listMethod})`,
    );

    // Build the path
    let path: string;
    if (customListPath) {
      // Use custom path with namespace substitution
      path = customListPath.replace('{namespace}', namespace);
    } else if (tenantLevel) {
      // Tenant-level resource - no namespace in path (dynamic API base)
      const basePath = `/api/${apiBase}`;
      path = `${basePath}/${resourceType}`;
    } else {
      // Standard path (with optional service segment for extended APIs like /api/config/dns/...)
      path = buildApiPath(namespace, resourceType, undefined, apiBase, serviceSegment);
    }

    const queryParams: Record<string, string> = {};
    if (labelFilter) {
      queryParams['label_filter'] = labelFilter;
    }

    const response = await this.request<Record<string, unknown>>({
      method: listMethod,
      path,
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      body: listMethod === 'POST' ? {} : undefined,
    });

    // Extract items from the response using the configured field
    const items = response[listResponseField] as T[] | undefined;
    return items || [];
  }

  /**
   * Create list options from ResourceTypeInfo
   */
  static buildListOptions(resourceType: ResourceTypeInfo, labelFilter?: string): ListOptions {
    return {
      apiBase: resourceType.apiBase,
      serviceSegment: resourceType.serviceSegment,
      customListPath: resourceType.customListPath,
      listMethod: resourceType.listMethod,
      tenantLevel: resourceType.tenantLevel,
      listResponseField: resourceType.listResponseField,
      labelFilter,
    };
  }

  /**
   * Replace (update) a resource
   */
  async replace<T extends Resource>(
    namespace: string,
    resourceType: string,
    name: string,
    body: T,
    apiBase: ApiBase = 'config',
    serviceSegment?: string,
  ): Promise<T> {
    this.logger.debug(
      `Replacing ${resourceType}/${name} in namespace ${namespace} (apiBase: ${apiBase}, serviceSegment: ${serviceSegment || 'none'})`,
    );

    return this.request<T>({
      method: 'PUT',
      path: buildApiPath(namespace, resourceType, name, apiBase, serviceSegment),
      body,
    });
  }

  /**
   * Delete a resource
   */
  async delete(
    namespace: string,
    resourceType: string,
    name: string,
    failIfReferred = false,
    apiBase: ApiBase = 'config',
    serviceSegment?: string,
  ): Promise<void> {
    this.logger.debug(
      `Deleting ${resourceType}/${name} from namespace ${namespace} (apiBase: ${apiBase}, serviceSegment: ${serviceSegment || 'none'})`,
    );

    const queryParams: Record<string, string> = {};
    if (failIfReferred) {
      queryParams['fail_if_referred'] = 'true';
    }

    await this.request<void>({
      method: 'DELETE',
      path: buildApiPath(namespace, resourceType, name, apiBase, serviceSegment),
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    });
  }

  /**
   * List all namespaces
   */
  async listNamespaces(): Promise<Array<{ name: string; metadata: ResourceMetadata }>> {
    this.logger.debug('Listing namespaces');

    const response = await this.request<ListResponse<{ name: string; metadata: ResourceMetadata }>>(
      {
        method: 'GET',
        path: API_ENDPOINTS.NAMESPACES,
      },
    );

    return response.items || [];
  }

  /**
   * Custom API endpoint request
   */
  async customRequest<T>(path: string, options: Partial<RequestOptions> = {}): Promise<T> {
    return this.request<T>({
      method: options.method || 'GET',
      path,
      body: options.body,
      queryParams: options.queryParams,
      timeout: options.timeout,
    });
  }

  /**
   * Get all sites from the system namespace
   */
  async getSites(): Promise<Site[]> {
    this.logger.debug('Fetching sites from system namespace');
    return this.list<Site>('system', 'sites');
  }

  /**
   * Get all Regional Edge sites
   */
  async getRegionalEdges(): Promise<Site[]> {
    const sites = await this.getSites();
    return sites.filter((site) => {
      const spec = site.get_spec || site.spec;
      return spec?.site_type === 'REGIONAL_EDGE';
    });
  }

  /**
   * Find a Regional Edge site by site code
   * Site codes appear in the site name (e.g., "ves-io-dc12-res" contains "dc12")
   * Note: F5-managed Regional Edge sites are visible in LIST but not accessible via GET
   */
  async findRegionalEdgeBySiteCode(siteCode: string): Promise<Site | undefined> {
    const allSites = await this.getSites();

    // Helper to get site name from root level or metadata
    const getSiteName = (site: Site): string | undefined => {
      const siteObj = site as unknown as Record<string, unknown>;
      return (siteObj['name'] as string) || site.metadata?.name;
    };

    // Find sites with the matching code in their name
    const lowerCode = siteCode.toLowerCase();
    return allSites.find((site) => {
      const name = getSiteName(site);
      return name?.toLowerCase().includes(lowerCode);
    });
  }

  /**
   * Check if the current user has permission to perform API operations.
   * Uses the evaluate-api-access endpoint for RBAC pre-checking.
   *
   * @param namespace - The namespace context for the operations
   * @param items - List of API operations to check (method + path)
   * @returns Promise resolving to true if ALL operations are permitted
   */
  async checkApiAccess(
    namespace: string,
    items: Array<{ method: string; path: string }>,
  ): Promise<boolean> {
    this.logger.debug(
      `Checking API access for ${items.length} operations in namespace ${namespace}`,
    );

    const request = {
      namespace,
      item_lists: [
        {
          list_id: 'permission_check',
          items: items.map((item) => ({
            method: item.method,
            path: item.path,
          })),
        },
      ],
    };

    try {
      const response = await this.request<{
        item_lists?: Array<{
          list_id: string;
          result: boolean;
          items?: Array<{ method: string; path: string; result: boolean }>;
        }>;
      }>({
        method: 'POST',
        path: '/api/web/namespaces/system/evaluate-api-access',
        body: request,
      });

      // Check if all operations are permitted
      const itemList = response.item_lists?.[0];
      const result = itemList?.result ?? false;
      this.logger.debug(`API access check result: ${result}`, {
        namespace,
        items: itemList?.items,
      });
      return result;
    } catch (error) {
      this.logger.warn('API access check failed, assuming no permission', error as Error);
      return false;
    }
  }

  /**
   * Delete a namespace and all resources within it (cascade delete).
   * This permanently removes the namespace and ALL configuration objects under it.
   *
   * @param namespaceName - Name of the namespace to delete
   */
  async cascadeDeleteNamespace(namespaceName: string): Promise<void> {
    this.logger.debug(`Cascade deleting namespace: ${namespaceName}`);

    await this.request<void>({
      method: 'POST',
      path: `/api/web/namespaces/${namespaceName}/cascade_delete`,
      body: {},
    });
  }

  /**
   * Make an authenticated HTTP request
   */
  private async request<T>(options: RequestOptions): Promise<T> {
    const { method, path, body, queryParams, timeout = this.defaultTimeout } = options;

    // Build URL with query parameters
    let fullPath = path;
    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(queryParams)) {
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, v));
        } else {
          params.append(key, value);
        }
      }
      fullPath = `${path}?${params.toString()}`;
    }

    const url = new URL(fullPath, this.baseUrl);
    const headers = this.authProvider.getHeaders();
    const agent = this.authProvider.getHttpsAgent();

    const response = await this.httpRequest(
      {
        hostname: url.hostname,
        port: url.port ? parseInt(url.port, 10) : 443,
        path: url.pathname + url.search,
        method,
        headers,
        agent,
        timeout,
      },
      body,
    );

    // Handle response
    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (!response.body || response.body.trim() === '') {
        return undefined as T;
      }
      try {
        return JSON.parse(response.body) as T;
      } catch {
        return response.body as unknown as T;
      }
    }

    throw new F5XCApiError(response.statusCode, response.body, fullPath);
  }

  /**
   * Low-level HTTP request using Node.js https module
   */
  private httpRequest(options: https.RequestOptions, body?: unknown): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf-8');
          const headers: Record<string, string | string[] | undefined> = {};

          for (const [key, value] of Object.entries(res.headers)) {
            headers[key] = value;
          }

          resolve({
            statusCode: res.statusCode || 500,
            body: responseBody,
            headers,
          });
        });
      });

      req.on('error', (error) => {
        this.logger.error('HTTP request failed', error);
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
        req.write(bodyStr);
      }

      req.end();
    });
  }
}
