import * as vscode from 'vscode';
import { ProfileManager, F5XCProfile } from '../config/profiles';
import { F5XCClient } from '../api/client';
import {
  RESOURCE_TYPES,
  getCategorizedResourceTypesForNamespace,
  getCategoryIcon,
  ResourceTypeInfo,
  isResourceTypeAvailableForNamespace,
  BUILT_IN_NAMESPACES,
  isBuiltInNamespace,
} from '../api/resourceTypes';
import { getLogger } from '../utils/logger';
import {
  F5XCTreeItem,
  TreeItemContext,
  NamespaceNodeData,
  CategoryNodeData,
  ResourceTypeNodeData,
  ResourceNodeData,
} from './treeTypes';

/**
 * Tree data provider for the F5 XC Explorer view
 */
export class F5XCExplorerProvider implements vscode.TreeDataProvider<F5XCTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<F5XCTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly profileManager: ProfileManager;
  private readonly clientFactory: (profile: F5XCProfile) => Promise<F5XCClient>;
  private readonly logger = getLogger();

  constructor(
    profileManager: ProfileManager,
    clientFactory: (profile: F5XCProfile) => Promise<F5XCClient>,
  ) {
    this.profileManager = profileManager;
    this.clientFactory = clientFactory;
  }

  getTreeItem(element: F5XCTreeItem): vscode.TreeItem {
    return element.getTreeItem();
  }

  async getChildren(element?: F5XCTreeItem): Promise<F5XCTreeItem[]> {
    if (!element) {
      return this.getRootItems();
    }
    return element.getChildren();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  private async getRootItems(): Promise<F5XCTreeItem[]> {
    const activeProfile = this.profileManager.getActiveProfile();

    if (!activeProfile) {
      return [];
    }

    try {
      const client = await this.clientFactory(activeProfile);
      const namespaces = await client.listNamespaces();

      // Separate built-in and custom namespaces using generated constants
      const builtInNs = namespaces.filter((ns) => isBuiltInNamespace(ns.name));
      const customNamespaces = namespaces.filter((ns) => !isBuiltInNamespace(ns.name));

      // Sort built-in namespaces in the specified order
      const builtInOrder: string[] = [...BUILT_IN_NAMESPACES];
      builtInNs.sort((a, b) => builtInOrder.indexOf(a.name) - builtInOrder.indexOf(b.name));

      // Sort custom namespaces alphabetically
      customNamespaces.sort((a, b) => a.name.localeCompare(b.name));

      const groups: F5XCTreeItem[] = [];

      // Add built-in namespaces group if any exist
      if (builtInNs.length > 0) {
        groups.push(
          new NamespaceGroupNode(
            'Built-in Namespaces',
            builtInNs.map((ns) => ns.name),
            activeProfile.name,
            this.clientFactory,
            this.profileManager,
            'symbol-namespace',
          ),
        );
      }

      // Add custom namespaces group if any exist
      if (customNamespaces.length > 0) {
        groups.push(
          new NamespaceGroupNode(
            'Custom Namespaces',
            customNamespaces.map((ns) => ns.name),
            activeProfile.name,
            this.clientFactory,
            this.profileManager,
            'folder-library',
          ),
        );
      }

      return groups;
    } catch (error) {
      this.logger.error('Failed to load namespaces', error as Error);
      return [];
    }
  }
}

/**
 * Namespace group node (Built-in Namespaces, Custom Namespaces)
 */
class NamespaceGroupNode implements F5XCTreeItem {
  constructor(
    private readonly groupName: string,
    private readonly namespaceNames: string[],
    private readonly profileName: string,
    private readonly clientFactory: (profile: F5XCProfile) => Promise<F5XCClient>,
    private readonly profileManager: ProfileManager,
    private readonly icon: string,
  ) {}

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.groupName, vscode.TreeItemCollapsibleState.Expanded);
    item.contextValue = TreeItemContext.NAMESPACE_GROUP;
    item.iconPath = new vscode.ThemeIcon(this.icon);
    item.tooltip = `${this.namespaceNames.length} namespaces`;
    return item;
  }

  getChildren(): Promise<F5XCTreeItem[]> {
    return Promise.resolve(
      this.namespaceNames.map(
        (name) =>
          new NamespaceNode(
            { name, profileName: this.profileName },
            this.clientFactory,
            this.profileManager,
          ),
      ),
    );
  }
}

/**
 * Namespace node in the tree
 */
class NamespaceNode implements F5XCTreeItem {
  constructor(
    private readonly data: NamespaceNodeData,
    private readonly clientFactory: (profile: F5XCProfile) => Promise<F5XCClient>,
    private readonly profileManager: ProfileManager,
  ) {}

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.data.name, vscode.TreeItemCollapsibleState.Collapsed);
    item.contextValue = TreeItemContext.NAMESPACE;
    item.iconPath = new vscode.ThemeIcon('folder');
    item.tooltip = `Namespace: ${this.data.name}`;
    return item;
  }

  getChildren(): Promise<F5XCTreeItem[]> {
    // Get categories filtered by namespace scope
    const categories = getCategorizedResourceTypesForNamespace(this.data.name);
    const nodes: F5XCTreeItem[] = [];

    for (const [category] of categories) {
      nodes.push(
        new CategoryNode(
          {
            category,
            namespace: this.data.name,
            profileName: this.data.profileName,
          },
          this.clientFactory,
          this.profileManager,
        ),
      );
    }

    return Promise.resolve(nodes);
  }
}

/**
 * Category node (Load Balancing, Security, etc.)
 */
class CategoryNode implements F5XCTreeItem {
  constructor(
    private readonly data: CategoryNodeData,
    private readonly clientFactory: (profile: F5XCProfile) => Promise<F5XCClient>,
    private readonly profileManager: ProfileManager,
  ) {}

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.data.category, vscode.TreeItemCollapsibleState.Collapsed);
    item.contextValue = TreeItemContext.CATEGORY;
    item.iconPath = new vscode.ThemeIcon(getCategoryIcon(this.data.category));
    item.tooltip = `${this.data.category} resources`;
    return item;
  }

  getChildren(): Promise<F5XCTreeItem[]> {
    // Filter by category AND namespace scope
    const types = Object.entries(RESOURCE_TYPES).filter(
      ([, info]) =>
        info.category === this.data.category &&
        isResourceTypeAvailableForNamespace(info, this.data.namespace),
    );

    return Promise.resolve(
      types.map(
        ([key, info]) =>
          new ResourceTypeNode(
            {
              resourceType: info,
              resourceTypeKey: key,
              namespace: this.data.namespace,
              profileName: this.data.profileName,
            },
            this.clientFactory,
            this.profileManager,
          ),
      ),
    );
  }
}

/**
 * Resource type node (HTTP Load Balancers, Origin Pools, etc.)
 */
class ResourceTypeNode implements F5XCTreeItem {
  private readonly logger = getLogger();

  constructor(
    private readonly data: ResourceTypeNodeData,
    private readonly clientFactory: (profile: F5XCProfile) => Promise<F5XCClient>,
    private readonly profileManager: ProfileManager,
  ) {}

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(
      this.data.resourceType.displayName,
      vscode.TreeItemCollapsibleState.Collapsed,
    );
    item.contextValue = `${TreeItemContext.RESOURCE_TYPE}:${this.data.resourceTypeKey}`;
    item.iconPath = new vscode.ThemeIcon(this.data.resourceType.icon);
    item.tooltip = this.data.resourceType.description || this.data.resourceType.displayName;
    return item;
  }

  async getChildren(): Promise<F5XCTreeItem[]> {
    try {
      const profile = this.profileManager.getProfile(this.data.profileName);
      if (!profile) {
        return [];
      }

      const client = await this.clientFactory(profile);
      const listOptions = F5XCClient.buildListOptions(this.data.resourceType);
      const resources = await client.listWithOptions(
        this.data.namespace,
        this.data.resourceType.apiPath,
        listOptions,
      );

      return resources.map((resource) => {
        // Handle multiple possible response structures from F5 XC API
        // The API may return: { metadata: { name } }, { name }, { get_spec: { name } }, etc.
        const resourceAny = resource as unknown as Record<string, unknown>;
        const metadata = resourceAny.metadata as Record<string, unknown> | undefined;
        const getSpec = resourceAny.get_spec as Record<string, unknown> | undefined;
        const objectData = resourceAny.object as Record<string, unknown> | undefined;
        const objectMetadata = objectData?.metadata as Record<string, unknown> | undefined;

        // Debug: log the actual response structure to help diagnose issues
        this.logger.debug(`Resource structure keys: ${Object.keys(resourceAny).join(', ')}`);

        const name =
          (metadata?.name as string) ||
          (resourceAny.name as string) ||
          (getSpec?.name as string) ||
          (objectMetadata?.name as string) ||
          'unknown';

        if (name === 'unknown') {
          this.logger.warn(
            `Could not extract name from resource. Keys: ${Object.keys(resourceAny).join(', ')}`,
          );
        }

        return new ResourceNode({
          name,
          namespace: this.data.namespace,
          resourceType: this.data.resourceType,
          resourceTypeKey: this.data.resourceTypeKey,
          profileName: this.data.profileName,
          metadata: metadata || objectMetadata || {},
        });
      });
    } catch (error) {
      this.logger.error(`Failed to load ${this.data.resourceType.displayName}`, error as Error);
      return [];
    }
  }

  getData(): ResourceTypeNodeData {
    return this.data;
  }
}

/**
 * Individual resource node
 */
export class ResourceNode implements F5XCTreeItem {
  constructor(private readonly data: ResourceNodeData) {}

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.data.name, vscode.TreeItemCollapsibleState.None);
    item.contextValue = `${TreeItemContext.RESOURCE}:${this.data.resourceTypeKey}`;
    item.iconPath = new vscode.ThemeIcon('file');
    item.tooltip = `${this.data.resourceType.displayName}: ${this.data.name}\nNamespace: ${this.data.namespace}\nCategory: ${this.data.resourceType.category}`;
    item.command = {
      command: 'f5xc.describe',
      title: 'Describe Resource',
      arguments: [this],
    };
    return item;
  }

  getChildren(): Promise<F5XCTreeItem[]> {
    return Promise.resolve([]); // Resources are leaf nodes
  }

  getData(): ResourceNodeData {
    return this.data;
  }

  get name(): string {
    return this.data.name;
  }

  get namespace(): string {
    return this.data.namespace;
  }

  get resourceType(): ResourceTypeInfo {
    return this.data.resourceType;
  }

  get resourceTypeKey(): string {
    return this.data.resourceTypeKey;
  }

  get profileName(): string {
    return this.data.profileName;
  }
}
