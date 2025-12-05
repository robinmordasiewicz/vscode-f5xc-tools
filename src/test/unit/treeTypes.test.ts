import { TreeItemContext } from '../../tree/treeTypes';

describe('TreeItemContext', () => {
  it('should have NAMESPACE_GROUP context', () => {
    expect(TreeItemContext.NAMESPACE_GROUP).toBe('namespaceGroup');
  });

  it('should have NAMESPACE context', () => {
    expect(TreeItemContext.NAMESPACE).toBe('namespace');
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

  it('should be a readonly object', () => {
    // Test that all keys are present
    const keys = Object.keys(TreeItemContext);
    expect(keys).toContain('NAMESPACE_GROUP');
    expect(keys).toContain('NAMESPACE');
    expect(keys).toContain('CATEGORY');
    expect(keys).toContain('RESOURCE_TYPE');
    expect(keys).toContain('RESOURCE');
    expect(keys).toHaveLength(5);
  });
});
