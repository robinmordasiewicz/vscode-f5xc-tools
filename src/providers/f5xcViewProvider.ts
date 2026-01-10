// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

import * as vscode from 'vscode';
import { ProfileManager } from '../config/profiles';
import { RESOURCE_TYPES, ResourceTypeInfo } from '../api/resourceTypes';
import { getLogger } from '../utils/logger';
import { filterResource, getFilterOptionsForViewMode, ViewMode } from '../utils/resourceFilter';

const logger = getLogger();

/**
 * Get the current view mode from settings
 */
function getViewMode(): ViewMode {
  return vscode.workspace.getConfiguration('f5xc').get<ViewMode>('viewMode', 'console');
}

/**
 * Parsed F5 XC View URI components
 */
interface F5XCViewUri {
  profileName: string;
  namespace: string;
  resourceType: string;
  resourceName: string;
}

/**
 * Read-only TextDocumentContentProvider for viewing F5 XC resources.
 * Uses f5xc-view:// scheme to display resources without edit capability.
 *
 * URI format: f5xc-view://profile/namespace/resourceType/resourceName.json
 */
export class F5XCViewProvider implements vscode.TextDocumentContentProvider {
  private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  // Cache for resource content
  private readonly contentCache = new Map<string, string>();

  constructor(private readonly profileManager: ProfileManager) {}

  /**
   * Parse an F5 XC View URI into its components
   */
  private parseUri(uri: vscode.Uri): F5XCViewUri {
    // URI format: f5xc-view://profile/namespace/resourceType/resourceName.json
    const profileName = uri.authority;
    const parts = uri.path.split('/').filter((p) => p.length > 0);

    if (!profileName || parts.length !== 3) {
      throw new Error(
        `Invalid F5 XC View URI format: ${uri.toString()}. Expected: f5xc-view://profile/namespace/resourceType/resourceName.json`,
      );
    }

    const namespace = parts[0] as string;
    const resourceType = parts[1] as string;
    const resourceNameWithExt = parts[2] as string;
    const resourceName = resourceNameWithExt.replace(/\.json$/, '');

    return { profileName, namespace, resourceType, resourceName };
  }

  /**
   * Create an F5 XC View URI from components
   */
  static createUri(
    profileName: string,
    namespace: string,
    resourceType: string,
    resourceName: string,
  ): vscode.Uri {
    return vscode.Uri.parse(
      `f5xc-view://${profileName}/${namespace}/${resourceType}/${resourceName}.json`,
    );
  }

  /**
   * Find ResourceTypeInfo by API path
   */
  private findResourceTypeInfo(apiPath: string): ResourceTypeInfo | undefined {
    for (const [, info] of Object.entries(RESOURCE_TYPES)) {
      if (info.apiPath === apiPath) {
        return info;
      }
    }
    return undefined;
  }

  /**
   * Provide content for the virtual document
   */
  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const cacheKey = uri.toString();

    // Return cached content if available
    if (this.contentCache.has(cacheKey)) {
      return this.contentCache.get(cacheKey)!;
    }

    try {
      const { profileName, namespace, resourceType, resourceName } = this.parseUri(uri);

      logger.debug(`Loading view content for: ${resourceName} (${resourceType})`);

      const client = await this.profileManager.getClient(profileName);
      const resourceTypeInfo = this.findResourceTypeInfo(resourceType);
      const apiBase = resourceTypeInfo?.apiBase || 'config';

      const resource = await client.getWithOptions(namespace, resourceType, resourceName, {
        apiBase,
        customGetPath: resourceTypeInfo?.customGetPath,
      });

      // Apply view mode filtering
      const viewMode = getViewMode();
      const filterOptions = getFilterOptionsForViewMode(viewMode);
      const filteredResource = filterResource(
        resource as unknown as Record<string, unknown>,
        filterOptions,
      );

      const content = JSON.stringify(filteredResource, null, 2);

      // Cache the content
      this.contentCache.set(cacheKey, content);

      return content;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load view content: ${message}`);
      return JSON.stringify({ error: `Failed to load resource: ${message}` }, null, 2);
    }
  }

  /**
   * Refresh content for a URI (clears cache and triggers reload)
   */
  refresh(uri: vscode.Uri): void {
    this.contentCache.delete(uri.toString());
    this._onDidChange.fire(uri);
  }

  /**
   * Clear all cached content
   */
  clearCache(): void {
    this.contentCache.clear();
  }

  dispose(): void {
    this._onDidChange.dispose();
    this.contentCache.clear();
  }
}
