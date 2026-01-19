// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Unit tests for the F5 XC Schema Provider
 */

import { F5XCSchemaProvider, getSchemaUriForDocument } from '../../providers/f5xcSchemaProvider';
import { resetSchemaRegistry } from '../../schema/schemaRegistry';

// Mock vscode module
const mockEventEmitter = {
  event: jest.fn(),
  fire: jest.fn(),
  dispose: jest.fn(),
};

jest.mock(
  'vscode',
  () => ({
    EventEmitter: jest.fn(() => mockEventEmitter),
    Uri: {
      parse: jest.fn((uri: string) => ({
        toString: () => uri,
        scheme: uri.split(':')[0],
        path: uri.includes('://') ? uri.split('://')[1] : uri,
        authority: '',
      })),
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

describe('F5XCSchemaProvider', () => {
  let provider: F5XCSchemaProvider;

  beforeEach(() => {
    resetSchemaRegistry();
    provider = new F5XCSchemaProvider();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with event emitter', () => {
      expect(provider).toBeInstanceOf(F5XCSchemaProvider);
      expect(provider.onDidChange).toBeDefined();
    });
  });

  describe('provideTextDocumentContent', () => {
    it('should return schema content for valid resource type URI', () => {
      const uri = {
        path: '/schemas/http_loadbalancer.json',
        toString: () => 'f5xc-schema://schemas/http_loadbalancer.json',
      };

      const content = provider.provideTextDocumentContent(uri as any);

      expect(typeof content).toBe('string');
      const parsed = JSON.parse(content);
      expect(parsed.$id).toContain('http_loadbalancer');
    });

    it('should return schema content for healthcheck', () => {
      const uri = {
        path: '/schemas/healthcheck.json',
        toString: () => 'f5xc-schema://schemas/healthcheck.json',
      };

      const content = provider.provideTextDocumentContent(uri as any);

      const parsed = JSON.parse(content);
      expect(parsed.title).toContain('Health Check');
    });

    it('should return schema content for origin_pool', () => {
      const uri = {
        path: '/schemas/origin_pool.json',
        toString: () => 'f5xc-schema://schemas/origin_pool.json',
      };

      const content = provider.provideTextDocumentContent(uri as any);

      const parsed = JSON.parse(content);
      expect(parsed.$id).toContain('origin_pool');
    });

    it('should return generic schema for "generic" resource type', () => {
      const uri = {
        path: '/schemas/generic.json',
        toString: () => 'f5xc-schema://schemas/generic.json',
      };

      const content = provider.provideTextDocumentContent(uri as any);

      const parsed = JSON.parse(content);
      expect(parsed.title).toBe('F5 XC Resource');
    });

    it('should return error schema for invalid URI format', () => {
      const uri = {
        path: '/invalid/path',
        toString: () => 'f5xc-schema://invalid/path',
      };

      const content = provider.provideTextDocumentContent(uri as any);

      const parsed = JSON.parse(content);
      expect(parsed.title).toBe('Error');
      expect(parsed.description).toContain('Invalid schema URI');
    });

    it('should handle URI without .json extension', () => {
      const uri = {
        path: '/schemas/http_loadbalancer',
        toString: () => 'f5xc-schema://schemas/http_loadbalancer',
      };

      const content = provider.provideTextDocumentContent(uri as any);

      // Should return error schema since pattern requires .json
      const parsed = JSON.parse(content);
      expect(parsed.title).toBe('Error');
    });

    it('should return generic schema for unknown resource type', () => {
      const uri = {
        path: '/schemas/unknown_resource_type.json',
        toString: () => 'f5xc-schema://schemas/unknown_resource_type.json',
      };

      const content = provider.provideTextDocumentContent(uri as any);

      // Should fall back to generic schema
      const parsed = JSON.parse(content);
      expect(parsed.title).toBe('F5 XC Resource');
    });
  });

  describe('notifySchemaChanged', () => {
    it('should fire change event for specified resource type', () => {
      provider.notifySchemaChanged('http_loadbalancer');

      expect(mockEventEmitter.fire).toHaveBeenCalled();
    });

    it('should fire change event with correct URI', () => {
      provider.notifySchemaChanged('origin_pool');

      expect(mockEventEmitter.fire).toHaveBeenCalled();
    });
  });

  describe('notifyAllSchemasChanged', () => {
    it('should fire change events for all resource types', () => {
      provider.notifyAllSchemasChanged();

      // Should fire multiple times (once for each resource type + generic)
      expect(mockEventEmitter.fire.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe('schema content validation', () => {
    it('should return valid JSON Schema for all common resource types', () => {
      const resourceTypes = [
        'http_loadbalancer',
        'origin_pool',
        'healthcheck',
        'app_firewall',
        'tcp_loadbalancer',
        'dns_load_balancer',
      ];

      for (const resourceType of resourceTypes) {
        const uri = {
          path: `/schemas/${resourceType}.json`,
          toString: () => `f5xc-schema://schemas/${resourceType}.json`,
        };

        const content = provider.provideTextDocumentContent(uri as any);

        expect(() => JSON.parse(content)).not.toThrow();
        const parsed = JSON.parse(content);
        expect(parsed.$schema).toBe('http://json-schema.org/draft-07/schema#');
        expect(parsed.type).toBe('object');
        expect(parsed.properties).toBeDefined();
      }
    });

    it('should include metadata and spec properties in all schemas', () => {
      const uri = {
        path: '/schemas/http_loadbalancer.json',
        toString: () => 'f5xc-schema://schemas/http_loadbalancer.json',
      };

      const content = provider.provideTextDocumentContent(uri as any);
      const parsed = JSON.parse(content);

      expect(parsed.properties.metadata).toBeDefined();
      expect(parsed.properties.spec).toBeDefined();
      expect(parsed.required).toContain('metadata');
      expect(parsed.required).toContain('spec');
    });
  });
});

describe('getSchemaUriForDocument', () => {
  beforeEach(() => {
    resetSchemaRegistry();
  });

  it('should return null for non-f5xc scheme', () => {
    const documentUri = {
      scheme: 'file',
      path: '/some/file.json',
    };

    const result = getSchemaUriForDocument(documentUri as any);

    expect(result).toBeNull();
  });

  it('should return schema URI for valid f5xc document URI', () => {
    const documentUri = {
      scheme: 'f5xc',
      path: '/default/http_loadbalancer/my-lb.json',
    };

    const result = getSchemaUriForDocument(documentUri as any);

    expect(result).not.toBeNull();
    expect(result!.toString()).toContain('http_loadbalancer');
  });

  it('should return generic schema URI for unknown resource type', () => {
    const documentUri = {
      scheme: 'f5xc',
      path: '/default/unknown_type/resource.json',
    };

    const result = getSchemaUriForDocument(documentUri as any);

    expect(result).not.toBeNull();
    expect(result!.toString()).toContain('generic');
  });

  it('should return null for invalid path format', () => {
    const documentUri = {
      scheme: 'f5xc',
      path: '/invalid',
    };

    const result = getSchemaUriForDocument(documentUri as any);

    expect(result).toBeNull();
  });

  it('should return null for empty path', () => {
    const documentUri = {
      scheme: 'f5xc',
      path: '',
    };

    const result = getSchemaUriForDocument(documentUri as any);

    expect(result).toBeNull();
  });

  it('should extract resource type correctly from various paths', () => {
    const testCases = [
      { path: '/namespace/http_loadbalancer/lb.json', expectedType: 'http_loadbalancer' },
      { path: '/default/origin_pool/pool.json', expectedType: 'origin_pool' },
      { path: '/shared/healthcheck/hc.json', expectedType: 'healthcheck' },
    ];

    for (const { path, expectedType } of testCases) {
      const documentUri = {
        scheme: 'f5xc',
        path,
      };

      const result = getSchemaUriForDocument(documentUri as any);

      expect(result).not.toBeNull();
      expect(result!.toString()).toContain(expectedType);
    }
  });
});

describe('Schema Provider Integration', () => {
  let provider: F5XCSchemaProvider;

  beforeEach(() => {
    resetSchemaRegistry();
    provider = new F5XCSchemaProvider();
  });

  describe('consistency between calls', () => {
    it('should return identical content for same URI', () => {
      const uri = {
        path: '/schemas/http_loadbalancer.json',
        toString: () => 'f5xc-schema://schemas/http_loadbalancer.json',
      };

      const content1 = provider.provideTextDocumentContent(uri as any);
      const content2 = provider.provideTextDocumentContent(uri as any);

      expect(content1).toBe(content2);
    });

    it('should return different content for different resource types', () => {
      const uri1 = {
        path: '/schemas/http_loadbalancer.json',
        toString: () => 'f5xc-schema://schemas/http_loadbalancer.json',
      };
      const uri2 = {
        path: '/schemas/origin_pool.json',
        toString: () => 'f5xc-schema://schemas/origin_pool.json',
      };

      const content1 = provider.provideTextDocumentContent(uri1 as any);
      const content2 = provider.provideTextDocumentContent(uri2 as any);

      expect(content1).not.toBe(content2);

      const parsed1 = JSON.parse(content1);
      const parsed2 = JSON.parse(content2);
      expect(parsed1.$id).not.toBe(parsed2.$id);
    });
  });

  describe('schema content structure', () => {
    it('should provide schemas usable by JSON language service', () => {
      const uri = {
        path: '/schemas/healthcheck.json',
        toString: () => 'f5xc-schema://schemas/healthcheck.json',
      };

      const content = provider.provideTextDocumentContent(uri as any);
      const schema = JSON.parse(content);

      // Required properties for JSON language service
      expect(schema.$schema).toBeDefined();
      expect(schema.type).toBeDefined();
      expect(schema.properties).toBeDefined();

      // Metadata should have name property
      expect(schema.properties.metadata.properties.name).toBeDefined();
      expect(schema.properties.metadata.properties.name.type).toBe('string');
    });
  });
});
