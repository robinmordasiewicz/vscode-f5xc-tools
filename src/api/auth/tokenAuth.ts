import * as https from 'https';
import { AuthProvider, TokenAuthConfig } from './index';
import { getLogger } from '../../utils/logger';
import { API_ENDPOINTS } from '../../generated/constants';

/**
 * API Token-based authentication provider for F5 XC
 */
export class TokenAuthProvider implements AuthProvider {
  readonly type = 'token' as const;
  private readonly apiUrl: string;
  private readonly apiToken: string;
  private readonly logger = getLogger();

  constructor(config: TokenAuthConfig) {
    this.apiUrl = config.apiUrl;
    this.apiToken = config.apiToken;
  }

  getHeaders(): Record<string, string> {
    return {
      Authorization: `APIToken ${this.apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  getHttpsAgent(): https.Agent | undefined {
    // Token auth doesn't require a custom HTTPS agent
    return undefined;
  }

  async validate(): Promise<boolean> {
    this.logger.debug('Validating API token...');

    try {
      const headers = this.getHeaders();

      return new Promise((resolve) => {
        const url = new URL(API_ENDPOINTS.NAMESPACES, this.apiUrl);

        const options: https.RequestOptions = {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname,
          method: 'GET',
          headers,
          timeout: 10000,
        };

        const req = https.request(options, (res) => {
          if (res.statusCode === 200) {
            this.logger.info('API token validated successfully');
            resolve(true);
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            this.logger.warn(`API token validation failed: ${res.statusCode}`);
            resolve(false);
          } else {
            this.logger.warn(`Unexpected status during validation: ${res.statusCode}`);
            resolve(false);
          }

          // Consume response data to free up memory
          res.resume();
        });

        req.on('error', (error) => {
          this.logger.error('Token validation request failed', error);
          resolve(false);
        });

        req.on('timeout', () => {
          this.logger.warn('Token validation request timed out');
          req.destroy();
          resolve(false);
        });

        req.end();
      });
    } catch (error) {
      this.logger.error('Token validation failed', error as Error);
      return false;
    }
  }

  dispose(): void {
    // No resources to clean up for token auth
  }
}
