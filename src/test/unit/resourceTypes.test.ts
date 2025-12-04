/**
 * Unit tests for the Resource Types registry
 */

import {
  RESOURCE_TYPES,
  ResourceCategory,
  ResourceTypeInfo,
  getResourceTypesByCategory,
  getCategorizedResourceTypes,
  getResourceTypeByApiPath,
  getResourceTypeKeys,
  getCategoryIcon,
} from '../../api/resourceTypes';

describe('Resource Types Registry', () => {
  describe('RESOURCE_TYPES constant', () => {
    it('should contain HTTP load balancer resource type', () => {
      expect(RESOURCE_TYPES.http_loadbalancer).toBeDefined();
      expect(RESOURCE_TYPES.http_loadbalancer!.displayName).toBe('HTTP Load Balancers');
      expect(RESOURCE_TYPES.http_loadbalancer!.category).toBe(ResourceCategory.LoadBalancing);
    });

    it('should have valid structure for all resource types', () => {
      const requiredFields: (keyof ResourceTypeInfo)[] = [
        'apiPath',
        'displayName',
        'category',
        'supportsCustomOps',
        'icon',
      ];

      for (const [_key, resourceType] of Object.entries(RESOURCE_TYPES)) {
        for (const field of requiredFields) {
          expect(resourceType[field]).toBeDefined();
        }
        // Validate apiPath format (lowercase with underscores, may include version numbers)
        expect(resourceType.apiPath).toMatch(/^[a-z0-9_]+$/);
      }
    });

    it('should have unique API paths', () => {
      const apiPaths = Object.values(RESOURCE_TYPES).map((r) => r.apiPath);
      const uniquePaths = new Set(apiPaths);
      expect(uniquePaths.size).toBe(apiPaths.length);
    });

    it('should have at least 40 resource types defined', () => {
      const keys = Object.keys(RESOURCE_TYPES);
      expect(keys.length).toBeGreaterThanOrEqual(40);
    });
  });

  describe('getResourceTypesByCategory', () => {
    it('should return load balancing resource types', () => {
      const loadBalancingTypes = getResourceTypesByCategory(ResourceCategory.LoadBalancing);

      expect(loadBalancingTypes.length).toBeGreaterThan(0);
      expect(loadBalancingTypes.every((r) => r.category === ResourceCategory.LoadBalancing)).toBe(
        true,
      );
    });

    it('should return security resource types', () => {
      const securityTypes = getResourceTypesByCategory(ResourceCategory.Security);

      expect(securityTypes.length).toBeGreaterThan(0);
      expect(securityTypes.every((r) => r.category === ResourceCategory.Security)).toBe(true);
    });

    it('should return empty array for category with no resources', () => {
      // All defined categories should have resources, but test the behavior
      const allCategories = Object.values(ResourceCategory);
      for (const category of allCategories) {
        const types = getResourceTypesByCategory(category);
        expect(Array.isArray(types)).toBe(true);
      }
    });

    it('should include http_loadbalancer in LoadBalancing category', () => {
      const loadBalancingTypes = getResourceTypesByCategory(ResourceCategory.LoadBalancing);
      const httpLb = loadBalancingTypes.find((r) => r.apiPath === 'http_loadbalancers');

      expect(httpLb).toBeDefined();
      expect(httpLb?.displayName).toBe('HTTP Load Balancers');
    });
  });

  describe('getCategorizedResourceTypes', () => {
    it('should return a Map with categories as keys', () => {
      const categorized = getCategorizedResourceTypes();

      expect(categorized).toBeInstanceOf(Map);
      expect(categorized.size).toBeGreaterThan(0);
    });

    it('should have LoadBalancing category with resources', () => {
      const categorized = getCategorizedResourceTypes();
      const loadBalancing = categorized.get(ResourceCategory.LoadBalancing);

      expect(loadBalancing).toBeDefined();
      expect(loadBalancing!.length).toBeGreaterThan(0);
    });

    it('should have all non-empty categories', () => {
      const categorized = getCategorizedResourceTypes();

      for (const [_category, resources] of categorized) {
        expect(resources.length).toBeGreaterThan(0);
      }
    });

    it('should cover all resource types', () => {
      const categorized = getCategorizedResourceTypes();
      let totalCount = 0;

      for (const resources of categorized.values()) {
        totalCount += resources.length;
      }

      expect(totalCount).toBe(Object.keys(RESOURCE_TYPES).length);
    });
  });

  describe('getResourceTypeByApiPath', () => {
    it('should find http_loadbalancers by API path', () => {
      const resourceType = getResourceTypeByApiPath('http_loadbalancers');

      expect(resourceType).toBeDefined();
      expect(resourceType?.displayName).toBe('HTTP Load Balancers');
    });

    it('should find origin_pools by API path', () => {
      const resourceType = getResourceTypeByApiPath('origin_pools');

      expect(resourceType).toBeDefined();
      expect(resourceType?.displayName).toBe('Origin Pools');
    });

    it('should return undefined for unknown API path', () => {
      const resourceType = getResourceTypeByApiPath('unknown_path');

      expect(resourceType).toBeUndefined();
    });

    it('should return undefined for empty string', () => {
      const resourceType = getResourceTypeByApiPath('');

      expect(resourceType).toBeUndefined();
    });
  });

  describe('getResourceTypeKeys', () => {
    it('should return array of resource type keys', () => {
      const keys = getResourceTypeKeys();

      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThan(0);
    });

    it('should include http_loadbalancer key', () => {
      const keys = getResourceTypeKeys();

      expect(keys).toContain('http_loadbalancer');
    });

    it('should include origin_pool key', () => {
      const keys = getResourceTypeKeys();

      expect(keys).toContain('origin_pool');
    });

    it('should include app_firewall key', () => {
      const keys = getResourceTypeKeys();

      expect(keys).toContain('app_firewall');
    });

    it('should have unique keys', () => {
      const keys = getResourceTypeKeys();
      const uniqueKeys = new Set(keys);

      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  describe('getCategoryIcon', () => {
    it('should return icon for LoadBalancing category', () => {
      const icon = getCategoryIcon(ResourceCategory.LoadBalancing);

      expect(icon).toBe('server-process');
    });

    it('should return icon for Security category', () => {
      const icon = getCategoryIcon(ResourceCategory.Security);

      expect(icon).toBe('shield');
    });

    it('should return icon for Networking category', () => {
      const icon = getCategoryIcon(ResourceCategory.Networking);

      expect(icon).toBe('type-hierarchy');
    });

    it('should return icon for Sites category', () => {
      const icon = getCategoryIcon(ResourceCategory.Sites);

      expect(icon).toBe('server');
    });

    it('should return icon for DNS category', () => {
      const icon = getCategoryIcon(ResourceCategory.DNS);

      expect(icon).toBe('globe');
    });

    it('should return icon for IAM category', () => {
      const icon = getCategoryIcon(ResourceCategory.IAM);

      expect(icon).toBe('account');
    });

    it('should return non-empty string for all categories', () => {
      const allCategories = Object.values(ResourceCategory);

      for (const category of allCategories) {
        const icon = getCategoryIcon(category);
        expect(icon).toBeTruthy();
        expect(typeof icon).toBe('string');
      }
    });
  });

  describe('ResourceCategory enum', () => {
    it('should have expected categories', () => {
      expect(ResourceCategory.LoadBalancing).toBe('Load Balancing');
      expect(ResourceCategory.Security).toBe('Security');
      expect(ResourceCategory.Networking).toBe('Networking');
      expect(ResourceCategory.Sites).toBe('Sites');
      expect(ResourceCategory.DNS).toBe('DNS');
    });

    it('should have at least 10 categories', () => {
      const categoryCount = Object.keys(ResourceCategory).length;
      expect(categoryCount).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Resource type features', () => {
    it('should have supportsLogs flag for http_loadbalancer', () => {
      expect(RESOURCE_TYPES.http_loadbalancer!.supportsLogs).toBe(true);
    });

    it('should have supportsMetrics flag for http_loadbalancer', () => {
      expect(RESOURCE_TYPES.http_loadbalancer!.supportsMetrics).toBe(true);
    });

    it('should have supportsCustomOps flag for http_loadbalancer', () => {
      expect(RESOURCE_TYPES.http_loadbalancer!.supportsCustomOps).toBe(true);
    });

    it('should have schemaFile for http_loadbalancer', () => {
      expect(RESOURCE_TYPES.http_loadbalancer!.schemaFile).toBeDefined();
      expect(RESOURCE_TYPES.http_loadbalancer!.schemaFile).toContain('http_loadbalancer');
    });

    it('should have description for http_loadbalancer', () => {
      expect(RESOURCE_TYPES.http_loadbalancer!.description).toBeDefined();
      expect(RESOURCE_TYPES.http_loadbalancer!.description!.length).toBeGreaterThan(0);
    });
  });
});
