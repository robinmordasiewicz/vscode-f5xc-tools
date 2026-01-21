// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

import * as vscode from 'vscode';
import { ProfileManager } from '../config/profiles';
import { F5XCExplorerProvider } from '../tree/f5xcExplorer';
import { F5XCDescribeProvider } from './f5xcDescribeProvider';
import { Resource } from '../api/client';
import { getLogger } from '../utils/logger';
import { showInfo, showError } from '../utils/errors';
import { getQuotaForResourceType, QuotaItem } from '../api/subscription';

const logger = getLogger();

/**
 * Healthcheck type options
 */
type HealthcheckType = 'http' | 'tcp' | 'udp_icmp';

/**
 * Host header mode options
 */
type HostHeaderMode = 'origin' | 'custom';

/**
 * Form data submitted from the webview
 */
interface HealthcheckFormData {
  name: string;
  namespace: string;
  type: HealthcheckType;
  interval: number;
  timeout: number;
  jitter: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
  // HTTP specific
  path?: string;
  hostHeaderMode?: HostHeaderMode;
  customHostHeader?: string;
  useHttp2?: boolean;
  expectedStatusCodes?: string[];
  customHeaders?: Array<{ key: string; value: string }>;
  headersToRemove?: string[];
  // TCP specific
  sendPayload?: string;
  sendPayloadHex?: boolean;
  expectedResponse?: string;
  expectedResponseHex?: boolean;
}

/**
 * Message from webview
 */
interface WebviewMessage {
  command: string;
  data?: HealthcheckFormData;
  field?: string;
  value?: unknown;
}

/**
 * WebView provider for creating F5 XC healthcheck resources via a form UI.
 * Uses the VSCode Webview UI Toolkit for consistent styling.
 */
export class HealthcheckFormProvider {
  private panel: vscode.WebviewPanel | undefined;
  private initialNamespace: string = 'default';
  private quotaInfo: QuotaItem | undefined;

  constructor(
    private readonly profileManager: ProfileManager,
    private readonly explorer: F5XCExplorerProvider,
    private readonly describeProvider: F5XCDescribeProvider,
  ) {}

  /**
   * Show the healthcheck creation form
   */
  async show(namespace?: string): Promise<void> {
    this.initialNamespace = namespace || 'default';

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'f5xcHealthcheckForm',
      'Create Healthcheck',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [], // Toolkit loaded from CDN, no local resources needed
      },
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    // Set up message handler
    this.panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      await this.handleMessage(message);
    });

    // Load namespaces and quota info
    const namespaces = await this.loadNamespaces();
    this.quotaInfo = await this.loadQuotaInfo();
    this.panel.webview.html = this.getWebviewContent(namespaces, this.quotaInfo);
  }

  /**
   * Handle messages from the webview
   */
  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.command) {
      case 'createHealthcheck':
        if (message.data) {
          await this.createHealthcheck(message.data);
        }
        break;
      case 'validateField':
        if (message.field !== undefined && message.value !== undefined) {
          this.validateField(message.field, message.value);
        }
        break;
      case 'cancel':
        this.panel?.dispose();
        break;
    }
  }

  /**
   * Load available namespaces for the dropdown
   */
  private async loadNamespaces(): Promise<string[]> {
    try {
      const activeProfile = await this.profileManager.getActiveProfile();
      if (!activeProfile) {
        return ['default'];
      }

      const client = await this.profileManager.getClient(activeProfile.name);
      const namespaces = await client.listNamespaces();
      return namespaces.map((ns) => ns.name);
    } catch (error) {
      logger.warn('Failed to load namespaces', error as Error);
      return ['default'];
    }
  }

  /**
   * Load quota information for healthchecks
   */
  private async loadQuotaInfo(): Promise<QuotaItem | undefined> {
    try {
      const activeProfile = await this.profileManager.getActiveProfile();
      if (!activeProfile) {
        return undefined;
      }

      const client = await this.profileManager.getClient(activeProfile.name);
      // Try namespace first, fallback to system
      let quota = await getQuotaForResourceType(client, 'healthchecks', this.initialNamespace);
      if (!quota) {
        quota = await getQuotaForResourceType(client, 'healthchecks', 'system');
      }
      return quota;
    } catch (error) {
      logger.warn('Failed to load quota info', error as Error);
      return undefined;
    }
  }

  /**
   * Validate a single field
   */
  private validateField(field: string, value: unknown): void {
    const errors: string[] = [];

    switch (field) {
      case 'name':
        if (typeof value === 'string') {
          if (!value.match(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/) && value.length > 1) {
            errors.push(
              'Name must be lowercase alphanumeric with hyphens, cannot start/end with hyphen',
            );
          }
        }
        break;
      case 'interval':
      case 'timeout':
        if (typeof value === 'number' && (value < 1 || value > 600)) {
          errors.push(`${field} must be between 1 and 600 seconds`);
        }
        break;
      case 'jitter':
        if (typeof value === 'number' && value !== 0 && (value < 10 || value > 50)) {
          errors.push('Jitter must be 0 or between 10 and 50');
        }
        break;
      case 'healthyThreshold':
      case 'unhealthyThreshold':
        if (typeof value === 'number' && (value < 1 || value > 16)) {
          errors.push(`${field} must be between 1 and 16`);
        }
        break;
      case 'path':
        if (typeof value === 'string' && value && !value.startsWith('/')) {
          errors.push('Path must start with /');
        }
        break;
    }

    // Send validation result back to webview
    if (this.panel) {
      void this.panel.webview.postMessage({
        command: 'validationResult',
        field,
        errors,
      });
    }
  }

  /**
   * Build the API payload from form data
   */
  private buildApiPayload(data: HealthcheckFormData): Resource<Record<string, unknown>> {
    const spec: Record<string, unknown> = {
      timeout: data.timeout,
    };

    const payload: Resource<Record<string, unknown>> = {
      metadata: {
        name: data.name,
        namespace: data.namespace,
      },
      spec,
    };

    // interval is required
    spec.interval = data.interval;

    // Add jitter if set (0 means not configured)
    if (data.jitter && data.jitter > 0) {
      spec.jitter_percent = data.jitter;
    }

    // Add thresholds
    spec.healthy_threshold = data.healthyThreshold;
    spec.unhealthy_threshold = data.unhealthyThreshold;

    // Type-specific configuration
    switch (data.type) {
      case 'http':
        spec.http_health_check = this.buildHttpConfig(data);
        break;
      case 'tcp':
        spec.tcp_health_check = this.buildTcpConfig(data);
        break;
      case 'udp_icmp':
        spec.icmp_health_check = {};
        break;
    }

    return payload;
  }

  /**
   * Build HTTP health check configuration
   */
  private buildHttpConfig(data: HealthcheckFormData): Record<string, unknown> {
    const config: Record<string, unknown> = {};

    // Path
    if (data.path) {
      config.path = data.path;
    }

    // Host header mode (mutually exclusive)
    if (data.hostHeaderMode === 'origin') {
      config.use_origin_server_name = {};
    } else if (data.hostHeaderMode === 'custom' && data.customHostHeader) {
      config.host_header = data.customHostHeader;
    }

    // HTTP/2
    if (data.useHttp2) {
      config.use_http2 = true;
    }

    // Expected status codes
    if (data.expectedStatusCodes && data.expectedStatusCodes.length > 0) {
      config.expected_status_codes = data.expectedStatusCodes;
    }

    // Custom headers
    if (data.customHeaders && data.customHeaders.length > 0) {
      config.headers = data.customHeaders.reduce(
        (acc, h) => {
          if (h.key && h.value) {
            acc[h.key] = h.value;
          }
          return acc;
        },
        {} as Record<string, string>,
      );
    }

    // Headers to remove
    if (data.headersToRemove && data.headersToRemove.length > 0) {
      config.request_headers_to_remove = data.headersToRemove;
    }

    return config;
  }

  /**
   * Build TCP health check configuration
   */
  private buildTcpConfig(data: HealthcheckFormData): Record<string, unknown> {
    const config: Record<string, unknown> = {};

    if (data.sendPayload) {
      config.send_payload = data.sendPayloadHex ? `hex:${data.sendPayload}` : data.sendPayload;
    }

    if (data.expectedResponse) {
      config.expected_response = data.expectedResponseHex
        ? `hex:${data.expectedResponse}`
        : data.expectedResponse;
    }

    return config;
  }

  /**
   * Create the healthcheck via API
   */
  private async createHealthcheck(data: HealthcheckFormData): Promise<void> {
    try {
      const activeProfile = await this.profileManager.getActiveProfile();
      if (!activeProfile) {
        showError('No active profile. Configure a profile first.');
        return;
      }

      // Build and validate payload
      const payload = this.buildApiPayload(data);
      logger.info(`Creating healthcheck: ${data.name} in namespace ${data.namespace}`);
      logger.debug('Healthcheck payload:', JSON.stringify(payload, null, 2));

      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Creating healthcheck ${data.name}...`,
          cancellable: false,
        },
        async () => {
          const client = await this.profileManager.getClient(activeProfile.name);
          await client.create(data.namespace, 'healthchecks', payload);
        },
      );

      showInfo(`Created healthcheck: ${data.name}`);
      this.explorer.refresh();
      this.panel?.dispose();

      // Show the describe view for the newly created resource
      await this.describeProvider.showDescribe(
        activeProfile.name,
        data.namespace,
        'healthchecks',
        data.name,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to create healthcheck: ${message}`);

      // Send error to webview
      if (this.panel) {
        void this.panel.webview.postMessage({
          command: 'createError',
          error: message,
        });
      }
    }
  }

  /**
   * Generate a nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
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
   * Render quota usage banner
   */
  private renderQuotaBanner(quotaInfo: QuotaItem | undefined): string {
    if (!quotaInfo) {
      return ''; // No banner if quota unavailable
    }

    const { usage, limit, percentUsed } = quotaInfo;
    const available = limit - usage;
    const isExceeded = usage >= limit;
    const isWarning = percentUsed >= 80 && !isExceeded;

    // Color based on status
    let bannerClass = 'quota-banner-ok';
    let statusIcon = '✓';
    let statusText = `${usage} of ${limit} used (${available} available)`;

    if (isExceeded) {
      bannerClass = 'quota-banner-error';
      statusIcon = '⛔';
      statusText = `Quota exceeded: ${usage}/${limit} - Cannot create new healthchecks`;
    } else if (isWarning) {
      bannerClass = 'quota-banner-warning';
      statusIcon = '⚠️';
      statusText = `Nearing limit: ${usage} of ${limit} used (${available} remaining)`;
    }

    return `
      <div class="quota-banner ${bannerClass}">
        <div class="quota-banner-content">
          <span class="quota-icon">${statusIcon}</span>
          <span class="quota-text">Healthcheck Quota: ${statusText}</span>
        </div>
        <div class="quota-progress">
          <div class="quota-progress-bar">
            <div class="quota-progress-fill" style="width: ${Math.min(percentUsed, 100)}%"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate HTML content for the webview
   */
  private getWebviewContent(namespaces: string[], quotaInfo?: QuotaItem): string {
    const nonce = this.getNonce();
    const quotaExceeded = quotaInfo ? quotaInfo.usage >= quotaInfo.limit : false;
    const cspSource = this.panel!.webview.cspSource;

    // Debug logging for CSP
    console.log('[Healthcheck] Nonce:', nonce);
    console.log('[Healthcheck] CSP Source:', cspSource);

    const csp = `default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource} https://cdn.jsdelivr.net;`;
    console.log('[Healthcheck] CSP:', csp);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource} https://cdn.jsdelivr.net;">
  <script type="module" nonce="${nonce}">
    import {
      provideVSCodeDesignSystem,
      vsCodeButton,
      vsCodeTextField,
      vsCodeDropdown,
      vsCodeOption,
      vsCodeRadio,
      vsCodeRadioGroup,
      vsCodeCheckbox
    } from 'https://cdn.jsdelivr.net/npm/@vscode/webview-ui-toolkit@1.4.0/dist/toolkit.min.js';

    provideVSCodeDesignSystem().register(
      vsCodeButton(),
      vsCodeTextField(),
      vsCodeDropdown(),
      vsCodeOption(),
      vsCodeRadio(),
      vsCodeRadioGroup(),
      vsCodeCheckbox()
    );

    console.log('[Healthcheck] Toolkit loaded from CDN');
  </script>
  <style>
    ${this.getStyles()}
  </style>
  <title>Create Healthcheck</title>
</head>
<body>
  <div class="container">
    <header class="header">
      <h1>Create Healthcheck</h1>
      <div class="header-actions">
        <vscode-button appearance="secondary" id="toggle-json-btn">Show JSON</vscode-button>
        <vscode-button appearance="primary" id="create-btn" disabled>Create</vscode-button>
      </div>
    </header>

    <div class="main-content">
      <div class="form-panel">
        <div class="form-content">
      <!-- Error Banner -->
      <div id="error-banner" class="error-banner hidden">
        <span id="error-message"></span>
        <vscode-button appearance="icon" id="close-error">
          <span class="codicon codicon-close"></span>
        </vscode-button>
      </div>

      <!-- Quota Banner -->
      ${this.renderQuotaBanner(quotaInfo)}

      <!-- Basic Settings -->
      <section class="section">
        <h2 class="section-title">Basic Settings</h2>

        <div class="field">
          <label for="name">Name *</label>
          <vscode-text-field id="name" placeholder="my-healthcheck" required></vscode-text-field>
          <span class="field-error" id="name-error"></span>
          <span class="field-hint">Lowercase alphanumeric with hyphens</span>
        </div>

        <div class="field">
          <label for="namespace">Namespace *</label>
          <vscode-dropdown id="namespace">
            ${namespaces.map((ns) => `<vscode-option value="${this.escapeHtml(ns)}"${ns === this.initialNamespace ? ' selected' : ''}>${this.escapeHtml(ns)}</vscode-option>`).join('\n            ')}
          </vscode-dropdown>
        </div>

        <div class="field">
          <label>Type</label>
          <vscode-radio-group id="type" orientation="horizontal" value="http">
            <vscode-radio value="http" checked>HTTP</vscode-radio>
            <vscode-radio value="tcp">TCP</vscode-radio>
            <vscode-radio value="udp_icmp">UDP-ICMP</vscode-radio>
          </vscode-radio-group>
        </div>
      </section>

      <!-- Timing Configuration -->
      <section class="section">
        <h2 class="section-title">Timing Configuration</h2>

        <div class="field-row">
          <div class="field">
            <label for="interval">Interval (sec)</label>
            <vscode-text-field id="interval" type="number" value="15" min="1" max="600"></vscode-text-field>
            <span class="field-hint">recommended: 15</span>
          </div>

          <div class="field">
            <label for="timeout">Timeout (sec)</label>
            <vscode-text-field id="timeout" type="number" value="3" min="1" max="600"></vscode-text-field>
            <span class="field-hint">recommended: 3</span>
          </div>

          <div class="field">
            <label for="jitter">Jitter (%)</label>
            <vscode-text-field id="jitter" type="number" value="30" min="0" max="50"></vscode-text-field>
            <span class="field-hint">0 or 10-50, recommended: 30</span>
          </div>
        </div>
      </section>

      <!-- Threshold Configuration -->
      <section class="section">
        <h2 class="section-title">Threshold Configuration</h2>

        <div class="field-row">
          <div class="field">
            <label for="healthy-threshold">Healthy Threshold</label>
            <vscode-text-field id="healthy-threshold" type="number" value="3" min="1" max="16"></vscode-text-field>
            <span class="field-hint">successes required, recommended: 3</span>
          </div>

          <div class="field">
            <label for="unhealthy-threshold">Unhealthy Threshold</label>
            <vscode-text-field id="unhealthy-threshold" type="number" value="1" min="1" max="16"></vscode-text-field>
            <span class="field-hint">failures allowed, recommended: 1</span>
          </div>
        </div>
      </section>

      <!--
        =================================================================
        HEALTHCHECK FORM DEFAULTS
        =================================================================
        IMPORTANT: All default values must match API spec recommendations
        Run "npm run validate:forms" to verify alignment

        Source: docs/specifications/api/domains/virtual.json
        Generated: src/generated/resourceTypesBase.ts (healthcheck resource)
        Validation: scripts/validate-form-defaults.ts
        =================================================================
      -->

      <!-- HTTP Settings (shown only when Type = HTTP) -->
      <section class="section type-section" id="http-section">
        <h2 class="section-title">HTTP Settings</h2>

        <div class="field">
          <label for="path">Path <span class="badge">recommended: /</span></label>
          <!-- Path default per API spec x-f5xc-recommended-value: "/" -->
          <vscode-text-field id="path" value="/" placeholder="/" required></vscode-text-field>
        </div>

        <div class="field">
          <label>Host Header Mode</label>
          <vscode-radio-group id="host-header-mode" orientation="vertical" value="origin">
            <vscode-radio value="origin" checked>Use Origin Server Name <span class="badge">recommended</span></vscode-radio>
            <vscode-radio value="custom">Custom Host Header</vscode-radio>
          </vscode-radio-group>
          <vscode-text-field id="custom-host-header" placeholder="example.com" class="nested-field" disabled></vscode-text-field>
        </div>

        <div class="field">
          <vscode-checkbox id="use-http2">Use HTTP/2</vscode-checkbox>
        </div>

        <div class="field">
          <label>Expected Status Codes <span class="badge">recommended: 200</span></label>
          <!-- Status codes default per API spec x-f5xc-recommended-value: ["200"] -->
          <div class="repeatable-list" id="status-codes-list">
            <div class="repeatable-item">
              <vscode-text-field class="status-code-input" value="200" placeholder="200"></vscode-text-field>
              <vscode-button appearance="icon" class="remove-btn" title="Remove">×</vscode-button>
            </div>
          </div>
          <vscode-button appearance="secondary" id="add-status-code">+ Add Status Code</vscode-button>
        </div>

        <div class="field">
          <label>Custom Headers</label>
          <div class="repeatable-list" id="custom-headers-list"></div>
          <vscode-button appearance="secondary" id="add-custom-header">+ Add Header</vscode-button>
        </div>

        <div class="field">
          <label>Headers to Remove</label>
          <div class="repeatable-list" id="headers-remove-list"></div>
          <vscode-button appearance="secondary" id="add-header-remove">+ Add Header</vscode-button>
        </div>
      </section>

      <!-- TCP Settings (shown only when Type = TCP) -->
      <section class="section type-section hidden" id="tcp-section">
        <h2 class="section-title">TCP Settings</h2>

        <div class="field">
          <label for="send-payload">Send Payload</label>
          <div class="field-with-checkbox">
            <vscode-text-field id="send-payload" placeholder="Optional payload to send"></vscode-text-field>
            <vscode-checkbox id="send-payload-hex">Hex format</vscode-checkbox>
          </div>
        </div>

        <div class="field">
          <label for="expected-response">Expected Response</label>
          <div class="field-with-checkbox">
            <vscode-text-field id="expected-response" placeholder="Optional expected response"></vscode-text-field>
            <vscode-checkbox id="expected-response-hex">Hex format</vscode-checkbox>
          </div>
        </div>
      </section>

      <!-- UDP-ICMP Settings (shown only when Type = UDP-ICMP) -->
      <section class="section type-section hidden" id="udp-icmp-section">
        <h2 class="section-title">UDP-ICMP Settings</h2>
        <div class="info-box">
          <span class="codicon codicon-info"></span>
          ICMP echo request/reply - no additional configuration needed
        </div>
      </section>
        </div>

        <footer class="footer">
          <vscode-button appearance="secondary" id="cancel-btn">Cancel</vscode-button>
          <vscode-button appearance="primary" id="create-btn-footer" disabled>Create</vscode-button>
        </footer>
      </div>

      <!-- JSON Preview Panel (right side) -->
      <div class="json-panel hidden" id="json-panel">
        <div class="json-panel-header">
          <h2>JSON Preview</h2>
          <vscode-button appearance="icon" id="close-json-btn" title="Close">×</vscode-button>
        </div>
        <div class="json-panel-content">
          <pre><code id="json-content">{}</code></pre>
        </div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const quotaExceeded = ${quotaExceeded};
    ${this.getScript()}
  </script>
</body>
</html>`;
  }

  /**
   * Get CSS styles
   */
  private getStyles(): string {
    return `
    * {
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      margin: 0;
      padding: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .container {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 0 24px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }

    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }

    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .main-content {
      display: flex;
      flex: 1;
      overflow: hidden;
      gap: 0;
    }

    .form-panel {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      max-width: 800px;
      transition: max-width 0.3s ease;
    }

    .main-content.json-visible .form-panel {
      max-width: 50%;
      flex: 0 0 50%;
    }

    .form-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px 0;
      padding-right: 16px;
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 0;
      border-top: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }

    /* JSON Panel (right side) */
    .json-panel {
      display: flex;
      flex-direction: column;
      flex: 0 0 50%;
      min-width: 0;
      border-left: 1px solid var(--vscode-panel-border);
      background: var(--vscode-editor-background);
      transition: flex 0.3s ease, opacity 0.3s ease;
    }

    .json-panel.hidden {
      display: none;
    }

    .json-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      flex-shrink: 0;
    }

    .json-panel-header h2 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--vscode-symbolIcon-classForeground);
    }

    .json-panel-content {
      flex: 1;
      overflow: auto;
      padding: 16px;
      background: var(--vscode-textCodeBlock-background);
    }

    .json-panel-content pre {
      margin: 0;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .section {
      margin-bottom: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .section:last-child {
      border-bottom: none;
    }

    .section-title {
      margin: 0 0 16px 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--vscode-symbolIcon-classForeground);
    }

    .field {
      margin-bottom: 16px;
    }

    .field label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
      color: var(--vscode-foreground);
    }

    .field-row {
      display: flex;
      gap: 16px;
    }

    .field-row .field {
      flex: 1;
    }

    .field-hint {
      display: block;
      margin-top: 4px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .field-error {
      display: block;
      margin-top: 4px;
      font-size: 11px;
      color: var(--vscode-errorForeground);
    }

    .nested-field {
      margin-top: 8px;
      margin-left: 24px;
    }

    .field-with-checkbox {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .field-with-checkbox vscode-text-field {
      flex: 1;
    }

    .badge {
      display: inline-block;
      padding: 2px 6px;
      margin-left: 8px;
      font-size: 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 4px;
    }

    /* Type sections visibility */
    .type-section {
      display: block;
    }

    .type-section.hidden {
      display: none;
    }

    /* Repeatable fields */
    .repeatable-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 8px;
    }

    .repeatable-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .repeatable-item vscode-text-field {
      flex: 1;
    }

    .repeatable-item .header-key {
      flex: 1;
    }

    .repeatable-item .header-value {
      flex: 2;
    }

    .remove-btn {
      flex-shrink: 0;
      color: var(--vscode-errorForeground);
    }

    /* Info box */
    .info-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: var(--vscode-textBlockQuote-background);
      border-left: 3px solid var(--vscode-textLink-foreground);
      border-radius: 4px;
      color: var(--vscode-descriptionForeground);
    }

    /* Error banner */
    .error-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      border-radius: 4px;
    }

    .error-banner.hidden {
      display: none;
    }

    /* Quota banner */
    .quota-banner {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      border-radius: 4px;
      border-left: 4px solid;
    }

    .quota-banner-ok {
      background: var(--vscode-textBlockQuote-background);
      border-left-color: var(--vscode-testing-iconPassed, #73c991);
    }

    .quota-banner-warning {
      background: rgba(204, 167, 0, 0.1);
      border-left-color: var(--vscode-testing-iconQueued, #cca700);
    }

    .quota-banner-error {
      background: var(--vscode-inputValidation-errorBackground);
      border-left-color: var(--vscode-testing-iconFailed, #f14c4c);
    }

    .quota-banner-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .quota-icon { font-size: 14px; }

    .quota-text {
      font-size: 12px;
      color: var(--vscode-foreground);
    }

    .quota-progress {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .quota-progress-bar {
      flex: 1;
      height: 4px;
      background: var(--vscode-progressBar-background);
      border-radius: 2px;
      overflow: hidden;
    }

    .quota-progress-fill {
      height: 100%;
      background: currentColor;
      transition: width 0.3s ease;
    }

    .quota-banner-ok .quota-progress-fill { background: var(--vscode-testing-iconPassed, #73c991); }
    .quota-banner-warning .quota-progress-fill { background: var(--vscode-testing-iconQueued, #cca700); }
    .quota-banner-error .quota-progress-fill { background: var(--vscode-testing-iconFailed, #f14c4c); }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 10px;
      height: 10px;
    }

    ::-webkit-scrollbar-track {
      background: transparent;
    }

    ::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-background);
      border-radius: 5px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--vscode-scrollbarSlider-hoverBackground);
    }

    /* VSCode components styling fixes */
    vscode-text-field {
      width: 100%;
    }

    vscode-dropdown {
      width: 100%;
    }

    vscode-radio-group {
      display: flex;
      gap: 16px;
    }

    vscode-radio-group[orientation="vertical"] {
      flex-direction: column;
      gap: 8px;
    }
    `;
  }

  /**
   * Get JavaScript for interactivity
   */
  private getScript(): string {
    return `
    (function() {
      const vscode = acquireVsCodeApi();

      // DOM Elements
      const nameField = document.getElementById('name');
      const namespaceField = document.getElementById('namespace');
      const typeGroup = document.getElementById('type');
      const intervalField = document.getElementById('interval');
      const timeoutField = document.getElementById('timeout');
      const jitterField = document.getElementById('jitter');
      const healthyThresholdField = document.getElementById('healthy-threshold');
      const unhealthyThresholdField = document.getElementById('unhealthy-threshold');
      const pathField = document.getElementById('path');
      const hostHeaderModeGroup = document.getElementById('host-header-mode');
      const customHostHeaderField = document.getElementById('custom-host-header');
      const useHttp2Field = document.getElementById('use-http2');
      const sendPayloadField = document.getElementById('send-payload');
      const sendPayloadHexField = document.getElementById('send-payload-hex');
      const expectedResponseField = document.getElementById('expected-response');
      const expectedResponseHexField = document.getElementById('expected-response-hex');

      const createBtn = document.getElementById('create-btn');
      const createBtnFooter = document.getElementById('create-btn-footer');
      const cancelBtn = document.getElementById('cancel-btn');
      const toggleJsonBtn = document.getElementById('toggle-json-btn');
      const closeJsonBtn = document.getElementById('close-json-btn');
      const jsonPanel = document.getElementById('json-panel');
      const mainContent = document.querySelector('.main-content');
      const jsonContent = document.getElementById('json-content');
      const errorBanner = document.getElementById('error-banner');
      const errorMessage = document.getElementById('error-message');
      const closeErrorBtn = document.getElementById('close-error');

      // Sections
      const httpSection = document.getElementById('http-section');
      const tcpSection = document.getElementById('tcp-section');
      const udpIcmpSection = document.getElementById('udp-icmp-section');

      // Repeatable lists
      const statusCodesList = document.getElementById('status-codes-list');
      const customHeadersList = document.getElementById('custom-headers-list');
      const headersRemoveList = document.getElementById('headers-remove-list');
      const addStatusCodeBtn = document.getElementById('add-status-code');
      const addCustomHeaderBtn = document.getElementById('add-custom-header');
      const addHeaderRemoveBtn = document.getElementById('add-header-remove');

      // State
      let currentType = 'http';
      let isJsonPanelOpen = false;

      // Type switching
      typeGroup.addEventListener('change', (e) => {
        currentType = e.target.value;

        httpSection.classList.toggle('hidden', currentType !== 'http');
        tcpSection.classList.toggle('hidden', currentType !== 'tcp');
        udpIcmpSection.classList.toggle('hidden', currentType !== 'udp_icmp');

        updatePreview();
        validateForm();
      });

      // Host header mode switching
      hostHeaderModeGroup.addEventListener('change', (e) => {
        const isCustom = e.target.value === 'custom';
        customHostHeaderField.disabled = !isCustom;
        if (!isCustom) {
          customHostHeaderField.value = '';
        }
        updatePreview();
      });

      // Form validation and preview updates
      const updateFields = [
        nameField, intervalField, timeoutField, jitterField,
        healthyThresholdField, unhealthyThresholdField, pathField,
        customHostHeaderField, sendPayloadField, expectedResponseField
      ];

      updateFields.forEach(field => {
        if (field) {
          field.addEventListener('input', () => {
            updatePreview();
            validateForm();
          });
        }
      });

      // Checkbox changes
      [useHttp2Field, sendPayloadHexField, expectedResponseHexField].forEach(cb => {
        if (cb) {
          cb.addEventListener('change', updatePreview);
        }
      });

      // Namespace change
      if (namespaceField) {
        namespaceField.addEventListener('change', updatePreview);
      }

      // Add status code
      addStatusCodeBtn.addEventListener('click', () => {
        const item = document.createElement('div');
        item.className = 'repeatable-item';
        item.innerHTML = \`
          <vscode-text-field class="status-code-input" placeholder="200 or 200-299"></vscode-text-field>
          <vscode-button appearance="icon" class="remove-btn" title="Remove">×</vscode-button>
        \`;
        item.querySelector('.remove-btn').addEventListener('click', () => {
          item.remove();
          updatePreview();
        });
        item.querySelector('.status-code-input').addEventListener('input', updatePreview);
        statusCodesList.appendChild(item);
      });

      // Add custom header
      addCustomHeaderBtn.addEventListener('click', () => {
        const item = document.createElement('div');
        item.className = 'repeatable-item';
        item.innerHTML = \`
          <vscode-text-field class="header-key" placeholder="Header name"></vscode-text-field>
          <vscode-text-field class="header-value" placeholder="Header value"></vscode-text-field>
          <vscode-button appearance="icon" class="remove-btn" title="Remove">×</vscode-button>
        \`;
        item.querySelector('.remove-btn').addEventListener('click', () => {
          item.remove();
          updatePreview();
        });
        item.querySelectorAll('vscode-text-field').forEach(f => {
          f.addEventListener('input', updatePreview);
        });
        customHeadersList.appendChild(item);
      });

      // Add header to remove
      addHeaderRemoveBtn.addEventListener('click', () => {
        const item = document.createElement('div');
        item.className = 'repeatable-item';
        item.innerHTML = \`
          <vscode-text-field class="header-remove-input" placeholder="Header name to remove"></vscode-text-field>
          <vscode-button appearance="icon" class="remove-btn" title="Remove">×</vscode-button>
        \`;
        item.querySelector('.remove-btn').addEventListener('click', () => {
          item.remove();
          updatePreview();
        });
        item.querySelector('.header-remove-input').addEventListener('input', updatePreview);
        headersRemoveList.appendChild(item);
      });

      // Initial remove buttons
      document.querySelectorAll('.repeatable-item .remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.target.closest('.repeatable-item').remove();
          updatePreview();
        });
      });

      document.querySelectorAll('.status-code-input').forEach(input => {
        input.addEventListener('input', updatePreview);
      });

      // JSON Panel toggle
      function toggleJsonPanel(show) {
        isJsonPanelOpen = show !== undefined ? show : !isJsonPanelOpen;
        jsonPanel.classList.toggle('hidden', !isJsonPanelOpen);
        mainContent.classList.toggle('json-visible', isJsonPanelOpen);
        toggleJsonBtn.textContent = isJsonPanelOpen ? 'Hide JSON' : 'Show JSON';
        if (isJsonPanelOpen) {
          updatePreview();
        }
      }

      toggleJsonBtn.addEventListener('click', () => toggleJsonPanel());
      closeJsonBtn.addEventListener('click', () => toggleJsonPanel(false));

      // Create button
      function handleCreate() {
        const formData = collectFormData();
        vscode.postMessage({ command: 'createHealthcheck', data: formData });
      }

      createBtn.addEventListener('click', handleCreate);
      createBtnFooter.addEventListener('click', handleCreate);

      // Cancel button
      cancelBtn.addEventListener('click', () => {
        vscode.postMessage({ command: 'cancel' });
      });

      // Close error banner
      closeErrorBtn.addEventListener('click', () => {
        errorBanner.classList.add('hidden');
      });

      // Collect form data
      function collectFormData() {
        const data = {
          name: nameField.value,
          namespace: namespaceField.value,
          type: currentType,
          interval: parseInt(intervalField.value) || 15,
          timeout: parseInt(timeoutField.value) || 3,
          jitter: parseInt(jitterField.value) || 0,
          healthyThreshold: parseInt(healthyThresholdField.value) || 3,
          unhealthyThreshold: parseInt(unhealthyThresholdField.value) || 1,
        };

        if (currentType === 'http') {
          data.path = pathField.value || '/';
          data.hostHeaderMode = document.querySelector('#host-header-mode vscode-radio:checked')?.value || 'origin';
          if (data.hostHeaderMode === 'custom') {
            data.customHostHeader = customHostHeaderField.value;
          }
          data.useHttp2 = useHttp2Field.checked;

          // Status codes
          const statusCodes = [];
          document.querySelectorAll('.status-code-input').forEach(input => {
            if (input.value) {
              statusCodes.push(input.value);
            }
          });
          if (statusCodes.length > 0) {
            data.expectedStatusCodes = statusCodes;
          }

          // Custom headers
          const headers = [];
          customHeadersList.querySelectorAll('.repeatable-item').forEach(item => {
            const key = item.querySelector('.header-key')?.value;
            const value = item.querySelector('.header-value')?.value;
            if (key && value) {
              headers.push({ key, value });
            }
          });
          if (headers.length > 0) {
            data.customHeaders = headers;
          }

          // Headers to remove
          const headersToRemove = [];
          headersRemoveList.querySelectorAll('.header-remove-input').forEach(input => {
            if (input.value) {
              headersToRemove.push(input.value);
            }
          });
          if (headersToRemove.length > 0) {
            data.headersToRemove = headersToRemove;
          }
        } else if (currentType === 'tcp') {
          if (sendPayloadField.value) {
            data.sendPayload = sendPayloadField.value;
            data.sendPayloadHex = sendPayloadHexField.checked;
          }
          if (expectedResponseField.value) {
            data.expectedResponse = expectedResponseField.value;
            data.expectedResponseHex = expectedResponseHexField.checked;
          }
        }

        return data;
      }

      // Build preview JSON
      function buildPreviewJson(data) {
        const payload = {
          metadata: {
            name: data.name || '',
            namespace: data.namespace || 'default',
          },
          spec: {
            timeout: data.timeout,
            interval: data.interval,
            healthy_threshold: data.healthyThreshold,
            unhealthy_threshold: data.unhealthyThreshold,
          },
        };

        if (data.jitter > 0) {
          payload.spec.jitter_percent = data.jitter;
        }

        if (data.type === 'http') {
          const httpConfig = {};
          if (data.path) {
            httpConfig.path = data.path;
          }
          if (data.hostHeaderMode === 'origin') {
            httpConfig.use_origin_server_name = {};
          } else if (data.customHostHeader) {
            httpConfig.host_header = data.customHostHeader;
          }
          if (data.useHttp2) {
            httpConfig.use_http2 = true;
          }
          if (data.expectedStatusCodes && data.expectedStatusCodes.length > 0) {
            httpConfig.expected_status_codes = data.expectedStatusCodes;
          }
          if (data.customHeaders && data.customHeaders.length > 0) {
            httpConfig.headers = {};
            data.customHeaders.forEach(h => {
              httpConfig.headers[h.key] = h.value;
            });
          }
          if (data.headersToRemove && data.headersToRemove.length > 0) {
            httpConfig.request_headers_to_remove = data.headersToRemove;
          }
          payload.spec.http_health_check = httpConfig;
        } else if (data.type === 'tcp') {
          const tcpConfig = {};
          if (data.sendPayload) {
            tcpConfig.send_payload = data.sendPayloadHex ? 'hex:' + data.sendPayload : data.sendPayload;
          }
          if (data.expectedResponse) {
            tcpConfig.expected_response = data.expectedResponseHex ? 'hex:' + data.expectedResponse : data.expectedResponse;
          }
          payload.spec.tcp_health_check = tcpConfig;
        } else if (data.type === 'udp_icmp') {
          payload.spec.icmp_health_check = {};
        }

        return payload;
      }

      // Update JSON preview
      function updatePreview() {
        if (!isJsonPanelOpen) return;

        const data = collectFormData();
        const json = buildPreviewJson(data);
        jsonContent.textContent = JSON.stringify(json, null, 2);
      }

      // Validate form
      function validateForm() {
        // If quota exceeded, always disable create button
        if (quotaExceeded) {
          createBtn.disabled = true;
          createBtnFooter.disabled = true;
          return;
        }

        const name = nameField.value.trim();
        const nameValid = name.length > 1 && /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(name);

        // Show/hide name error
        const nameError = document.getElementById('name-error');
        if (name && !nameValid) {
          nameError.textContent = 'Name must be lowercase alphanumeric with hyphens, cannot start/end with hyphen';
        } else {
          nameError.textContent = '';
        }

        const isValid = nameValid;
        createBtn.disabled = !isValid;
        createBtnFooter.disabled = !isValid;
      }

      // Handle messages from extension
      window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
          case 'createError':
            errorMessage.textContent = message.error;
            errorBanner.classList.remove('hidden');
            break;
          case 'validationResult':
            // Handle field-specific validation results
            break;
        }
      });

      // Initial state
      updatePreview();
      validateForm();
    })();
    `;
  }

  /**
   * Dispose of the webview panel
   */
  dispose(): void {
    this.panel?.dispose();
  }
}
