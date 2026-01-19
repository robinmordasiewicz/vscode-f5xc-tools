// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Unit tests for the Schema Registry
 */

import {
  SchemaRegistry,
  getSchemaRegistry,
  resetSchemaRegistry,
} from '../../schema/schemaRegistry';

// Mock vscode module
jest.mock(
  'vscode',
  () => ({
    Uri: {
      parse: jest.fn((uri: string) => ({ toString: () => uri, scheme: uri.split(':')[0] })),
    },
    window: {
      createOutputChannel: jest.fn(() => ({
        appendLine: jest.fn(),
        append: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn(),
        clear: jest.fn(),
        replace: jest.fn(),
        name: 'F5 XC',
      })),
    },
    workspace: {
      getConfiguration: jest.fn(() => ({
        get: jest.fn(() => ({})),
      })),
    },
  }),
  { virtual: true },
);

describe('Schema Registry', () => {
  let registry: SchemaRegistry;

  beforeEach(() => {
    // Reset singleton and create fresh instance for each test
    resetSchemaRegistry();
    registry = new SchemaRegistry();
  });

  describe('constructor', () => {
    it('should create a new instance', () => {
      expect(registry).toBeInstanceOf(SchemaRegistry);
    });

    it('should start with empty cache', () => {
      const stats = registry.getCacheStats();
      expect(stats.cachedCount).toBe(0);
    });
  });

  describe('getSchemaUri', () => {
    it('should return URI for resource type', () => {
      const uri = registry.getSchemaUri('http_loadbalancer');

      expect(uri.toString()).toBe('f5xc-schema://schemas/http_loadbalancer.json');
    });

    it('should return URI for any resource type string', () => {
      const uri = registry.getSchemaUri('custom_type');

      expect(uri.toString()).toBe('f5xc-schema://schemas/custom_type.json');
    });
  });

  describe('getGenericSchemaUri', () => {
    it('should return generic schema URI', () => {
      const uri = registry.getGenericSchemaUri();

      expect(uri.toString()).toBe('f5xc-schema://schemas/generic.json');
    });
  });

  describe('getOrGenerateSchema', () => {
    it('should generate schema for valid resource type', () => {
      const schema = registry.getOrGenerateSchema('http_loadbalancer');

      expect(schema).not.toBeNull();
      expect(schema!.$id).toContain('http_loadbalancer');
    });

    it('should cache schema after first generation', () => {
      const schema1 = registry.getOrGenerateSchema('http_loadbalancer');
      const schema2 = registry.getOrGenerateSchema('http_loadbalancer');

      expect(schema1).toBe(schema2); // Same reference (cached)
    });

    it('should return null for unknown resource type', () => {
      const schema = registry.getOrGenerateSchema('unknown_resource');

      expect(schema).toBeNull();
    });

    it('should increment cached count after generation', () => {
      expect(registry.getCacheStats().cachedCount).toBe(0);

      registry.getOrGenerateSchema('http_loadbalancer');
      expect(registry.getCacheStats().cachedCount).toBe(1);

      registry.getOrGenerateSchema('origin_pool');
      expect(registry.getCacheStats().cachedCount).toBe(2);
    });

    it('should not increment cached count for same resource type', () => {
      registry.getOrGenerateSchema('http_loadbalancer');
      registry.getOrGenerateSchema('http_loadbalancer');
      registry.getOrGenerateSchema('http_loadbalancer');

      expect(registry.getCacheStats().cachedCount).toBe(1);
    });
  });

  describe('getGenericSchema', () => {
    it('should return generic schema', () => {
      const schema = registry.getGenericSchema();

      expect(schema).toBeDefined();
      expect(schema.$id).toContain('generic');
      expect(schema.title).toBe('F5 XC Resource');
    });

    it('should cache generic schema', () => {
      const schema1 = registry.getGenericSchema();
      const schema2 = registry.getGenericSchema();

      expect(schema1).toBe(schema2); // Same reference (cached)
    });
  });

  describe('getSchemaContent', () => {
    it('should return JSON string for valid resource type', () => {
      const content = registry.getSchemaContent('http_loadbalancer');

      expect(typeof content).toBe('string');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should return generic schema content for "generic"', () => {
      const content = registry.getSchemaContent('generic');

      const parsed = JSON.parse(content);
      expect(parsed.title).toBe('F5 XC Resource');
    });

    it('should return generic schema for unknown resource type', () => {
      const content = registry.getSchemaContent('unknown_resource');

      const parsed = JSON.parse(content);
      // Should fall back to generic schema
      expect(parsed.title).toBe('F5 XC Resource');
    });

    it('should return properly formatted JSON', () => {
      const content = registry.getSchemaContent('http_loadbalancer');

      // Should be pretty-printed with 2-space indentation
      expect(content).toContain('\n');
      expect(content).toMatch(/^\{\n {2}"/);
    });
  });

  describe('getAvailableResourceTypes', () => {
    it('should return array of resource type keys', () => {
      const types = registry.getAvailableResourceTypes();

      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });

    it('should include common resource types', () => {
      const types = registry.getAvailableResourceTypes();

      expect(types).toContain('http_loadbalancer');
      expect(types).toContain('origin_pool');
      expect(types).toContain('healthcheck');
    });
  });

  describe('clearCache', () => {
    it('should clear all cached schemas', () => {
      // Populate cache
      registry.getOrGenerateSchema('http_loadbalancer');
      registry.getOrGenerateSchema('origin_pool');
      registry.getGenericSchema();

      expect(registry.getCacheStats().cachedCount).toBe(2);

      // Clear cache
      registry.clearCache();

      expect(registry.getCacheStats().cachedCount).toBe(0);
    });

    it('should allow re-generation after clearing', () => {
      registry.getOrGenerateSchema('http_loadbalancer');
      registry.clearCache();

      const schema = registry.getOrGenerateSchema('http_loadbalancer');
      expect(schema).not.toBeNull();
      expect(registry.getCacheStats().cachedCount).toBe(1);
    });
  });

  describe('prewarmCache', () => {
    it('should populate cache for specified resource types', () => {
      registry.prewarmCache(['http_loadbalancer', 'origin_pool']);

      expect(registry.getCacheStats().cachedCount).toBe(2);
    });

    it('should use default resource types when none specified', () => {
      registry.prewarmCache();

      // Default types: http_loadbalancer, origin_pool, healthcheck, app_firewall
      expect(registry.getCacheStats().cachedCount).toBe(4);
    });

    it('should skip invalid resource types without throwing', () => {
      expect(() => {
        registry.prewarmCache(['http_loadbalancer', 'invalid_type', 'origin_pool']);
      }).not.toThrow();

      // Should only cache the valid ones
      expect(registry.getCacheStats().cachedCount).toBe(2);
    });
  });

  describe('hasSchema', () => {
    it('should return true for cached resource type', () => {
      registry.getOrGenerateSchema('http_loadbalancer');

      expect(registry.hasSchema('http_loadbalancer')).toBe(true);
    });

    it('should return true for uncached but valid resource type', () => {
      expect(registry.hasSchema('http_loadbalancer')).toBe(true);
    });

    it('should return false for unknown resource type', () => {
      expect(registry.hasSchema('unknown_resource')).toBe(false);
    });
  });

  describe('getCacheStats', () => {
    it('should return correct cache statistics', () => {
      const stats = registry.getCacheStats();

      expect(stats).toHaveProperty('cachedCount');
      expect(stats).toHaveProperty('availableCount');
      expect(typeof stats.cachedCount).toBe('number');
      expect(typeof stats.availableCount).toBe('number');
    });

    it('should update cachedCount as schemas are generated', () => {
      expect(registry.getCacheStats().cachedCount).toBe(0);

      registry.getOrGenerateSchema('http_loadbalancer');
      expect(registry.getCacheStats().cachedCount).toBe(1);

      registry.getOrGenerateSchema('origin_pool');
      expect(registry.getCacheStats().cachedCount).toBe(2);
    });

    it('should report correct availableCount', () => {
      const stats = registry.getCacheStats();

      // Should match total number of generated resource types (234+)
      expect(stats.availableCount).toBeGreaterThanOrEqual(200);
    });
  });

  describe('singleton pattern', () => {
    it('getSchemaRegistry should return same instance', () => {
      const registry1 = getSchemaRegistry();
      const registry2 = getSchemaRegistry();

      expect(registry1).toBe(registry2);
    });

    it('resetSchemaRegistry should create new instance', () => {
      const registry1 = getSchemaRegistry();
      registry1.getOrGenerateSchema('http_loadbalancer');

      resetSchemaRegistry();

      const registry2 = getSchemaRegistry();
      // New instance should have empty cache
      expect(registry2.getCacheStats().cachedCount).toBe(0);
    });
  });

  describe('thread safety and consistency', () => {
    it('should produce consistent results across multiple calls', () => {
      const results: string[] = [];

      for (let i = 0; i < 10; i++) {
        const content = registry.getSchemaContent('http_loadbalancer');
        results.push(content);
      }

      // All results should be identical
      const firstResult = results[0];
      expect(results.every((r) => r === firstResult)).toBe(true);
    });

    it('should handle rapid sequential access', () => {
      const types = ['http_loadbalancer', 'origin_pool', 'healthcheck', 'app_firewall'];

      // Rapidly access schemas
      for (let i = 0; i < 100; i++) {
        const type = types[i % types.length];
        const schema = registry.getOrGenerateSchema(type!);
        expect(schema).not.toBeNull();
      }

      // Only 4 unique types should be cached
      expect(registry.getCacheStats().cachedCount).toBe(4);
    });
  });
});
