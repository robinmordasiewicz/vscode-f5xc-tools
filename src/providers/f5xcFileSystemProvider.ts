import * as vscode from 'vscode';
import { ProfileManager } from '../config/profiles';
import { RESOURCE_TYPES } from '../api/resourceTypes';
import { Resource } from '../api/client';
import { getLogger } from '../utils/logger';
import { showInfo, showError } from '../utils/errors';

const logger = getLogger();

/**
 * Parsed F5 XC URI components
 */
interface F5XCUri {
  profileName: string;
  namespace: string;
  resourceType: string;
  resourceName: string;
}

/**
 * Virtual file system provider for F5 XC resources.
 * Allows editing resources with Cmd+S saving directly to F5 XC API.
 *
 * URI format: f5xc://profile/namespace/resourceType/resourceName.json
 */
export class F5XCFileSystemProvider implements vscode.FileSystemProvider {
  private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this._onDidChangeFile.event;

  // Cache for file contents (content loaded when file is opened)
  private readonly fileContents = new Map<string, Uint8Array>();

  // Cache for file metadata
  private readonly fileMeta = new Map<string, { mtime: number; ctime: number }>();

  constructor(
    private readonly profileManager: ProfileManager,
    private readonly onResourceUpdated?: () => void,
  ) {}

  /**
   * Parse an F5 XC URI into its components
   */
  private parseUri(uri: vscode.Uri): F5XCUri {
    // URI format: f5xc://profile/namespace/resourceType/resourceName.json
    // The profile is in the authority, path contains namespace/resourceType/resourceName.json
    const profileName = uri.authority;
    const parts = uri.path.split('/').filter((p) => p.length > 0);

    if (!profileName || parts.length !== 3) {
      throw vscode.FileSystemError.FileNotFound(
        `Invalid F5 XC URI format: ${uri.toString()}. Expected: f5xc://profile/namespace/resourceType/resourceName.json`,
      );
    }

    const namespace = parts[0] as string;
    const resourceType = parts[1] as string;
    const resourceNameWithExt = parts[2] as string;
    const resourceName = resourceNameWithExt.replace(/\.json$/, '');

    return { profileName, namespace, resourceType, resourceName };
  }

  /**
   * Create an F5 XC URI from components
   */
  static createUri(
    profileName: string,
    namespace: string,
    resourceType: string,
    resourceName: string,
  ): vscode.Uri {
    return vscode.Uri.parse(
      `f5xc://${profileName}/${namespace}/${resourceType}/${resourceName}.json`,
    );
  }

  watch(): vscode.Disposable {
    // Not implementing file watching for remote resources
    return new vscode.Disposable(() => {});
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    const key = uri.toString();
    const meta = this.fileMeta.get(key);

    if (meta) {
      return {
        type: vscode.FileType.File,
        ctime: meta.ctime,
        mtime: meta.mtime,
        size: this.fileContents.get(key)?.length || 0,
      };
    }

    // If not in cache, it's a new file being opened
    const now = Date.now();
    return {
      type: vscode.FileType.File,
      ctime: now,
      mtime: now,
      size: 0,
    };
  }

  readDirectory(): [string, vscode.FileType][] {
    // Not implementing directory listing
    return [];
  }

  createDirectory(): void {
    // Not implementing directory creation
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const key = uri.toString();

    // Return cached content if available
    if (this.fileContents.has(key)) {
      return this.fileContents.get(key)!;
    }

    // Fetch from API
    const { profileName, namespace, resourceType, resourceName } = this.parseUri(uri);

    const resourceTypeInfo = RESOURCE_TYPES[resourceType];
    if (!resourceTypeInfo) {
      throw vscode.FileSystemError.FileNotFound(`Unknown resource type: ${resourceType}`);
    }

    try {
      const client = await this.profileManager.getClient(profileName);
      const resource = await client.get(
        namespace,
        resourceTypeInfo.apiPath,
        resourceName,
        'GET_RSP_FORMAT_FOR_REPLACE',
      );

      const content = JSON.stringify(resource, null, 2);
      const data = new TextEncoder().encode(content);

      // Cache the content
      const now = Date.now();
      this.fileContents.set(key, data);
      this.fileMeta.set(key, { ctime: now, mtime: now });

      return data;
    } catch (error) {
      const err = error as Error;
      logger.error(`Failed to read resource: ${err.message}`);
      throw vscode.FileSystemError.FileNotFound(uri);
    }
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    _options: { create: boolean; overwrite: boolean },
  ): Promise<void> {
    const { profileName, namespace, resourceType, resourceName } = this.parseUri(uri);

    const resourceTypeInfo = RESOURCE_TYPES[resourceType];
    if (!resourceTypeInfo) {
      throw vscode.FileSystemError.FileNotFound(`Unknown resource type: ${resourceType}`);
    }

    // Parse the content as JSON
    let resource: { metadata?: { name?: string; namespace?: string }; spec?: unknown };
    try {
      const text = new TextDecoder().decode(content);
      resource = JSON.parse(text) as typeof resource;
    } catch {
      showError('Invalid JSON content');
      throw vscode.FileSystemError.NoPermissions('Invalid JSON content');
    }

    // Validate metadata matches URI
    if (resource.metadata?.name && resource.metadata.name !== resourceName) {
      showError(
        `Resource name in JSON (${resource.metadata.name}) does not match file name (${resourceName})`,
      );
      throw vscode.FileSystemError.NoPermissions('Resource name mismatch');
    }

    if (resource.metadata?.namespace && resource.metadata.namespace !== namespace) {
      showError(
        `Namespace in JSON (${resource.metadata.namespace}) does not match file path (${namespace})`,
      );
      throw vscode.FileSystemError.NoPermissions('Namespace mismatch');
    }

    // Apply to F5 XC
    try {
      const client = await this.profileManager.getClient(profileName);

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Saving ${resourceName} to F5 XC...`,
          cancellable: false,
        },
        async () => {
          await client.replace(
            namespace,
            resourceTypeInfo.apiPath,
            resourceName,
            resource as Resource,
          );
        },
      );

      // Update cache
      const key = uri.toString();
      this.fileContents.set(key, content);
      this.fileMeta.set(key, {
        ctime: this.fileMeta.get(key)?.ctime || Date.now(),
        mtime: Date.now(),
      });

      showInfo(`Saved ${resourceTypeInfo.displayName}: ${resourceName}`);
      logger.info(`Saved resource to F5 XC: ${resourceName}`);

      // Notify that resource was updated (for tree refresh)
      if (this.onResourceUpdated) {
        this.onResourceUpdated();
      }
    } catch (error) {
      const err = error as Error;
      logger.error(`Failed to save resource: ${err.message}`);
      showError(`Failed to save: ${err.message}`);
      throw vscode.FileSystemError.NoPermissions(err.message);
    }
  }

  delete(uri: vscode.Uri): void {
    // Remove from cache
    const key = uri.toString();
    this.fileContents.delete(key);
    this.fileMeta.delete(key);
  }

  rename(): void {
    throw vscode.FileSystemError.NoPermissions('Renaming F5 XC resources is not supported');
  }

  /**
   * Clear cached content for a URI (useful when refreshing)
   */
  clearCache(uri?: vscode.Uri): void {
    if (uri) {
      const key = uri.toString();
      this.fileContents.delete(key);
      this.fileMeta.delete(key);
    } else {
      this.fileContents.clear();
      this.fileMeta.clear();
    }
  }
}
