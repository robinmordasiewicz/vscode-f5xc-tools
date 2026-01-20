// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

import * as vscode from 'vscode';
import { ProfileManager } from '../config/profiles';
import { RESOURCE_TYPES, ResourceTypeInfo } from '../api/resourceTypes';
import { API_ENDPOINTS } from '../generated/constants';
import { getLogger } from '../utils/logger';
import { getDocumentationUrl as getGeneratedDocUrl } from '../generated/documentationUrls';
import { getQuotaForResourceType, QuotaItem } from '../api/subscription';

const logger = getLogger();

/**
 * Represents a field in a section
 */
interface FieldDefinition {
  key: string;
  value: string;
  status?: 'enabled' | 'disabled' | 'warning' | 'good' | 'bad';
}

/**
 * Represents a sub-group within a section (rendered as a boxed container)
 */
interface SubGroupDefinition {
  id: string;
  title: string;
  fields: FieldDefinition[];
}

/**
 * Represents a section in the describe view
 */
interface SectionDefinition {
  id: string;
  title: string;
  subCategoryLabel?: string; // Label shown above sub-groups (e.g., "L7 DDoS Protection Settings")
  subGroups?: SubGroupDefinition[]; // Boxed sub-groups
  fields: FieldDefinition[]; // Ungrouped fields (rendered after sub-groups)
}

/**
 * WebView provider for displaying F5 XC resource descriptions.
 * Matches the F5 XC Console UI layout with toolbar, sidebar, and organized sections.
 */
export class F5XCDescribeProvider {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly profileManager: ProfileManager) {}

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
   * Check if a value is empty (null, undefined, {}, [], "")
   */
  private isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    if (value === '') {
      return true;
    }
    if (Array.isArray(value) && value.length === 0) {
      return true;
    }
    if (typeof value === 'object' && Object.keys(value).length === 0) {
      return true;
    }
    return false;
  }

  /**
   * Format ISO date to short format "Mar 4, 2026"
   */
  private formatDateShort(isoString: string | undefined): string | undefined {
    if (!isoString) {
      return undefined;
    }
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  }

  /**
   * Format timestamp to locale string
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
   * Get documentation URL for resource type.
   * Uses URLs generated from OpenAPI spec files at compile time.
   */
  private getDocumentationUrl(resourceType: string): string {
    return getGeneratedDocUrl(resourceType);
  }

  /**
   * Format key for display (snake_case to Title Case)
   */
  private formatKey(key: string): string {
    return key
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get status for enable/disable fields
   */
  private getEnableDisableStatus(
    spec: Record<string, unknown>,
    disableKey: string,
    enableKey: string,
  ): { enabled: boolean; value: string } | null {
    // In F5 XC API, the presence of the key indicates selection, even if value is empty {}
    // e.g., "disable_trust_client_ip_headers": {} means disabled IS selected
    const isDisabled = disableKey in spec;
    const isEnabled = enableKey in spec;

    if (isDisabled) {
      return { enabled: false, value: 'Disable' };
    } else if (isEnabled) {
      return { enabled: true, value: 'Enable' };
    }
    return null;
  }

  /**
   * Show the describe panel for a resource
   * @param cachedData Optional cached data from list response (for resources without GET endpoint)
   */
  async showDescribe(
    profileName: string,
    namespace: string,
    resourceType: string,
    resourceName: string,
    cachedData?: Record<string, unknown>,
  ): Promise<void> {
    try {
      logger.debug(`Describing resource: ${resourceName} (${resourceType})`);

      const resourceTypeInfo = this.findResourceTypeInfo(resourceType);
      const displayName = resourceTypeInfo?.displayName || resourceType;

      let resource: Record<string, unknown>;

      // Use cached data if available (for resources that don't have a GET endpoint)
      if (resourceTypeInfo?.useListDataForDescribe && cachedData) {
        logger.debug(`Using cached list data for ${resourceName} (no GET endpoint available)`);
        resource = cachedData;
      } else {
        const client = await this.profileManager.getClient(profileName);
        const apiBase = resourceTypeInfo?.apiBase || 'config';
        resource = (await client.getWithOptions(namespace, resourceType, resourceName, {
          apiBase,
          customGetPath: resourceTypeInfo?.customGetPath,
        })) as unknown as Record<string, unknown>;
      }

      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.Beside);
      } else {
        this.panel = vscode.window.createWebviewPanel(
          'f5xcDescribe',
          `${resourceName}`,
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [],
          },
        );

        this.panel.onDidDispose(() => {
          this.panel = undefined;
        });

        // Set up message handler
        this.panel.webview.onDidReceiveMessage(
          async (message: { command: string; resourceType?: string }) => {
            switch (message.command) {
              case 'editResource':
                await vscode.commands.executeCommand('f5xc.edit', {
                  profileName,
                  namespace,
                  resourceType,
                  resourceName,
                });
                break;
              case 'openDocumentation': {
                const docUrl = this.getDocumentationUrl(resourceType);
                await vscode.env.openExternal(vscode.Uri.parse(docUrl));
                break;
              }
            }
          },
        );
      }

      this.panel.title = resourceName;

      // Fetch quota info for this resource type (best effort - don't fail if quota unavailable)
      // Quotas are typically tenant-wide, so try resource's namespace first, then fall back to 'system'
      let quotaInfo: QuotaItem | undefined;
      try {
        const client = await this.profileManager.getClient(profileName);
        logger.info(`Fetching quota for resourceType: ${resourceType}, namespace: ${namespace}`);

        // First try the resource's namespace
        quotaInfo = await getQuotaForResourceType(client, resourceType, namespace);

        // If not found and namespace isn't 'system', fall back to 'system' namespace
        // (quotas are often tenant-wide and stored in system namespace)
        if (!quotaInfo && namespace !== 'system') {
          logger.info(`No quota in ${namespace}, trying system namespace...`);
          quotaInfo = await getQuotaForResourceType(client, resourceType, 'system');
        }

        if (quotaInfo) {
          logger.info(
            `Found quota info: ${quotaInfo.displayName} - ${quotaInfo.usage}/${quotaInfo.limit}`,
          );
        } else {
          logger.info(`No quota info found for ${resourceType}`);
        }
      } catch (quotaError) {
        const errorMessage = quotaError instanceof Error ? quotaError.message : String(quotaError);
        logger.warn(`Failed to fetch quota info for ${resourceType}: ${errorMessage}`);
      }

      this.panel.webview.html = this.getWebviewContent(
        resource,
        resourceName,
        displayName,
        namespace,
        resourceType,
        profileName,
        quotaInfo,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to describe resource: ${message}`);
      void vscode.window.showErrorMessage(`Failed to describe resource: ${message}`);
    }
  }

  /**
   * Show the describe panel for a namespace object.
   * Uses the same describe webview as other resources, but fetches data from
   * the tenant-level namespaces API: /api/web/namespaces/{name}.
   */
  async showNamespaceDescribe(profileName: string, namespaceName: string): Promise<void> {
    try {
      logger.debug(`Describing namespace: ${namespaceName}`);

      const client = await this.profileManager.getClient(profileName);
      const resource = await client.customRequest<Record<string, unknown>>(
        `${API_ENDPOINTS.NAMESPACES}/${encodeURIComponent(namespaceName)}`,
      );

      const displayName = 'Namespace';

      if (this.panel) {
        this.panel.reveal(vscode.ViewColumn.Beside);
      } else {
        this.panel = vscode.window.createWebviewPanel(
          'f5xcDescribe',
          namespaceName,
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [],
          },
        );

        this.panel.onDidDispose(() => {
          this.panel = undefined;
        });
      }

      this.panel.title = namespaceName;
      this.panel.webview.html = this.getWebviewContent(
        resource,
        namespaceName,
        displayName,
        '',
        'namespaces',
        profileName,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to describe namespace: ${message}`);
      void vscode.window.showErrorMessage(`Failed to describe namespace: ${message}`);
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
    apiPath: string,
    profileName: string,
    quotaInfo?: QuotaItem,
  ): string {
    const nonce = this.getNonce();
    const cspSource = this.panel!.webview.cspSource;
    const metadata = resource.metadata as Record<string, unknown> | undefined;
    const systemMetadata = resource.system_metadata as Record<string, unknown> | undefined;
    const spec = resource.spec as Record<string, unknown> | undefined;

    // Extract sections based on resource type
    const sections = this.extractSections(apiPath, metadata, systemMetadata, spec, namespace);

    // Generate JSON content for JSON tab
    const jsonContent = JSON.stringify(resource, null, 2);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource};">
  <style>
    ${this.getStyles()}
  </style>
</head>
<body data-profile="${this.escapeHtml(profileName)}" data-namespace="${this.escapeHtml(namespace)}" data-resource-type="${this.escapeHtml(apiPath)}" data-resource-name="${this.escapeHtml(resourceName)}">
  <!-- Top Toolbar -->
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="resource-type">${this.escapeHtml(resourceType)}</span>
      <span class="resource-name">${this.escapeHtml(resourceName)}</span>
    </div>
    <div class="toolbar-center">
      <button class="tab-btn active" data-tab="form">Form</button>
      <button class="tab-btn" data-tab="documentation">Documentation</button>
      <button class="tab-btn" data-tab="json">JSON</button>
    </div>
    <div class="toolbar-right">
      <input type="text" class="search-input" placeholder="Search..." />
      <button class="edit-btn">Edit Configuration</button>
    </div>
  </div>

  <!-- Main Container -->
  <div class="container">
    <!-- Left Sidebar Navigation -->
    <nav class="sidebar">
      <ul class="nav-list">
        ${sections.map((s) => `<li class="nav-item" data-section="${s.id}">${this.escapeHtml(s.title)}</li>`).join('\n        ')}
      </ul>
    </nav>

    <!-- Main Content Area -->
    <main class="content">
      <!-- Form View (default) -->
      <div class="tab-content active" id="form-view">
        ${quotaInfo ? this.renderQuotaWidget(quotaInfo, resourceType) : this.renderQuotaUnavailable(resourceType)}
        ${sections.map((s) => this.renderSection(s)).join('\n')}
      </div>

      <!-- JSON View -->
      <div class="tab-content" id="json-view">
        <pre class="json-content"><code>${this.escapeHtml(jsonContent)}</code></pre>
      </div>
    </main>
  </div>

  <script nonce="${nonce}">
    ${this.getScript()}
  </script>
</body>
</html>`;
  }

  /**
   * Extract all sections based on resource type
   */
  private extractSections(
    apiPath: string,
    metadata: Record<string, unknown> | undefined,
    systemMetadata: Record<string, unknown> | undefined,
    spec: Record<string, unknown> | undefined,
    namespace: string,
  ): SectionDefinition[] {
    switch (apiPath) {
      case 'http_loadbalancers':
        return this.extractHttpLbSections(metadata, systemMetadata, spec, namespace);
      case 'origin_pools':
        return this.extractOriginPoolSections(metadata, systemMetadata, spec, namespace);
      default:
        return this.extractGenericSections(metadata, systemMetadata, spec, namespace);
    }
  }

  /**
   * Extract HTTP Load Balancer sections matching F5 XC Console layout
   */
  private extractHttpLbSections(
    metadata: Record<string, unknown> | undefined,
    _systemMetadata: Record<string, unknown> | undefined,
    spec: Record<string, unknown> | undefined,
    _namespace: string,
  ): SectionDefinition[] {
    const sections: SectionDefinition[] = [];

    // 1. Metadata
    const metadataFields: FieldDefinition[] = [];
    if (metadata?.name) {
      metadataFields.push({ key: 'Name', value: String(metadata.name) });
    }
    sections.push({ id: 'metadata', title: 'Metadata', fields: metadataFields });

    // 2. Domains and LB Type
    const domainsFields: FieldDefinition[] = [];
    const domains = spec?.domains as string[] | undefined;
    if (domains && domains.length > 0) {
      domainsFields.push({ key: 'Domains', value: domains.join(', ') });
    }

    // Determine LB type and extract all HTTPS config fields
    const httpsAutoConfig = spec?.https_auto_cert as Record<string, unknown> | undefined;
    const httpsConfig = spec?.https as Record<string, unknown> | undefined;
    const httpConfig = spec?.http as Record<string, unknown> | undefined;
    const activeConfig = httpsAutoConfig || httpsConfig || httpConfig;

    // Track LB type for conditional section rendering
    let lbType: 'https_auto' | 'https_custom' | 'http' | 'unknown' = 'unknown';

    if (httpsAutoConfig && !this.isEmpty(httpsAutoConfig)) {
      lbType = 'https_auto';
      domainsFields.push({ key: 'Load Balancer Type', value: 'HTTPS with Automatic Certificate' });

      // HTTP Redirect to HTTPS
      if (httpsAutoConfig.http_redirect !== undefined) {
        domainsFields.push({
          key: 'HTTP Redirect to HTTPS',
          value: httpsAutoConfig.http_redirect ? 'True' : 'False',
        });
      }

      // Add HSTS Header
      if (httpsAutoConfig.add_hsts !== undefined) {
        domainsFields.push({
          key: 'Add HSTS Header',
          value: httpsAutoConfig.add_hsts ? 'True' : 'False',
        });
      }

      // HTTPS Listen Port Choice and Port
      if (httpsAutoConfig.port || httpsAutoConfig.default_https_port) {
        domainsFields.push({
          key: 'HTTPS Listen Port Choice',
          value: httpsAutoConfig.default_https_port ? 'Default HTTPS Port' : 'HTTPS Listen Port',
        });
        if (httpsAutoConfig.port) {
          domainsFields.push({ key: 'HTTPS Listen Port', value: String(httpsAutoConfig.port) });
        }
      }

      // TLS Security Level
      if (httpsAutoConfig.tls_config) {
        const tlsConfig = httpsAutoConfig.tls_config as Record<string, unknown>;
        if (tlsConfig.default_security) {
          domainsFields.push({ key: 'TLS Security Level', value: 'High' });
        } else if (tlsConfig.medium_security) {
          domainsFields.push({ key: 'TLS Security Level', value: 'Medium' });
        } else if (tlsConfig.low_security) {
          domainsFields.push({ key: 'TLS Security Level', value: 'Low' });
        } else if (tlsConfig.custom_security) {
          domainsFields.push({ key: 'TLS Security Level', value: 'Custom' });
        }
      }

      // mTLS
      if (httpsAutoConfig.no_mtls) {
        domainsFields.push({ key: 'mTLS', value: 'Disable', status: 'disabled' });
      } else if (httpsAutoConfig.use_mtls) {
        domainsFields.push({ key: 'mTLS', value: 'Enable', status: 'enabled' });
      }
    } else if (httpsConfig && !this.isEmpty(httpsConfig)) {
      lbType = 'https_custom';
      domainsFields.push({ key: 'Load Balancer Type', value: 'HTTPS with Custom Certificate' });
    } else if (httpConfig && !this.isEmpty(httpConfig)) {
      lbType = 'http';
      domainsFields.push({ key: 'Load Balancer Type', value: 'HTTP' });

      // HTTP Listen Port
      if (httpConfig.port !== undefined) {
        domainsFields.push({ key: 'HTTP Listen Port', value: String(httpConfig.port) });
      }

      // DNS Management
      if (httpConfig.dns_volterra_managed !== undefined) {
        domainsFields.push({
          key: 'DNS Info',
          value: httpConfig.dns_volterra_managed ? 'F5 XC Managed' : 'Manual DNS Configuration',
        });
      }
    }

    // Server Response Header (at spec level)
    if (spec?.response_headers_to_add || spec?.response_headers_to_remove) {
      domainsFields.push({ key: 'Server Response Header', value: 'Custom' });
    } else if (spec?.default_header !== undefined || !spec?.response_headers_to_add) {
      domainsFields.push({ key: 'Server Response Header', value: 'Default' });
    }

    // Path Normalization (at spec level)
    if (spec?.enable_path_normalization) {
      domainsFields.push({ key: 'Path Normalization', value: 'Enable', status: 'enabled' });
    } else if (spec?.disable_path_normalization) {
      domainsFields.push({ key: 'Path Normalization', value: 'Disable', status: 'disabled' });
    } else {
      // Default is enabled
      domainsFields.push({ key: 'Path Normalization', value: 'Enable', status: 'enabled' });
    }

    // Default Load Balancer (at spec level)
    if (spec?.default_loadbalancer) {
      domainsFields.push({ key: 'Default Load Balancer', value: 'Yes' });
    } else {
      // Default is "No" when not explicitly set
      domainsFields.push({ key: 'Default Load Balancer', value: 'No' });
    }

    // Connection Idle Timeout (inside https config)
    if (activeConfig?.connection_idle_timeout) {
      domainsFields.push({
        key: 'Connection Idle Timeout',
        value: String(activeConfig.connection_idle_timeout),
      });
    }

    // HTTP Protocol Configuration (at spec level)
    if (spec?.http_protocol_configuration) {
      const httpProto = spec.http_protocol_configuration as Record<string, unknown>;
      if (httpProto.http_protocol_enable_v1_v2) {
        domainsFields.push({ key: 'HTTP Protocol Configuration', value: 'HTTP/1.1 and HTTP/2' });
      } else if (httpProto.http_protocol_enable_v1_only) {
        domainsFields.push({ key: 'HTTP Protocol Configuration', value: 'HTTP/1.1 Only' });
      } else if (httpProto.http_protocol_enable_v2_only) {
        domainsFields.push({ key: 'HTTP Protocol Configuration', value: 'HTTP/2 Only' });
      } else {
        domainsFields.push({ key: 'HTTP Protocol Configuration', value: 'HTTP/1.1 and HTTP/2' });
      }
    } else {
      // Default is HTTP/1.1 and HTTP/2 when not explicitly set
      domainsFields.push({ key: 'HTTP Protocol Configuration', value: 'HTTP/1.1 and HTTP/2' });
    }

    // TLS Coalescing Options (inside https config) - only for HTTPS load balancers
    if (httpsAutoConfig || httpsConfig) {
      if (httpsAutoConfig?.no_tls_coalescing || httpsConfig?.no_tls_coalescing) {
        domainsFields.push({ key: 'TLS Coalescing Options', value: 'No Coalescing' });
      } else {
        // Default is "Default Coalescing" for HTTPS
        domainsFields.push({ key: 'TLS Coalescing Options', value: 'Default Coalescing' });
      }
    }

    sections.push({ id: 'domains', title: 'Domains and LB Type', fields: domainsFields });

    // 3. Web Application Firewall
    const wafFields: FieldDefinition[] = [];
    const wafStatus = this.getEnableDisableStatus(spec || {}, 'disable_waf', 'app_firewall');
    if (wafStatus) {
      wafFields.push({
        key: 'Web Application Firewall (WAF)',
        value: wafStatus.value,
        status: wafStatus.enabled ? 'enabled' : 'disabled',
      });
    }
    if (spec?.waf_exclusion_rules && !this.isEmpty(spec.waf_exclusion_rules)) {
      wafFields.push({ key: 'WAF Exclusion', value: 'Inline Rules' });
    }
    sections.push({ id: 'waf', title: 'Web Application Firewall', fields: wafFields });

    // 4. Bot Protection
    const botFields: FieldDefinition[] = [];
    const botStatus = this.getEnableDisableStatus(spec || {}, 'disable_bot_defense', 'bot_defense');
    if (botStatus) {
      botFields.push({
        key: 'Bot Defense',
        value: botStatus.value,
        status: botStatus.enabled ? 'enabled' : 'disabled',
      });
    }
    sections.push({ id: 'bot-protection', title: 'Bot Protection', fields: botFields });

    // 5. API Protection
    const apiFields: FieldDefinition[] = [];
    const apiDefStatus = this.getEnableDisableStatus(
      spec || {},
      'disable_api_definition',
      'api_definition',
    );
    if (apiDefStatus) {
      apiFields.push({
        key: 'API Definition',
        value: apiDefStatus.value,
        status: apiDefStatus.enabled ? 'enabled' : 'disabled',
      });
    }
    const apiDiscStatus = this.getEnableDisableStatus(
      spec || {},
      'disable_api_discovery',
      'enable_api_discovery',
    );
    if (apiDiscStatus) {
      apiFields.push({
        key: 'API Discovery',
        value: apiDiscStatus.value,
        status: apiDiscStatus.enabled ? 'enabled' : 'disabled',
      });
    }
    // Sensitive Data Discovery
    if (spec?.default_sensitive_data_policy) {
      apiFields.push({ key: 'Sensitive Data Discovery', value: 'Default' });
    }
    // API Testing
    const apiTestingStatus = this.getEnableDisableStatus(
      spec || {},
      'disable_api_testing',
      'api_testing_config',
    );
    if (apiTestingStatus) {
      apiFields.push({
        key: 'API Testing',
        value: apiTestingStatus.value,
        status: apiTestingStatus.enabled ? 'enabled' : 'disabled',
      });
    } else {
      apiFields.push({ key: 'API Testing', value: 'Disable', status: 'disabled' });
    }
    sections.push({ id: 'api-protection', title: 'API Protection', fields: apiFields });

    // 6. Malware Protection
    const malwareFields: FieldDefinition[] = [];
    const malwareStatus = this.getEnableDisableStatus(
      spec || {},
      'disable_malware_protection',
      'malware_protection_setting',
    );
    if (malwareStatus) {
      malwareFields.push({
        key: 'Malware Protection',
        value: malwareStatus.value,
        status: malwareStatus.enabled ? 'enabled' : 'disabled',
      });
    }
    sections.push({ id: 'malware-protection', title: 'Malware Protection', fields: malwareFields });

    // 7. DoS Settings (with sub-groups)
    const mitigationFields: FieldDefinition[] = [];
    const protectionFields: FieldDefinition[] = [];
    const ungroupedDosFields: FieldDefinition[] = [];

    const l7Ddos = spec?.l7_ddos_protection as Record<string, unknown> | undefined;
    if (l7Ddos && !this.isEmpty(l7Ddos)) {
      // Mitigation Settings group
      if (l7Ddos.mitigation_block) {
        mitigationFields.push({ key: 'Mitigation Action', value: 'Block' });
      } else if (l7Ddos.mitigation_captcha_challenge) {
        mitigationFields.push({ key: 'Mitigation Action', value: 'Captcha Challenge' });
      } else if (l7Ddos.mitigation_js_challenge) {
        mitigationFields.push({ key: 'Mitigation Action', value: 'JS Challenge' });
      }
      if (l7Ddos.default_rps_threshold) {
        mitigationFields.push({ key: 'RPS Threshold', value: 'Default' });
      } else if (l7Ddos.rps_threshold) {
        mitigationFields.push({ key: 'RPS Threshold', value: String(l7Ddos.rps_threshold) });
      }

      // Protection Settings group
      if (l7Ddos.clientside_action_none) {
        protectionFields.push({ key: 'Client-Side Challenge', value: 'None' });
      }
      if (l7Ddos.custom_service_policy) {
        protectionFields.push({ key: 'Custom Service Policy', value: 'Configured' });
      } else {
        protectionFields.push({ key: 'Custom Service Policy', value: 'None' });
      }
    }

    // Slow DDoS (ungrouped - at section level)
    if (spec?.system_default_timeouts) {
      ungroupedDosFields.push({ key: 'Slow DDoS Mitigation', value: 'Default' });
    }

    // Build section with sub-groups
    const dosSubGroups: SubGroupDefinition[] = [];
    if (mitigationFields.length > 0) {
      dosSubGroups.push({
        id: 'mitigation',
        title: 'Mitigation Settings',
        fields: mitigationFields,
      });
    }
    if (protectionFields.length > 0) {
      dosSubGroups.push({
        id: 'protection',
        title: 'Protection Settings',
        fields: protectionFields,
      });
    }

    sections.push({
      id: 'dos-settings',
      title: 'DoS Settings',
      subCategoryLabel: dosSubGroups.length > 0 ? 'L7 DDoS Protection Settings' : undefined,
      subGroups: dosSubGroups.length > 0 ? dosSubGroups : undefined,
      fields: ungroupedDosFields,
    });

    // 8. Client-Side Defense (separate section)
    const csdFields: FieldDefinition[] = [];
    const csdStatus = this.getEnableDisableStatus(
      spec || {},
      'disable_client_side_defense',
      'client_side_defense',
    );
    if (csdStatus) {
      csdFields.push({
        key: 'Client-Side Defense',
        value: csdStatus.value,
        status: csdStatus.enabled ? 'enabled' : 'disabled',
      });
    }
    sections.push({ id: 'client-side-defense', title: 'Client-Side Defense', fields: csdFields });

    // 9. Common Security Controls
    const securityFields: FieldDefinition[] = [];
    // Service Policies
    if (spec?.service_policies_from_namespace) {
      securityFields.push({ key: 'Service Policies', value: 'Apply Namespace Service Policies' });
    } else if (spec?.no_service_policies) {
      securityFields.push({ key: 'Service Policies', value: 'None' });
    } else if (spec?.active_service_policies) {
      securityFields.push({ key: 'Service Policies', value: 'Custom' });
    }
    // IP Reputation
    const ipRepStatus = this.getEnableDisableStatus(
      spec || {},
      'disable_ip_reputation',
      'enable_ip_reputation',
    );
    if (ipRepStatus) {
      securityFields.push({
        key: 'IP Reputation',
        value: ipRepStatus.value,
        status: ipRepStatus.enabled ? 'enabled' : 'disabled',
      });
    }
    // Threat Mesh
    const threatMeshStatus = this.getEnableDisableStatus(
      spec || {},
      'disable_threat_mesh',
      'enable_threat_mesh',
    );
    if (threatMeshStatus) {
      securityFields.push({
        key: 'Threat Mesh',
        value: threatMeshStatus.value,
        status: threatMeshStatus.enabled ? 'enabled' : 'disabled',
      });
    }
    // User Identifier
    if (spec?.user_id_client_ip) {
      securityFields.push({ key: 'User Identifier', value: 'Client IP Address' });
    }
    // Malicious User Detection
    const malUserStatus = this.getEnableDisableStatus(
      spec || {},
      'disable_malicious_user_detection',
      'enable_malicious_user_detection',
    );
    if (malUserStatus) {
      securityFields.push({
        key: 'Malicious User Detection',
        value: malUserStatus.value,
        status: malUserStatus.enabled ? 'enabled' : 'disabled',
      });
    }
    // Malicious User Mitigation And Challenges
    const malMitigationStatus = this.getEnableDisableStatus(
      spec || {},
      'no_malicious_user_mitigation',
      'malicious_user_mitigation',
    );
    if (malMitigationStatus) {
      securityFields.push({
        key: 'Malicious User Mitigation And Challenges',
        value: malMitigationStatus.value,
        status: malMitigationStatus.enabled ? 'enabled' : 'disabled',
      });
    } else {
      securityFields.push({
        key: 'Malicious User Mitigation And Challenges',
        value: 'Disable',
        status: 'disabled',
      });
    }
    // Rate Limiting
    const rateStatus = this.getEnableDisableStatus(spec || {}, 'disable_rate_limit', 'rate_limit');
    if (rateStatus) {
      securityFields.push({
        key: 'Rate Limiting',
        value: rateStatus.value,
        status: rateStatus.enabled ? 'enabled' : 'disabled',
      });
    }
    sections.push({
      id: 'security-controls',
      title: 'Common Security Controls',
      fields: securityFields,
    });

    // 9. Other Settings
    const otherFields: FieldDefinition[] = [];
    // VIP Advertisement
    if (spec?.advertise_on_public_default_vip) {
      otherFields.push({ key: 'VIP Advertisement', value: 'Internet' });
    } else if (spec?.advertise_on_public) {
      otherFields.push({ key: 'VIP Advertisement', value: 'Public' });
    } else if (spec?.advertise_custom) {
      otherFields.push({ key: 'VIP Advertisement', value: 'Custom' });
    } else if (spec?.do_not_advertise) {
      otherFields.push({ key: 'VIP Advertisement', value: 'Do Not Advertise' });
    }
    // Load Balancing Algorithm
    if (spec?.round_robin) {
      otherFields.push({ key: 'Load Balancing Algorithm', value: 'Round Robin' });
    } else if (spec?.least_active) {
      otherFields.push({ key: 'Load Balancing Algorithm', value: 'Least Active' });
    } else if (spec?.random) {
      otherFields.push({ key: 'Load Balancing Algorithm', value: 'Random' });
    } else if (spec?.source_ip_stickiness) {
      otherFields.push({ key: 'Load Balancing Algorithm', value: 'Source IP Stickiness' });
    } else if (spec?.cookie_stickiness) {
      otherFields.push({ key: 'Load Balancing Algorithm', value: 'Cookie Stickiness' });
    }
    // Trusted Client IP Headers
    const trustedIpStatus = this.getEnableDisableStatus(
      spec || {},
      'disable_trust_client_ip_headers',
      'enable_trust_client_ip_headers',
    );
    if (trustedIpStatus) {
      otherFields.push({
        key: 'Trusted Client IP Headers',
        value: trustedIpStatus.value,
        status: trustedIpStatus.enabled ? 'enabled' : 'disabled',
      });
    }
    // Add Location
    if (spec?.add_location !== undefined) {
      otherFields.push({ key: 'Add Location', value: spec.add_location ? 'True' : 'False' });
    }
    sections.push({ id: 'other-settings', title: 'Other Settings', fields: otherFields });

    // 10. Virtual Host State
    const vhStateFields: FieldDefinition[] = [];
    const state = spec?.state as string | undefined;
    if (state) {
      const displayState = state.replace('VIRTUAL_HOST_', '');
      const isReady = state.includes('READY');
      vhStateFields.push({
        key: 'Virtual Host State',
        value: displayState,
        status: isReady ? 'good' : 'warning',
      });
    }
    sections.push({ id: 'vh-state', title: 'Virtual Host State', fields: vhStateFields });

    // Certificate sections - only show for HTTPS types (not HTTP)
    // HTTP type has cert_state = "AutoCertNotApplicable" which is not relevant to display
    if (lbType !== 'http') {
      const autoCertInfo = spec?.auto_cert_info as Record<string, unknown> | undefined;

      // 12. Auto Cert State
      const autoCertStateFields: FieldDefinition[] = [];
      if (autoCertInfo?.auto_cert_state) {
        const certState = String(autoCertInfo.auto_cert_state);
        const isValid = certState.toLowerCase().includes('valid');
        autoCertStateFields.push({
          key: 'Auto Cert State',
          value: isValid ? 'Certificate Valid' : certState,
          status: isValid ? 'good' : 'bad',
        });
      }
      sections.push({
        id: 'auto-cert-state',
        title: 'Auto Cert State',
        fields: autoCertStateFields,
      });

      // 13. Auto Cert Expiry Timestamp
      const autoCertExpiryFields: FieldDefinition[] = [];
      if (autoCertInfo?.auto_cert_expiry) {
        const formatted = this.formatDateShort(String(autoCertInfo.auto_cert_expiry));
        autoCertExpiryFields.push({
          key: 'Auto Cert Expiry Timestamp',
          value: formatted || String(autoCertInfo.auto_cert_expiry),
        });
      }
      sections.push({
        id: 'auto-cert-expiry',
        title: 'Auto Cert Expiry Timestamp',
        fields: autoCertExpiryFields,
      });

      // 14. Auto Cert Subject - show full DN value (e.g., "CN=domain.com") for F5 XC Console consistency
      const autoCertSubjectFields: FieldDefinition[] = [];
      if (autoCertInfo?.auto_cert_subject) {
        autoCertSubjectFields.push({
          key: 'Auto Cert Subject',
          value: String(autoCertInfo.auto_cert_subject),
        });
      }
      sections.push({
        id: 'auto-cert-subject',
        title: 'Auto Cert Subject',
        fields: autoCertSubjectFields,
      });

      // 15. Auto Cert Issuer - show full value (organization info is valuable)
      const autoCertIssuerFields: FieldDefinition[] = [];
      if (autoCertInfo?.auto_cert_issuer) {
        autoCertIssuerFields.push({
          key: 'Auto Cert Issuer',
          value: String(autoCertInfo.auto_cert_issuer),
        });
      }
      sections.push({
        id: 'auto-cert-issuer',
        title: 'Auto Cert Issuer',
        fields: autoCertIssuerFields,
      });

      // 16. Cert State
      const certStateFields: FieldDefinition[] = [];
      const certState = spec?.cert_state as string | undefined;
      if (certState) {
        const isValid = certState.toLowerCase().includes('valid');
        certStateFields.push({
          key: 'Cert State',
          value: isValid ? 'Certificate Valid' : certState,
          status: isValid ? 'good' : 'bad',
        });
      }
      sections.push({ id: 'cert-state', title: 'Cert State', fields: certStateFields });
    }

    // Return all sections (empty ones will show "Not Configured")
    return sections;
  }

  /**
   * Extract Origin Pool sections matching F5 XC Console layout
   */
  private extractOriginPoolSections(
    metadata: Record<string, unknown> | undefined,
    _systemMetadata: Record<string, unknown> | undefined,
    spec: Record<string, unknown> | undefined,
    _namespace: string,
  ): SectionDefinition[] {
    const sections: SectionDefinition[] = [];

    // Display name mappings for enums
    const lbAlgorithmDisplay: Record<string, string> = {
      LB_OVERRIDE: 'Load Balancer Override',
      ROUND_ROBIN: 'Round Robin',
      LEAST_ACTIVE: 'Least Active',
      RANDOM: 'Random',
      SOURCE_IP_STICKINESS: 'Source IP Stickiness',
      COOKIE_STICKINESS: 'Cookie Stickiness',
      RING_HASH: 'Ring Hash',
    };

    const endpointSelectionDisplay: Record<string, string> = {
      LOCAL_PREFERRED: 'Local Endpoints Preferred',
      LOCAL_ONLY: 'Local Endpoints Only',
      DISTRIBUTED: 'Distributed',
    };

    // 1. Metadata
    const metadataFields: FieldDefinition[] = [];
    if (metadata?.name) {
      metadataFields.push({ key: 'Name', value: String(metadata.name) });
    }
    sections.push({ id: 'metadata', title: 'Metadata', fields: metadataFields });

    // 2. Origin Servers section with sub-group for servers table
    const serversSubGroupFields: FieldDefinition[] = [];
    const originServers = spec?.origin_servers as Array<Record<string, unknown>> | undefined;
    if (originServers && originServers.length > 0) {
      originServers.forEach((server, index) => {
        const serverInfo = this.getOriginServerTypeAndValue(server);
        serversSubGroupFields.push({
          key: `Server ${index + 1} Type`,
          value: serverInfo.type,
        });
        serversSubGroupFields.push({
          key: `Server ${index + 1} Name/IP`,
          value: serverInfo.value,
        });
        // Add labels if present
        const labels = server.labels as Record<string, string> | undefined;
        if (labels && Object.keys(labels).length > 0) {
          const labelStr = Object.entries(labels)
            .map(([k, v]) => `${k}=${v}`)
            .join(', ');
          serversSubGroupFields.push({
            key: `Server ${index + 1} Labels`,
            value: labelStr,
          });
        }
      });
    }

    // Build sub-groups for Origin Servers section
    const originServersSubGroups: SubGroupDefinition[] = [];
    if (serversSubGroupFields.length > 0) {
      originServersSubGroups.push({
        id: 'servers-list',
        title: 'Origin Servers',
        fields: serversSubGroupFields,
      });
    }

    // Fields below the sub-group (port, connection pool, health check, LB algo, endpoint selection)
    const originServersFields: FieldDefinition[] = [];

    // Origin Server Port
    if (spec?.port !== undefined) {
      originServersFields.push({ key: 'Origin server Port', value: 'Port' });
      originServersFields.push({ key: 'Port', value: String(spec.port) });
    }

    // Connection Pool Reuse
    const connPoolType = spec?.upstream_conn_pool_reuse_type as Record<string, unknown> | undefined;
    if (connPoolType) {
      if ('enable_conn_pool_reuse' in connPoolType) {
        originServersFields.push({
          key: 'Select upstream connection pool reuse state',
          value: 'Enable Connection Pool Reuse',
          status: 'enabled',
        });
      } else if ('disable_conn_pool_reuse' in connPoolType) {
        originServersFields.push({
          key: 'Select upstream connection pool reuse state',
          value: 'Disable Connection Pool Reuse',
          status: 'disabled',
        });
      }
    }

    // Health Check Port
    if ('same_as_endpoint_port' in (spec || {})) {
      originServersFields.push({ key: 'Port used for health check', value: 'Endpoint port' });
    } else if (spec?.port_override !== undefined) {
      originServersFields.push({
        key: 'Port used for health check',
        value: String(spec.port_override),
      });
    }

    // Load Balancer Algorithm
    if (spec?.loadbalancer_algorithm) {
      const algo = String(spec.loadbalancer_algorithm);
      originServersFields.push({
        key: 'LoadBalancer Algorithm',
        value: lbAlgorithmDisplay[algo] || algo,
      });
    }

    // Endpoint Selection
    if (spec?.endpoint_selection) {
      const selection = String(spec.endpoint_selection);
      originServersFields.push({
        key: 'Endpoint Selection',
        value: endpointSelectionDisplay[selection] || selection,
      });
    }

    sections.push({
      id: 'origin-servers',
      title: 'Origin Servers',
      subGroups: originServersSubGroups.length > 0 ? originServersSubGroups : undefined,
      fields: originServersFields,
    });

    // 3. TLS
    const tlsFields: FieldDefinition[] = [];
    if ('no_tls' in (spec || {})) {
      tlsFields.push({ key: 'TLS', value: 'Disable', status: 'disabled' });
    } else if (spec?.use_tls) {
      tlsFields.push({ key: 'TLS', value: 'Enable', status: 'enabled' });
      // Extract TLS settings if present
      const tlsConfig = spec.use_tls as Record<string, unknown>;
      if (tlsConfig) {
        if ('use_host_header_as_sni' in tlsConfig) {
          tlsFields.push({ key: 'SNI', value: 'Use Host Header as SNI' });
        } else if (tlsConfig.sni) {
          tlsFields.push({ key: 'SNI', value: String(tlsConfig.sni) });
        }
        if ('skip_server_verification' in tlsConfig) {
          tlsFields.push({ key: 'Server Verification', value: 'Skip', status: 'warning' });
        } else if ('use_server_verification' in tlsConfig) {
          tlsFields.push({ key: 'Server Verification', value: 'Enable', status: 'enabled' });
        }
        if ('volterra_trusted_ca' in tlsConfig) {
          tlsFields.push({ key: 'Trusted CA', value: 'F5 Distributed Cloud Trusted CA' });
        }
      }
    }
    sections.push({ id: 'tls', title: 'TLS', fields: tlsFields });

    return sections;
  }

  /**
   * Get origin server type and value from server configuration
   */
  private getOriginServerTypeAndValue(server: Record<string, unknown>): {
    type: string;
    value: string;
  } {
    if (server.public_ip) {
      const ip = server.public_ip as Record<string, unknown>;
      return { type: 'Public IP', value: String(ip.ip || 'Unknown') };
    }
    if (server.private_ip) {
      const ip = server.private_ip as Record<string, unknown>;
      const ipValue = String(ip.ip || 'Unknown');
      const site = ip.site_locator as Record<string, unknown> | undefined;
      const siteRef = site?.site as Record<string, unknown> | undefined;
      const siteName = siteRef?.name ? ` (${String(siteRef.name)})` : '';
      return { type: 'Private IP', value: `${ipValue}${siteName}` };
    }
    if (server.public_name) {
      const dns = server.public_name as Record<string, unknown>;
      return { type: 'Public DNS', value: String(dns.dns_name || 'Unknown') };
    }
    if (server.private_name) {
      const dns = server.private_name as Record<string, unknown>;
      const dnsName = String(dns.dns_name || 'Unknown');
      const site = dns.site_locator as Record<string, unknown> | undefined;
      const siteRef = site?.site as Record<string, unknown> | undefined;
      const siteName = siteRef?.name ? ` (${String(siteRef.name)})` : '';
      return { type: 'Private DNS', value: `${dnsName}${siteName}` };
    }
    if (server.k8s_service) {
      const k8s = server.k8s_service as Record<string, unknown>;
      const name = String(k8s.service_name || 'Unknown');
      const ns = k8s.service_namespace ? `${String(k8s.service_namespace)}/` : '';
      return { type: 'K8s Service', value: `${ns}${name}` };
    }
    if (server.consul_service) {
      const consul = server.consul_service as Record<string, unknown>;
      return { type: 'Consul Service', value: String(consul.service_name || 'Unknown') };
    }
    if (server.custom_endpoint_object) {
      const custom = server.custom_endpoint_object as Record<string, unknown>;
      const endpoint = custom.endpoint as Record<string, unknown> | undefined;
      return { type: 'Custom Endpoint', value: String(endpoint?.name || 'Unknown') };
    }
    if (server.vn_private_ip) {
      const vn = server.vn_private_ip as Record<string, unknown>;
      return { type: 'VN Private IP', value: String(vn.ip || 'Unknown') };
    }
    if (server.vn_private_name) {
      const vn = server.vn_private_name as Record<string, unknown>;
      return { type: 'VN Private DNS', value: String(vn.dns_name || 'Unknown') };
    }
    return { type: 'Unknown', value: 'Unknown' };
  }

  /**
   * Extract generic sections for unknown resource types
   */
  private extractGenericSections(
    metadata: Record<string, unknown> | undefined,
    systemMetadata: Record<string, unknown> | undefined,
    spec: Record<string, unknown> | undefined,
    namespace: string,
  ): SectionDefinition[] {
    const sections: SectionDefinition[] = [];

    // Metadata section
    const metadataFields: FieldDefinition[] = [];
    if (metadata?.name) {
      metadataFields.push({ key: 'Name', value: String(metadata.name) });
    }
    metadataFields.push({ key: 'Namespace', value: namespace });
    if (metadata?.description) {
      metadataFields.push({ key: 'Description', value: String(metadata.description) });
    }
    // Creator information from system metadata
    if (systemMetadata?.creator_id) {
      metadataFields.push({ key: 'Creator', value: String(systemMetadata.creator_id) });
    }
    // Creation timestamp
    const createTime = this.formatTimestamp(
      systemMetadata?.creation_timestamp as string | undefined,
    );
    if (createTime) {
      metadataFields.push({ key: 'Created', value: createTime });
    }
    const modTime = this.formatTimestamp(
      systemMetadata?.modification_timestamp as string | undefined,
    );
    if (modTime) {
      metadataFields.push({ key: 'Last Modified', value: modTime });
    }
    // Unique identifier
    if (systemMetadata?.uid) {
      metadataFields.push({ key: 'UID', value: String(systemMetadata.uid) });
    }
    // Labels (key-value pairs for organization)
    if (metadata?.labels && Object.keys(metadata.labels as object).length > 0) {
      const labels = metadata.labels as Record<string, string>;
      const labelStr = Object.entries(labels)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      metadataFields.push({ key: 'Labels', value: labelStr });
    }
    sections.push({ id: 'metadata', title: 'Metadata', fields: metadataFields });

    // Spec section - show all non-empty scalar fields
    if (spec) {
      const specFields: FieldDefinition[] = [];
      for (const [key, value] of Object.entries(spec)) {
        if (this.isEmpty(value)) {
          continue;
        }
        if (typeof value === 'object') {
          continue;
        }
        specFields.push({ key: this.formatKey(key), value: String(value) });
      }
      if (specFields.length > 0) {
        sections.push({ id: 'spec', title: 'Configuration', fields: specFields });
      }
    }

    return sections;
  }

  /**
   * Render a section as HTML
   */
  private renderSection(section: SectionDefinition): string {
    // Show "Not Configured" for empty sections (no fields and no sub-groups)
    const hasContent =
      section.fields.length > 0 || (section.subGroups && section.subGroups.length > 0);
    if (!hasContent) {
      return `
      <section class="section" id="section-${section.id}">
        <h3 class="section-header">${this.escapeHtml(section.title)}</h3>
        <div class="section-body">
          <div class="not-configured">Not Configured</div>
        </div>
      </section>
      `;
    }

    // Check for single-field section with matching key - render as compact inline row
    // This eliminates redundant headers like "Virtual Host State" -> "Virtual Host State: READY"
    const firstField = section.fields[0];
    const isSingleFieldWithMatchingKey =
      section.fields.length === 1 &&
      (!section.subGroups || section.subGroups.length === 0) &&
      !section.subCategoryLabel &&
      firstField?.key === section.title;

    if (isSingleFieldWithMatchingKey) {
      return this.renderCompactSection(section);
    }

    // Build sub-category label if present
    const subCategoryHtml = section.subCategoryLabel
      ? `<div class="sub-category-label">${this.escapeHtml(section.subCategoryLabel)}</div>`
      : '';

    // Build sub-groups HTML
    const subGroupsHtml = section.subGroups
      ? section.subGroups.map((sg) => this.renderSubGroup(sg)).join('\n')
      : '';

    // Build ungrouped fields HTML
    const ungroupedFieldsHtml =
      section.fields.length > 0
        ? `<div class="ungrouped-fields">${this.renderFields(section.fields)}</div>`
        : '';

    return `
      <section class="section" id="section-${section.id}">
        <h3 class="section-header">${this.escapeHtml(section.title)}</h3>
        <div class="section-body">
          ${subCategoryHtml}
          ${subGroupsHtml}
          ${ungroupedFieldsHtml}
        </div>
      </section>
    `;
  }

  /**
   * Render quota widget showing resource usage vs limit
   */
  private renderQuotaWidget(quotaInfo: QuotaItem, _resourceType: string): string {
    const percentUsed = quotaInfo.percentUsed;
    const available = quotaInfo.limit - quotaInfo.usage;

    // Determine color based on usage percentage
    let progressColor = 'var(--vscode-testing-iconPassed, #73c991)'; // Green
    let statusText = 'Good';
    if (percentUsed >= 80) {
      progressColor = 'var(--vscode-testing-iconFailed, #f14c4c)'; // Red
      statusText = 'Critical';
    } else if (percentUsed >= 60) {
      progressColor = 'var(--vscode-testing-iconQueued, #cca700)'; // Yellow
      statusText = 'Warning';
    }

    return `
      <div class="quota-widget">
        <div class="quota-header">
          <span class="quota-title">Resource Quota</span>
          <span class="quota-status" style="color: ${progressColor}">${statusText}</span>
        </div>
        <div class="quota-content">
          <div class="quota-info">
            <span class="quota-label">Resource Type:</span>
            <span class="quota-value">${this.escapeHtml(quotaInfo.displayName)}</span>
          </div>
          <div class="quota-info">
            <span class="quota-label">Used:</span>
            <span class="quota-value">${quotaInfo.usage} of ${quotaInfo.limit}</span>
          </div>
          <div class="quota-info">
            <span class="quota-label">Available:</span>
            <span class="quota-value">${available}</span>
          </div>
          <div class="quota-progress-container">
            <div class="quota-progress-bar">
              <div class="quota-progress-fill" style="width: ${Math.min(percentUsed, 100)}%; background: ${progressColor}"></div>
            </div>
            <span class="quota-percent">${percentUsed}%</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render a subtle fallback when quota info is unavailable
   */
  private renderQuotaUnavailable(resourceType: string): string {
    return `
      <div class="quota-widget quota-unavailable">
        <div class="quota-header">
          <span class="quota-title">Resource Quota</span>
          <span class="quota-status" style="color: var(--vscode-descriptionForeground)">Unavailable</span>
        </div>
        <div class="quota-content">
          <div class="quota-info">
            <span class="quota-label">Resource Type:</span>
            <span class="quota-value">${this.escapeHtml(resourceType)}</span>
          </div>
          <div class="quota-info">
            <span class="quota-value" style="color: var(--vscode-descriptionForeground); font-style: italic;">
              Quota information is not available for this resource type.
            </span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render a compact section for single-field sections where field key matches title
   * This eliminates redundant headers and renders as a simple inline row
   */
  private renderCompactSection(section: SectionDefinition): string {
    const field = section.fields[0];
    // Safety check (should never happen as this is only called for single-field sections)
    if (!field) {
      return '';
    }

    const statusClass = field.status ? ` status-${field.status}` : '';
    const statusIcon = this.getStatusIcon(field.status);
    const keyLower = field.key?.toLowerCase() || '';
    const valueLower = field.value?.toLowerCase() || '';

    return `
      <section class="section section-compact" id="section-${section.id}">
        <div class="field-row compact-row" data-key="${this.escapeHtml(keyLower)}" data-value="${this.escapeHtml(valueLower)}">
          <span class="field-key">${this.escapeHtml(field.key)}:</span>
          <span class="field-value${statusClass}">${statusIcon}${this.escapeHtml(field.value)}</span>
        </div>
      </section>
    `;
  }

  /**
   * Render a sub-group with boxed container
   */
  private renderSubGroup(subGroup: SubGroupDefinition): string {
    return `
      <div class="sub-group" id="subgroup-${subGroup.id}">
        <div class="sub-group-header">${this.escapeHtml(subGroup.title)}</div>
        ${this.renderFields(subGroup.fields)}
      </div>
    `;
  }

  /**
   * Render an array of fields as field rows
   */
  private renderFields(fields: FieldDefinition[]): string {
    return fields
      .map((field) => {
        const statusClass = field.status ? ` status-${field.status}` : '';
        const statusIcon = this.getStatusIcon(field.status);
        return `
        <div class="field-row" data-key="${this.escapeHtml(field.key.toLowerCase())}" data-value="${this.escapeHtml(field.value.toLowerCase())}">
          <span class="field-icon"></span>
          <span class="field-key">${this.escapeHtml(field.key)}</span>
          <span class="field-value${statusClass}">${statusIcon}${this.escapeHtml(field.value)}</span>
        </div>`;
      })
      .join('\n');
  }

  /**
   * Get status icon based on status
   */
  private getStatusIcon(status: string | undefined): string {
    switch (status) {
      case 'enabled':
      case 'good':
        return '<span class="status-icon good"></span>';
      case 'disabled':
      case 'bad':
        return '<span class="status-icon bad"></span>';
      case 'warning':
        return '<span class="status-icon warning"></span>';
      default:
        return '';
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
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
      margin: 0;
      padding: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Toolbar */
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background: linear-gradient(135deg, #6b2fad 0%, #0076d6 100%);
      border-bottom: 1px solid var(--vscode-panel-border);
      gap: 16px;
      flex-shrink: 0;
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .resource-type {
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      white-space: nowrap;
    }

    .resource-name {
      color: white;
      font-weight: 600;
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .toolbar-center {
      display: flex;
      gap: 4px;
    }

    .tab-btn {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: rgba(255, 255, 255, 0.8);
      padding: 6px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.15s;
      white-space: nowrap;
    }

    .tab-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }

    .tab-btn.active {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border-color: white;
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .search-input {
      width: 160px;
      padding: 6px 12px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.1);
      color: white;
      font-size: 12px;
    }

    .search-input::placeholder {
      color: rgba(255, 255, 255, 0.5);
    }

    .search-input:focus {
      outline: none;
      border-color: white;
      background: rgba(255, 255, 255, 0.15);
    }

    .edit-btn {
      background: white;
      color: #6b2fad;
      border: none;
      padding: 6px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      font-size: 12px;
      transition: all 0.15s;
      white-space: nowrap;
    }

    .edit-btn:hover {
      background: #f0f0f0;
    }

    /* Container */
    .container {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* Sidebar */
    .sidebar {
      width: 200px;
      min-width: 200px;
      background: var(--vscode-sideBar-background);
      border-right: 1px solid var(--vscode-panel-border);
      overflow-y: auto;
      padding: 8px 0;
      flex-shrink: 0;
    }

    .nav-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .nav-item {
      padding: 8px 16px;
      cursor: pointer;
      font-size: 12px;
      color: var(--vscode-sideBar-foreground);
      border-left: 3px solid transparent;
      transition: all 0.1s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .nav-item:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .nav-item.active {
      background: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
      border-left-color: #6b2fad;
    }

    /* Main Content */
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 16px 24px;
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    /* Sections */
    .section {
      margin-bottom: 24px;
      scroll-margin-top: 16px;
    }

    .section.hidden {
      display: none;
    }

    /* Compact section - single-field sections without redundant header */
    .section-compact {
      margin-bottom: 8px;
      padding: 8px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .section-compact .compact-row {
      padding: 4px 0;
    }

    .section-compact .field-key {
      color: var(--vscode-symbolIcon-classForeground);
      font-weight: 600;
    }

    .section-header {
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-symbolIcon-classForeground);
      margin: 0 0 12px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .section-body {
      display: flex;
      flex-direction: column;
    }

    /* Sub-category label */
    .sub-category-label {
      font-size: 12px;
      font-weight: 500;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 12px;
      padding-left: 8px;
    }

    /* Sub-group box container */
    .sub-group {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      margin-bottom: 16px;
      padding: 12px;
      background: var(--vscode-editor-background);
    }

    .sub-group-header {
      font-size: 12px;
      font-weight: 600;
      color: var(--vscode-editor-foreground);
      margin-bottom: 8px;
      padding-bottom: 4px;
    }

    .sub-group .field-row {
      padding: 4px 8px;
    }

    /* Ungrouped fields after sub-groups */
    .ungrouped-fields {
      margin-top: 8px;
    }

    .not-configured {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      padding: 8px;
      font-size: 12px;
    }

    /* Field Rows */
    .field-row {
      display: flex;
      align-items: flex-start;
      padding: 6px 8px;
      gap: 12px;
      border-radius: 3px;
    }

    .field-row:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .field-row.hidden {
      display: none;
    }

    .field-icon {
      width: 16px;
      flex-shrink: 0;
    }

    .field-key {
      color: var(--vscode-descriptionForeground);
      min-width: 200px;
      flex-shrink: 0;
      font-size: 12px;
    }

    .field-value {
      color: var(--vscode-editor-foreground);
      word-break: break-word;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Status Icons */
    .status-icon {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .status-icon.good {
      background-color: var(--vscode-testing-iconPassed, #73c991);
    }

    .status-icon.bad {
      background-color: var(--vscode-testing-iconFailed, #f14c4c);
    }

    .status-icon.warning {
      background-color: var(--vscode-testing-iconQueued, #cca700);
    }

    .status-enabled, .status-good {
      color: var(--vscode-testing-iconPassed, #73c991);
    }

    .status-disabled, .status-bad {
      color: var(--vscode-testing-iconFailed, #f14c4c);
    }

    .status-warning {
      color: var(--vscode-testing-iconQueued, #cca700);
    }

    /* Quota Widget */
    .quota-widget {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 20px;
    }

    .quota-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .quota-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-symbolIcon-classForeground);
    }

    .quota-status {
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
    }

    .quota-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .quota-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
    }

    .quota-label {
      color: var(--vscode-descriptionForeground);
      min-width: 100px;
    }

    .quota-value {
      color: var(--vscode-editor-foreground);
      font-weight: 500;
    }

    .quota-progress-container {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 4px;
    }

    .quota-progress-bar {
      flex: 1;
      height: 8px;
      background: var(--vscode-progressBar-background, rgba(255, 255, 255, 0.1));
      border-radius: 4px;
      overflow: hidden;
    }

    .quota-progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .quota-percent {
      font-size: 12px;
      font-weight: 600;
      min-width: 40px;
      text-align: right;
      color: var(--vscode-editor-foreground);
    }

    /* Quota unavailable state */
    .quota-unavailable {
      opacity: 0.7;
      border-color: var(--vscode-panel-border, rgba(255, 255, 255, 0.1));
    }

    .quota-unavailable .quota-header {
      background: var(--vscode-sideBar-background, rgba(255, 255, 255, 0.03));
    }

    /* JSON View */
    .json-content {
      background: var(--vscode-textCodeBlock-background);
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 12px;
      line-height: 1.5;
      white-space: pre;
      margin: 0;
    }

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
      const tabButtons = document.querySelectorAll('.tab-btn');
      const tabContents = document.querySelectorAll('.tab-content');
      const navItems = document.querySelectorAll('.nav-item');
      const searchInput = document.querySelector('.search-input');
      const editButton = document.querySelector('.edit-btn');
      const sections = document.querySelectorAll('.section');
      const content = document.querySelector('.content');

      // Tab Switching
      tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.dataset.tab;

          if (tab === 'documentation') {
            vscode.postMessage({ command: 'openDocumentation' });
            return;
          }

          tabButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          tabContents.forEach(c => {
            c.classList.remove('active');
            if (c.id === tab + '-view') {
              c.classList.add('active');
            }
          });
        });
      });

      // Sidebar Navigation
      navItems.forEach(item => {
        item.addEventListener('click', () => {
          const sectionId = item.dataset.section;
          const targetSection = document.getElementById('section-' + sectionId);

          if (targetSection) {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });

      // Search Filtering
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const fieldRows = document.querySelectorAll('.field-row');

        if (!query) {
          fieldRows.forEach(row => row.classList.remove('hidden'));
          sections.forEach(section => section.classList.remove('hidden'));
          return;
        }

        fieldRows.forEach(row => {
          const key = row.dataset.key || '';
          const value = row.dataset.value || '';
          if (key.includes(query) || value.includes(query)) {
            row.classList.remove('hidden');
          } else {
            row.classList.add('hidden');
          }
        });

          sections.forEach(section => {
            const visibleRows = section.querySelectorAll('.field-row:not(.hidden)');
            if (visibleRows.length === 0) {
              section.classList.add('hidden');
            } else {
              section.classList.remove('hidden');
            }
          });
        });
      }

      // Edit Button
      if (editButton) {
        editButton.addEventListener('click', () => {
          vscode.postMessage({ command: 'editResource' });
        });
      }

      // Intersection Observer for active section tracking
      const observerOptions = {
        root: content,
        rootMargin: '-10% 0px -80% 0px',
        threshold: 0
      };

      const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.id.replace('section-', '');
            navItems.forEach(item => {
              if (item.dataset.section === sectionId) {
                item.classList.add('active');
              } else {
                item.classList.remove('active');
              }
            });
          }
        });
      }, observerOptions);

      sections.forEach(section => sectionObserver.observe(section));

      // Set first nav item as active
      if (navItems.length > 0) {
        navItems[0].classList.add('active');
      }
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
