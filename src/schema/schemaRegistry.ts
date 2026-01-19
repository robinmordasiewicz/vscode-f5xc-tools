// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Schema Registry for F5 XC resource types.
 * Caches generated schemas and provides access by resource type.
 */

import * as vscode from 'vscode';
import {
  generateSchemaForResourceType,
  generateGenericSchema,
  getSchemaResourceTypes,
  F5XCJsonSchema,
} from './schemaGenerator';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Registry for caching and managing JSON Schemas for F5 XC resource types.
 * Implements lazy loading - schemas are generated on first access.
 */
export class SchemaRegistry {
  private schemas = new Map<string, F5XCJsonSchema>();
  private genericSchema: F5XCJsonSchema | null = null;

  /**
   * Get the schema URI for a resource type.
   * The URI uses the f5xc-schema:// scheme for VSCode's JSON language service.
   */
  getSchemaUri(resourceType: string): vscode.Uri {
    return vscode.Uri.parse(`f5xc-schema://schemas/${resourceType}.json`);
  }

  /**
   * Get the generic schema URI for any F5 XC resource.
   */
  getGenericSchemaUri(): vscode.Uri {
    return vscode.Uri.parse('f5xc-schema://schemas/generic.json');
  }

  /**
   * Get or generate a schema for a specific resource type.
   * Caches the schema for subsequent requests.
   *
   * @param resourceType - The resource type key (e.g., 'http_loadbalancer')
   * @returns The JSON Schema or null if resource type is unknown
   */
  getOrGenerateSchema(resourceType: string): F5XCJsonSchema | null {
    // Check cache first
    if (this.schemas.has(resourceType)) {
      return this.schemas.get(resourceType)!;
    }

    // Generate schema
    const schema = generateSchemaForResourceType(resourceType);
    if (schema) {
      this.schemas.set(resourceType, schema);
      logger.debug(`Generated schema for resource type: ${resourceType}`);
    }

    return schema;
  }

  /**
   * Get the generic schema for any F5 XC resource.
   * Useful as a fallback when the specific resource type is unknown.
   */
  getGenericSchema(): F5XCJsonSchema {
    if (!this.genericSchema) {
      this.genericSchema = generateGenericSchema();
      logger.debug('Generated generic F5 XC resource schema');
    }
    return this.genericSchema;
  }

  /**
   * Get schema content as a JSON string for a resource type.
   * Used by the TextDocumentContentProvider.
   *
   * @param resourceType - The resource type key or 'generic'
   * @returns JSON string of the schema
   */
  getSchemaContent(resourceType: string): string {
    if (resourceType === 'generic') {
      return JSON.stringify(this.getGenericSchema(), null, 2);
    }

    const schema = this.getOrGenerateSchema(resourceType);
    if (schema) {
      return JSON.stringify(schema, null, 2);
    }

    // Fallback to generic schema if resource type is unknown
    logger.warn(`Unknown resource type: ${resourceType}, using generic schema`);
    return JSON.stringify(this.getGenericSchema(), null, 2);
  }

  /**
   * Get all available resource type keys.
   */
  getAvailableResourceTypes(): string[] {
    return getSchemaResourceTypes();
  }

  /**
   * Clear the schema cache.
   * Useful for testing or when resource types are updated.
   */
  clearCache(): void {
    this.schemas.clear();
    this.genericSchema = null;
    logger.debug('Schema cache cleared');
  }

  /**
   * Pre-warm the cache by generating schemas for commonly used resource types.
   * This can improve performance for frequently accessed resources.
   */
  prewarmCache(resourceTypes?: string[]): void {
    const typesToWarm = resourceTypes || [
      'http_loadbalancer',
      'origin_pool',
      'healthcheck',
      'app_firewall',
    ];

    for (const type of typesToWarm) {
      this.getOrGenerateSchema(type);
    }
    logger.debug(`Pre-warmed schema cache for ${typesToWarm.length} resource types`);
  }

  /**
   * Check if a schema exists for a resource type.
   */
  hasSchema(resourceType: string): boolean {
    if (this.schemas.has(resourceType)) {
      return true;
    }
    // Check if resource type exists (will be generated on access)
    return getSchemaResourceTypes().includes(resourceType);
  }

  /**
   * Get cache statistics for debugging.
   */
  getCacheStats(): { cachedCount: number; availableCount: number } {
    return {
      cachedCount: this.schemas.size,
      availableCount: getSchemaResourceTypes().length,
    };
  }
}

/**
 * Singleton instance of the schema registry.
 * Use this for accessing schemas throughout the extension.
 */
let registryInstance: SchemaRegistry | null = null;

/**
 * Get the singleton schema registry instance.
 */
export function getSchemaRegistry(): SchemaRegistry {
  if (!registryInstance) {
    registryInstance = new SchemaRegistry();
  }
  return registryInstance;
}

/**
 * Reset the schema registry (for testing purposes).
 */
export function resetSchemaRegistry(): void {
  if (registryInstance) {
    registryInstance.clearCache();
  }
  registryInstance = null;
}
