import * as https from 'https';

/**
 * Authentication provider interface for F5 XC API
 */
export interface AuthProvider {
  /** The type of authentication */
  readonly type: 'token' | 'p12';

  /** Get HTTP headers required for authentication */
  getHeaders(): Record<string, string>;

  /** Get HTTPS agent for certificate-based auth (undefined for token auth) */
  getHttpsAgent(): https.Agent | undefined;

  /** Validate the credentials */
  validate(): Promise<boolean>;

  /** Clean up resources */
  dispose(): void;
}

/**
 * Configuration for token-based authentication
 */
export interface TokenAuthConfig {
  apiUrl: string;
  token: string;
}

/**
 * Configuration for P12 certificate-based authentication
 */
export interface P12AuthConfig {
  apiUrl: string;
  p12Path: string;
  p12Password: string;
}

/**
 * Combined auth configuration
 */
export type AuthConfig =
  | { type: 'token'; config: TokenAuthConfig }
  | { type: 'p12'; config: P12AuthConfig };

export { TokenAuthProvider } from './tokenAuth';
export { P12AuthProvider } from './p12Auth';
