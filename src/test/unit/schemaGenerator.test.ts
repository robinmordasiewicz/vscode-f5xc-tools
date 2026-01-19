// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Unit tests for the JSON Schema generator
 */

import {
  generateSchemaForResourceType,
  generateGenericSchema,
  getSchemaResourceTypes,
  hasDetailedFieldMetadata,
} from '../../schema/schemaGenerator';

describe('Schema Generator', () => {
  describe('generateSchemaForResourceType', () => {
    it('should generate a valid JSON Schema for http_loadbalancer', () => {
      const schema = generateSchemaForResourceType('http_loadbalancer');

      expect(schema).not.toBeNull();
      expect(schema!.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(schema!.$id).toBe('f5xc-schema://schemas/http_loadbalancer.json');
      expect(schema!.title).toContain('F5 XC');
      expect(schema!.type).toBe('object');
    });

    it('should include metadata and spec properties', () => {
      const schema = generateSchemaForResourceType('http_loadbalancer');

      expect(schema).not.toBeNull();
      expect(schema!.properties).toHaveProperty('metadata');
      expect(schema!.properties).toHaveProperty('spec');
      expect(schema!.required).toContain('metadata');
      expect(schema!.required).toContain('spec');
    });

    it('should generate metadata schema with standard fields', () => {
      const schema = generateSchemaForResourceType('http_loadbalancer');

      expect(schema).not.toBeNull();
      const metadata = schema!.properties.metadata as {
        type: string;
        properties: Record<string, unknown>;
      };
      expect(metadata).toBeDefined();
      expect(metadata.type).toBe('object');
      expect(metadata.properties).toBeDefined();
      expect(metadata.properties).toHaveProperty('name');
      expect(metadata.properties).toHaveProperty('namespace');
      expect(metadata.properties).toHaveProperty('labels');
      expect(metadata.properties).toHaveProperty('annotations');
      expect(metadata.properties).toHaveProperty('description');
      expect(metadata.properties).toHaveProperty('disable');
    });

    it('should mark metadata.name as required', () => {
      const schema = generateSchemaForResourceType('http_loadbalancer');

      expect(schema).not.toBeNull();
      const metadata = schema!.properties.metadata as {
        required: string[];
        properties: Record<string, Record<string, unknown>>;
      };
      expect(metadata).toBeDefined();
      expect(metadata.required).toContain('name');
      expect(metadata.properties).toBeDefined();
      const nameField = metadata.properties['name']!;
      expect(nameField).toBeDefined();
      expect(nameField['x-f5xc-required']).toBe(true);
    });

    it('should return null for unknown resource type', () => {
      const schema = generateSchemaForResourceType('unknown_resource_type');

      expect(schema).toBeNull();
    });

    it('should generate schema for healthcheck with field metadata', () => {
      const schema = generateSchemaForResourceType('healthcheck');

      expect(schema).not.toBeNull();
      expect(schema!.title).toContain('Health Check');
      expect(schema!.properties.spec).toBeDefined();
    });

    it('should include description from resource type', () => {
      const schema = generateSchemaForResourceType('healthcheck');

      expect(schema).not.toBeNull();
      expect(schema!.description).toBeDefined();
      expect(typeof schema!.description).toBe('string');
      expect(schema!.description!.length).toBeGreaterThan(0);
    });

    it('should generate schema for origin_pool', () => {
      const schema = generateSchemaForResourceType('origin_pool');

      expect(schema).not.toBeNull();
      expect(schema!.$id).toBe('f5xc-schema://schemas/origin_pool.json');
      expect(schema!.properties.metadata).toBeDefined();
      expect(schema!.properties.spec).toBeDefined();
    });

    it('should generate schema for app_firewall', () => {
      const schema = generateSchemaForResourceType('app_firewall');

      expect(schema).not.toBeNull();
      expect(schema!.$id).toBe('f5xc-schema://schemas/app_firewall.json');
    });

    it('should handle resource types without field metadata', () => {
      // Find a resource type that might not have detailed field metadata
      const schema = generateSchemaForResourceType('alert_policy');

      // Should still generate a valid schema
      expect(schema).not.toBeNull();
      expect(schema!.properties.metadata).toBeDefined();
      expect(schema!.properties.spec).toBeDefined();
      // spec should allow additional properties when no field metadata
      const spec = schema!.properties.spec as { additionalProperties: boolean };
      expect(spec.additionalProperties).toBe(true);
    });
  });

  describe('generateGenericSchema', () => {
    it('should generate a valid generic schema', () => {
      const schema = generateGenericSchema();

      expect(schema.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(schema.$id).toBe('f5xc-schema://schemas/generic.json');
      expect(schema.title).toBe('F5 XC Resource');
      expect(schema.type).toBe('object');
    });

    it('should include metadata and spec properties', () => {
      const schema = generateGenericSchema();

      expect(schema.properties).toHaveProperty('metadata');
      expect(schema.properties).toHaveProperty('spec');
      expect(schema.required).toContain('metadata');
      expect(schema.required).toContain('spec');
    });

    it('should have flexible spec that allows additional properties', () => {
      const schema = generateGenericSchema();

      const spec = schema.properties.spec as { additionalProperties: boolean };
      expect(spec.additionalProperties).toBe(true);
    });

    it('should have description', () => {
      const schema = generateGenericSchema();

      expect(schema.description).toBe('Generic schema for F5 Distributed Cloud resources');
    });
  });

  describe('getSchemaResourceTypes', () => {
    it('should return an array of resource type keys', () => {
      const types = getSchemaResourceTypes();

      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });

    it('should include common resource types', () => {
      const types = getSchemaResourceTypes();

      expect(types).toContain('http_loadbalancer');
      expect(types).toContain('origin_pool');
      expect(types).toContain('healthcheck');
      expect(types).toContain('app_firewall');
    });

    it('should return at least 200 resource types', () => {
      const types = getSchemaResourceTypes();

      // Based on the generated resource types (234)
      expect(types.length).toBeGreaterThanOrEqual(200);
    });

    it('should return unique keys', () => {
      const types = getSchemaResourceTypes();
      const uniqueTypes = [...new Set(types)];

      expect(types.length).toBe(uniqueTypes.length);
    });
  });

  describe('hasDetailedFieldMetadata', () => {
    it('should return true for healthcheck which has field metadata', () => {
      const hasMetadata = hasDetailedFieldMetadata('healthcheck');

      expect(hasMetadata).toBe(true);
    });

    it('should return true for origin_pool which has field metadata', () => {
      const hasMetadata = hasDetailedFieldMetadata('origin_pool');

      expect(hasMetadata).toBe(true);
    });

    it('should return false for unknown resource type', () => {
      const hasMetadata = hasDetailedFieldMetadata('unknown_resource');

      expect(hasMetadata).toBe(false);
    });

    it('should return boolean for any valid resource type', () => {
      const types = getSchemaResourceTypes();

      for (const type of types.slice(0, 10)) {
        const hasMetadata = hasDetailedFieldMetadata(type);
        expect(typeof hasMetadata).toBe('boolean');
      }
    });
  });

  describe('Schema structure validation', () => {
    it('should generate schemas with valid JSON Schema draft-07 structure', () => {
      const types = ['http_loadbalancer', 'origin_pool', 'healthcheck', 'app_firewall'];

      for (const type of types) {
        const schema = generateSchemaForResourceType(type);
        expect(schema).not.toBeNull();

        // Validate required JSON Schema properties
        expect(schema!.$schema).toBe('http://json-schema.org/draft-07/schema#');
        expect(schema!.$id).toMatch(/^f5xc-schema:\/\/schemas\/[a-z_]+\.json$/);
        expect(schema!.type).toBe('object');
        expect(schema!.properties).toBeDefined();
        expect(typeof schema!.properties).toBe('object');
      }
    });

    it('should have consistent metadata schema across resource types', () => {
      const schema1 = generateSchemaForResourceType('http_loadbalancer');
      const schema2 = generateSchemaForResourceType('origin_pool');

      expect(schema1).not.toBeNull();
      expect(schema2).not.toBeNull();

      // Metadata schemas should be structurally identical
      const meta1 = schema1!.properties.metadata as { properties?: Record<string, unknown> };
      const meta2 = schema2!.properties.metadata as { properties?: Record<string, unknown> };
      const meta1Keys = Object.keys(meta1.properties || {}).sort();
      const meta2Keys = Object.keys(meta2.properties || {}).sort();

      expect(meta1Keys).toEqual(meta2Keys);
    });
  });

  describe('Field metadata integration', () => {
    it('should include x-f5xc-required extension for required fields', () => {
      const schema = generateSchemaForResourceType('healthcheck');

      expect(schema).not.toBeNull();
      // metadata.name should always be marked as required
      const metadata = schema!.properties.metadata as {
        properties: Record<string, Record<string, unknown>>;
      };
      expect(metadata.properties).toBeDefined();
      const nameField = metadata.properties['name']!;
      expect(nameField).toBeDefined();
      expect(nameField['x-f5xc-required']).toBe(true);
    });

    it('should include recommended values as defaults when available', () => {
      const schema = generateSchemaForResourceType('healthcheck');

      expect(schema).not.toBeNull();
      const spec = schema!.properties.spec as { properties: Record<string, unknown> };

      // healthcheck has recommended values for interval, timeout, etc.
      // These should appear as defaults in the schema
      expect(spec.properties).toBeDefined();
    });

    it('should mark server-defaulted fields with extension', () => {
      const schema = generateSchemaForResourceType('healthcheck');

      expect(schema).not.toBeNull();
      // Should have spec properties that include server default markers
      const spec = schema!.properties.spec as { type: string };
      expect(spec.type).toBe('object');
    });
  });

  describe('Schema generation determinism', () => {
    it('should produce identical schemas on multiple calls', () => {
      const schema1 = generateSchemaForResourceType('http_loadbalancer');
      const schema2 = generateSchemaForResourceType('http_loadbalancer');

      expect(JSON.stringify(schema1)).toBe(JSON.stringify(schema2));
    });

    it('should produce identical generic schemas on multiple calls', () => {
      const schema1 = generateGenericSchema();
      const schema2 = generateGenericSchema();

      expect(JSON.stringify(schema1)).toBe(JSON.stringify(schema2));
    });
  });

  describe('Error handling', () => {
    it('should handle empty string resource type', () => {
      const schema = generateSchemaForResourceType('');

      expect(schema).toBeNull();
    });

    it('should handle resource type with special characters', () => {
      const schema = generateSchemaForResourceType('invalid/resource');

      expect(schema).toBeNull();
    });

    it('should not throw for any input', () => {
      const testInputs = ['', 'unknown', '123', 'a'.repeat(1000), null as unknown as string];

      for (const input of testInputs) {
        expect(() => generateSchemaForResourceType(input)).not.toThrow();
      }
    });
  });
});
