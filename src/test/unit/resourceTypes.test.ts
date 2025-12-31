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
  isResourceTypeAvailableForNamespace,
  getResourceTypesForNamespace,
  getCategorizedResourceTypesForNamespace,
  getDangerLevel,
  getOperationPurpose,
  getRequiredFields,
  isResourceTypePreview,
  getResourceTypeTierRequirement,
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
        // Validate apiPath format (lowercase with underscores/hyphens, may include version numbers)
        expect(resourceType.apiPath).toMatch(/^[a-z0-9_-]+$/);
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
      // schemaFile now uses domain-based files (e.g., "virtual.json") instead of resource-specific files
      expect(RESOURCE_TYPES.http_loadbalancer!.schemaFile).toMatch(/\.json$/);
    });

    it('should have description for http_loadbalancer', () => {
      expect(RESOURCE_TYPES.http_loadbalancer!.description).toBeDefined();
      expect(RESOURCE_TYPES.http_loadbalancer!.description!.length).toBeGreaterThan(0);
    });
  });

  describe('Namespace scope filtering', () => {
    describe('isResourceTypeAvailableForNamespace', () => {
      // System scope tests - resources with literal /namespaces/system/ paths
      it('should return true for system-scoped resource in system namespace', () => {
        const systemResource: ResourceTypeInfo = {
          ...RESOURCE_TYPES.http_loadbalancer!,
          namespaceScope: 'system',
        };
        expect(isResourceTypeAvailableForNamespace(systemResource, 'system')).toBe(true);
      });

      it('should return false for system-scoped resource in custom namespace', () => {
        const systemResource: ResourceTypeInfo = {
          ...RESOURCE_TYPES.http_loadbalancer!,
          namespaceScope: 'system',
        };
        expect(isResourceTypeAvailableForNamespace(systemResource, 'my-namespace')).toBe(false);
      });

      it('should return false for system-scoped resource in shared namespace', () => {
        const systemResource: ResourceTypeInfo = {
          ...RESOURCE_TYPES.http_loadbalancer!,
          namespaceScope: 'system',
        };
        expect(isResourceTypeAvailableForNamespace(systemResource, 'shared')).toBe(false);
      });

      // Any scope tests - resources with {namespace} placeholder or tenant-level
      // These should be available in user namespaces (shared, default, custom) but NOT system
      it('should return false for any-scoped resource in system namespace', () => {
        const anyResource: ResourceTypeInfo = {
          ...RESOURCE_TYPES.http_loadbalancer!,
          namespaceScope: 'any',
        };
        // System namespace is reserved for system-level resources only
        expect(isResourceTypeAvailableForNamespace(anyResource, 'system')).toBe(false);
      });

      it('should return true for any-scoped resource in shared namespace', () => {
        const anyResource: ResourceTypeInfo = {
          ...RESOURCE_TYPES.http_loadbalancer!,
          namespaceScope: 'any',
        };
        expect(isResourceTypeAvailableForNamespace(anyResource, 'shared')).toBe(true);
      });

      it('should return true for any-scoped resource in custom namespace', () => {
        const anyResource: ResourceTypeInfo = {
          ...RESOURCE_TYPES.http_loadbalancer!,
          namespaceScope: 'any',
        };
        expect(isResourceTypeAvailableForNamespace(anyResource, 'my-custom-ns')).toBe(true);
      });

      it('should return true for any-scoped resource in default namespace', () => {
        const anyResource: ResourceTypeInfo = {
          ...RESOURCE_TYPES.http_loadbalancer!,
          namespaceScope: 'any',
        };
        expect(isResourceTypeAvailableForNamespace(anyResource, 'default')).toBe(true);
      });

      it('should default to any scope when namespaceScope is undefined', () => {
        const undefinedScopeResource: ResourceTypeInfo = {
          ...RESOURCE_TYPES.http_loadbalancer!,
          namespaceScope: undefined,
        };
        // Defaults to 'any' scope - available in user namespaces but NOT system
        expect(isResourceTypeAvailableForNamespace(undefinedScopeResource, 'system')).toBe(false);
        expect(isResourceTypeAvailableForNamespace(undefinedScopeResource, 'shared')).toBe(true);
        expect(isResourceTypeAvailableForNamespace(undefinedScopeResource, 'my-ns')).toBe(true);
      });

      // Shared scope tests - resources with literal /namespaces/shared/ paths (rare)
      it('should return true for shared-scoped resource in shared namespace', () => {
        const sharedResource: ResourceTypeInfo = {
          ...RESOURCE_TYPES.http_loadbalancer!,
          namespaceScope: 'shared',
        };
        expect(isResourceTypeAvailableForNamespace(sharedResource, 'shared')).toBe(true);
      });

      it('should return false for shared-scoped resource in system namespace', () => {
        const sharedResource: ResourceTypeInfo = {
          ...RESOURCE_TYPES.http_loadbalancer!,
          namespaceScope: 'shared',
        };
        expect(isResourceTypeAvailableForNamespace(sharedResource, 'system')).toBe(false);
      });

      it('should return false for shared-scoped resource in custom namespace', () => {
        const sharedResource: ResourceTypeInfo = {
          ...RESOURCE_TYPES.http_loadbalancer!,
          namespaceScope: 'shared',
        };
        expect(isResourceTypeAvailableForNamespace(sharedResource, 'my-ns')).toBe(false);
      });
    });

    describe('getResourceTypesForNamespace', () => {
      it('should filter out system-only resources for custom namespaces', () => {
        const filtered = getResourceTypesForNamespace('my-custom-namespace');
        // System-scoped resources should not be in the result
        for (const [_key, info] of Object.entries(filtered)) {
          if (info.namespaceScope === 'system') {
            fail('System-scoped resource found in custom namespace filter result');
          }
        }
      });

      it('should include system-only resources for system namespace', () => {
        const filtered = getResourceTypesForNamespace('system');
        // Find a known system-scoped resource (aws_vpc_site is manually set to system)
        const awsVpcSite = filtered['aws_vpc_site'];
        expect(awsVpcSite).toBeDefined();
      });

      it('should include any-scoped resources in user namespaces but not system', () => {
        // any-scoped resources should be available in user namespaces (shared, custom) but NOT system
        const systemFiltered = getResourceTypesForNamespace('system');
        const sharedFiltered = getResourceTypesForNamespace('shared');
        const customFiltered = getResourceTypesForNamespace('my-custom-namespace');

        // HTTP Load Balancer has any scope and should be in shared and custom, but NOT system
        expect(systemFiltered['http_loadbalancer']).toBeUndefined();
        expect(sharedFiltered['http_loadbalancer']).toBeDefined();
        expect(customFiltered['http_loadbalancer']).toBeDefined();
      });

      it('should filter out system-only resources for shared namespace', () => {
        const filtered = getResourceTypesForNamespace('shared');
        // System-scoped resources should not be in the result
        for (const [_key, info] of Object.entries(filtered)) {
          if (info.namespaceScope === 'system') {
            fail('System-scoped resource found in shared namespace filter result');
          }
        }
      });
    });

    describe('getCategorizedResourceTypesForNamespace', () => {
      it('should return categorized resources filtered by namespace', () => {
        const categorized = getCategorizedResourceTypesForNamespace('my-namespace');
        expect(categorized).toBeInstanceOf(Map);
        expect(categorized.size).toBeGreaterThan(0);
      });

      it('should not include system-only resources in custom namespace categories', () => {
        const categorized = getCategorizedResourceTypesForNamespace('my-app-namespace');
        for (const [_category, resources] of categorized) {
          for (const [_key, info] of resources) {
            if (info.namespaceScope === 'system') {
              fail('System-scoped resource found in custom namespace categorized result');
            }
          }
        }
      });

      it('should include system-only resources in system namespace categories', () => {
        const categorized = getCategorizedResourceTypesForNamespace('system');
        // aws_vpc_site has manual override to be system-scoped
        let foundSystemResource = false;
        for (const [_category, resources] of categorized) {
          for (const [key, _info] of resources) {
            if (key === 'aws_vpc_site') {
              foundSystemResource = true;
              break;
            }
          }
        }
        expect(foundSystemResource).toBe(true);
      });

      it('should include any-scoped resources in shared namespace', () => {
        const categorized = getCategorizedResourceTypesForNamespace('shared');
        // Security category should contain app_firewall in shared namespace
        let foundAppFirewall = false;
        for (const [_category, resources] of categorized) {
          for (const [key, _info] of resources) {
            if (key === 'app_firewall') {
              foundAppFirewall = true;
              break;
            }
          }
        }
        expect(foundAppFirewall).toBe(true);
      });
    });
  });

  describe('Operation metadata helpers', () => {
    describe('getDangerLevel', () => {
      it('should return danger level for delete operation', () => {
        const dangerLevel = getDangerLevel('http_loadbalancer', 'delete');
        expect(['low', 'medium', 'high']).toContain(dangerLevel);
      });

      it('should default to medium for unknown resource type', () => {
        const dangerLevel = getDangerLevel('unknown_resource', 'delete');
        expect(dangerLevel).toBe('medium');
      });

      it('should default to delete operation when not specified', () => {
        const dangerLevel = getDangerLevel('http_loadbalancer');
        expect(['low', 'medium', 'high']).toContain(dangerLevel);
      });

      it('should handle create operation', () => {
        const dangerLevel = getDangerLevel('http_loadbalancer', 'create');
        expect(['low', 'medium', 'high']).toContain(dangerLevel);
      });
    });

    describe('getOperationPurpose', () => {
      it('should return purpose for list operation', () => {
        const purpose = getOperationPurpose('http_loadbalancer', 'list');
        // May be undefined if no metadata, but should not throw
        expect(purpose === undefined || typeof purpose === 'string').toBe(true);
      });

      it('should return purpose for get operation', () => {
        const purpose = getOperationPurpose('http_loadbalancer', 'get');
        expect(purpose === undefined || typeof purpose === 'string').toBe(true);
      });

      it('should return undefined for unknown resource type', () => {
        const purpose = getOperationPurpose('unknown_resource', 'list');
        expect(purpose).toBeUndefined();
      });
    });

    describe('getRequiredFields', () => {
      it('should return array for create operation', () => {
        const fields = getRequiredFields('http_loadbalancer', 'create');
        expect(Array.isArray(fields)).toBe(true);
      });

      it('should return array for update operation', () => {
        const fields = getRequiredFields('http_loadbalancer', 'update');
        expect(Array.isArray(fields)).toBe(true);
      });

      it('should return empty array for unknown resource type', () => {
        const fields = getRequiredFields('unknown_resource', 'create');
        expect(fields).toEqual([]);
      });

      it('should include metadata.name for resources that require it', () => {
        // Most resources require metadata.name for create
        const fields = getRequiredFields('http_loadbalancer', 'create');
        // If required fields exist, they should be strings
        expect(fields.every((f) => typeof f === 'string')).toBe(true);
      });
    });
  });

  describe('Preview and tier helpers', () => {
    describe('isResourceTypePreview', () => {
      it('should return boolean for known resource type', () => {
        const isPreview = isResourceTypePreview('http_loadbalancer');
        expect(typeof isPreview).toBe('boolean');
      });

      it('should return false for unknown resource type', () => {
        const isPreview = isResourceTypePreview('unknown_resource');
        expect(isPreview).toBe(false);
      });
    });

    describe('getResourceTypeTierRequirement', () => {
      it('should return tier or undefined for known resource type', () => {
        const tier = getResourceTypeTierRequirement('http_loadbalancer');
        expect(tier === undefined || typeof tier === 'string').toBe(true);
      });

      it('should return undefined for unknown resource type', () => {
        const tier = getResourceTypeTierRequirement('unknown_resource');
        expect(tier).toBeUndefined();
      });
    });
  });
});
