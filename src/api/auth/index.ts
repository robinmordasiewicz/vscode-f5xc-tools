// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

import * as https from 'https';

/**
 * Authentication provider interface for F5 XC API
 */
export interface AuthProvider {
  /** The type of authentication */
  readonly type: 'token' | 'cert';

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
  apiToken: string;
}

/**
 * Configuration for certificate-based authentication
 * Supports two methods:
 * 1. P12 Bundle: p12Bundle path (password from F5XC_P12_PASSWORD env var)
 * 2. Cert + Key: Direct PEM file paths
 */
export interface CertAuthConfig {
  apiUrl: string;
  /** P12 bundle file path */
  p12Bundle?: string;
  /** TLS certificate PEM file path */
  cert?: string;
  /** TLS private key PEM file path */
  key?: string;
}

/**
 * Combined auth configuration
 */
export type AuthConfig =
  | { type: 'token'; config: TokenAuthConfig }
  | { type: 'cert'; config: CertAuthConfig };

export { TokenAuthProvider } from './tokenAuth';
export { CertAuthProvider } from './certAuth';
