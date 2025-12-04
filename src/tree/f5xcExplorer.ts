import * as vscode from 'vscode';
import { ProfileManager, F5XCProfile } from '../config/profiles';
import { F5XCClient } from '../api/client';
import {
  RESOURCE_TYPES,
  getCategorizedResourceTypes,
  getCategoryIcon,
  ResourceTypeInfo,
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

      return namespaces.map(
        (ns) =>
          new NamespaceNode(
            { name: ns.name, profileName: activeProfile.name },
            this.clientFactory,
            this.profileManager,
          ),
      );
    } catch (error) {
      this.logger.error('Failed to load namespaces', error as Error);
      return [];
    }
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
    const categories = getCategorizedResourceTypes();
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
    const types = Object.entries(RESOURCE_TYPES).filter(
      ([, info]) => info.category === this.data.category,
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
      const resources = await client.list(this.data.namespace, this.data.resourceType.apiPath);

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
    item.tooltip = `${this.data.resourceType.displayName}: ${this.data.name}`;
    item.command = {
      command: 'f5xc.get',
      title: 'View Resource',
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
