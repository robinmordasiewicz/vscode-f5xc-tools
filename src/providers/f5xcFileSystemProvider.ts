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
      const apiBase = resourceTypeInfo.apiBase || 'config';

      // Get the full resource (without GET_RSP_FORMAT_FOR_REPLACE which returns spec-only)
      const response = await client.get(
        namespace,
        resourceTypeInfo.apiPath,
        resourceName,
        undefined,
        apiBase,
      );

      // Handle different F5 XC API response structures
      const responseAny = response as unknown as Record<string, unknown>;

      // Extract metadata and spec from the response
      let metadata: Record<string, unknown> | undefined;
      let spec: Record<string, unknown> | undefined;

      if (responseAny.metadata && responseAny.spec) {
        // Direct format: { metadata, spec, ... }
        metadata = responseAny.metadata as Record<string, unknown>;
        spec = responseAny.spec as Record<string, unknown>;
      } else if (responseAny.object) {
        // Wrapped in object: { object: { metadata, spec } }
        const obj = responseAny.object as Record<string, unknown>;
        metadata = obj.metadata as Record<string, unknown>;
        spec = obj.spec as Record<string, unknown>;
      } else if (responseAny.replace_form) {
        // replace_form wrapper: { metadata: {...}, replace_form: { spec: {...} } }
        // OR: { replace_form: { metadata: {...}, spec: {...} } }
        const replaceForm = responseAny.replace_form as Record<string, unknown>;

        // Check if metadata is at root level alongside replace_form
        if (responseAny.metadata) {
          metadata = responseAny.metadata as Record<string, unknown>;
          spec = replaceForm.spec as Record<string, unknown>;
        } else if (replaceForm.metadata && replaceForm.spec) {
          // Both inside replace_form
          metadata = replaceForm.metadata as Record<string, unknown>;
          spec = replaceForm.spec as Record<string, unknown>;
        } else if (replaceForm.spec) {
          // Only spec in replace_form - construct minimal metadata from URI
          spec = replaceForm.spec as Record<string, unknown>;
          metadata = {
            name: resourceName,
            namespace: namespace,
          };
        }
      } else if (responseAny.get_spec) {
        // get_spec might contain the full resource or just spec
        const getSpec = responseAny.get_spec as Record<string, unknown>;
        if (getSpec.metadata && getSpec.spec) {
          metadata = getSpec.metadata as Record<string, unknown>;
          spec = getSpec.spec as Record<string, unknown>;
        }
      }

      // If we couldn't find metadata/spec, fail gracefully
      if (!metadata || !spec) {
        logger.error(`Failed to extract metadata/spec from API response`);
        throw new Error('API response does not contain expected metadata and spec fields');
      }

      // Build the editable resource with only metadata and spec
      const resource = { metadata, spec };

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
    let parsedContent: Record<string, unknown>;
    let text: string;
    try {
      text = new TextDecoder().decode(content);
      parsedContent = JSON.parse(text) as Record<string, unknown>;
    } catch {
      showError('Invalid JSON content');
      throw vscode.FileSystemError.NoPermissions('Invalid JSON content');
    }

    // Extract metadata and spec - the only fields needed for replace
    // Handle case where content might be wrapped in a response structure
    let metadata = parsedContent.metadata as Record<string, unknown> | undefined;
    let spec = parsedContent.spec as Record<string, unknown> | undefined;

    // If no direct metadata/spec, check for common wrapper patterns
    if (!metadata || !spec) {
      // Try common F5 XC API wrapper keys
      const wrapperKeys = ['object', 'get_spec', 'replace_spec', 'create_form', 'replace_form'];
      for (const key of wrapperKeys) {
        const wrapper = parsedContent[key] as Record<string, unknown> | undefined;
        if (wrapper && wrapper.metadata && wrapper.spec) {
          metadata = wrapper.metadata as Record<string, unknown>;
          spec = wrapper.spec as Record<string, unknown>;
          break;
        }
      }
    }

    // If still not found, try searching all top-level keys for an object with metadata/spec
    if (!metadata || !spec) {
      for (const key of Object.keys(parsedContent)) {
        const value = parsedContent[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          const obj = value as Record<string, unknown>;
          if (obj.metadata && obj.spec) {
            metadata = obj.metadata as Record<string, unknown>;
            spec = obj.spec as Record<string, unknown>;
            break;
          }
        }
      }
    }

    // Validate required fields exist
    if (!metadata) {
      showError('Resource must have a metadata field');
      throw vscode.FileSystemError.NoPermissions('Missing metadata field');
    }

    if (!spec) {
      showError('Resource must have a spec field');
      throw vscode.FileSystemError.NoPermissions('Missing spec field');
    }

    // Validate metadata matches URI
    const metadataName = metadata.name as string | undefined;
    const metadataNamespace = metadata.namespace as string | undefined;

    if (metadataName && metadataName !== resourceName) {
      showError(
        `Resource name in JSON (${metadataName}) does not match file name (${resourceName})`,
      );
      throw vscode.FileSystemError.NoPermissions('Resource name mismatch');
    }

    if (metadataNamespace && metadataNamespace !== namespace) {
      showError(`Namespace in JSON (${metadataNamespace}) does not match file path (${namespace})`);
      throw vscode.FileSystemError.NoPermissions('Namespace mismatch');
    }

    // Build the request body with only metadata and spec (strip system_metadata, status, etc.)
    const requestBody = {
      metadata,
      spec,
    } as unknown as Resource;

    // Apply to F5 XC
    try {
      const client = await this.profileManager.getClient(profileName);
      const apiBase = resourceTypeInfo.apiBase || 'config';

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
            requestBody,
            apiBase,
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
