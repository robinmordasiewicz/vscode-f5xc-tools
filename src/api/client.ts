import * as https from 'https';
import { AuthProvider } from './auth';
import { F5XCApiError } from '../utils/errors';
import { getLogger } from '../utils/logger';

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
  async create<T extends Resource>(namespace: string, resourceType: string, body: T): Promise<T> {
    this.logger.debug(`Creating ${resourceType} in namespace ${namespace}`);

    return this.request<T>({
      method: 'POST',
      path: `/api/config/namespaces/${namespace}/${resourceType}`,
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
  ): Promise<T> {
    this.logger.debug(`Getting ${resourceType}/${name} from namespace ${namespace}`);

    const queryParams: Record<string, string> = {};
    if (responseFormat) {
      queryParams['response_format'] = responseFormat;
    }

    return this.request<T>({
      method: 'GET',
      path: `/api/config/namespaces/${namespace}/${resourceType}/${name}`,
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
  ): Promise<T[]> {
    this.logger.debug(`Listing ${resourceType} in namespace ${namespace}`);

    const queryParams: Record<string, string> = {};
    if (labelFilter) {
      queryParams['label_filter'] = labelFilter;
    }

    const response = await this.request<ListResponse<T>>({
      method: 'GET',
      path: `/api/config/namespaces/${namespace}/${resourceType}`,
      queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
    });

    return response.items || [];
  }

  /**
   * Replace (update) a resource
   */
  async replace<T extends Resource>(
    namespace: string,
    resourceType: string,
    name: string,
    body: T,
  ): Promise<T> {
    this.logger.debug(`Replacing ${resourceType}/${name} in namespace ${namespace}`);

    return this.request<T>({
      method: 'PUT',
      path: `/api/config/namespaces/${namespace}/${resourceType}/${name}`,
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
  ): Promise<void> {
    this.logger.debug(`Deleting ${resourceType}/${name} from namespace ${namespace}`);

    const queryParams: Record<string, string> = {};
    if (failIfReferred) {
      queryParams['fail_if_referred'] = 'true';
    }

    await this.request<void>({
      method: 'DELETE',
      path: `/api/config/namespaces/${namespace}/${resourceType}/${name}`,
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
        path: '/api/web/namespaces',
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
