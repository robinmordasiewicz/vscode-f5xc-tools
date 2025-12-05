import * as https from 'https';
import * as fs from 'fs';
import * as forge from 'node-forge';
import { AuthProvider, P12AuthConfig } from './index';
import { getLogger } from '../../utils/logger';
import { AuthenticationError } from '../../utils/errors';
import { API_ENDPOINTS } from '../../generated/constants';

/**
 * P12 Certificate-based authentication provider for F5 XC
 */
export class P12AuthProvider implements AuthProvider {
  readonly type = 'p12' as const;
  private readonly apiUrl: string;
  private readonly p12Path: string;
  private readonly password: string;
  private agent?: https.Agent;
  private readonly logger = getLogger();

  constructor(config: P12AuthConfig) {
    this.apiUrl = config.apiUrl;
    this.p12Path = config.p12Path;
    this.password = config.p12Password;
  }

  getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  getHttpsAgent(): https.Agent {
    if (this.agent) {
      return this.agent;
    }

    this.logger.debug('Creating HTTPS agent from P12 certificate...');

    try {
      // Read P12 file
      if (!fs.existsSync(this.p12Path)) {
        throw new AuthenticationError(`P12 file not found: ${this.p12Path}`);
      }

      const p12Buffer = fs.readFileSync(this.p12Path);
      const p12Der = p12Buffer.toString('binary');

      // Parse P12 using node-forge
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, this.password);

      // Extract certificate
      const certBagType = forge.pki.oids.certBag as string;
      const certBags = p12.getBags({ bagType: certBagType });
      const certBagArray = certBags[certBagType];

      if (!certBagArray || certBagArray.length === 0) {
        throw new AuthenticationError('No certificate found in P12 file');
      }

      const certBag = certBagArray[0];
      if (!certBag || !certBag.cert) {
        throw new AuthenticationError('Invalid certificate in P12 file');
      }

      const cert = forge.pki.certificateToPem(certBag.cert);

      // Extract private key
      const keyBagType = forge.pki.oids.pkcs8ShroudedKeyBag as string;
      const keyBags = p12.getBags({ bagType: keyBagType });
      let keyBagArray = keyBags[keyBagType];

      // Try alternative key bag type if not found
      if (!keyBagArray || keyBagArray.length === 0) {
        const altKeyBagType = forge.pki.oids.keyBag as string;
        const altKeyBags = p12.getBags({ bagType: altKeyBagType });
        keyBagArray = altKeyBags[altKeyBagType];
      }

      if (!keyBagArray || keyBagArray.length === 0) {
        throw new AuthenticationError('No private key found in P12 file');
      }

      const keyBag = keyBagArray[0];
      if (!keyBag || !keyBag.key) {
        throw new AuthenticationError('Invalid private key in P12 file');
      }

      const key = forge.pki.privateKeyToPem(keyBag.key);

      // Create HTTPS agent with certificate and key
      this.agent = new https.Agent({
        cert,
        key,
        rejectUnauthorized: true,
        keepAlive: true,
        maxSockets: 10,
      });

      this.logger.info('P12 certificate loaded successfully');
      return this.agent;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('Invalid password')) {
        throw new AuthenticationError('Invalid P12 password');
      }

      throw new AuthenticationError(`Failed to load P12 certificate: ${errorMessage}`);
    }
  }

  async validate(): Promise<boolean> {
    this.logger.debug('Validating P12 certificate...');

    try {
      const agent = this.getHttpsAgent();
      const headers = this.getHeaders();

      return new Promise((resolve) => {
        const url = new URL(API_ENDPOINTS.NAMESPACES, this.apiUrl);

        const options: https.RequestOptions = {
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname,
          method: 'GET',
          headers,
          agent,
          timeout: 10000,
        };

        const req = https.request(options, (res) => {
          if (res.statusCode === 200) {
            this.logger.info('P12 certificate validated successfully');
            resolve(true);
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            this.logger.warn(`P12 certificate validation failed: ${res.statusCode}`);
            resolve(false);
          } else {
            this.logger.warn(`Unexpected status during validation: ${res.statusCode}`);
            resolve(false);
          }

          // Consume response data to free up memory
          res.resume();
        });

        req.on('error', (error) => {
          this.logger.error('P12 validation request failed', error);
          resolve(false);
        });

        req.on('timeout', () => {
          this.logger.warn('P12 validation request timed out');
          req.destroy();
          resolve(false);
        });

        req.end();
      });
    } catch (error) {
      this.logger.error('P12 validation failed', error as Error);
      return false;
    }
  }

  dispose(): void {
    if (this.agent) {
      this.agent.destroy();
      this.agent = undefined;
      this.logger.debug('P12 HTTPS agent disposed');
    }
  }
}
