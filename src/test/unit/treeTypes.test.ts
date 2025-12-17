import { TreeItemContext } from '../../tree/treeTypes';

describe('TreeItemContext', () => {
  it('should have NAMESPACE_GROUP context', () => {
    expect(TreeItemContext.NAMESPACE_GROUP).toBe('namespaceGroup');
  });

  it('should have NAMESPACE context', () => {
    expect(TreeItemContext.NAMESPACE).toBe('namespace');
  });

  it('should have NAMESPACE_BUILTIN context', () => {
    expect(TreeItemContext.NAMESPACE_BUILTIN).toBe('namespace:builtin');
  });

  it('should have NAMESPACE_CUSTOM context', () => {
    expect(TreeItemContext.NAMESPACE_CUSTOM).toBe('namespace:custom');
  });

  it('should have CATEGORY context', () => {
    expect(TreeItemContext.CATEGORY).toBe('category');
  });

  it('should have RESOURCE_TYPE context', () => {
    expect(TreeItemContext.RESOURCE_TYPE).toBe('resourceType');
  });

  it('should have RESOURCE context', () => {
    expect(TreeItemContext.RESOURCE).toBe('resource');
  });

  it('should have SUBSCRIPTION_GROUP context', () => {
    expect(TreeItemContext.SUBSCRIPTION_GROUP).toBe('subscriptionGroup');
  });

  it('should have SUBSCRIPTION_PLAN context', () => {
    expect(TreeItemContext.SUBSCRIPTION_PLAN).toBe('subscriptionPlan');
  });

  it('should have SUBSCRIPTION_QUOTAS context', () => {
    expect(TreeItemContext.SUBSCRIPTION_QUOTAS).toBe('subscriptionQuotas');
  });

  it('should be a readonly object', () => {
    // Test that all keys are present
    const keys = Object.keys(TreeItemContext);
    expect(keys).toContain('NAMESPACE_GROUP');
    expect(keys).toContain('NAMESPACE');
    expect(keys).toContain('NAMESPACE_BUILTIN');
    expect(keys).toContain('NAMESPACE_CUSTOM');
    expect(keys).toContain('CATEGORY');
    expect(keys).toContain('RESOURCE_TYPE');
    expect(keys).toContain('RESOURCE');
    expect(keys).toContain('SUBSCRIPTION_GROUP');
    expect(keys).toContain('SUBSCRIPTION_PLAN');
    expect(keys).toContain('SUBSCRIPTION_QUOTAS');
    expect(keys).toHaveLength(10);
  });
});
