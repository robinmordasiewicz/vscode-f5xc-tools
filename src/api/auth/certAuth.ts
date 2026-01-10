// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Certificate-based authentication provider for F5 XC
 * Supports two methods:
 * 1. P12 Bundle: p12Bundle path with password from F5XC_P12_PASSWORD env var
 * 2. Cert + Key: Direct PEM file paths (no password needed)
 */

import * as https from 'https';
import * as fs from 'fs';
import * as forge from 'node-forge';
import { AuthProvider, CertAuthConfig } from './index';
import { getLogger } from '../../utils/logger';
import { AuthenticationError } from '../../utils/errors';
import { API_ENDPOINTS } from '../../generated/constants';

/**
 * Certificate-based authentication provider for F5 XC mTLS
 */
export class CertAuthProvider implements AuthProvider {
  readonly type = 'cert' as const;
  private readonly apiUrl: string;
  private readonly p12Bundle?: string;
  private readonly certPath?: string;
  private readonly keyPath?: string;
  private agent?: https.Agent;
  private readonly logger = getLogger();

  constructor(config: CertAuthConfig) {
    this.apiUrl = config.apiUrl;
    this.p12Bundle = config.p12Bundle;
    this.certPath = config.cert;
    this.keyPath = config.key;

    // Validate config
    if (this.p12Bundle && (this.certPath || this.keyPath)) {
      throw new AuthenticationError(
        'Cannot specify both p12Bundle and cert/key paths. Use one method only.',
      );
    }

    if (!this.p12Bundle && (!this.certPath || !this.keyPath)) {
      throw new AuthenticationError('Must specify either p12Bundle or both cert and key paths.');
    }
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

    if (this.p12Bundle) {
      this.agent = this.createAgentFromP12();
    } else {
      this.agent = this.createAgentFromCertKey();
    }

    return this.agent;
  }

  /**
   * Create HTTPS agent from P12 bundle
   */
  private createAgentFromP12(): https.Agent {
    this.logger.debug('Creating HTTPS agent from P12 certificate...');

    const password = process.env.F5XC_P12_PASSWORD || '';

    if (!this.p12Bundle) {
      throw new AuthenticationError('P12 bundle path not specified');
    }

    if (!fs.existsSync(this.p12Bundle)) {
      throw new AuthenticationError(`P12 file not found: ${this.p12Bundle}`);
    }

    try {
      const p12Buffer = fs.readFileSync(this.p12Bundle);
      const p12Der = p12Buffer.toString('binary');

      // Parse P12 using node-forge
      const p12Asn1 = forge.asn1.fromDer(p12Der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

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

      this.logger.info('P12 certificate loaded successfully');

      return new https.Agent({
        cert,
        key,
        rejectUnauthorized: true,
        keepAlive: true,
        maxSockets: 10,
      });
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('Invalid password')) {
        throw new AuthenticationError(
          'Invalid P12 password. Set F5XC_P12_PASSWORD environment variable.',
        );
      }

      throw new AuthenticationError(`Failed to load P12 certificate: ${errorMessage}`);
    }
  }

  /**
   * Create HTTPS agent from separate cert and key PEM files
   */
  private createAgentFromCertKey(): https.Agent {
    this.logger.debug('Creating HTTPS agent from cert and key files...');

    if (!this.certPath || !this.keyPath) {
      throw new AuthenticationError('Certificate and key paths not specified');
    }

    if (!fs.existsSync(this.certPath)) {
      throw new AuthenticationError(`Certificate file not found: ${this.certPath}`);
    }

    if (!fs.existsSync(this.keyPath)) {
      throw new AuthenticationError(`Key file not found: ${this.keyPath}`);
    }

    try {
      const cert = fs.readFileSync(this.certPath, 'utf-8');
      const key = fs.readFileSync(this.keyPath, 'utf-8');

      this.logger.info('Certificate and key loaded successfully');

      return new https.Agent({
        cert,
        key,
        rejectUnauthorized: true,
        keepAlive: true,
        maxSockets: 10,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new AuthenticationError(`Failed to load certificate files: ${errorMessage}`);
    }
  }

  async validate(): Promise<boolean> {
    this.logger.debug('Validating certificate authentication...');

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
            this.logger.info('Certificate validated successfully');
            resolve(true);
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            this.logger.warn(`Certificate validation failed: ${res.statusCode}`);
            resolve(false);
          } else {
            this.logger.warn(`Unexpected status during validation: ${res.statusCode}`);
            resolve(false);
          }

          res.resume();
        });

        req.on('error', (error) => {
          this.logger.error('Certificate validation request failed', error);
          resolve(false);
        });

        req.on('timeout', () => {
          this.logger.warn('Certificate validation request timed out');
          req.destroy();
          resolve(false);
        });

        req.end();
      });
    } catch (error) {
      this.logger.error('Certificate validation failed', error as Error);
      return false;
    }
  }

  dispose(): void {
    if (this.agent) {
      this.agent.destroy();
      this.agent = undefined;
      this.logger.debug('Certificate HTTPS agent disposed');
    }
  }
}
