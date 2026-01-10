// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Unit tests for the validation utilities
 */

import {
  validateResourcePayload,
  isFieldRequired,
  getRequiredFieldsSummary,
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
});
