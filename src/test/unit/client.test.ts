// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

import { F5XCClient, ListOptions } from '../../api/client';
import { ResourceTypeInfo, ResourceCategory } from '../../api/resourceTypes';

describe('F5XCClient', () => {
  describe('buildListOptions', () => {
    it('should build list options from minimal resource type info', () => {
      const resourceType: ResourceTypeInfo = {
        apiPath: 'http_loadbalancers',
        displayName: 'HTTP Load Balancers',
        category: ResourceCategory.LoadBalancing,
        icon: 'globe',
        supportsCustomOps: false,
      };

      const options = F5XCClient.buildListOptions(resourceType);

      expect(options.apiBase).toBeUndefined();
      expect(options.customListPath).toBeUndefined();
      expect(options.listMethod).toBeUndefined();
      expect(options.tenantLevel).toBeUndefined();
      expect(options.listResponseField).toBeUndefined();
      expect(options.labelFilter).toBeUndefined();
    });

    it('should build list options with all resource type fields', () => {
      const resourceType: ResourceTypeInfo = {
        apiPath: 'active_alerts',
        displayName: 'Active Alerts',
        category: ResourceCategory.Observability,
        icon: 'alert',
        supportsCustomOps: false,
        apiBase: 'web',
        customListPath: '/api/web/namespaces/{namespace}/active_alerts',
        listMethod: 'POST',
        tenantLevel: true,
        listResponseField: 'alerts',
      };

      const options = F5XCClient.buildListOptions(resourceType);

      expect(options.apiBase).toBe('web');
      expect(options.customListPath).toBe('/api/web/namespaces/{namespace}/active_alerts');
      expect(options.listMethod).toBe('POST');
      expect(options.tenantLevel).toBe(true);
      expect(options.listResponseField).toBe('alerts');
    });

    it('should include label filter when provided', () => {
      const resourceType: ResourceTypeInfo = {
        apiPath: 'origin_pools',
        displayName: 'Origin Pools',
        category: ResourceCategory.LoadBalancing,
        icon: 'server',
        supportsCustomOps: false,
      };

      const options = F5XCClient.buildListOptions(resourceType, 'env=prod');

      expect(options.labelFilter).toBe('env=prod');
    });

    it('should handle undefined label filter', () => {
      const resourceType: ResourceTypeInfo = {
        apiPath: 'app_firewalls',
        displayName: 'App Firewalls',
        category: ResourceCategory.Security,
        icon: 'shield',
        supportsCustomOps: false,
      };

      const options = F5XCClient.buildListOptions(resourceType, undefined);

      expect(options.labelFilter).toBeUndefined();
    });

    it('should handle config api base', () => {
      const resourceType: ResourceTypeInfo = {
        apiPath: 'service_policys',
        displayName: 'Service Policies',
        category: ResourceCategory.Security,
        icon: 'shield',
        supportsCustomOps: false,
        apiBase: 'config',
      };

      const options = F5XCClient.buildListOptions(resourceType);

      expect(options.apiBase).toBe('config');
    });

    it('should handle web api base', () => {
      const resourceType: ResourceTypeInfo = {
        apiPath: 'namespaces',
        displayName: 'Namespaces',
        category: ResourceCategory.IAM,
        icon: 'folder',
        supportsCustomOps: false,
        apiBase: 'web',
      };

      const options = F5XCClient.buildListOptions(resourceType);

      expect(options.apiBase).toBe('web');
    });
  });
});

describe('ListOptions interface', () => {
  it('should allow all properties to be optional', () => {
    const options: ListOptions = {};
    expect(options.apiBase).toBeUndefined();
    expect(options.customListPath).toBeUndefined();
    expect(options.listMethod).toBeUndefined();
    expect(options.tenantLevel).toBeUndefined();
    expect(options.listResponseField).toBeUndefined();
    expect(options.labelFilter).toBeUndefined();
  });

  it('should allow GET list method', () => {
    const options: ListOptions = { listMethod: 'GET' };
    expect(options.listMethod).toBe('GET');
  });

  it('should allow POST list method', () => {
    const options: ListOptions = { listMethod: 'POST' };
    expect(options.listMethod).toBe('POST');
  });

  it('should allow config api base', () => {
    const options: ListOptions = { apiBase: 'config' };
    expect(options.apiBase).toBe('config');
  });

  it('should allow web api base', () => {
    const options: ListOptions = { apiBase: 'web' };
    expect(options.apiBase).toBe('web');
  });
});
