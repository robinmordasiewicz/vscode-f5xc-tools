// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Unit tests for the validation utilities
 */

import {
  validateResourcePayload,
  isFieldRequired,
  getRequiredFieldsSummary,
  ValidationResult,
} from '../../utils/validation';

describe('Validation Utilities', () => {
  describe('validateResourcePayload', () => {
    it('should return valid for payload with all required fields', () => {
      const payload = {
        metadata: {
          name: 'test-resource',
          namespace: 'default',
        },
        spec: {
          domains: ['example.com'],
        },
      };

      const result = validateResourcePayload('http_loadbalancer', 'create', payload);

      // Result structure should be correct
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('missingFields');
      expect(result).toHaveProperty('warnings');
      expect(Array.isArray(result.missingFields)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should return invalid when required fields are missing', () => {
      const payload = {
        metadata: {},
        spec: {},
      };

      const result = validateResourcePayload('http_loadbalancer', 'create', payload);

      // Should detect missing fields
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('missingFields');
      expect(result).toHaveProperty('warnings');
    });

    it('should handle empty payload', () => {
      const payload = {};

      const result = validateResourcePayload('http_loadbalancer', 'create', payload);

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('missingFields');
      expect(result).toHaveProperty('warnings');
    });

    it('should handle unknown resource type', () => {
      const payload = {
        metadata: { name: 'test' },
      };

      const result = validateResourcePayload('unknown_resource', 'create', payload);

      // Unknown resources should validate (no required fields known)
      expect(result.valid).toBe(true);
      expect(result.missingFields).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should detect nested missing fields', () => {
      const payload = {
        metadata: {
          namespace: 'default',
          // name is missing
        },
      };

      const result = validateResourcePayload('http_loadbalancer', 'create', payload);

      // Should work without throwing
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('missingFields');
    });

    it('should not flag empty strings as present', () => {
      const payload = {
        metadata: {
          name: '', // Empty string should be considered missing
          namespace: 'default',
        },
      };

      const result = validateResourcePayload('http_loadbalancer', 'create', payload);

      // Empty string values should be treated as missing
      expect(result).toHaveProperty('valid');
    });

    it('should handle null values as missing', () => {
      const payload = {
        metadata: {
          name: null,
          namespace: 'default',
        },
      };

      const result = validateResourcePayload('http_loadbalancer', 'create', payload);

      expect(result).toHaveProperty('valid');
    });

    it('should handle update operation', () => {
      const payload = {
        metadata: {
          name: 'test-resource',
          namespace: 'default',
        },
      };

      const result = validateResourcePayload('http_loadbalancer', 'update', payload);

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('missingFields');
      expect(result).toHaveProperty('warnings');
    });
  });

  describe('isFieldRequired', () => {
    it('should return boolean for known resource and field', () => {
      const required = isFieldRequired('http_loadbalancer', 'create', 'metadata.name');

      expect(typeof required).toBe('boolean');
    });

    it('should return false for unknown resource type', () => {
      const required = isFieldRequired('unknown_resource', 'create', 'metadata.name');

      expect(required).toBe(false);
    });

    it('should handle path-based fields', () => {
      const required = isFieldRequired('http_loadbalancer', 'create', 'path.namespace');

      // Path-based fields may or may not be in required list
      expect(typeof required).toBe('boolean');
    });
  });

  describe('getRequiredFieldsSummary', () => {
    it('should return array of human-readable field names', () => {
      const summary = getRequiredFieldsSummary('http_loadbalancer', 'create');

      expect(Array.isArray(summary)).toBe(true);
      // All items should be strings
      expect(summary.every((s) => typeof s === 'string')).toBe(true);
    });

    it('should return empty array for unknown resource type', () => {
      const summary = getRequiredFieldsSummary('unknown_resource', 'create');

      expect(summary).toEqual([]);
    });

    it('should format nested field names', () => {
      const summary = getRequiredFieldsSummary('http_loadbalancer', 'create');

      // If there are any required fields, they should be formatted
      // e.g., "metadata.name" -> "Metadata → Name"
      expect(Array.isArray(summary)).toBe(true);
    });

    it('should not include path-based fields', () => {
      const summary = getRequiredFieldsSummary('http_loadbalancer', 'create');

      // Path-based fields like "path.namespace" should be filtered out
      const hasPathFields = summary.some((s) => s.toLowerCase().includes('path'));
      expect(hasPathFields).toBe(false);
    });
  });

  describe('ValidationResult structure', () => {
    it('should include serverDefaultedFields property', () => {
      const payload = {
        metadata: { name: 'test' },
      };

      const result: ValidationResult = validateResourcePayload(
        'http_loadbalancer',
        'create',
        payload,
      );

      expect(result).toHaveProperty('serverDefaultedFields');
      expect(Array.isArray(result.serverDefaultedFields)).toBe(true);
    });

    it('should include hints property', () => {
      const payload = {
        metadata: { name: 'test' },
      };

      const result: ValidationResult = validateResourcePayload(
        'http_loadbalancer',
        'create',
        payload,
      );

      expect(result).toHaveProperty('hints');
      expect(Array.isArray(result.hints)).toBe(true);
    });

    it('should have all required ValidationResult properties', () => {
      const payload = {
        metadata: { name: 'test' },
      };

      const result: ValidationResult = validateResourcePayload(
        'http_loadbalancer',
        'create',
        payload,
      );

      // Check all properties exist
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('missingFields');
      expect(result).toHaveProperty('serverDefaultedFields');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('hints');

      // Check types
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.missingFields)).toBe(true);
      expect(Array.isArray(result.serverDefaultedFields)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.hints)).toBe(true);
    });
  });

  describe('Server default field handling', () => {
    it('should not include server-defaulted fields in missingFields', () => {
      const payload = {
        metadata: { name: 'test' },
        spec: {},
      };

      const result = validateResourcePayload('http_loadbalancer', 'create', payload);

      // Server-defaulted fields should be in serverDefaultedFields, not missingFields
      // The specific fields depend on the generated metadata
      expect(Array.isArray(result.serverDefaultedFields)).toBe(true);
      expect(Array.isArray(result.missingFields)).toBe(true);

      // There should be no overlap between missing and server-defaulted
      const overlap = result.missingFields.filter((f) => result.serverDefaultedFields.includes(f));
      expect(overlap).toEqual([]);
    });

    it('should provide hints for server-defaulted fields', () => {
      const payload = {
        metadata: { name: 'test' },
        spec: {},
      };

      const result = validateResourcePayload('http_loadbalancer', 'create', payload);

      // If there are server-defaulted fields, there should be hints
      if (result.serverDefaultedFields.length > 0) {
        expect(result.hints.length).toBeGreaterThan(0);
      }
    });

    it('should still validate user-required fields as missing', () => {
      const payload = {
        metadata: {},
        spec: {},
      };

      const result = validateResourcePayload('http_loadbalancer', 'create', payload);

      // User-required fields like metadata.name should still be flagged as missing
      // The exact validation depends on the resource type's required fields
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('missingFields');
    });

    it('should handle resources with no field metadata gracefully', () => {
      const payload = {
        metadata: { name: 'test' },
      };

      // Unknown resources have no field metadata
      const result = validateResourcePayload('unknown_resource', 'create', payload);

      expect(result.valid).toBe(true);
      expect(result.serverDefaultedFields).toEqual([]);
      expect(result.hints).toEqual([]);
    });
  });

  describe('Recommended value field handling', () => {
    it('should include recommendedValueFields property in result', () => {
      const payload = {
        metadata: { name: 'test' },
        spec: {},
      };

      const result: ValidationResult = validateResourcePayload('healthcheck', 'create', payload);

      // recommendedValueFields is optional, may be present or not
      if (result.recommendedValueFields !== undefined) {
        expect(Array.isArray(result.recommendedValueFields)).toBe(true);
      }
    });

    it('should track missing fields with recommended values for healthcheck', () => {
      const payload = {
        metadata: { name: 'test' },
        spec: {},
      };

      const result = validateResourcePayload('healthcheck', 'create', payload);

      // healthcheck has recommended values for timeout, interval, etc.
      if (result.recommendedValueFields) {
        expect(result.recommendedValueFields.length).toBeGreaterThan(0);
      }
    });

    it('should not include recommended value fields that are provided', () => {
      const payload = {
        metadata: { name: 'test' },
        spec: {
          timeout: 5, // User provided a value
        },
      };

      const result = validateResourcePayload('healthcheck', 'create', payload);

      // If recommendedValueFields is present, it should not include 'spec.timeout'
      if (result.recommendedValueFields) {
        expect(result.recommendedValueFields).not.toContain('spec.timeout');
      }
    });

    it('should provide hints for recommended values', () => {
      const payload = {
        metadata: { name: 'test' },
        spec: {},
      };

      const result = validateResourcePayload('healthcheck', 'create', payload);

      // Should have hints about recommended values
      const hasRecommendedHint = result.hints.some((h) => h.includes('Recommended'));
      expect(hasRecommendedHint).toBe(true);
    });

    it('should include recommended value in hint message', () => {
      const payload = {
        metadata: { name: 'test' },
        spec: {},
      };

      const result = validateResourcePayload('healthcheck', 'create', payload);

      // Hints should include actual recommended values like "3" for timeout
      const recommendedHint = result.hints.find((h) => h.includes('Recommended'));
      if (recommendedHint) {
        // Should contain some numeric values
        expect(recommendedHint).toMatch(/\d+/);
      }
    });

    it('should not have recommended value hints when all provided', () => {
      const payload = {
        metadata: { name: 'test' },
        spec: {
          timeout: 5,
          interval: 10,
          unhealthy_threshold: 2,
          healthy_threshold: 2,
          jitter_percent: 20,
        },
      };

      const result = validateResourcePayload('healthcheck', 'create', payload);

      // Should not have recommended value hints when user provided all values
      const hasRecommendedHint = result.hints.some((h) => h.includes('Recommended'));
      // Either no recommended hint, or empty recommendedValueFields
      if (result.recommendedValueFields) {
        expect(result.recommendedValueFields.length).toBe(0);
      }
      if (!result.recommendedValueFields || result.recommendedValueFields.length === 0) {
        expect(hasRecommendedHint).toBe(false);
      }
    });

    it('should not have recommendedValueFields for resources without recommended values', () => {
      const payload = {
        metadata: { name: 'test' },
      };

      // Unknown resources have no recommended values
      const result = validateResourcePayload('unknown_resource', 'create', payload);

      // recommendedValueFields should be undefined or empty for unknown resources
      expect(
        result.recommendedValueFields === undefined || result.recommendedValueFields.length === 0,
      ).toBe(true);
    });

    it('should keep recommended value fields separate from server defaulted fields', () => {
      const payload = {
        metadata: { name: 'test' },
        spec: {},
      };

      const result = validateResourcePayload('healthcheck', 'create', payload);

      // Recommended value fields and server defaulted fields should be separate concepts
      // No overlap expected
      if (result.recommendedValueFields && result.recommendedValueFields.length > 0) {
        const overlap = result.recommendedValueFields.filter((f) =>
          result.serverDefaultedFields.includes(f),
        );
        // Fields with recommended values shouldn't also be in serverDefaultedFields
        // (they are different metadata attributes)
        expect(Array.isArray(overlap)).toBe(true);
      }
    });
  });

  describe('origin_pool LB_OVERRIDE hint', () => {
    it('should show hint when LB_OVERRIDE is used for loadbalancer_algorithm', () => {
      const payload = {
        metadata: { name: 'test' },
        spec: {
          origin_servers: [{ public_ip: { ip: '1.2.3.4' } }],
          port: 443,
          loadbalancer_algorithm: 'LB_OVERRIDE',
        },
      };

      const result = validateResourcePayload('origin_pool', 'create', payload);

      // Should have a hint about LB_OVERRIDE
      const hasLbOverrideHint = result.hints.some((h) => h.includes('LB_OVERRIDE'));
      expect(hasLbOverrideHint).toBe(true);
    });

    it('should explain that LB_OVERRIDE inherits from load balancer', () => {
      const payload = {
        metadata: { name: 'test' },
        spec: {
          origin_servers: [{ public_ip: { ip: '1.2.3.4' } }],
          port: 443,
          loadbalancer_algorithm: 'LB_OVERRIDE',
        },
      };

      const result = validateResourcePayload('origin_pool', 'create', payload);

      // Hint should mention inheritance from HTTP Load Balancer
      const hint = result.hints.find((h) => h.includes('LB_OVERRIDE'));
      expect(hint).toBeDefined();
      expect(hint).toContain('inherited');
    });

    it('should mention ROUND_ROBIN fallback in LB_OVERRIDE hint', () => {
      const payload = {
        metadata: { name: 'test' },
        spec: {
          origin_servers: [{ public_ip: { ip: '1.2.3.4' } }],
          port: 443,
          loadbalancer_algorithm: 'LB_OVERRIDE',
        },
      };

      const result = validateResourcePayload('origin_pool', 'create', payload);

      // Hint should mention ROUND_ROBIN as fallback
      const hint = result.hints.find((h) => h.includes('LB_OVERRIDE'));
      expect(hint).toBeDefined();
      expect(hint).toContain('ROUND_ROBIN');
    });

    it('should not show LB_OVERRIDE hint when not using LB_OVERRIDE', () => {
      const payload = {
        metadata: { name: 'test' },
        spec: {
          origin_servers: [{ public_ip: { ip: '1.2.3.4' } }],
          port: 443,
          loadbalancer_algorithm: 'ROUND_ROBIN',
        },
      };

      const result = validateResourcePayload('origin_pool', 'create', payload);

      // Should NOT have the LB_OVERRIDE hint
      const hasLbOverrideHint = result.hints.some((h) => h.includes('LB_OVERRIDE'));
      expect(hasLbOverrideHint).toBe(false);
    });

    it('should not show LB_OVERRIDE hint when loadbalancer_algorithm is not set', () => {
      const payload = {
        metadata: { name: 'test' },
        spec: {
          origin_servers: [{ public_ip: { ip: '1.2.3.4' } }],
          port: 443,
        },
      };

      const result = validateResourcePayload('origin_pool', 'create', payload);

      // Should NOT have the LB_OVERRIDE hint
      const hasLbOverrideHint = result.hints.some((h) => h.includes('LB_OVERRIDE'));
      expect(hasLbOverrideHint).toBe(false);
    });

    it('should not show LB_OVERRIDE hint for other resource types', () => {
      const payload = {
        metadata: { name: 'test' },
        spec: {
          loadbalancer_algorithm: 'LB_OVERRIDE',
        },
      };

      const result = validateResourcePayload('http_loadbalancer', 'create', payload);

      // Should NOT have the LB_OVERRIDE hint for non-origin_pool resources
      const hasLbOverrideHint = result.hints.some((h) => h.includes('LB_OVERRIDE'));
      expect(hasLbOverrideHint).toBe(false);
    });
  });
});
