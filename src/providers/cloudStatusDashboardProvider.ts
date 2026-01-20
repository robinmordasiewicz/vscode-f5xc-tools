// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

/**
 * Cloud Status Dashboard WebView Provider
 * Displays detailed F5 Cloud Status information in a WebView panel
 */

import * as vscode from 'vscode';
import {
  CloudStatusClient,
  Component,
  ComponentStatus,
  Incident,
  ScheduledMaintenance,
  SummaryResponse,
  getStatusDisplayText,
  getIncidentStatusText,
  extractSiteCode,
} from '../api/cloudStatus';
import { Site } from '../api/client';
import { ProfileManager } from '../config/profiles';
import { getLogger } from '../utils/logger';
import { getPopCoordinates, formatCoordinates, Coordinates } from '../api/popCoordinates';
import { geocodeLocation } from '../api/geocoder';

/**
 * WebView provider for Cloud Status Dashboard
 */
export class CloudStatusDashboardProvider {
  private panel: vscode.WebviewPanel | undefined;
  private readonly client: CloudStatusClient;
  private readonly profileManager: ProfileManager;

  constructor(profileManager: ProfileManager) {
    this.client = new CloudStatusClient();
    this.profileManager = profileManager;
  }

  /**
   * Show or reveal the dashboard panel
   */
  async showDashboard(): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      await this.refresh();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'cloudStatusDashboard',
      'F5 Cloud Status',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [],
      },
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });

    this.panel.webview.onDidReceiveMessage(async (message: { command: string }) => {
      switch (message.command) {
        case 'refresh':
          await this.refresh();
          break;
        case 'openExternal':
          await vscode.env.openExternal(vscode.Uri.parse('https://www.f5cloudstatus.com'));
          break;
      }
    });

    await this.refresh();
  }

  /**
   * Refresh the dashboard content
   */
  async refresh(): Promise<void> {
    if (!this.panel) {
      return;
    }

    try {
      this.client.clearCache();
      const summary = await this.client.getSummary();
      this.panel.webview.html = this.getWebviewContent(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load status';
      this.panel.webview.html = this.getErrorContent(message);
    }
  }

  /**
   * Generate a CSP nonce
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
   * Get status color class
   */
  private getStatusColor(status: ComponentStatus): string {
    switch (status) {
      case 'operational':
        return 'status-operational';
      case 'degraded_performance':
        return 'status-degraded';
      case 'partial_outage':
        return 'status-partial';
      case 'major_outage':
        return 'status-major';
      case 'under_maintenance':
        return 'status-maintenance';
      default:
        return '';
    }
  }

  /**
   * Get impact color class
   */
  private getImpactColor(impact: string): string {
    switch (impact) {
      case 'none':
        return 'impact-none';
      case 'minor':
        return 'impact-minor';
      case 'major':
        return 'impact-major';
      case 'critical':
        return 'impact-critical';
      case 'maintenance':
        return 'impact-maintenance';
      default:
        return '';
    }
  }

  /**
   * Get worst status from a group of components
   */
  private getWorstStatus(components: Component[]): ComponentStatus {
    const statusPriority: ComponentStatus[] = [
      'major_outage',
      'partial_outage',
      'degraded_performance',
      'under_maintenance',
      'operational',
    ];

    for (const status of statusPriority) {
      if (components.some((c) => c.status === status)) {
        return status;
      }
    }
    return 'operational';
  }

  /**
   * Get webview content for successful load
   */
  private getWebviewContent(summary: SummaryResponse): string {
    const nonce = this.getNonce();
    const cspSource = this.panel!.webview.cspSource;

    // Group components by their group_id
    const groups = new Map<string, Component>();
    const componentsByGroup = new Map<string, Component[]>();
    const standaloneComponents: Component[] = [];

    for (const component of summary.components) {
      if (component.group) {
        groups.set(component.id, component);
        componentsByGroup.set(component.id, []);
      }
    }

    for (const component of summary.components) {
      if (!component.group) {
        if (component.group_id && componentsByGroup.has(component.group_id)) {
          componentsByGroup.get(component.group_id)!.push(component);
        } else {
          standaloneComponents.push(component);
        }
      }
    }

    // Build component groups HTML
    const groupsHtml = Array.from(groups.entries())
      .map(([groupId, group]) => {
        const children = componentsByGroup.get(groupId) || [];
        if (children.length === 0) {
          return '';
        }
        const worstStatus = this.getWorstStatus(children);
        return this.renderComponentGroup(group, children, worstStatus);
      })
      .filter((html) => html)
      .join('\n');

    // Build standalone components HTML
    const standaloneHtml = standaloneComponents.map((c) => this.renderComponent(c)).join('\n');

    // Build incidents HTML
    const unresolvedIncidents = summary.incidents.filter((i) => i.status !== 'resolved');
    const incidentsHtml =
      unresolvedIncidents.length > 0
        ? `
        <div class="section">
          <h2 class="section-title incident-title">
            <span class="incident-icon"></span>
            Active Incidents (${unresolvedIncidents.length})
          </h2>
          <div class="incidents-list">
            ${unresolvedIncidents.map((i) => this.renderIncident(i)).join('\n')}
          </div>
        </div>
      `
        : '';

    // Build maintenance HTML
    const activeMaintenance = summary.scheduled_maintenances.filter(
      (m) => m.status !== 'completed',
    );
    const maintenanceHtml =
      activeMaintenance.length > 0
        ? `
        <div class="section">
          <h2 class="section-title maintenance-title">
            <span class="maintenance-icon"></span>
            Scheduled Maintenance (${activeMaintenance.length})
          </h2>
          <div class="maintenance-list">
            ${activeMaintenance.map((m) => this.renderMaintenance(m)).join('\n')}
          </div>
        </div>
      `
        : '';

    // Overall status banner
    const overallStatus = summary.status;
    const statusBannerClass =
      overallStatus.indicator === 'none'
        ? 'banner-operational'
        : `banner-${overallStatus.indicator}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource};">
  <title>F5 Cloud Status</title>
  <style>${this.getStyles()}</style>
</head>
<body>
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="logo">F5</span>
      <span class="title">Cloud Status Dashboard</span>
    </div>
    <div class="toolbar-right">
      <button class="btn btn-secondary" id="openExternal">
        <span class="external-icon"></span>
        Open in Browser
      </button>
      <button class="btn btn-primary" id="refresh">
        <span class="refresh-icon"></span>
        Refresh
      </button>
    </div>
  </div>

  <!-- Status Banner -->
  <div class="status-banner ${statusBannerClass}">
    <span class="status-indicator"></span>
    <span class="status-text">${this.escapeHtml(overallStatus.description)}</span>
    <span class="updated-at">Updated: ${new Date(summary.page.updated_at).toLocaleString()}</span>
  </div>

  <!-- Main Content -->
  <div class="container">
    <!-- Components Section -->
    <div class="section">
      <h2 class="section-title">Service Status</h2>
      <div class="component-groups">
        ${groupsHtml}
        ${standaloneHtml}
      </div>
    </div>

    <!-- Incidents Section -->
    ${incidentsHtml}

    <!-- Maintenance Section -->
    ${maintenanceHtml}

    <!-- Empty State -->
    ${
      unresolvedIncidents.length === 0 && activeMaintenance.length === 0
        ? '<div class="empty-state"><span class="check-icon"></span>No active incidents or scheduled maintenance</div>'
        : ''
    }
  </div>

  <script nonce="${nonce}">${this.getScript()}</script>
</body>
</html>`;
  }

  /**
   * Render a component group (collapsible)
   */
  private renderComponentGroup(
    group: Component,
    children: Component[],
    worstStatus: ComponentStatus,
  ): string {
    const statusClass = this.getStatusColor(worstStatus);
    const componentsHtml = children
      .sort((a, b) => a.position - b.position)
      .map((c) => this.renderComponent(c))
      .join('\n');

    return `
      <div class="component-group" data-expanded="true">
        <div class="group-header ${statusClass}">
          <span class="expand-icon"></span>
          <span class="group-name">${this.escapeHtml(group.name)}</span>
          <span class="group-status">${getStatusDisplayText(worstStatus)}</span>
          <span class="component-count">${children.length} components</span>
        </div>
        <div class="group-children">
          ${componentsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Render a single component
   */
  private renderComponent(component: Component): string {
    const statusClass = this.getStatusColor(component.status);
    return `
      <div class="component ${statusClass}">
        <span class="component-indicator"></span>
        <span class="component-name">${this.escapeHtml(component.name)}</span>
        <span class="component-status">${getStatusDisplayText(component.status)}</span>
      </div>
    `;
  }

  /**
   * Render an incident
   */
  private renderIncident(incident: Incident): string {
    const impactClass = this.getImpactColor(incident.impact);
    const startedAt = new Date(incident.started_at).toLocaleString();
    const latestUpdate = incident.incident_updates[0];
    const affectedComponents = incident.components.map((c) => c.name).join(', ');

    return `
      <div class="incident ${impactClass}">
        <div class="incident-header">
          <span class="incident-indicator"></span>
          <span class="incident-name">${this.escapeHtml(incident.name)}</span>
          <span class="incident-status">${getIncidentStatusText(incident.status)}</span>
        </div>
        <div class="incident-details">
          <div class="incident-meta">
            <span class="meta-item"><strong>Impact:</strong> ${incident.impact}</span>
            <span class="meta-item"><strong>Started:</strong> ${startedAt}</span>
          </div>
          ${affectedComponents ? `<div class="affected"><strong>Affected:</strong> ${this.escapeHtml(affectedComponents)}</div>` : ''}
          ${latestUpdate ? `<div class="latest-update"><strong>Latest Update:</strong> ${this.escapeHtml(latestUpdate.body)}</div>` : ''}
        </div>
        <a href="${incident.shortlink}" class="incident-link" target="_blank">View Details</a>
      </div>
    `;
  }

  /**
   * Render a scheduled maintenance
   */
  private renderMaintenance(maintenance: ScheduledMaintenance): string {
    const scheduledFor = new Date(maintenance.scheduled_for).toLocaleString();
    const scheduledUntil = new Date(maintenance.scheduled_until).toLocaleString();
    const affectedComponents = maintenance.components.map((c) => c.name).join(', ');

    return `
      <div class="maintenance">
        <div class="maintenance-header">
          <span class="maintenance-indicator"></span>
          <span class="maintenance-name">${this.escapeHtml(maintenance.name)}</span>
          <span class="maintenance-status">${getIncidentStatusText(maintenance.status)}</span>
        </div>
        <div class="maintenance-details">
          <div class="maintenance-meta">
            <span class="meta-item"><strong>Scheduled:</strong> ${scheduledFor} - ${scheduledUntil}</span>
          </div>
          ${affectedComponents ? `<div class="affected"><strong>Affected:</strong> ${this.escapeHtml(affectedComponents)}</div>` : ''}
        </div>
        <a href="${maintenance.shortlink}" class="maintenance-link" target="_blank">View Details</a>
      </div>
    `;
  }

  /**
   * Get error content HTML
   */
  private getErrorContent(message: string): string {
    const nonce = this.getNonce();
    const cspSource = this.panel!.webview.cspSource;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource};">
  <title>F5 Cloud Status - Error</title>
  <style>${this.getStyles()}</style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="logo">F5</span>
      <span class="title">Cloud Status Dashboard</span>
    </div>
    <div class="toolbar-right">
      <button class="btn btn-primary" id="refresh">
        <span class="refresh-icon"></span>
        Retry
      </button>
    </div>
  </div>
  <div class="container">
    <div class="error-state">
      <span class="error-icon"></span>
      <h2>Failed to Load Status</h2>
      <p>${this.escapeHtml(message)}</p>
      <button class="btn btn-primary" id="retryBtn">Try Again</button>
    </div>
  </div>
  <script nonce="${nonce}">${this.getScript()}</script>
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
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-editor-foreground, #cccccc);
      background-color: var(--vscode-editor-background, #1e1e1e);
      line-height: 1.5;
    }

    /* Toolbar */
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 24px;
      background: linear-gradient(135deg, #6b2fad 0%, #0076d6 100%);
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo {
      background: white;
      color: #6b2fad;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 14px;
    }

    .title {
      color: white;
      font-weight: 600;
      font-size: 16px;
    }

    .toolbar-right {
      display: flex;
      gap: 8px;
    }

    .btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s;
    }

    .btn-primary {
      background: white;
      color: #6b2fad;
    }

    .btn-primary:hover {
      background: #f0f0f0;
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.15);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    /* Icons */
    .refresh-icon::before { content: "\\21BB"; font-size: 14px; }
    .external-icon::before { content: "\\2197"; font-size: 14px; }
    .expand-icon::before { content: "\\25BC"; font-size: 10px; transition: transform 0.15s; }
    .check-icon::before { content: "\\2713"; font-size: 24px; color: #73c991; }
    .error-icon::before { content: "\\2717"; font-size: 48px; color: #f14c4c; }
    .incident-icon::before { content: "\\26A0"; font-size: 16px; }
    .maintenance-icon::before { content: "\\1F527"; font-size: 16px; }

    [data-expanded="false"] .expand-icon::before {
      transform: rotate(-90deg);
    }

    /* Status Banner */
    .status-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .banner-operational { background: rgba(115, 201, 145, 0.15); }
    .banner-minor { background: rgba(204, 167, 0, 0.15); }
    .banner-major { background: rgba(241, 76, 76, 0.15); }
    .banner-critical { background: rgba(241, 76, 76, 0.25); }
    .banner-maintenance { background: rgba(0, 122, 204, 0.15); }

    .status-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .banner-operational .status-indicator { background: #73c991; }
    .banner-minor .status-indicator { background: #cca700; }
    .banner-major .status-indicator { background: #f14c4c; }
    .banner-critical .status-indicator { background: #f14c4c; }
    .banner-maintenance .status-indicator { background: #007acc; }

    .status-text {
      font-weight: 600;
      flex: 1;
    }

    .updated-at {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }

    /* Container */
    .container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Sections */
    .section {
      margin-bottom: 32px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .incident-title { color: #f14c4c; }
    .maintenance-title { color: #007acc; }

    /* Component Groups */
    .component-groups {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .component-group {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      overflow: hidden;
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .group-header:hover {
      background: var(--vscode-list-hoverBackground);
    }

    .group-name {
      font-weight: 600;
      flex: 1;
    }

    .group-status {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .component-count {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }

    .group-children {
      border-top: 1px solid var(--vscode-panel-border);
    }

    [data-expanded="false"] .group-children {
      display: none;
    }

    /* Components */
    .component {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px 10px 32px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .component:last-child {
      border-bottom: none;
    }

    .component-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .component-name {
      flex: 1;
    }

    .component-status {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
    }

    /* Status Colors */
    .status-operational .component-indicator,
    .status-operational .group-header .component-indicator { background: #73c991; }
    .status-operational .group-status,
    .status-operational .component-status { background: rgba(115, 201, 145, 0.2); color: #73c991; }

    .status-degraded .component-indicator { background: #cca700; }
    .status-degraded .group-status,
    .status-degraded .component-status { background: rgba(204, 167, 0, 0.2); color: #cca700; }

    .status-partial .component-indicator { background: #f0883e; }
    .status-partial .group-status,
    .status-partial .component-status { background: rgba(240, 136, 62, 0.2); color: #f0883e; }

    .status-major .component-indicator { background: #f14c4c; }
    .status-major .group-status,
    .status-major .component-status { background: rgba(241, 76, 76, 0.2); color: #f14c4c; }

    .status-maintenance .component-indicator { background: #007acc; }
    .status-maintenance .group-status,
    .status-maintenance .component-status { background: rgba(0, 122, 204, 0.2); color: #007acc; }

    /* Incidents */
    .incidents-list, .maintenance-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .incident, .maintenance {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 16px;
    }

    .incident-header, .maintenance-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .incident-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .impact-none .incident-indicator { background: #73c991; }
    .impact-minor .incident-indicator { background: #cca700; }
    .impact-major .incident-indicator { background: #f0883e; }
    .impact-critical .incident-indicator { background: #f14c4c; }
    .impact-maintenance .incident-indicator { background: #007acc; }

    .incident-name, .maintenance-name {
      font-weight: 600;
      flex: 1;
    }

    .incident-status, .maintenance-status {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }

    .incident-details, .maintenance-details {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
    }

    .incident-meta, .maintenance-meta {
      display: flex;
      gap: 16px;
      margin-bottom: 8px;
    }

    .affected, .latest-update {
      margin-top: 8px;
      padding: 8px;
      background: var(--vscode-textCodeBlock-background);
      border-radius: 4px;
    }

    .incident-link, .maintenance-link {
      display: inline-block;
      margin-top: 12px;
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
    }

    .incident-link:hover, .maintenance-link:hover {
      text-decoration: underline;
    }

    .maintenance-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #007acc;
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }

    /* Error State */
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px;
      text-align: center;
    }

    .error-state h2 {
      margin: 16px 0 8px;
    }

    .error-state p {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 24px;
    }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 10px;
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

      // Refresh button
      document.querySelectorAll('#refresh, #retryBtn').forEach(btn => {
        btn?.addEventListener('click', () => {
          vscode.postMessage({ command: 'refresh' });
        });
      });

      // Open external button
      document.getElementById('openExternal')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'openExternal' });
      });

      // Component group expand/collapse
      document.querySelectorAll('.group-header').forEach(header => {
        header.addEventListener('click', () => {
          const group = header.closest('.component-group');
          if (group) {
            const expanded = group.dataset.expanded === 'true';
            group.dataset.expanded = expanded ? 'false' : 'true';
          }
        });
      });
    })();
    `;
  }

  /**
   * Show maintenance details in a WebView panel
   */
  showMaintenanceDetails(maintenance: ScheduledMaintenance): void {
    const panel = vscode.window.createWebviewPanel(
      'maintenanceDetails',
      `Maintenance: ${maintenance.name}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [],
      },
    );

    panel.webview.html = this.getMaintenanceDetailsContent(maintenance, panel.webview);

    panel.webview.onDidReceiveMessage(async (message: { command: string }) => {
      switch (message.command) {
        case 'openExternal':
          await vscode.env.openExternal(vscode.Uri.parse(maintenance.shortlink));
          break;
      }
    });
  }

  /**
   * Generate HTML content for maintenance details
   */
  private getMaintenanceDetailsContent(
    maintenance: ScheduledMaintenance,
    webview: vscode.Webview,
  ): string {
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;
    const scheduledFor = new Date(maintenance.scheduled_for).toLocaleString();
    const scheduledUntil = new Date(maintenance.scheduled_until).toLocaleString();
    const createdAt = new Date(maintenance.created_at).toLocaleString();
    const updatedAt = new Date(maintenance.updated_at).toLocaleString();
    const affectedComponents = maintenance.components.map((c) => c.name);

    // Build updates timeline
    const updatesHtml = maintenance.incident_updates
      .map((update) => {
        const updateTime = new Date(update.created_at).toLocaleString();
        return `
          <div class="update">
            <div class="update-header">
              <span class="update-status status-${update.status}">${this.escapeHtml(update.status)}</span>
              <span class="update-time">${updateTime}</span>
            </div>
            <div class="update-body">${this.escapeHtml(update.body)}</div>
          </div>
        `;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource};">
  <title>Maintenance Details</title>
  <style>${this.getMaintenanceStyles()}</style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="logo">F5</span>
      <span class="title">Scheduled Maintenance</span>
    </div>
    <div class="toolbar-right">
      <button class="btn btn-secondary" id="openExternal">
        <span class="external-icon"></span>
        Open in Browser
      </button>
    </div>
  </div>
  <div class="container">
    <div class="maintenance-header">
      <div class="maintenance-icon"></div>
      <h1 class="maintenance-title">${this.escapeHtml(maintenance.name)}</h1>
      <span class="status-badge status-${maintenance.status}">${getIncidentStatusText(maintenance.status)}</span>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <h3>Schedule</h3>
        <div class="info-item">
          <span class="label">Start:</span>
          <span class="value">${scheduledFor}</span>
        </div>
        <div class="info-item">
          <span class="label">End:</span>
          <span class="value">${scheduledUntil}</span>
        </div>
      </div>

      <div class="info-card">
        <h3>Details</h3>
        <div class="info-item">
          <span class="label">Impact:</span>
          <span class="value impact-${maintenance.impact}">${maintenance.impact}</span>
        </div>
        <div class="info-item">
          <span class="label">Created:</span>
          <span class="value">${createdAt}</span>
        </div>
        <div class="info-item">
          <span class="label">Updated:</span>
          <span class="value">${updatedAt}</span>
        </div>
      </div>
    </div>

    ${
      affectedComponents.length > 0
        ? `
    <div class="section">
      <h2>Affected Components</h2>
      <div class="components-list">
        ${affectedComponents.map((c) => `<span class="component-badge">${this.escapeHtml(c)}</span>`).join('\n')}
      </div>
    </div>
    `
        : ''
    }

    ${
      maintenance.incident_updates.length > 0
        ? `
    <div class="section">
      <h2>Updates Timeline</h2>
      <div class="updates-list">
        ${updatesHtml}
      </div>
    </div>
    `
        : ''
    }
  </div>
  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      document.getElementById('openExternal')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'openExternal' });
      });
    })();
  </script>
</body>
</html>`;
  }

  /**
   * Get CSS styles for maintenance details view
   */
  private getMaintenanceStyles(): string {
    return `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      line-height: 1.5;
    }
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: var(--vscode-titleBar-activeBackground);
      border-bottom: 1px solid var(--vscode-titleBar-border);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo {
      background: #e4002b;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 14px;
    }
    .title {
      font-size: 14px;
      font-weight: 500;
      color: var(--vscode-foreground);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
    }
    .btn-secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .external-icon::before {
      content: "↗";
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
    }
    .maintenance-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .maintenance-icon {
      width: 48px;
      height: 48px;
      background: var(--vscode-charts-blue);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .maintenance-icon::before {
      content: "🔧";
      font-size: 24px;
    }
    .maintenance-title {
      font-size: 24px;
      font-weight: 600;
      flex: 1;
      min-width: 200px;
    }
    .status-badge {
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
      text-transform: capitalize;
    }
    .status-scheduled {
      background: var(--vscode-charts-blue);
      color: white;
    }
    .status-in_progress {
      background: var(--vscode-charts-yellow);
      color: black;
    }
    .status-verifying {
      background: var(--vscode-charts-orange);
      color: white;
    }
    .status-completed {
      background: var(--vscode-charts-green);
      color: white;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .info-card {
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      padding: 16px;
    }
    .info-card h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--vscode-foreground);
    }
    .info-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    .info-item:last-child {
      border-bottom: none;
    }
    .label {
      color: var(--vscode-descriptionForeground);
    }
    .value {
      font-weight: 500;
    }
    .impact-none { color: var(--vscode-charts-green); }
    .impact-minor { color: var(--vscode-charts-yellow); }
    .impact-major { color: var(--vscode-charts-orange); }
    .impact-critical { color: var(--vscode-charts-red); }
    .impact-maintenance { color: var(--vscode-charts-blue); }
    .section {
      margin-bottom: 24px;
    }
    .section h2 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    .components-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .component-badge {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
    }
    .updates-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .update {
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      padding: 16px;
      border-left: 3px solid var(--vscode-charts-blue);
    }
    .update-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .update-status {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      text-transform: capitalize;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .update-time {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .update-body {
      color: var(--vscode-foreground);
      white-space: pre-wrap;
    }
    `;
  }

  /**
   * Show incident details in a WebView panel
   */
  showIncidentDetails(incident: Incident): void {
    const panel = vscode.window.createWebviewPanel(
      'incidentDetails',
      `Incident: ${incident.name}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [],
      },
    );

    panel.webview.html = this.getIncidentDetailsContent(incident, panel.webview);

    panel.webview.onDidReceiveMessage(async (message: { command: string }) => {
      switch (message.command) {
        case 'openExternal':
          await vscode.env.openExternal(vscode.Uri.parse(incident.shortlink));
          break;
      }
    });
  }

  /**
   * Generate HTML content for incident details
   */
  private getIncidentDetailsContent(incident: Incident, webview: vscode.Webview): string {
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;
    const startedAt = new Date(incident.started_at).toLocaleString();
    const resolvedAt = incident.resolved_at
      ? new Date(incident.resolved_at).toLocaleString()
      : 'Ongoing';
    const createdAt = new Date(incident.created_at).toLocaleString();
    const updatedAt = new Date(incident.updated_at).toLocaleString();
    const affectedComponents = incident.components.map((c) => c.name);

    // Build updates timeline
    const updatesHtml = incident.incident_updates
      .map((update) => {
        const updateTime = new Date(update.created_at).toLocaleString();
        return `
          <div class="update">
            <div class="update-header">
              <span class="update-status status-${update.status}">${this.escapeHtml(update.status)}</span>
              <span class="update-time">${updateTime}</span>
            </div>
            <div class="update-body">${this.escapeHtml(update.body)}</div>
          </div>
        `;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource};">
  <title>Incident Details</title>
  <style>${this.getMaintenanceStyles()}
    .incident-icon::before {
      content: "⚠️";
      font-size: 24px;
    }
    .status-investigating {
      background: var(--vscode-charts-orange);
      color: white;
    }
    .status-identified {
      background: var(--vscode-charts-yellow);
      color: black;
    }
    .status-monitoring {
      background: var(--vscode-charts-blue);
      color: white;
    }
    .status-resolved {
      background: var(--vscode-charts-green);
      color: white;
    }
    .status-postmortem {
      background: var(--vscode-descriptionForeground);
      color: var(--vscode-editor-background);
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="logo">F5</span>
      <span class="title">Active Incident</span>
    </div>
    <div class="toolbar-right">
      <button class="btn btn-secondary" id="openExternal">
        <span class="external-icon"></span>
        Open in Browser
      </button>
    </div>
  </div>
  <div class="container">
    <div class="maintenance-header">
      <div class="incident-icon"></div>
      <h1 class="maintenance-title">${this.escapeHtml(incident.name)}</h1>
      <span class="status-badge status-${incident.status}">${getIncidentStatusText(incident.status)}</span>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <h3>Timeline</h3>
        <div class="info-item">
          <span class="label">Started:</span>
          <span class="value">${startedAt}</span>
        </div>
        <div class="info-item">
          <span class="label">Resolved:</span>
          <span class="value">${resolvedAt}</span>
        </div>
      </div>

      <div class="info-card">
        <h3>Details</h3>
        <div class="info-item">
          <span class="label">Impact:</span>
          <span class="value impact-${incident.impact}">${incident.impact}</span>
        </div>
        <div class="info-item">
          <span class="label">Created:</span>
          <span class="value">${createdAt}</span>
        </div>
        <div class="info-item">
          <span class="label">Updated:</span>
          <span class="value">${updatedAt}</span>
        </div>
      </div>
    </div>

    ${
      affectedComponents.length > 0
        ? `
    <div class="section">
      <h2>Affected Components</h2>
      <div class="components-list">
        ${affectedComponents.map((c) => `<span class="component-badge">${this.escapeHtml(c)}</span>`).join('\n')}
      </div>
    </div>
    `
        : ''
    }

    ${
      incident.incident_updates.length > 0
        ? `
    <div class="section">
      <h2>Incident Updates</h2>
      <div class="updates-list">
        ${updatesHtml}
      </div>
    </div>
    `
        : ''
    }
  </div>
  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      document.getElementById('openExternal')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'openExternal' });
      });
    })();
  </script>
</body>
</html>`;
  }

  /**
   * Show component details in a WebView panel
   */
  async showComponentDetails(component: Component): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'componentDetails',
      `Service: ${component.name}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [],
      },
    );

    // Fetch related incidents for this component
    const relatedIncidents = await this.client.getIncidentsForComponent(component.id);

    panel.webview.html = this.getComponentDetailsContent(
      component,
      relatedIncidents,
      panel.webview,
    );

    panel.webview.onDidReceiveMessage(async (message: { command: string }) => {
      switch (message.command) {
        case 'openExternal':
          await vscode.env.openExternal(vscode.Uri.parse('https://www.f5cloudstatus.com'));
          break;
      }
    });
  }

  /**
   * Generate HTML content for component details
   */
  private getComponentDetailsContent(
    component: Component,
    incidents: Incident[],
    webview: vscode.Webview,
  ): string {
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;
    const createdAt = new Date(component.created_at).toLocaleString();
    const updatedAt = new Date(component.updated_at).toLocaleString();
    const startDate = component.start_date
      ? new Date(component.start_date).toLocaleDateString()
      : 'N/A';

    // Separate active and resolved incidents
    const activeIncidents = incidents.filter((i) => i.status !== 'resolved');
    const resolvedIncidents = incidents.filter((i) => i.status === 'resolved').slice(0, 10);

    // Build active incidents HTML
    const activeIncidentsHtml =
      activeIncidents.length > 0
        ? activeIncidents
            .map((incident) => {
              const startedAt = new Date(incident.started_at).toLocaleString();
              const latestUpdate = incident.incident_updates[0];
              return `
              <div class="incident-card active">
                <div class="incident-header">
                  <span class="incident-name">${this.escapeHtml(incident.name)}</span>
                  <span class="status-badge status-${incident.status}">${getIncidentStatusText(incident.status)}</span>
                </div>
                <div class="incident-meta">
                  <span class="impact impact-${incident.impact}">Impact: ${incident.impact}</span>
                  <span class="incident-time">Started: ${startedAt}</span>
                </div>
                ${latestUpdate ? `<div class="incident-update"><strong>Latest:</strong> ${this.escapeHtml(latestUpdate.body)}</div>` : ''}
              </div>
            `;
            })
            .join('\n')
        : '<div class="no-incidents">No active incidents affecting this service</div>';

    // Build resolved incidents HTML
    const resolvedIncidentsHtml =
      resolvedIncidents.length > 0
        ? resolvedIncidents
            .map((incident) => {
              const startedAt = new Date(incident.started_at).toLocaleString();
              const resolvedAt = incident.resolved_at
                ? new Date(incident.resolved_at).toLocaleString()
                : 'N/A';
              return `
              <div class="incident-card resolved">
                <div class="incident-header">
                  <span class="incident-name">${this.escapeHtml(incident.name)}</span>
                  <span class="status-badge status-resolved">Resolved</span>
                </div>
                <div class="incident-meta">
                  <span class="impact impact-${incident.impact}">Impact: ${incident.impact}</span>
                  <span class="incident-time">Started: ${startedAt} | Resolved: ${resolvedAt}</span>
                </div>
              </div>
            `;
            })
            .join('\n')
        : '<div class="no-incidents">No recent resolved incidents</div>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource};">
  <title>Service Details</title>
  <style>${this.getMaintenanceStyles()}
    .component-icon::before {
      content: "🔧";
      font-size: 24px;
    }
    .status-operational {
      background: var(--vscode-charts-green);
      color: white;
    }
    .status-degraded_performance {
      background: var(--vscode-charts-yellow);
      color: black;
    }
    .status-partial_outage {
      background: var(--vscode-charts-orange);
      color: white;
    }
    .status-major_outage {
      background: var(--vscode-charts-red);
      color: white;
    }
    .status-under_maintenance {
      background: var(--vscode-charts-blue);
      color: white;
    }
    .incident-card {
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      border-left: 3px solid var(--vscode-charts-blue);
    }
    .incident-card.active {
      border-left-color: var(--vscode-charts-orange);
    }
    .incident-card.resolved {
      border-left-color: var(--vscode-charts-green);
      opacity: 0.8;
    }
    .incident-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
      gap: 12px;
    }
    .incident-name {
      font-weight: 500;
      flex: 1;
    }
    .incident-meta {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    .incident-update {
      font-size: 13px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 8px;
      border-radius: 4px;
      margin-top: 8px;
    }
    .no-incidents {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      padding: 12px;
    }
    .status-investigating {
      background: var(--vscode-charts-orange);
      color: white;
    }
    .status-identified {
      background: var(--vscode-charts-yellow);
      color: black;
    }
    .status-monitoring {
      background: var(--vscode-charts-blue);
      color: white;
    }
    .status-resolved {
      background: var(--vscode-charts-green);
      color: white;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="logo">F5</span>
      <span class="title">Service Status</span>
    </div>
    <div class="toolbar-right">
      <button class="btn btn-secondary" id="openExternal">
        <span class="external-icon"></span>
        Open Status Page
      </button>
    </div>
  </div>
  <div class="container">
    <div class="maintenance-header">
      <div class="component-icon"></div>
      <h1 class="maintenance-title">${this.escapeHtml(component.name)}</h1>
      <span class="status-badge status-${component.status}">${getStatusDisplayText(component.status)}</span>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <h3>Status Information</h3>
        <div class="info-item">
          <span class="label">Current Status:</span>
          <span class="value">${getStatusDisplayText(component.status)}</span>
        </div>
        <div class="info-item">
          <span class="label">Last Updated:</span>
          <span class="value">${updatedAt}</span>
        </div>
      </div>

      <div class="info-card">
        <h3>Service Details</h3>
        <div class="info-item">
          <span class="label">Service Start:</span>
          <span class="value">${startDate}</span>
        </div>
        <div class="info-item">
          <span class="label">Created:</span>
          <span class="value">${createdAt}</span>
        </div>
        ${
          component.description
            ? `
        <div class="info-item">
          <span class="label">Description:</span>
          <span class="value">${this.escapeHtml(component.description)}</span>
        </div>
        `
            : ''
        }
      </div>
    </div>

    <div class="section">
      <h2>Active Incidents (${activeIncidents.length})</h2>
      <div class="incidents-list">
        ${activeIncidentsHtml}
      </div>
    </div>

    <div class="section">
      <h2>Recent Incident History</h2>
      <div class="incidents-list">
        ${resolvedIncidentsHtml}
      </div>
    </div>
  </div>
  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      document.getElementById('openExternal')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'openExternal' });
      });
    })();
  </script>
</body>
</html>`;
  }

  /**
   * Show PoP (Regional Edge) details in a WebView panel
   */
  async showPoPDetails(component: Component): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'popDetails',
      `PoP: ${component.name}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [],
      },
    );

    // Extract site code from PoP name (e.g., "Ashburn (dc12)" -> "dc12")
    const siteCode = extractSiteCode(component.name);

    // Get coordinates using static map or geocoding fallback
    const coordinates = await getPopCoordinates(siteCode, component.name, geocodeLocation);

    // Try to fetch Regional Edge data from XC API if authenticated
    // Note: F5-managed Regional Edge sites are visible in LIST but coordinates are not accessible
    let xcSite: Site | null = null;
    const activeProfile = await this.profileManager.getActiveProfile();

    if (activeProfile && siteCode) {
      try {
        const xcClient = await this.profileManager.getClient(activeProfile.name);
        if (xcClient) {
          xcSite = (await xcClient.findRegionalEdgeBySiteCode(siteCode)) || null;
        }
      } catch (error) {
        // Log error and fall back to Cloud Status data only
        const logger = getLogger();
        logger.error(
          `[showPoPDetails] Error fetching XC data`,
          error instanceof Error ? error : undefined,
        );
        xcSite = null;
      }
    }

    // Fetch related incidents for this PoP
    const relatedIncidents = await this.client.getIncidentsForComponent(component.id);

    panel.webview.html = this.getPoPDetailsContent(
      component,
      siteCode,
      xcSite,
      relatedIncidents,
      coordinates,
      panel.webview,
    );

    panel.webview.onDidReceiveMessage(async (message: { command: string }) => {
      switch (message.command) {
        case 'openExternal':
          await vscode.env.openExternal(vscode.Uri.parse('https://www.f5cloudstatus.com'));
          break;
      }
    });
  }

  /**
   * Generate HTML content for PoP details
   */
  private getPoPDetailsContent(
    component: Component,
    siteCode: string | null,
    xcSite: Site | null,
    incidents: Incident[],
    coordinates: Coordinates | null,
    webview: vscode.Webview,
  ): string {
    const nonce = this.getNonce();
    const cspSource = webview.cspSource;
    const updatedAt = new Date(component.updated_at).toLocaleString();

    // Parse location from component name (e.g., "Ashburn (dc12), VA, United States")
    const nameParts = component.name.split(',').map((p) => p.trim());
    const cityWithCode = nameParts[0] || component.name;
    const city = cityWithCode.replace(/\s*\([^)]+\)/, '').trim();
    const stateOrRegion = nameParts[1] || '';
    const country = nameParts[2] || nameParts[1] || '';

    // Separate active and resolved incidents
    const activeIncidents = incidents.filter((i) => i.status !== 'resolved');
    const resolvedIncidents = incidents.filter((i) => i.status === 'resolved').slice(0, 5);

    // Build active incidents HTML
    const activeIncidentsHtml =
      activeIncidents.length > 0
        ? activeIncidents
            .map((incident) => {
              const startedAt = new Date(incident.started_at).toLocaleString();
              const latestUpdate = incident.incident_updates[0];
              return `
              <div class="incident-card active">
                <div class="incident-header">
                  <span class="incident-name">${this.escapeHtml(incident.name)}</span>
                  <span class="status-badge status-${incident.status}">${getIncidentStatusText(incident.status)}</span>
                </div>
                <div class="incident-meta">
                  <span class="impact impact-${incident.impact}">Impact: ${incident.impact}</span>
                  <span class="incident-time">Started: ${startedAt}</span>
                </div>
                ${latestUpdate ? `<div class="incident-update"><strong>Latest:</strong> ${this.escapeHtml(latestUpdate.body)}</div>` : ''}
              </div>
            `;
            })
            .join('\n')
        : '<div class="no-incidents">No active incidents affecting this PoP</div>';

    // Build resolved incidents HTML
    const resolvedIncidentsHtml =
      resolvedIncidents.length > 0
        ? resolvedIncidents
            .map((incident) => {
              const startedAt = new Date(incident.started_at).toLocaleString();
              const resolvedAt = incident.resolved_at
                ? new Date(incident.resolved_at).toLocaleString()
                : 'N/A';
              return `
              <div class="incident-card resolved">
                <div class="incident-header">
                  <span class="incident-name">${this.escapeHtml(incident.name)}</span>
                  <span class="status-badge status-resolved">Resolved</span>
                </div>
                <div class="incident-meta">
                  <span class="impact impact-${incident.impact}">Impact: ${incident.impact}</span>
                  <span class="incident-time">Started: ${startedAt} | Resolved: ${resolvedAt}</span>
                </div>
              </div>
            `;
            })
            .join('\n')
        : '<div class="no-incidents">No recent resolved incidents</div>';

    // Build XC Regional Edge section
    // Note: F5-managed Regional Edge sites only expose labels data, not full spec with coordinates
    let xcDetailsHtml = '';
    if (xcSite) {
      const siteObj = xcSite as unknown as Record<string, unknown>;
      const labels = (siteObj['labels'] as Record<string, string>) || {};

      // Extract data from root-level fields and labels
      const siteName = (siteObj['name'] as string) || xcSite.metadata?.name || 'Unknown';
      const region = labels['ves.io/region'] || '';
      const country = labels['ves.io/country'] || '';
      const siteType = labels['ves.io/siteType'] || '';
      const tenant = (siteObj['tenant'] as string) || '';

      // Format label values for display (remove "ves-io-" prefix if present)
      const formatLabel = (value: string): string => {
        return value.replace(/^ves-io-/, '').replace(/-/g, ' ');
      };

      xcDetailsHtml = `
      <div class="info-card xc-details">
        <h3>Regional Edge Details <span class="xc-badge">F5 XC</span></h3>
        <div class="info-item">
          <span class="label">Site Name:</span>
          <span class="value">${this.escapeHtml(siteName)}</span>
        </div>
        ${
          region
            ? `
        <div class="info-item">
          <span class="label">Region:</span>
          <span class="value">${this.escapeHtml(formatLabel(region))}</span>
        </div>
        `
            : ''
        }
        ${
          country
            ? `
        <div class="info-item">
          <span class="label">Country:</span>
          <span class="value">${this.escapeHtml(formatLabel(country))}</span>
        </div>
        `
            : ''
        }
        ${
          siteType
            ? `
        <div class="info-item">
          <span class="label">Site Type:</span>
          <span class="value">${this.escapeHtml(siteType === 'ves-io-re' ? 'Regional Edge' : formatLabel(siteType))}</span>
        </div>
        `
            : ''
        }
        ${
          tenant
            ? `
        <div class="info-item">
          <span class="label">Tenant:</span>
          <span class="value">${this.escapeHtml(tenant)}</span>
        </div>
        `
            : ''
        }
      </div>
      `;
    } else {
      xcDetailsHtml = `
      <div class="info-card auth-notice">
        <div class="auth-icon">ℹ️</div>
        <div class="auth-message">
          <strong>Extended Details Available</strong>
          <p>Sign in to an F5 XC profile to view additional Regional Edge details including region classification and tenant information.</p>
        </div>
      </div>
      `;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource};">
  <title>PoP Details</title>
  <style>${this.getMaintenanceStyles()}
    .pop-icon::before {
      content: "🌐";
      font-size: 24px;
    }
    .status-operational {
      background: var(--vscode-charts-green);
      color: white;
    }
    .status-degraded_performance {
      background: var(--vscode-charts-yellow);
      color: black;
    }
    .status-partial_outage {
      background: var(--vscode-charts-orange);
      color: white;
    }
    .status-major_outage {
      background: var(--vscode-charts-red);
      color: white;
    }
    .status-under_maintenance {
      background: var(--vscode-charts-blue);
      color: white;
    }
    .incident-card {
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      border-left: 3px solid var(--vscode-charts-blue);
    }
    .incident-card.active {
      border-left-color: var(--vscode-charts-orange);
    }
    .incident-card.resolved {
      border-left-color: var(--vscode-charts-green);
      opacity: 0.8;
    }
    .incident-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 8px;
      gap: 12px;
    }
    .incident-name {
      font-weight: 500;
      flex: 1;
    }
    .incident-meta {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    .incident-update {
      font-size: 13px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 8px;
      border-radius: 4px;
      margin-top: 8px;
    }
    .no-incidents {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      padding: 12px;
    }
    .status-investigating {
      background: var(--vscode-charts-orange);
      color: white;
    }
    .status-identified {
      background: var(--vscode-charts-yellow);
      color: black;
    }
    .status-monitoring {
      background: var(--vscode-charts-blue);
      color: white;
    }
    .status-resolved {
      background: var(--vscode-charts-green);
      color: white;
    }
    .xc-badge {
      background: var(--vscode-charts-purple);
      color: white;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      margin-left: 8px;
      font-weight: normal;
      vertical-align: middle;
    }
    .xc-details {
      border-left: 3px solid var(--vscode-charts-purple);
    }
    .auth-notice {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      background: var(--vscode-editorInfo-background);
      border-left: 3px solid var(--vscode-editorInfo-foreground);
      padding: 16px;
    }
    .auth-icon {
      font-size: 24px;
    }
    .auth-message p {
      margin: 8px 0 0 0;
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
    }
    .site-code {
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
    }
    .coordinates {
      font-family: var(--vscode-editor-font-family);
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 8px;
      border-radius: 3px;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="logo">F5</span>
      <span class="title">Regional Edge Status</span>
    </div>
    <div class="toolbar-right">
      <button class="btn btn-secondary" id="openExternal">
        <span class="external-icon"></span>
        Open Status Page
      </button>
    </div>
  </div>
  <div class="container">
    <div class="maintenance-header">
      <div class="pop-icon"></div>
      <h1 class="maintenance-title">${this.escapeHtml(component.name)}</h1>
      <span class="status-badge status-${component.status}">${getStatusDisplayText(component.status)}</span>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <h3>Cloud Status</h3>
        <div class="info-item">
          <span class="label">Current Status:</span>
          <span class="value">${getStatusDisplayText(component.status)}</span>
        </div>
        <div class="info-item">
          <span class="label">Last Updated:</span>
          <span class="value">${updatedAt}</span>
        </div>
        ${
          siteCode
            ? `
        <div class="info-item">
          <span class="label">Site Code:</span>
          <span class="value"><span class="site-code">${this.escapeHtml(siteCode)}</span></span>
        </div>
        `
            : ''
        }
      </div>

      <div class="info-card">
        <h3>Location</h3>
        <div class="info-item">
          <span class="label">City:</span>
          <span class="value">${this.escapeHtml(city)}</span>
        </div>
        ${
          stateOrRegion && stateOrRegion !== country
            ? `
        <div class="info-item">
          <span class="label">State/Region:</span>
          <span class="value">${this.escapeHtml(stateOrRegion)}</span>
        </div>
        `
            : ''
        }
        ${
          country
            ? `
        <div class="info-item">
          <span class="label">Country:</span>
          <span class="value">${this.escapeHtml(country)}</span>
        </div>
        `
            : ''
        }
        <div class="info-item">
          <span class="label">Coordinates:</span>
          <span class="value coordinates">${formatCoordinates(coordinates)}</span>
        </div>
        ${
          component.description
            ? `
        <div class="info-item">
          <span class="label">Description:</span>
          <span class="value">${this.escapeHtml(component.description)}</span>
        </div>
        `
            : ''
        }
      </div>
    </div>

    ${xcDetailsHtml}

    <div class="section">
      <h2>Active Incidents (${activeIncidents.length})</h2>
      <div class="incidents-list">
        ${activeIncidentsHtml}
      </div>
    </div>

    <div class="section">
      <h2>Recent Incident History</h2>
      <div class="incidents-list">
        ${resolvedIncidentsHtml}
      </div>
    </div>
  </div>
  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      document.getElementById('openExternal')?.addEventListener('click', () => {
        vscode.postMessage({ command: 'openExternal' });
      });
    })();
  </script>
</body>
</html>`;
  }

  /**
   * Dispose of the panel
   */
  dispose(): void {
    this.panel?.dispose();
  }
}
