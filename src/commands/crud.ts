import * as vscode from 'vscode';
import { F5XCExplorerProvider, ResourceNode } from '../tree/f5xcExplorer';
import { ProfileManager } from '../config/profiles';
import { F5XCFileSystemProvider } from '../providers/f5xcFileSystemProvider';
import { F5XCViewProvider } from '../providers/f5xcViewProvider';
import { F5XCDescribeProvider } from '../providers/f5xcDescribeProvider';
import { withErrorHandling, showInfo, showWarning } from '../utils/errors';
import { getLogger } from '../utils/logger';
import { RESOURCE_TYPES, getResourceTypeByApiPath } from '../api/resourceTypes';
import { filterResource, getFilterOptionsForViewMode, ViewMode } from '../utils/resourceFilter';
import { ResourceNodeData } from '../tree/treeTypes';

const logger = getLogger();

/**
 * Data passed from webview when clicking "Edit Configuration"
 */
interface WebviewResourceData {
  profileName: string;
  namespace: string;
  resourceType: string; // apiPath from describe view
  resourceName: string;
}

/**
 * Type guard to check if argument is a ResourceNode (has getData method)
 */
function isResourceNode(arg: unknown): arg is ResourceNode {
  return (
    typeof arg === 'object' &&
    arg !== null &&
    'getData' in arg &&
    typeof (arg as ResourceNode).getData === 'function'
  );
}

/**
 * Get the current view mode from settings
 */
function getViewMode(): ViewMode {
  return vscode.workspace.getConfiguration('f5xc').get<ViewMode>('viewMode', 'console');
}

/**
 * Register CRUD commands for F5 XC resources
 */
export function registerCrudCommands(
  context: vscode.ExtensionContext,
  explorer: F5XCExplorerProvider,
  profileManager: ProfileManager,
  fsProvider: F5XCFileSystemProvider,
  viewProvider: F5XCViewProvider,
  describeProvider: F5XCDescribeProvider,
): void {
  // GET - View resource as JSON (read-only)
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.get', async (node: ResourceNode) => {
      await withErrorHandling(async () => {
        const data = node.getData();
        const profile = profileManager.getProfile(data.profileName);

        if (!profile) {
          showWarning(`Profile "${data.profileName}" not found`);
          return;
        }

        // Create f5xc-view:// URI for read-only viewing
        const uri = F5XCViewProvider.createUri(
          data.profileName,
          data.namespace,
          data.resourceType.apiPath,
          data.name,
        );

        // Refresh the content to ensure fresh data
        viewProvider.refresh(uri);

        // Open the document using the f5xc-view:// content provider
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: false });

        const viewMode = getViewMode();
        logger.info(`Viewing resource: ${data.name} (view mode: ${viewMode})`);
      }, 'View resource');
    }),
  );

  // DESCRIBE - Show formatted resource description in WebView
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.describe', async (node: ResourceNode) => {
      await withErrorHandling(async () => {
        const data = node.getData();

        await describeProvider.showDescribe(
          data.profileName,
          data.namespace,
          data.resourceType.apiPath,
          data.name,
        );

        logger.info(`Describing resource: ${data.name}`);
      }, 'Describe resource');
    }),
  );

  // EDIT - Open resource for editing using f5xc:// virtual file system
  // Supports both ResourceNode (from tree view) and WebviewResourceData (from describe webview)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'f5xc.edit',
      async (arg: ResourceNode | WebviewResourceData) => {
        await withErrorHandling(async () => {
          let data: ResourceNodeData;

          if (isResourceNode(arg)) {
            // Called from tree view with ResourceNode
            data = arg.getData();
          } else {
            // Called from webview with plain object
            const resourceType = getResourceTypeByApiPath(arg.resourceType);
            if (!resourceType) {
              showWarning(`Unknown resource type: ${arg.resourceType}`);
              return;
            }

            // Find the resourceTypeKey from RESOURCE_TYPES
            const resourceTypeKey = Object.entries(RESOURCE_TYPES).find(
              ([, info]) => info.apiPath === arg.resourceType,
            )?.[0];

            if (!resourceTypeKey) {
              showWarning(`Could not find resource type key for: ${arg.resourceType}`);
              return;
            }

            data = {
              name: arg.resourceName,
              namespace: arg.namespace,
              resourceType: resourceType,
              resourceTypeKey: resourceTypeKey,
              profileName: arg.profileName,
            };
          }

          const profile = profileManager.getProfile(data.profileName);

          if (!profile) {
            showWarning(`Profile "${data.profileName}" not found`);
            return;
          }

          // Create f5xc:// URI for the resource
          const uri = F5XCFileSystemProvider.createUri(
            data.profileName,
            data.namespace,
            data.resourceTypeKey,
            data.name,
          );

          // Clear any cached content to ensure fresh data
          fsProvider.clearCache(uri);

          // Open the document using the f5xc:// file system
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, { preview: false });

          logger.info(`Editing resource: ${data.name}`);
          showInfo(`Editing ${data.name}. Press Cmd+S to save changes to F5 XC.`);
        }, 'Edit resource');
      },
    ),
  );

  // CREATE - Create new resource from template
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.create', async (arg?: unknown) => {
      await withErrorHandling(async () => {
        // Determine resource type from context or prompt user
        let resourceTypeKey: string | undefined;
        let namespace = 'default';

        // If called from tree view with resource type context
        if (arg && typeof arg === 'object' && 'getData' in arg) {
          const nodeData = (
            arg as { getData: () => { resourceTypeKey: string; namespace: string } }
          ).getData();
          resourceTypeKey = nodeData.resourceTypeKey;
          namespace = nodeData.namespace;
        }

        // If no resource type, prompt user to select
        if (!resourceTypeKey) {
          const items = Object.entries(RESOURCE_TYPES).map(([key, info]) => ({
            label: info.displayName,
            description: info.category,
            detail: info.description,
            key,
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select resource type to create',
            matchOnDescription: true,
            matchOnDetail: true,
          });

          if (!selected) {
            return;
          }

          resourceTypeKey = selected.key;
        }

        const resourceType = RESOURCE_TYPES[resourceTypeKey];
        if (!resourceType) {
          showWarning(`Unknown resource type: ${resourceTypeKey}`);
          return;
        }

        // Get namespace
        const namespaceInput = await vscode.window.showInputBox({
          prompt: 'Enter namespace',
          value: namespace,
          placeHolder: 'default',
        });

        if (!namespaceInput) {
          return;
        }

        // Create template
        const template = createResourceTemplate(resourceTypeKey, namespaceInput);
        const content = JSON.stringify(template, null, 2);

        // Create document
        const doc = await vscode.workspace.openTextDocument({
          content,
          language: 'json',
        });

        await vscode.window.showTextDocument(doc, { preview: false });
        showInfo(
          `Created template for ${resourceType.displayName}. Edit and use "F5 XC: Apply" to create.`,
        );
      }, 'Create resource');
    }),
  );

  // APPLY - Create or update resource from current editor
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.apply', async () => {
      await withErrorHandling(async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          showWarning('No active editor');
          return;
        }

        const document = editor.document;
        const content = document.getText();

        let resource: { metadata?: { name?: string; namespace?: string }; spec?: unknown };
        try {
          resource = JSON.parse(content) as typeof resource;
        } catch {
          showWarning('Invalid JSON in editor');
          return;
        }

        const namespace = resource.metadata?.namespace;
        const name = resource.metadata?.name;

        if (!namespace || !name) {
          showWarning('Resource must have metadata.namespace and metadata.name');
          return;
        }

        // Detect resource type from file name or content
        const resourceTypeKey = detectResourceType(document.fileName, resource);
        if (!resourceTypeKey) {
          showWarning(
            'Could not determine resource type. Use naming convention: *.{type}.f5xc.json',
          );
          return;
        }

        const resourceType = RESOURCE_TYPES[resourceTypeKey];
        if (!resourceType) {
          showWarning(`Unknown resource type: ${resourceTypeKey}`);
          return;
        }

        // Get active profile
        const activeProfile = profileManager.getActiveProfile();
        if (!activeProfile) {
          showWarning('No active profile. Configure a profile first.');
          return;
        }

        const client = await profileManager.getClient(activeProfile.name);
        const apiBase = resourceType.apiBase || 'config';
        const serviceSegment = resourceType.serviceSegment;

        // Try to get existing resource to determine create vs update
        let exists = false;
        try {
          await client.get(
            namespace,
            resourceType.apiPath,
            name,
            undefined,
            apiBase,
            serviceSegment,
          );
          exists = true;
        } catch {
          exists = false;
        }

        // Confirm action
        const action = exists ? 'Update' : 'Create';
        const confirm = await vscode.window.showInformationMessage(
          `${action} ${resourceType.displayName} "${name}" in namespace "${namespace}"?`,
          { modal: true },
          action,
        );

        if (confirm !== action) {
          return;
        }

        // Apply resource - cast to any since we've validated the required fields exist
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `${action === 'Update' ? 'Updating' : 'Creating'} ${name}...`,
            cancellable: false,
          },
          async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
            const resourceData = resource as any;
            if (exists) {
              await client.replace(
                namespace,
                resourceType.apiPath,
                name,
                resourceData,
                apiBase,
                serviceSegment,
              );
            } else {
              await client.create(
                namespace,
                resourceType.apiPath,
                resourceData,
                apiBase,
                serviceSegment,
              );
            }
          },
        );

        showInfo(`${action}d ${resourceType.displayName}: ${name}`);
        explorer.refresh();
      }, 'Apply resource');
    }),
  );

  // DELETE - Delete resource
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.delete', async (node: ResourceNode) => {
      await withErrorHandling(async () => {
        const data = node.getData();

        // Confirm deletion
        const confirmDelete = vscode.workspace
          .getConfiguration('f5xc')
          .get<boolean>('confirmDelete', true);

        if (confirmDelete) {
          const confirm = await vscode.window.showWarningMessage(
            `Delete ${data.resourceType.displayName} "${data.name}" from namespace "${data.namespace}"?`,
            { modal: true },
            'Delete',
          );

          if (confirm !== 'Delete') {
            return;
          }
        }

        const client = await profileManager.getClient(data.profileName);
        const apiBase = data.resourceType.apiBase || 'config';
        const serviceSegment = data.resourceType.serviceSegment;

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Deleting ${data.name}...`,
            cancellable: false,
          },
          async () => {
            await client.delete(
              data.namespace,
              data.resourceType.apiPath,
              data.name,
              false,
              apiBase,
              serviceSegment,
            );
          },
        );

        showInfo(`Deleted ${data.resourceType.displayName}: ${data.name}`);
        explorer.refresh();
      }, 'Delete resource');
    }),
  );

  // DIFF - Compare local with remote
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.diff', async (node?: ResourceNode) => {
      await withErrorHandling(async () => {
        let remoteContent: string;
        let localUri: vscode.Uri;
        let name: string;

        if (node) {
          // Called from tree view
          const data = node.getData();
          const client = await profileManager.getClient(data.profileName);
          const apiBase = data.resourceType.apiBase || 'config';
          const serviceSegment = data.resourceType.serviceSegment;
          const resource = await client.get(
            data.namespace,
            data.resourceType.apiPath,
            data.name,
            undefined,
            apiBase,
            serviceSegment,
          );
          remoteContent = JSON.stringify(resource, null, 2);
          name = data.name;

          // Check if there's an active editor with this resource
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            localUri = editor.document.uri;
          } else {
            showWarning('Open the resource in editor first to compare');
            return;
          }
        } else {
          // Called from editor
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            showWarning('No active editor');
            return;
          }

          localUri = editor.document.uri;
          const content = editor.document.getText();

          let resource: { metadata?: { name?: string; namespace?: string } };
          try {
            resource = JSON.parse(content) as typeof resource;
          } catch {
            showWarning('Invalid JSON in editor');
            return;
          }

          const namespace = resource.metadata?.namespace;
          name = resource.metadata?.name || 'unknown';

          if (!namespace || !name) {
            showWarning('Resource must have metadata.namespace and metadata.name');
            return;
          }

          const resourceTypeKey = detectResourceType(editor.document.fileName, resource);
          if (!resourceTypeKey) {
            showWarning('Could not determine resource type');
            return;
          }

          const resourceType = RESOURCE_TYPES[resourceTypeKey];
          if (!resourceType) {
            showWarning(`Unknown resource type: ${resourceTypeKey}`);
            return;
          }

          const activeProfile = profileManager.getActiveProfile();
          if (!activeProfile) {
            showWarning('No active profile');
            return;
          }

          const client = await profileManager.getClient(activeProfile.name);
          const apiBase = resourceType.apiBase || 'config';
          const serviceSegmentFromType = resourceType.serviceSegment;
          const remoteResource = await client.get(
            namespace,
            resourceType.apiPath,
            name,
            undefined,
            apiBase,
            serviceSegmentFromType,
          );
          remoteContent = JSON.stringify(remoteResource, null, 2);
        }

        // Create virtual document for remote content
        const remoteUri = vscode.Uri.parse(`f5xc-remote:${name}.json`);

        // Register content provider if not already registered
        const provider = new (class implements vscode.TextDocumentContentProvider {
          provideTextDocumentContent(): string {
            return remoteContent;
          }
        })();

        context.subscriptions.push(
          vscode.workspace.registerTextDocumentContentProvider('f5xc-remote', provider),
        );

        // Show diff
        await vscode.commands.executeCommand(
          'vscode.diff',
          remoteUri,
          localUri,
          `${name} (Remote ↔ Local)`,
        );
      }, 'Compare with remote');
    }),
  );

  // COPY NAME - Copy resource name to clipboard
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.copyName', async (node: ResourceNode) => {
      const data = node.getData();
      await vscode.env.clipboard.writeText(data.name);
      showInfo(`Copied: ${data.name}`);
    }),
  );

  // COPY AS JSON - Copy resource JSON to clipboard
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.copyAsJson', async (node: ResourceNode) => {
      await withErrorHandling(async () => {
        const data = node.getData();
        const client = await profileManager.getClient(data.profileName);
        const apiBase = data.resourceType.apiBase || 'config';
        const resource = await client.get(
          data.namespace,
          data.resourceType.apiPath,
          data.name,
          undefined,
          apiBase,
        );

        // Apply view mode filtering
        const viewMode = getViewMode();
        const filterOptions = getFilterOptionsForViewMode(viewMode);
        const filteredResource = filterResource(
          resource as unknown as Record<string, unknown>,
          filterOptions,
        );

        const json = JSON.stringify(filteredResource, null, 2);
        await vscode.env.clipboard.writeText(json);
        showInfo(`Copied ${data.name} JSON to clipboard (${viewMode} view)`);
      }, 'Copy as JSON');
    }),
  );

  // OPEN IN BROWSER - Open resource in F5 XC console
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.openInBrowser', async (node: ResourceNode) => {
      const data = node.getData();
      const profile = profileManager.getProfile(data.profileName);

      if (!profile) {
        showWarning(`Profile "${data.profileName}" not found`);
        return;
      }

      // Construct console URL
      const baseUrl = profile.apiUrl.replace('/api', '');
      const consoleUrl = `${baseUrl}/web/workspaces/default/manage/load-balancers/${data.resourceType.apiPath}/${data.name}?namespace=${data.namespace}`;

      await vscode.env.openExternal(vscode.Uri.parse(consoleUrl));
    }),
  );

  // TOGGLE VIEW MODE - Switch between console and full API views
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.toggleViewMode', async () => {
      const config = vscode.workspace.getConfiguration('f5xc');
      const currentMode = config.get<ViewMode>('viewMode', 'console');
      const newMode: ViewMode = currentMode === 'console' ? 'full' : 'console';

      await config.update('viewMode', newMode, vscode.ConfigurationTarget.Global);

      const modeDescription =
        newMode === 'console'
          ? 'Console View (clean, filtered output)'
          : 'Full API View (complete response)';
      showInfo(`Switched to ${modeDescription}`);
      logger.info(`View mode changed to: ${newMode}`);
    }),
  );
}

/**
 * Create a resource template for a given type
 */
function createResourceTemplate(resourceTypeKey: string, namespace: string): object {
  const baseTemplate = {
    metadata: {
      name: `new-${resourceTypeKey}`,
      namespace,
      labels: {},
      annotations: {},
    },
    spec: {},
  };

  // Add type-specific spec templates
  switch (resourceTypeKey) {
    case 'http_loadbalancer':
      return {
        ...baseTemplate,
        spec: {
          domains: ['example.com'],
          http: {
            dns_volterra_managed: true,
          },
          default_route_pools: [
            {
              pool: {
                tenant: '',
                namespace,
                name: 'my-origin-pool',
              },
              weight: 1,
            },
          ],
          advertise_on_public_default_vip: {},
        },
      };

    case 'origin_pool':
      return {
        ...baseTemplate,
        spec: {
          origin_servers: [
            {
              public_ip: {
                ip: '1.2.3.4',
              },
            },
          ],
          port: 443,
          use_tls: {
            use_host_header_as_sni: {},
          },
          loadbalancer_algorithm: 'LB_OVERRIDE',
        },
      };

    case 'app_firewall':
      return {
        ...baseTemplate,
        spec: {
          blocking: {},
          detection_settings: {
            signature_selection_setting: {
              default_attack_type_settings: {},
            },
          },
        },
      };

    default:
      return baseTemplate;
  }
}

/**
 * Detect resource type from filename or content
 */
function detectResourceType(fileName: string, _resource: object): string | undefined {
  // Try to extract from filename pattern: *.{type}.f5xc.json or *.{type}.json
  const patterns = [/\.([a-z_]+)\.f5xc\.json$/i, /\.([a-z_]+)\.json$/i];

  for (const pattern of patterns) {
    const match = fileName.match(pattern);
    if (match && match[1]) {
      const typeKey = match[1];
      if (RESOURCE_TYPES[typeKey]) {
        return typeKey;
      }
      // Try to find by API path
      const byApiPath = getResourceTypeByApiPath(typeKey);
      if (byApiPath) {
        const entry = Object.entries(RESOURCE_TYPES).find(([, v]) => v === byApiPath);
        if (entry) {
          return entry[0];
        }
      }
    }
  }

  return undefined;
}
