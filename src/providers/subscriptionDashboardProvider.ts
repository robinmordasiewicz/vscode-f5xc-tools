// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * WebView provider for subscription plan and quota dashboards
 */

import * as vscode from 'vscode';
import { ProfileManager } from '../config/profiles';
import {
  getCurrentPlan,
  getQuotaUsage,
  getAddonActivationStatus,
  createAddonSubscription,
  PlanInfo,
  QuotaUsage,
  QuotaItem,
  AddonService,
  AccessStatus,
} from '../api/subscription';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Provider for subscription-related webview panels
 */
export class SubscriptionDashboardProvider {
  private planPanel: vscode.WebviewPanel | undefined;
  private quotasPanel: vscode.WebviewPanel | undefined;

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
   * Show the Plan dashboard
   */
  async showPlan(profileName: string): Promise<void> {
    try {
      logger.debug(`Showing plan dashboard for profile: ${profileName}`);

      const client = await this.profileManager.getClient(profileName);
      const planInfo = await getCurrentPlan(client);

      // Get available addons (not included in plan)
      const availableAddons = planInfo.allowedAddonServices.filter(
        (addon) => !planInfo.includedAddonServices.some((inc) => inc.name === addon.name),
      );

      // Fetch access statuses for available addons
      const accessStatuses = await this.getAddonAccessStatuses(profileName, availableAddons);

      if (this.planPanel) {
        this.planPanel.reveal(vscode.ViewColumn.Beside);
      } else {
        this.planPanel = vscode.window.createWebviewPanel(
          'f5xcPlanDashboard',
          'Subscription Plan',
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [],
          },
        );

        this.planPanel.onDidDispose(() => {
          this.planPanel = undefined;
        });

        // Handle webview messages
        this.planPanel.webview.onDidReceiveMessage(
          async (message: { command: string; addonName?: string; addonDisplayName?: string }) => {
            if (message.command === 'refresh') {
              await this.showPlan(profileName);
            } else if (message.command === 'activateAddon' && message.addonName) {
              await this.handleActivateAddon(
                message.addonName,
                message.addonDisplayName || message.addonName,
                profileName,
              );
            }
          },
        );
      }

      this.planPanel.webview.html = this.getPlanWebviewContent(planInfo, accessStatuses);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to show plan dashboard: ${message}`);
      void vscode.window.showErrorMessage(`Failed to load subscription plan: ${message}`);
    }
  }

  /**
   * Show the Quotas dashboard
   */
  async showQuotas(profileName: string): Promise<void> {
    try {
      logger.debug(`Showing quotas dashboard for profile: ${profileName}`);

      const client = await this.profileManager.getClient(profileName);
      const quotaUsage = await getQuotaUsage(client, 'system');

      if (this.quotasPanel) {
        this.quotasPanel.reveal(vscode.ViewColumn.Beside);
      } else {
        this.quotasPanel = vscode.window.createWebviewPanel(
          'f5xcQuotasDashboard',
          'Quota Usage',
          vscode.ViewColumn.Beside,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [],
          },
        );

        this.quotasPanel.onDidDispose(() => {
          this.quotasPanel = undefined;
        });

        // Handle refresh message
        this.quotasPanel.webview.onDidReceiveMessage(async (message: { command: string }) => {
          if (message.command === 'refresh') {
            await this.showQuotas(profileName);
          }
        });
      }

      this.quotasPanel.webview.html = this.getQuotasWebviewContent(quotaUsage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to show quotas dashboard: ${message}`);
      void vscode.window.showErrorMessage(`Failed to load quota usage: ${message}`);
    }
  }

  /**
   * Handle addon activation request from webview
   */
  private async handleActivateAddon(
    addonName: string,
    addonDisplayName: string,
    profileName: string,
  ): Promise<void> {
    // Show confirmation dialog
    const confirm = await vscode.window.showInformationMessage(
      `Activate "${addonDisplayName}"?\n\nThis will create a pending subscription request. Activation may require approval from F5 support.`,
      { modal: true },
      'Activate',
      'Cancel',
    );

    if (confirm !== 'Activate') {
      return;
    }

    try {
      const client = await this.profileManager.getClient(profileName);

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Activating ${addonDisplayName}...`,
          cancellable: false,
        },
        async () => {
          const response = await createAddonSubscription(client, addonName, 'system');
          logger.info(`Addon subscription created: ${response.metadata?.name}`);
        },
      );

      void vscode.window.showInformationMessage(
        `Activation request submitted for "${addonDisplayName}". Status: Pending approval.`,
      );

      // Refresh the dashboard to show updated status
      await this.showPlan(profileName);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to activate addon ${addonName}: ${errorMessage}`);
      void vscode.window.showErrorMessage(`Failed to activate addon: ${errorMessage}`);
    }
  }

  /**
   * Get access status for available addons
   */
  private async getAddonAccessStatuses(
    profileName: string,
    addons: AddonService[],
  ): Promise<Map<string, AccessStatus>> {
    const accessStatuses = new Map<string, AccessStatus>();

    try {
      const client = await this.profileManager.getClient(profileName);

      // Fetch access status for each addon in parallel
      const statusPromises = addons.map(async (addon) => {
        try {
          const status = await getAddonActivationStatus(client, addon.name);
          return { name: addon.name, accessStatus: status.accessStatus || 'AS_AC_ALLOWED' };
        } catch {
          return { name: addon.name, accessStatus: 'AS_AC_ALLOWED' as AccessStatus };
        }
      });

      const statuses = await Promise.all(statusPromises);
      statuses.forEach(({ name, accessStatus }) => {
        accessStatuses.set(name, accessStatus);
      });
    } catch (error) {
      logger.warn('Failed to fetch addon access statuses:', error as Error);
    }

    return accessStatuses;
  }

  /**
   * Generate Plan dashboard HTML
   */
  private getPlanWebviewContent(
    planInfo: PlanInfo,
    accessStatuses: Map<string, AccessStatus>,
  ): string {
    const nonce = this.getNonce();
    const cspSource = this.planPanel!.webview.cspSource;

    const tierBadge =
      planInfo.tier === 'advanced'
        ? '<span class="tier-badge tier-advanced">Advanced</span>'
        : '<span class="tier-badge tier-standard">Standard</span>';

    // Group addons by category
    const addonsByCategory = this.groupAddonsByCategory(planInfo.includedAddonServices);
    const availableByCategory = this.groupAddonsByCategory(
      planInfo.allowedAddonServices.filter(
        (addon) => !planInfo.includedAddonServices.some((inc) => inc.name === addon.name),
      ),
    );

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
<body>
  <!-- Top Toolbar -->
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="resource-type">Subscription</span>
      <span class="resource-name">Plan</span>
    </div>
    <div class="toolbar-right">
      <button class="refresh-btn" onclick="refresh()">⟳ Refresh</button>
    </div>
  </div>

  <!-- Main Content -->
  <div class="container">
    <main class="content">
      <!-- Plan Overview Card -->
      <div class="card plan-card">
        <div class="card-header">
          <h2>Plan Overview</h2>
          ${tierBadge}
        </div>
        <div class="card-body">
          <div class="plan-title">${this.escapeHtml(planInfo.title)}</div>
          ${planInfo.subtitle ? `<div class="plan-subtitle">${this.escapeHtml(planInfo.subtitle)}</div>` : ''}
          ${planInfo.description ? `<div class="plan-description">${this.escapeHtml(planInfo.description)}</div>` : ''}
        </div>
      </div>

      <!-- Active Addons Section -->
      <div class="section">
        <h3 class="section-header">Active Addon Services</h3>
        ${this.renderAddonsByCategory(addonsByCategory, true)}
        ${
          planInfo.includedAddonServices.length === 0
            ? '<div class="empty-state">No addon services currently active</div>'
            : ''
        }
      </div>

      <!-- Available Addons Section -->
      <div class="section">
        <h3 class="section-header">Available Addon Services</h3>
        ${this.renderAddonsByCategory(availableByCategory, false, accessStatuses)}
        ${
          Object.keys(availableByCategory).length === 0
            ? '<div class="empty-state">All available addon services are active</div>'
            : ''
        }
      </div>
    </main>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    function refresh() {
      vscode.postMessage({ command: 'refresh' });
    }

    function activateAddon(addonName, addonDisplayName) {
      vscode.postMessage({
        command: 'activateAddon',
        addonName: addonName,
        addonDisplayName: addonDisplayName
      });
    }
  </script>
</body>
</html>`;
  }

  /**
   * Group addons by category
   */
  private groupAddonsByCategory(addons: AddonService[]): Record<string, AddonService[]> {
    return addons.reduce<Record<string, AddonService[]>>((grouped, addon) => {
      const category = addon.category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(addon);
      return grouped;
    }, {});
  }

  /**
   * Render addons grouped by category
   */
  private renderAddonsByCategory(
    grouped: Record<string, AddonService[]>,
    isActive: boolean,
    accessStatuses?: Map<string, AccessStatus>,
  ): string {
    if (Object.keys(grouped).length === 0) {
      return '';
    }

    const categoryLabels: Record<string, string> = {
      bot_defense: 'Bot Defense',
      waap: 'Web App & API Protection',
      securemesh: 'SecureMesh',
      appstack: 'App Stack',
      dns: 'DNS Services',
      observability: 'Observability',
      other: 'Other Services',
    };

    return Object.entries(grouped)
      .map(
        ([category, addons]) => `
      <div class="addon-group">
        <div class="addon-group-header">${categoryLabels[category] || category}</div>
        <div class="addon-list">
          ${addons.map((addon) => this.renderAddonItem(addon, isActive, addons.length > 1, accessStatuses?.get(addon.name))).join('')}
        </div>
      </div>
    `,
      )
      .join('');
  }

  /**
   * Render a single addon item
   * When showName is false (single addon in category), we omit the name since
   * the category header already shows it. When showName is true (multiple addons
   * in same category), we show the name to distinguish between them.
   * For available (inactive) addons, shows an Activate button based on accessStatus.
   */
  private renderAddonItem(
    addon: AddonService,
    isActive: boolean,
    showName: boolean,
    accessStatus?: AccessStatus,
  ): string {
    const tierClass = addon.tier === 'advanced' ? 'tier-advanced' : 'tier-standard';
    const statusIcon = isActive ? '✓' : '';
    const statusClass = isActive ? 'addon-active' : 'addon-available';
    const tierLabel = addon.tier === 'advanced' ? 'Advanced' : 'Standard';

    // Show addon name only when there are multiple addons in the same category
    const nameHtml = showName
      ? `<span class="addon-name">${this.escapeHtml(addon.displayName)}</span>`
      : '';

    // Generate activate button for available (not active) addons
    let actionHtml = '';
    if (!isActive) {
      actionHtml = this.renderActivateButton(addon, accessStatus);
    }

    return `
      <div class="addon-item ${statusClass}">
        ${nameHtml}
        <span class="addon-tier ${tierClass}">${tierLabel}</span>
        ${isActive ? `<span class="addon-status">${statusIcon}</span>` : actionHtml}
      </div>
    `;
  }

  /**
   * Render activate button based on access status
   */
  private renderActivateButton(addon: AddonService, accessStatus?: AccessStatus): string {
    const escapedName = this.escapeHtml(addon.name);
    const escapedDisplayName = this.escapeHtml(addon.displayName);

    // Determine button state based on access status
    switch (accessStatus) {
      case 'AS_AC_PBAC_DENY_UPGRADE_PLAN':
        return `
          <button class="activate-btn disabled" disabled title="Upgrade your plan to enable this addon">
            Upgrade Plan
          </button>
        `;

      case 'AS_AC_PBAC_DENY_CONTACT_SALES':
        return `
          <button class="activate-btn disabled" disabled title="Contact F5 Sales to enable this addon">
            Contact Sales
          </button>
        `;

      case 'AS_AC_PBAC_DENY':
      case 'AS_AC_PBAC_DENY_AS_AC_EOL':
        return `
          <button class="activate-btn disabled" disabled title="This addon is not available for your account">
            Not Available
          </button>
        `;

      case 'AS_AC_ALLOWED':
      case 'AS_AC_NONE':
      default:
        return `
          <button class="activate-btn" onclick="activateAddon('${escapedName}', '${escapedDisplayName}')" title="Request activation for this addon">
            Activate →
          </button>
        `;
    }
  }

  /**
   * Generate Quotas dashboard HTML
   */
  private getQuotasWebviewContent(quotaUsage: QuotaUsage): string {
    const nonce = this.getNonce();
    const cspSource = this.quotasPanel!.webview.cspSource;

    // Calculate summary stats
    const allItems = [...quotaUsage.objects, ...quotaUsage.resources];
    const totalUsed = allItems.reduce((sum, item) => sum + item.usage, 0);
    const totalLimit = allItems.reduce((sum, item) => sum + item.limit, 0);
    const criticalItems = allItems.filter((item) => item.percentUsed >= 80);

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
<body>
  <!-- Top Toolbar -->
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="resource-type">Subscription</span>
      <span class="resource-name">Quotas</span>
    </div>
    <div class="toolbar-right">
      <button class="refresh-btn" onclick="refresh()">⟳ Refresh</button>
    </div>
  </div>

  <!-- Main Content -->
  <div class="container">
    <main class="content">
      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-value">${totalUsed}</div>
          <div class="summary-label">Total Used</div>
        </div>
        <div class="summary-card">
          <div class="summary-value">${totalLimit}</div>
          <div class="summary-label">Total Limit</div>
        </div>
        <div class="summary-card ${criticalItems.length > 0 ? 'warning' : ''}">
          <div class="summary-value">${criticalItems.length}</div>
          <div class="summary-label">Critical (≥80%)</div>
        </div>
      </div>

      <!-- Object Quotas -->
      ${
        quotaUsage.objects.length > 0
          ? `
      <div class="section">
        <h3 class="section-header">Object Quotas</h3>
        <div class="quota-table">
          ${quotaUsage.objects.map((item) => this.renderQuotaItem(item)).join('')}
        </div>
      </div>
      `
          : ''
      }

      <!-- Resource Quotas -->
      ${
        quotaUsage.resources.length > 0
          ? `
      <div class="section">
        <h3 class="section-header">Resource Quotas</h3>
        <div class="quota-table">
          ${quotaUsage.resources.map((item) => this.renderQuotaItem(item)).join('')}
        </div>
      </div>
      `
          : ''
      }

      <!-- API Rate Limits -->
      ${
        quotaUsage.apis.length > 0
          ? `
      <div class="section">
        <h3 class="section-header">API Rate Limits</h3>
        <div class="quota-table">
          ${quotaUsage.apis.map((item) => this.renderQuotaItem(item)).join('')}
        </div>
      </div>
      `
          : ''
      }

      ${allItems.length === 0 ? '<div class="empty-state">No quota information available</div>' : ''}
    </main>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function refresh() {
      vscode.postMessage({ command: 'refresh' });
    }
  </script>
</body>
</html>`;
  }

  /**
   * Render a single quota item with progress bar
   */
  private renderQuotaItem(item: QuotaItem): string {
    let statusClass = 'good';
    if (item.percentUsed >= 80) {
      statusClass = 'critical';
    } else if (item.percentUsed >= 60) {
      statusClass = 'warning';
    }

    return `
      <div class="quota-row">
        <div class="quota-info">
          <span class="quota-name">${this.escapeHtml(item.displayName)}</span>
          <span class="quota-values">${item.usage} / ${item.limit}</span>
        </div>
        <div class="quota-progress">
          <div class="progress-bar">
            <div class="progress-fill ${statusClass}" style="width: ${Math.min(item.percentUsed, 100)}%"></div>
          </div>
          <span class="quota-percent ${statusClass}">${item.percentUsed}%</span>
        </div>
      </div>
    `;
  }

  /**
   * Get CSS styles for both dashboards
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
      flex-shrink: 0;
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .resource-type {
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
    }

    .resource-name {
      color: white;
      font-weight: 600;
      font-size: 14px;
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .refresh-btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .refresh-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    /* Container */
    .container {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .content {
      max-width: 800px;
      margin: 0 auto;
    }

    /* Cards */
    .card {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      margin-bottom: 16px;
      overflow: hidden;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .card-header h2 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }

    .card-body {
      padding: 16px;
    }

    /* Tier Badges */
    .tier-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .tier-advanced {
      background: linear-gradient(135deg, #6b2fad 0%, #9c4fd4 100%);
      color: white;
    }

    .tier-standard {
      background: linear-gradient(135deg, #0076d6 0%, #0099ff 100%);
      color: white;
    }

    /* Plan Card */
    .plan-title {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .plan-subtitle {
      font-size: 14px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }

    .plan-description {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.5;
    }

    /* Sections */
    .section {
      margin-bottom: 24px;
    }

    .section-header {
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-symbolIcon-classForeground);
      margin: 0 0 12px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    /* Addon Groups */
    .addon-group {
      margin-bottom: 16px;
    }

    .addon-group-header {
      font-size: 12px;
      font-weight: 500;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      padding-left: 4px;
    }

    .addon-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .addon-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      background: var(--vscode-sideBar-background);
      border-radius: 4px;
    }

    .addon-active {
      border-left: 3px solid var(--vscode-testing-iconPassed, #73c991);
    }

    .addon-available {
      border-left: 3px solid var(--vscode-descriptionForeground);
      opacity: 0.7;
    }

    .addon-name {
      flex: 1;
      font-size: 12px;
    }

    .addon-tier {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 500;
    }

    .addon-status {
      color: var(--vscode-testing-iconPassed, #73c991);
      font-weight: bold;
    }

    /* Activate Button */
    .activate-btn {
      background: linear-gradient(135deg, #0076d6 0%, #0099ff 100%);
      color: white;
      border: none;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }

    .activate-btn:hover:not(.disabled) {
      background: linear-gradient(135deg, #0066c0 0%, #0088e0 100%);
      transform: translateY(-1px);
    }

    .activate-btn:active:not(.disabled) {
      transform: translateY(0);
    }

    .activate-btn.disabled {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-descriptionForeground);
      cursor: not-allowed;
      opacity: 0.7;
    }

    /* Summary Cards */
    .summary-cards {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
    }

    .summary-card {
      flex: 1;
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }

    .summary-card.warning {
      border-color: var(--vscode-testing-iconFailed, #f14c4c);
    }

    .summary-value {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .summary-card.warning .summary-value {
      color: var(--vscode-testing-iconFailed, #f14c4c);
    }

    .summary-label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
    }

    /* Quota Table */
    .quota-table {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .quota-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 10px 12px;
      background: var(--vscode-sideBar-background);
      border-radius: 4px;
    }

    .quota-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .quota-name {
      font-size: 12px;
      font-weight: 500;
    }

    .quota-values {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .quota-progress {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .progress-bar {
      flex: 1;
      height: 6px;
      background: var(--vscode-editorWidget-background);
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .progress-fill.good {
      background: var(--vscode-testing-iconPassed, #73c991);
    }

    .progress-fill.warning {
      background: var(--vscode-testing-iconQueued, #cca700);
    }

    .progress-fill.critical {
      background: var(--vscode-testing-iconFailed, #f14c4c);
    }

    .quota-percent {
      font-size: 11px;
      font-weight: 600;
      min-width: 40px;
      text-align: right;
    }

    .quota-percent.good {
      color: var(--vscode-testing-iconPassed, #73c991);
    }

    .quota-percent.warning {
      color: var(--vscode-testing-iconQueued, #cca700);
    }

    .quota-percent.critical {
      color: var(--vscode-testing-iconFailed, #f14c4c);
    }

    /* Empty State */
    .empty-state {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      padding: 16px;
      text-align: center;
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
   * Dispose of all webview panels
   */
  dispose(): void {
    this.planPanel?.dispose();
    this.quotasPanel?.dispose();
  }
}
