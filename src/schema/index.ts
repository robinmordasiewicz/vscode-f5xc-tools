// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Schema module exports for F5 XC JSON IntelliSense.
 */

export {
  generateSchemaForResourceType,
  generateGenericSchema,
  getSchemaResourceTypes,
  hasDetailedFieldMetadata,
} from './schemaGenerator';
export type { F5XCJsonSchema, SchemaProperty } from './schemaGenerator';

export { SchemaRegistry, getSchemaRegistry, resetSchemaRegistry } from './schemaRegistry';
