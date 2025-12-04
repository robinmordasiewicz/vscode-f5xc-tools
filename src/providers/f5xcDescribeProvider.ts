import * as vscode from 'vscode';
import { ProfileManager } from '../config/profiles';
import { RESOURCE_TYPES, ResourceTypeInfo } from '../api/resourceTypes';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * WebView provider for displaying F5 XC resource descriptions.
 * Shows formatted metadata, labels, annotations, status, and spec
 * in a table-like format similar to kubectl describe output.
 */
export class F5XCDescribeProvider {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly profileManager: ProfileManager) {}

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
   * Show the describe panel for a resource
   */
  async showDescribe(
    profileName: string,
    namespace: string,
    resourceType: string,
    resourceName: string,
  ): Promise<void> {
    try {
      logger.debug(`Describing resource: ${resourceName} (${resourceType})`);

      const client = await this.profileManager.getClient(profileName);
      const resourceTypeInfo = this.findResourceTypeInfo(resourceType);
      const apiBase = resourceTypeInfo?.apiBase || 'config';
      const displayName = resourceTypeInfo?.displayName || resourceType;

      // Fetch full resource (not filtered)
      const resource = await client.get(namespace, resourceType, resourceName, undefined, apiBase);

      // Create or reveal the webview panel
      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.Beside);
      } else {
        this.panel = vscode.window.createWebviewPanel(
          'f5xcDescribe',
          `Describe: ${resourceName}`,
          vscode.ViewColumn.Beside,
          {
            enableScripts: false,
            retainContextWhenHidden: true,
          },
        );

        this.panel.onDidDispose(() => {
          this.panel = undefined;
        });
      }

      // Update panel title and content
      this.panel.title = `Describe: ${resourceName}`;
      this.panel.webview.html = this.getWebviewContent(
        resource as unknown as Record<string, unknown>,
        resourceName,
        displayName,
        namespace,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to describe resource: ${message}`);
      void vscode.window.showErrorMessage(`Failed to describe resource: ${message}`);
    }
  }

  /**
   * Generate HTML content for the webview
   */
  private getWebviewContent(
    resource: Record<string, unknown>,
    resourceName: string,
    resourceType: string,
    namespace: string,
  ): string {
    const metadata = resource.metadata as Record<string, unknown> | undefined;
    const systemMetadata = resource.system_metadata as Record<string, unknown> | undefined;
    const spec = resource.spec as Record<string, unknown> | undefined;

    const sections: string[] = [];

    // Header
    sections.push(`
      <h2>${this.escapeHtml(resourceType)}: ${this.escapeHtml(resourceName)}</h2>
    `);

    // Metadata section
    sections.push(this.renderSection('Metadata', this.renderMetadata(metadata, namespace)));

    // Labels section
    const labels = metadata?.labels as Record<string, string> | undefined;
    if (labels && Object.keys(labels).length > 0) {
      sections.push(this.renderSection('Labels', this.renderKeyValuePairs(labels)));
    }

    // Annotations section
    const annotations = metadata?.annotations as Record<string, string> | undefined;
    if (annotations && Object.keys(annotations).length > 0) {
      sections.push(this.renderSection('Annotations', this.renderKeyValuePairs(annotations)));
    }

    // System Metadata / Status section
    if (systemMetadata) {
      sections.push(this.renderSection('Status', this.renderSystemMetadata(systemMetadata)));
    }

    // Spec section (top-level fields only)
    if (spec) {
      sections.push(this.renderSection('Spec', this.renderSpec(spec)));
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
      padding: 16px;
      line-height: 1.5;
    }
    h2 {
      color: var(--vscode-editor-foreground);
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 8px;
      margin-top: 0;
    }
    .section {
      margin-bottom: 24px;
    }
    .section-header {
      font-weight: bold;
      color: var(--vscode-symbolIcon-classForeground);
      margin: 16px 0 8px;
      font-size: 1.1em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    tr {
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    tr:last-child {
      border-bottom: none;
    }
    td {
      padding: 6px 12px 6px 0;
      vertical-align: top;
    }
    .key {
      color: var(--vscode-symbolIcon-fieldForeground);
      font-weight: 500;
      width: 200px;
      white-space: nowrap;
    }
    .value {
      color: var(--vscode-editor-foreground);
      word-break: break-word;
    }
    .value-none {
      color: var(--vscode-disabledForeground);
      font-style: italic;
    }
    .nested-value {
      background-color: var(--vscode-textBlockQuote-background);
      padding: 8px;
      border-radius: 4px;
      font-family: var(--vscode-editor-font-family);
      font-size: 0.9em;
      white-space: pre-wrap;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  ${sections.join('\n')}
</body>
</html>`;
  }

  /**
   * Render a section with header
   */
  private renderSection(title: string, content: string): string {
    return `
      <div class="section">
        <div class="section-header">${this.escapeHtml(title)}</div>
        ${content}
      </div>
    `;
  }

  /**
   * Render metadata fields
   */
  private renderMetadata(metadata: Record<string, unknown> | undefined, namespace: string): string {
    const rows: string[] = [];

    rows.push(this.renderRow('Name', metadata?.name as string | undefined));
    rows.push(this.renderRow('Namespace', namespace));
    rows.push(this.renderRow('UID', metadata?.uid as string | undefined));
    rows.push(
      this.renderRow(
        'Creation Time',
        this.formatTimestamp(metadata?.creation_timestamp as string | undefined),
      ),
    );
    rows.push(this.renderRow('Creator', metadata?.creator_id as string | undefined));
    rows.push(this.renderRow('Description', metadata?.description as string | undefined));

    return `<table>${rows.join('\n')}</table>`;
  }

  /**
   * Render system metadata / status fields
   */
  private renderSystemMetadata(systemMetadata: Record<string, unknown>): string {
    const rows: string[] = [];

    rows.push(this.renderRow('State', systemMetadata.state as string | undefined));
    rows.push(
      this.renderRow(
        'Last Modified',
        this.formatTimestamp(systemMetadata.modification_timestamp as string | undefined),
      ),
    );
    rows.push(this.renderRow('Modified By', systemMetadata.modifier_id as string | undefined));
    rows.push(this.renderRow('Tenant', systemMetadata.tenant as string | undefined));

    // Object index for internal tracking
    const objectIndex = systemMetadata.object_index as number | undefined;
    if (objectIndex !== undefined) {
      rows.push(this.renderRow('Object Index', String(objectIndex)));
    }

    // Finalizers
    const finalizers = systemMetadata.finalizers as string[] | undefined;
    if (finalizers && finalizers.length > 0) {
      rows.push(this.renderRow('Finalizers', finalizers.join(', ')));
    }

    return `<table>${rows.join('\n')}</table>`;
  }

  /**
   * Render spec fields (top-level only, complex objects shown as JSON)
   */
  private renderSpec(spec: Record<string, unknown>): string {
    const rows: string[] = [];

    for (const [key, value] of Object.entries(spec)) {
      if (value === null || value === undefined) {
        continue;
      }

      const displayKey = this.formatKey(key);

      if (typeof value === 'object') {
        // Show complex objects as formatted JSON
        const jsonValue = JSON.stringify(value, null, 2);
        rows.push(this.renderRow(displayKey, jsonValue, true));
      } else {
        rows.push(this.renderRow(displayKey, String(value)));
      }
    }

    if (rows.length === 0) {
      return '<p class="value-none">No spec fields</p>';
    }

    return `<table>${rows.join('\n')}</table>`;
  }

  /**
   * Render key-value pairs (labels, annotations)
   */
  private renderKeyValuePairs(pairs: Record<string, string>): string {
    const rows: string[] = [];

    for (const [key, value] of Object.entries(pairs)) {
      rows.push(this.renderRow(key, value));
    }

    if (rows.length === 0) {
      return '<p class="value-none">None</p>';
    }

    return `<table>${rows.join('\n')}</table>`;
  }

  /**
   * Render a single table row
   */
  private renderRow(key: string, value: string | undefined, isNested = false): string {
    const displayValue =
      value !== undefined && value !== ''
        ? isNested
          ? `<div class="nested-value">${this.escapeHtml(value)}</div>`
          : this.escapeHtml(value)
        : '<span class="value-none">-</span>';

    return `
      <tr>
        <td class="key">${this.escapeHtml(key)}</td>
        <td class="value">${displayValue}</td>
      </tr>
    `;
  }

  /**
   * Format a key for display (snake_case to Title Case)
   */
  private formatKey(key: string): string {
    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format a timestamp for display
   */
  private formatTimestamp(timestamp: string | undefined): string | undefined {
    if (!timestamp) {
      return undefined;
    }

    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
  }

  /**
   * Dispose of the webview panel
   */
  dispose(): void {
    this.panel?.dispose();
  }
}
