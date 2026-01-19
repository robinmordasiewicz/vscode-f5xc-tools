// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * JSON Schema generator for F5 XC resource types.
 * Generates schemas from field metadata to enable VSCode IntelliSense.
 */

import {
  GENERATED_RESOURCE_TYPES,
  GeneratedResourceTypeInfo,
  GeneratedFieldMetadata,
} from '../generated/resourceTypesBase';

/**
 * JSON Schema draft-07 compatible property definition
 */
export interface SchemaProperty {
  type?: string | string[];
  description?: string;
  default?: unknown;
  enum?: string[];
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
  additionalProperties?: SchemaProperty | boolean;
  $ref?: string;
  required?: string[];
  // F5 XC custom extensions for IntelliSense hints
  'x-f5xc-required'?: boolean;
  'x-f5xc-server-default'?: boolean;
  'x-f5xc-recommended-value'?: unknown;
}

/**
 * Complete JSON Schema for an F5 XC resource type
 */
export interface F5XCJsonSchema {
  $schema: string;
  $id: string;
  title: string;
  description?: string;
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required?: string[];
  definitions?: Record<string, SchemaProperty>;
}

/**
 * Parse a dot-notation field path and set a value in a nested object.
 * Creates intermediate objects as needed.
 */
function setNestedProperty(
  obj: Record<string, SchemaProperty>,
  path: string,
  props: Partial<SchemaProperty>,
): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] as string;
    const isLast = i === parts.length - 1;

    if (isLast) {
      // Set properties on the leaf
      if (!current[part]) {
        current[part] = { type: 'string' };
      }
      Object.assign(current[part], props);
    } else {
      // Create intermediate nested object
      if (!current[part]) {
        current[part] = {
          type: 'object',
          properties: {},
        };
      }
      if (!current[part].properties) {
        current[part].properties = {};
      }
      current = current[part].properties!;
    }
  }
}

/**
 * Build metadata schema with standard F5 XC resource metadata fields
 */
function buildMetadataSchema(): SchemaProperty {
  return {
    type: 'object',
    description: 'Resource metadata containing identification and organizational information',
    properties: {
      name: {
        type: 'string',
        description: 'Resource name (required). Must be unique within the namespace.',
        'x-f5xc-required': true,
      },
      namespace: {
        type: 'string',
        description: 'Namespace where the resource resides.',
      },
      labels: {
        type: 'object',
        description: 'Key-value labels for organizing and selecting resources.',
        additionalProperties: { type: 'string' },
      },
      annotations: {
        type: 'object',
        description: 'Key-value annotations for storing non-identifying metadata.',
        additionalProperties: { type: 'string' },
      },
      description: {
        type: 'string',
        description: 'Human-readable description of the resource.',
      },
      disable: {
        type: 'boolean',
        description: 'Set to true to disable this resource.',
        default: false,
      },
    },
    required: ['name'],
  };
}

/**
 * Build spec schema from resource type field metadata
 */
function buildSpecSchema(resourceType: GeneratedResourceTypeInfo): SchemaProperty {
  const specSchema: SchemaProperty = {
    type: 'object',
    description: `${resourceType.displayName} specification`,
    properties: {},
  };

  const fieldMetadata = resourceType.fieldMetadata;

  if (!fieldMetadata || !fieldMetadata.fields) {
    // No field metadata available - return basic schema
    specSchema.additionalProperties = true;
    return specSchema;
  }

  // Process each field in the metadata
  for (const [fieldPath, metadata] of Object.entries(fieldMetadata.fields)) {
    // Skip non-spec fields
    if (!fieldPath.startsWith('spec.')) {
      continue;
    }

    const specPath = fieldPath.replace('spec.', '');
    const props = buildFieldProperties(metadata);

    setNestedProperty(specSchema.properties!, specPath, props);
  }

  // Mark required fields
  if (fieldMetadata.userRequiredFields && fieldMetadata.userRequiredFields.length > 0) {
    const requiredTopLevel: string[] = [];
    for (const field of fieldMetadata.userRequiredFields) {
      if (field.startsWith('spec.')) {
        const specPath = field.replace('spec.', '');
        // Only add top-level fields to required array
        const topLevelField = specPath.split('.')[0];
        if (topLevelField && !requiredTopLevel.includes(topLevelField)) {
          requiredTopLevel.push(topLevelField);
        }
      }
    }
    if (requiredTopLevel.length > 0) {
      specSchema.required = requiredTopLevel;
    }
  }

  // Allow additional properties for flexibility
  specSchema.additionalProperties = true;

  return specSchema;
}

/**
 * Build property definition from field metadata
 */
function buildFieldProperties(metadata: GeneratedFieldMetadata): Partial<SchemaProperty> {
  const props: Partial<SchemaProperty> = {};

  // Infer type from default value if available
  if (metadata.default !== undefined) {
    props.default = metadata.default;
    props.type = inferJsonType(metadata.default);
  }

  // Mark server default fields
  if (metadata.serverDefault) {
    props['x-f5xc-server-default'] = true;
    props.description = (props.description || '') + ' (Server provides default value)';
  }

  // Mark required fields
  if (metadata.requiredFor?.create) {
    props['x-f5xc-required'] = true;
  }

  // Add recommended value
  if (metadata.recommendedValue !== undefined) {
    props['x-f5xc-recommended-value'] = metadata.recommendedValue;
    props.default = props.default ?? metadata.recommendedValue;
    // Infer type from recommended value if not already set
    if (!props.type) {
      props.type = inferJsonType(metadata.recommendedValue);
    }
  }

  return props;
}

/**
 * Infer JSON Schema type from a value
 */
function inferJsonType(value: unknown): string | string[] {
  if (value === null) {
    return ['null', 'string'];
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  if (typeof value === 'object') {
    return 'object';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number';
  }
  return 'string';
}

/**
 * Generate a JSON Schema for a specific resource type
 *
 * @param resourceTypeKey - The key of the resource type (e.g., 'http_loadbalancer')
 * @returns The generated JSON Schema or null if resource type not found
 */
export function generateSchemaForResourceType(resourceTypeKey: string): F5XCJsonSchema | null {
  const resourceType = GENERATED_RESOURCE_TYPES[resourceTypeKey];
  if (!resourceType) {
    return null;
  }

  const schema: F5XCJsonSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: `f5xc-schema://schemas/${resourceTypeKey}.json`,
    title: `F5 XC ${resourceType.displayName}`,
    description: resourceType.description,
    type: 'object',
    properties: {
      metadata: buildMetadataSchema(),
      spec: buildSpecSchema(resourceType),
    },
    required: ['metadata', 'spec'],
  };

  return schema;
}

/**
 * Generate a combined schema that can match any F5 XC resource type
 */
export function generateGenericSchema(): F5XCJsonSchema {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'f5xc-schema://schemas/generic.json',
    title: 'F5 XC Resource',
    description: 'Generic schema for F5 Distributed Cloud resources',
    type: 'object',
    properties: {
      metadata: buildMetadataSchema(),
      spec: {
        type: 'object',
        description: 'Resource specification',
        additionalProperties: true,
      },
    },
    required: ['metadata', 'spec'],
  };
}

/**
 * Get list of all resource type keys that have schemas
 */
export function getSchemaResourceTypes(): string[] {
  return Object.keys(GENERATED_RESOURCE_TYPES);
}

/**
 * Check if a resource type has detailed field metadata
 */
export function hasDetailedFieldMetadata(resourceTypeKey: string): boolean {
  const resourceType = GENERATED_RESOURCE_TYPES[resourceTypeKey];
  return !!(
    resourceType?.fieldMetadata?.fields && Object.keys(resourceType.fieldMetadata.fields).length > 0
  );
}
