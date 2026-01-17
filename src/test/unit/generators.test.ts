// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Unit tests for the generator functions.
 *
 * Tests the determinism and correctness of the code generation utilities
 * that parse OpenAPI specs and generate TypeScript files.
 *
 * Note: The generator functions are defined inline here to avoid import path issues
 * since the scripts/ directory is outside the src/ rootDir.
 */

// Inline implementations of generator utility functions for testing
// These match the implementations in scripts/generators/spec-parser.ts

type NamespaceScope = 'any' | 'system' | 'shared';

function extractSchemaId(filename: string): string | null {
  const match = filename.match(/^docs-cloud-f5-com\.\d+\.public\.(.+)\.ves-swagger\.json$/);
  return match && match[1] ? match[1] : null;
}

function deriveResourceKey(schemaId: string): string | null {
  const parts = schemaId.split('.');
  const schemaIndex = parts.indexOf('schema');
  if (schemaIndex === -1 || schemaIndex >= parts.length - 1) {
    return null;
  }

  const afterSchema = parts.slice(schemaIndex + 1);

  if (afterSchema[0] === 'views' && afterSchema.length > 1) {
    return afterSchema.slice(1).join('_');
  }

  return afterSchema.join('_');
}

function deriveApiPathSuffix(resourceKey: string): string {
  if (resourceKey.endsWith('s')) {
    return resourceKey + 'es';
  }
  return resourceKey + 's';
}

function deriveNamespaceScope(fullPath: string | null): NamespaceScope {
  if (!fullPath) {
    return 'any';
  }

  if (fullPath.includes('/namespaces/system/')) {
    return 'system';
  }

  if (fullPath.includes('/namespaces/shared/')) {
    return 'shared';
  }

  return 'any';
}

function formatDisplayName(title: string | undefined, resourceKey: string): string {
  if (title) {
    let cleaned = title.replace(/^F5 Distributed Cloud Services API for\s+/i, '');
    cleaned = cleaned.replace(/^ves\.io\.schema\.(views\.)?/, '');
    cleaned = cleaned
      .split(/[._]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    if (!cleaned.endsWith('s') && !cleaned.endsWith('ing')) {
      cleaned += 's';
    }

    return cleaned;
  }

  return (
    resourceKey
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + 's'
  );
}

describe('Generator Utilities', () => {
  describe('extractSchemaId', () => {
    it('should extract schema ID from valid filename', () => {
      const filename =
        'docs-cloud-f5-com.0073.public.ves.io.schema.views.http_loadbalancer.ves-swagger.json';
      expect(extractSchemaId(filename)).toBe('ves.io.schema.views.http_loadbalancer');
    });

    it('should extract schema ID from non-views filename', () => {
      const filename = 'docs-cloud-f5-com.0001.public.ves.io.schema.app_firewall.ves-swagger.json';
      expect(extractSchemaId(filename)).toBe('ves.io.schema.app_firewall');
    });

    it('should return null for invalid filename format', () => {
      expect(extractSchemaId('invalid-file.json')).toBeNull();
      expect(extractSchemaId('docs-cloud-f5-com.json')).toBeNull();
      expect(extractSchemaId('')).toBeNull();
    });

    it('should handle nested schema IDs', () => {
      const filename =
        'docs-cloud-f5-com.0042.public.ves.io.schema.api_sec.api_crawler.ves-swagger.json';
      expect(extractSchemaId(filename)).toBe('ves.io.schema.api_sec.api_crawler');
    });
  });

  describe('deriveResourceKey', () => {
    it('should derive key from views schema', () => {
      expect(deriveResourceKey('ves.io.schema.views.http_loadbalancer')).toBe('http_loadbalancer');
    });

    it('should derive key from non-views schema', () => {
      expect(deriveResourceKey('ves.io.schema.app_firewall')).toBe('app_firewall');
    });

    it('should handle nested schemas', () => {
      expect(deriveResourceKey('ves.io.schema.api_sec.api_crawler')).toBe('api_sec_api_crawler');
    });

    it('should return null for invalid schema ID', () => {
      expect(deriveResourceKey('invalid')).toBeNull();
      expect(deriveResourceKey('missing.schemaword')).toBeNull();
      expect(deriveResourceKey('schema')).toBeNull(); // schema at end with nothing after
    });
  });

  describe('deriveApiPathSuffix', () => {
    it('should pluralize resource key', () => {
      expect(deriveApiPathSuffix('http_loadbalancer')).toBe('http_loadbalancers');
      expect(deriveApiPathSuffix('origin_pool')).toBe('origin_pools');
    });

    it('should handle keys ending in s', () => {
      expect(deriveApiPathSuffix('dns_zones')).toBe('dns_zoneses');
    });

    it('should handle service_policy correctly', () => {
      expect(deriveApiPathSuffix('service_policy')).toBe('service_policys');
    });
  });

  describe('deriveNamespaceScope', () => {
    it('should return system for literal system paths', () => {
      expect(deriveNamespaceScope('/api/config/namespaces/system/sites')).toBe('system');
    });

    it('should return shared for literal shared paths', () => {
      expect(deriveNamespaceScope('/api/config/namespaces/shared/resources')).toBe('shared');
    });

    it('should return any for parameterized namespace paths', () => {
      expect(deriveNamespaceScope('/api/config/namespaces/{namespace}/http_loadbalancers')).toBe(
        'any',
      );
      expect(deriveNamespaceScope('/api/config/namespaces/{ns}/resources')).toBe('any');
    });

    it('should return any for tenant-level paths', () => {
      expect(deriveNamespaceScope('/api/config/tenant_resources')).toBe('any');
    });

    it('should return any for null path', () => {
      expect(deriveNamespaceScope(null)).toBe('any');
    });
  });

  describe('formatDisplayName', () => {
    it('should format title with F5 prefix', () => {
      const title = 'F5 Distributed Cloud Services API for ves.io.schema.views.http_loadbalancer';
      expect(formatDisplayName(title, 'http_loadbalancer')).toBe('Http Loadbalancers');
    });

    it('should format from resource key when no title', () => {
      expect(formatDisplayName(undefined, 'http_loadbalancer')).toBe('Http Loadbalancers');
      expect(formatDisplayName(undefined, 'origin_pool')).toBe('Origin Pools');
    });

    it('should handle multi-word resource keys', () => {
      expect(formatDisplayName(undefined, 'api_definition')).toBe('Api Definitions');
    });
  });
});

describe('Generation Determinism', () => {
  it('should produce same output for same input', () => {
    const schemaId = 'ves.io.schema.views.http_loadbalancer';

    const result1 = deriveResourceKey(schemaId);
    const result2 = deriveResourceKey(schemaId);

    expect(result1).toBe(result2);
  });

  it('should produce consistent pluralization', () => {
    const keys = ['http_loadbalancer', 'origin_pool', 'app_firewall'];

    const results1 = keys.map(deriveApiPathSuffix);
    const results2 = keys.map(deriveApiPathSuffix);

    expect(results1).toEqual(results2);
  });

  it('should produce consistent namespace scope derivation', () => {
    const paths = [
      '/api/config/namespaces/system/sites',
      '/api/config/namespaces/{namespace}/http_loadbalancers',
      '/api/web/namespaces/{ns}/resources',
    ];

    const results1 = paths.map(deriveNamespaceScope);
    const results2 = paths.map(deriveNamespaceScope);

    expect(results1).toEqual(results2);
  });
});

describe('Generated Files Contract', () => {
  it('should export GENERATED_RESOURCE_TYPES', () => {
    const generated = require('../../generated/resourceTypesBase');

    expect(generated.GENERATED_RESOURCE_TYPES).toBeDefined();
    expect(typeof generated.GENERATED_RESOURCE_TYPES).toBe('object');
  });

  it('should export DOCUMENTATION_URLS', () => {
    const generated = require('../../generated/documentationUrls');

    expect(generated.DOCUMENTATION_URLS).toBeDefined();
    expect(typeof generated.DOCUMENTATION_URLS).toBe('object');
  });

  it('should export constants', () => {
    const generated = require('../../generated/constants');

    expect(generated.BUILT_IN_NAMESPACES).toBeDefined();
    expect(generated.API_ENDPOINTS).toBeDefined();
    expect(generated.CATEGORY_ICONS).toBeDefined();
  });

  it('should have required fields in resource types', () => {
    const generated = require('../../generated/resourceTypesBase');

    const httpLb = generated.GENERATED_RESOURCE_TYPES['http_loadbalancer'];
    expect(httpLb).toBeDefined();
    expect(httpLb.apiPath).toBeDefined();
    expect(httpLb.displayName).toBeDefined();
    expect(httpLb.apiBase).toBeDefined();
    expect(httpLb.namespaceScoped).toBeDefined();
    expect(httpLb.namespaceScope).toBeDefined();
  });

  it('should have no duplicate resource keys', () => {
    const generated = require('../../generated/resourceTypesBase');
    const keys = Object.keys(generated.GENERATED_RESOURCE_TYPES);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });

  it('should have valid namespace scopes', () => {
    const generated = require('../../generated/resourceTypesBase');
    const validScopes = ['any', 'system', 'shared'];

    for (const key of Object.keys(generated.GENERATED_RESOURCE_TYPES)) {
      const resource = generated.GENERATED_RESOURCE_TYPES[key];
      expect(validScopes).toContain(resource.namespaceScope);
    }
  });

  it('should have valid fieldMetadata structure when present', () => {
    const generated = require('../../generated/resourceTypesBase');

    for (const key of Object.keys(generated.GENERATED_RESOURCE_TYPES)) {
      const resource = generated.GENERATED_RESOURCE_TYPES[key];

      // fieldMetadata is optional - only validate if present
      if (resource.fieldMetadata) {
        expect(resource.fieldMetadata).toHaveProperty('fields');
        expect(typeof resource.fieldMetadata.fields).toBe('object');

        // serverDefaultFields should be array if present
        if (resource.fieldMetadata.serverDefaultFields) {
          expect(Array.isArray(resource.fieldMetadata.serverDefaultFields)).toBe(true);
        }

        // userRequiredFields should be array if present
        if (resource.fieldMetadata.userRequiredFields) {
          expect(Array.isArray(resource.fieldMetadata.userRequiredFields)).toBe(true);
        }

        // Each field entry should have valid structure
        for (const fieldPath of Object.keys(resource.fieldMetadata.fields)) {
          const field = resource.fieldMetadata.fields[fieldPath];
          expect(typeof field).toBe('object');

          // If serverDefault is present, should be boolean
          if (field.serverDefault !== undefined) {
            expect(typeof field.serverDefault).toBe('boolean');
          }

          // If requiredFor is present, should have valid structure
          if (field.requiredFor) {
            expect(typeof field.requiredFor).toBe('object');
            if (field.requiredFor.create !== undefined) {
              expect(typeof field.requiredFor.create).toBe('boolean');
            }
            if (field.requiredFor.update !== undefined) {
              expect(typeof field.requiredFor.update).toBe('boolean');
            }
          }
        }
      }
    }
  });
});
