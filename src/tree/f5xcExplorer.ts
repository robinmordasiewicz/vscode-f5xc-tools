// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

import * as vscode from 'vscode';
import { ProfileManager, Profile } from '../config/profiles';
import { F5XCClient } from '../api/client';
import {
  RESOURCE_TYPES,
  getCategorizedResourceTypesForNamespace,
  getCategoryIcon,
  ResourceTypeInfo,
  isResourceTypeAvailableForNamespace,
  BUILT_IN_NAMESPACES,
  isBuiltInNamespace,
  getDangerLevel,
  getOperationPurpose,
  getPrerequisites,
  getCommonErrors,
  isResourceTypePreview,
  getResourceTypeTierRequirement,
  getResourceDomain,
} from '../api/resourceTypes';
import {
  getDomainsForCategory,
  getDomainMetadata,
  getDomainComplexity,
  getDomainUseCases,
  UiCategory,
} from '../generated/domainCategories';
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
  private readonly clientFactory: (profile: Profile) => Promise<F5XCClient>;
  private readonly logger = getLogger();

  constructor(
    profileManager: ProfileManager,
    clientFactory: (profile: Profile) => Promise<F5XCClient>,
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

  /**
   * Convert error to user-friendly message
   */
  private getErrorMessage(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('timeout')) {
      return 'Connection timed out. Check your network connection or VPN status.';
    }
    if (message.includes('socket hang up') || message.includes('econnrefused')) {
      return 'Could not connect to API. The endpoint may be unreachable or VPN may be required.';
    }
    if (message.includes('401') || message.includes('unauthorized')) {
      return 'Authentication failed. Your API token may be invalid or expired.';
    }
    if (message.includes('403') || message.includes('forbidden')) {
      return 'Access denied. You may not have permission to access this resource.';
    }
    if (message.includes('certificate')) {
      return 'Certificate error. Check your P12 certificate configuration.';
    }

    return error.message || 'An unknown error occurred';
  }

  private async getRootItems(): Promise<F5XCTreeItem[]> {
    const activeProfile = await this.profileManager.getActiveProfile();

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
            true, // isBuiltIn
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
            false, // isBuiltIn
          ),
        );
      }

      return groups;
    } catch (error) {
      this.logger.error('Failed to load namespaces', error as Error);
      const errorMessage = this.getErrorMessage(error as Error);
      return [new ErrorNode('Failed to load namespaces', errorMessage)];
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
    private readonly clientFactory: (profile: Profile) => Promise<F5XCClient>,
    private readonly profileManager: ProfileManager,
    private readonly icon: string,
    private readonly isBuiltIn: boolean,
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
            { name, profileName: this.profileName, isBuiltIn: this.isBuiltIn },
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
export class NamespaceNode implements F5XCTreeItem {
  constructor(
    private readonly data: NamespaceNodeData,
    private readonly clientFactory: (profile: Profile) => Promise<F5XCClient>,
    private readonly profileManager: ProfileManager,
  ) {}

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.data.name, vscode.TreeItemCollapsibleState.Collapsed);
    // Use differentiated context value for built-in vs custom namespaces
    item.contextValue = this.data.isBuiltIn
      ? TreeItemContext.NAMESPACE_BUILTIN
      : TreeItemContext.NAMESPACE_CUSTOM;
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

  /**
   * Get namespace node data for command handlers
   */
  getData(): NamespaceNodeData {
    return this.data;
  }
}

/**
 * Category node (Load Balancing, Security, etc.)
 */
class CategoryNode implements F5XCTreeItem {
  constructor(
    private readonly data: CategoryNodeData,
    private readonly clientFactory: (profile: Profile) => Promise<F5XCClient>,
    private readonly profileManager: ProfileManager,
  ) {}

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.data.category, vscode.TreeItemCollapsibleState.Collapsed);
    item.contextValue = TreeItemContext.CATEGORY;
    item.iconPath = new vscode.ThemeIcon(getCategoryIcon(this.data.category));

    // Build enhanced tooltip with domain descriptions
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${this.data.category}**\n\n`);

    // Get domains in this category and show their descriptions
    const domainsInCategory = getDomainsForCategory(this.data.category as UiCategory);
    if (domainsInCategory.length > 0) {
      // Show up to 3 domains with their icons and descriptions
      for (const domain of domainsInCategory.slice(0, 3)) {
        const meta = getDomainMetadata(domain);
        if (meta) {
          tooltip.appendMarkdown(
            `${meta.icon} **${meta.title.replace(/^F5 XC /, '').replace(/ API$/, '')}**\n`,
          );
          tooltip.appendMarkdown(`${meta.description_short}\n\n`);
        }
      }
      if (domainsInCategory.length > 3) {
        tooltip.appendMarkdown(`*...and ${domainsInCategory.length - 3} more*\n`);
      }
    } else {
      tooltip.appendMarkdown(`${this.data.category} resources`);
    }

    item.tooltip = tooltip;
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
    private readonly clientFactory: (profile: Profile) => Promise<F5XCClient>,
    private readonly profileManager: ProfileManager,
  ) {}

  getTreeItem(): vscode.TreeItem {
    // Check for preview status
    const isPreview = isResourceTypePreview(this.data.resourceTypeKey);
    const tierRequirement = getResourceTypeTierRequirement(this.data.resourceTypeKey);

    // Add preview badge to display name if applicable
    const displayName = isPreview
      ? `${this.data.resourceType.displayName} 🧪`
      : this.data.resourceType.displayName;

    const item = new vscode.TreeItem(displayName, vscode.TreeItemCollapsibleState.Collapsed);
    item.contextValue = `${TreeItemContext.RESOURCE_TYPE}:${this.data.resourceTypeKey}`;
    item.iconPath = new vscode.ThemeIcon(this.data.resourceType.icon);

    // Build enhanced tooltip with resource type information
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${this.data.resourceType.displayName}**`);
    if (isPreview) {
      tooltip.appendMarkdown(' 🧪 *(Preview)*');
    }
    tooltip.appendMarkdown('\n\n');

    if (this.data.resourceType.description) {
      tooltip.appendMarkdown(`${this.data.resourceType.description}\n\n`);
    }
    tooltip.appendMarkdown(`**Category**: ${this.data.resourceType.category}\n\n`);

    // Add tier requirement if applicable
    if (tierRequirement) {
      tooltip.appendMarkdown(`**Requires**: ${tierRequirement} tier\n\n`);
    }

    // Add complexity level from domain metadata
    const domain = getResourceDomain(this.data.resourceTypeKey);
    if (domain) {
      const complexity = getDomainComplexity(domain);
      if (complexity) {
        const complexityLabel = complexity.charAt(0).toUpperCase() + complexity.slice(1);
        const complexityIcon =
          complexity === 'expert' ? '🔴' : complexity === 'advanced' ? '🟡' : '🟢';
        tooltip.appendMarkdown(`**Complexity**: ${complexityIcon} ${complexityLabel}\n\n`);
      }

      // Add use cases (show first 3)
      const useCases = getDomainUseCases(domain);
      if (useCases.length > 0) {
        tooltip.appendMarkdown(`---\n\n**Use Cases:**\n\n`);
        for (const useCase of useCases.slice(0, 3)) {
          tooltip.appendMarkdown(`• ${useCase}\n`);
        }
        tooltip.appendMarkdown(`\n`);
      }
    }

    // Add operation information
    const listPurpose = getOperationPurpose(this.data.resourceTypeKey, 'list');
    const createPurpose = getOperationPurpose(this.data.resourceTypeKey, 'create');
    const deleteDanger = getDangerLevel(this.data.resourceTypeKey, 'delete');

    tooltip.appendMarkdown(`---\n\n`);
    tooltip.appendMarkdown(`**Available Operations:**\n\n`);
    if (listPurpose) {
      tooltip.appendMarkdown(`- List: ${listPurpose}\n`);
    }
    if (createPurpose) {
      tooltip.appendMarkdown(`- Create: ${createPurpose}\n`);
    }
    const dangerIcon = deleteDanger === 'high' ? '⚠️' : deleteDanger === 'medium' ? '⚡' : '✓';
    tooltip.appendMarkdown(
      `- Delete: ${dangerIcon} ${deleteDanger === 'high' ? 'High Risk' : deleteDanger === 'medium' ? 'Medium' : 'Low'}\n`,
    );

    // Add prerequisites from create operation
    const createPrereqs = getPrerequisites(this.data.resourceTypeKey, 'create');
    if (createPrereqs.length > 0) {
      tooltip.appendMarkdown(`\n**Prerequisites**: ${createPrereqs.join(', ')}\n`);
    }

    // Add domain context if available
    if (domain) {
      const domainMeta = getDomainMetadata(domain);
      if (domainMeta) {
        tooltip.appendMarkdown(`\n---\n\n`);
        tooltip.appendMarkdown(
          `${domainMeta.icon} *Domain: ${domainMeta.title.replace(/^F5 XC /, '').replace(/ API$/, '')}*\n`,
        );
      }
    }

    item.tooltip = tooltip;
    return item;
  }

  async getChildren(): Promise<F5XCTreeItem[]> {
    try {
      const profile = await this.profileManager.getProfile(this.data.profileName);
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

      return (
        resources
          .map((resource) => {
            // Handle multiple possible response structures from F5 XC API
            // The API may return: { metadata: { name } }, { name }, { get_spec: { name } }, etc.
            const resourceAny = resource as unknown as Record<string, unknown>;
            const metadata = resourceAny.metadata as Record<string, unknown> | undefined;
            const getSpec = resourceAny.get_spec as Record<string, unknown> | undefined;
            const objectData = resourceAny.object as Record<string, unknown> | undefined;
            const objectMetadata = objectData?.metadata as Record<string, unknown> | undefined;
            const getSpecMetadata = getSpec?.metadata as Record<string, unknown> | undefined;

            const name =
              (metadata?.name as string) ||
              (resourceAny.name as string) ||
              (resourceAny.userName as string) || // SCIM format
              (resourceAny.displayName as string) || // SCIM format fallback
              (getSpec?.name as string) ||
              (objectMetadata?.name as string) ||
              (getSpecMetadata?.name as string) ||
              'unknown';

            // Get resource's actual namespace from metadata - check multiple locations
            // Do NOT fallback to current namespace as that defeats the filter
            const resourceNamespace =
              (metadata?.namespace as string) ||
              (objectMetadata?.namespace as string) ||
              (getSpecMetadata?.namespace as string) ||
              (resourceAny.namespace as string) ||
              (getSpec?.namespace as string) ||
              null; // No fallback - if we can't find it, we'll log and exclude

            // Debug: log namespace detection for troubleshooting
            this.logger.debug(
              `Resource "${name}" namespace detection: found="${resourceNamespace}", expected="${this.data.namespace}", keys=[${Object.keys(resourceAny).join(', ')}]`,
            );

            if (name === 'unknown') {
              this.logger.warn(
                `Could not extract name from resource. Keys: ${Object.keys(resourceAny).join(', ')}`,
              );
            }

            return {
              name,
              resourceNamespace,
              metadata: metadata || objectMetadata || {},
              fullResourceData: resourceAny, // Store full data for resources without GET endpoint
            };
          })
          // Filter out resources from different namespaces (e.g., shared namespace resources
          // showing up in other namespace listings)
          // If namespace couldn't be determined (null), exclude the resource to be safe
          // Skip filtering for resources that use non-standard APIs without namespace metadata (e.g., SCIM)
          .filter((r) => {
            if (this.data.resourceType.skipNamespaceFilter) {
              return true;
            }
            return r.resourceNamespace === this.data.namespace;
          })
          .map((r) => {
            return new ResourceNode({
              name: r.name,
              namespace: this.data.namespace,
              resourceType: this.data.resourceType,
              resourceTypeKey: this.data.resourceTypeKey,
              profileName: this.data.profileName,
              metadata: r.metadata,
              fullResourceData: this.data.resourceType.useListDataForDescribe
                ? r.fullResourceData
                : undefined,
            });
          })
      );
    } catch (error) {
      this.logger.error(`Failed to load ${this.data.resourceType.displayName}`, error as Error);
      return [new ErrorNode('Failed to load resources', (error as Error).message)];
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

    // Build enhanced tooltip with operation metadata
    const deleteDanger = getDangerLevel(this.data.resourceTypeKey, 'delete');
    const deletePurpose = getOperationPurpose(this.data.resourceTypeKey, 'delete');
    const getPurpose = getOperationPurpose(this.data.resourceTypeKey, 'get');

    // Use MarkdownString for richer tooltip
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${this.data.resourceType.displayName}**: ${this.data.name}\n\n`);
    tooltip.appendMarkdown(`**Namespace**: ${this.data.namespace}\n\n`);
    tooltip.appendMarkdown(`**Category**: ${this.data.resourceType.category}\n\n`);
    tooltip.appendMarkdown(`---\n\n`);
    tooltip.appendMarkdown(`**Operations:**\n\n`);
    if (getPurpose) {
      tooltip.appendMarkdown(`- View: ${getPurpose}\n`);
    }
    // Show danger level with appropriate indicator
    const dangerIcon = deleteDanger === 'high' ? '⚠️' : deleteDanger === 'medium' ? '⚡' : '✓';
    const dangerText =
      deleteDanger === 'high' ? 'High Risk' : deleteDanger === 'medium' ? 'Medium' : 'Low';
    tooltip.appendMarkdown(`- Delete: ${dangerIcon} ${dangerText}`);
    if (deletePurpose) {
      tooltip.appendMarkdown(` - ${deletePurpose}`);
    }
    tooltip.appendMarkdown('\n');

    // Add common errors section (combine get and delete operations)
    const getErrors = getCommonErrors(this.data.resourceTypeKey, 'get');
    const deleteErrors = getCommonErrors(this.data.resourceTypeKey, 'delete');
    const allErrors = [...getErrors, ...deleteErrors];

    // Deduplicate by error code and show top 3
    const uniqueErrors = allErrors.filter(
      (error, index, self) => index === self.findIndex((e) => e.code === error.code),
    );

    if (uniqueErrors.length > 0) {
      tooltip.appendMarkdown(`\n---\n\n**Common Issues:**\n\n`);
      for (const error of uniqueErrors.slice(0, 3)) {
        tooltip.appendMarkdown(`• **${error.code}**: ${error.solution || error.message}\n`);
      }
    }

    item.tooltip = tooltip;
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

/**
 * Error node for displaying connection/API errors in the tree
 */
class ErrorNode implements F5XCTreeItem {
  constructor(
    private readonly title: string,
    private readonly message: string,
    private readonly retryCommand: string = 'f5xc.refreshExplorer',
  ) {}

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.title, vscode.TreeItemCollapsibleState.None);
    item.contextValue = TreeItemContext.ERROR;
    item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('list.errorForeground'));
    item.description = 'Click to retry';
    item.tooltip = this.message;
    item.command = {
      command: this.retryCommand,
      title: 'Retry',
    };
    return item;
  }

  getChildren(): Promise<F5XCTreeItem[]> {
    return Promise.resolve([]);
  }
}
