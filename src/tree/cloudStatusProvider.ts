/**
 * Cloud Status Tree Provider
 * TreeDataProvider for F5 Cloud Status information
 */

import * as vscode from 'vscode';
import {
  CloudStatusClient,
  Component,
  ComponentStatus,
  Incident,
  ScheduledMaintenance,
  getStatusDisplayText,
  getIncidentStatusText,
} from '../api/cloudStatus';
import { CloudStatusTreeItem, CloudStatusContext } from './cloudStatusTypes';

/**
 * Get ThemeIcon for component status
 */
function getStatusIcon(status: ComponentStatus): vscode.ThemeIcon {
  switch (status) {
    case 'operational':
      return new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
    case 'degraded_performance':
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
    case 'partial_outage':
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
    case 'major_outage':
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('list.errorForeground'));
    case 'under_maintenance':
      return new vscode.ThemeIcon('tools', new vscode.ThemeColor('list.deemphasizedForeground'));
    default:
      return new vscode.ThemeIcon('question');
  }
}

/**
 * Get ThemeIcon for incident impact
 */
function getIncidentIcon(impact: string): vscode.ThemeIcon {
  switch (impact) {
    case 'none':
      return new vscode.ThemeIcon('info', new vscode.ThemeColor('list.deemphasizedForeground'));
    case 'minor':
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.warningForeground'));
    case 'major':
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('list.errorForeground'));
    case 'critical':
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('list.errorForeground'));
    case 'maintenance':
      return new vscode.ThemeIcon('tools', new vscode.ThemeColor('list.deemphasizedForeground'));
    default:
      return new vscode.ThemeIcon('bell');
  }
}

/**
 * Tree data provider for Cloud Status
 */
export class CloudStatusProvider implements vscode.TreeDataProvider<CloudStatusTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    CloudStatusTreeItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private readonly client: CloudStatusClient;

  constructor() {
    this.client = new CloudStatusClient();
  }

  getTreeItem(element: CloudStatusTreeItem): vscode.TreeItem {
    return element.getTreeItem();
  }

  async getChildren(element?: CloudStatusTreeItem): Promise<CloudStatusTreeItem[]> {
    if (!element) {
      return this.getRootItems();
    }
    return element.getChildren();
  }

  refresh(): void {
    this.client.clearCache();
    this._onDidChangeTreeData.fire(undefined);
  }

  private async getRootItems(): Promise<CloudStatusTreeItem[]> {
    try {
      const summary = await this.client.getSummary();
      const items: CloudStatusTreeItem[] = [];

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

      // Add component groups
      for (const [groupId, group] of groups) {
        const children = componentsByGroup.get(groupId) || [];
        if (children.length > 0) {
          items.push(new ComponentGroupNode(group, children));
        }
      }

      // Add standalone components
      for (const component of standaloneComponents) {
        items.push(new ComponentNode(component));
      }

      // Add active incidents if any
      const unresolvedIncidents = summary.incidents.filter((i) => i.status !== 'resolved');
      if (unresolvedIncidents.length > 0) {
        items.push(new IncidentsGroupNode(unresolvedIncidents));
      }

      // Add scheduled maintenance if any
      const activeMaintenance = summary.scheduled_maintenances.filter(
        (m) => m.status !== 'completed',
      );
      if (activeMaintenance.length > 0) {
        items.push(new MaintenanceGroupNode(activeMaintenance));
      }

      return items;
    } catch (error) {
      return [new ErrorNode(error instanceof Error ? error.message : 'Failed to load status')];
    }
  }
}

/**
 * Component group node (Services, PoPs)
 */
class ComponentGroupNode implements CloudStatusTreeItem {
  constructor(
    private readonly group: Component,
    private readonly children: Component[],
  ) {}

  getTreeItem(): vscode.TreeItem {
    // Determine worst status among children
    const worstStatus = this.getWorstStatus();
    const item = new vscode.TreeItem(this.group.name, vscode.TreeItemCollapsibleState.Collapsed);
    item.contextValue = CloudStatusContext.GROUP;
    item.iconPath = getStatusIcon(worstStatus);
    item.description = getStatusDisplayText(worstStatus);
    item.tooltip = `${this.group.name}\n${this.children.length} components\nStatus: ${getStatusDisplayText(worstStatus)}`;
    return item;
  }

  getChildren(): Promise<CloudStatusTreeItem[]> {
    return Promise.resolve(
      this.children.sort((a, b) => a.position - b.position).map((c) => new ComponentNode(c)),
    );
  }

  private getWorstStatus(): ComponentStatus {
    const statusPriority: ComponentStatus[] = [
      'major_outage',
      'partial_outage',
      'degraded_performance',
      'under_maintenance',
      'operational',
    ];

    for (const status of statusPriority) {
      if (this.children.some((c) => c.status === status)) {
        return status;
      }
    }
    return 'operational';
  }
}

/**
 * Individual component node
 */
class ComponentNode implements CloudStatusTreeItem {
  constructor(private readonly component: Component) {}

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.component.name, vscode.TreeItemCollapsibleState.None);
    item.contextValue = CloudStatusContext.COMPONENT;
    item.iconPath = getStatusIcon(this.component.status);
    item.description = getStatusDisplayText(this.component.status);
    item.tooltip = new vscode.MarkdownString(
      `**${this.component.name}**\n\nStatus: ${getStatusDisplayText(this.component.status)}${this.component.description ? `\n\n${this.component.description}` : ''}`,
    );
    return item;
  }

  getChildren(): Promise<CloudStatusTreeItem[]> {
    return Promise.resolve([]);
  }
}

/**
 * Incidents group node
 */
class IncidentsGroupNode implements CloudStatusTreeItem {
  constructor(private readonly incidents: Incident[]) {}

  getTreeItem(): vscode.TreeItem {
    const label = `Active Incidents (${this.incidents.length})`;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
    item.contextValue = CloudStatusContext.INCIDENTS_GROUP;
    item.iconPath = new vscode.ThemeIcon('bell-dot', new vscode.ThemeColor('list.errorForeground'));
    item.tooltip = `${this.incidents.length} active incident${this.incidents.length === 1 ? '' : 's'}`;
    return item;
  }

  getChildren(): Promise<CloudStatusTreeItem[]> {
    return Promise.resolve(this.incidents.map((i) => new IncidentNode(i)));
  }
}

/**
 * Individual incident node
 */
class IncidentNode implements CloudStatusTreeItem {
  constructor(private readonly incident: Incident) {}

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.incident.name, vscode.TreeItemCollapsibleState.None);
    item.contextValue = CloudStatusContext.INCIDENT;
    item.iconPath = getIncidentIcon(this.incident.impact);
    item.description = getIncidentStatusText(this.incident.status);

    const startedAt = new Date(this.incident.started_at).toLocaleString();
    const latestUpdate = this.incident.incident_updates[0];
    const affectedComponents = this.incident.components.map((c) => c.name).join(', ');

    let tooltipContent = `**${this.incident.name}**\n\n`;
    tooltipContent += `Status: ${getIncidentStatusText(this.incident.status)}\n`;
    tooltipContent += `Impact: ${this.incident.impact}\n`;
    tooltipContent += `Started: ${startedAt}\n`;
    if (affectedComponents) {
      tooltipContent += `\nAffected: ${affectedComponents}\n`;
    }
    if (latestUpdate) {
      tooltipContent += `\n---\n\n**Latest Update:**\n${latestUpdate.body}`;
    }

    item.tooltip = new vscode.MarkdownString(tooltipContent);
    item.command = {
      command: 'vscode.open',
      title: 'Open Incident',
      arguments: [vscode.Uri.parse(this.incident.shortlink)],
    };
    return item;
  }

  getChildren(): Promise<CloudStatusTreeItem[]> {
    return Promise.resolve([]);
  }
}

/**
 * Scheduled maintenance group node
 */
class MaintenanceGroupNode implements CloudStatusTreeItem {
  constructor(private readonly maintenances: ScheduledMaintenance[]) {}

  getTreeItem(): vscode.TreeItem {
    const label = `Scheduled Maintenance (${this.maintenances.length})`;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
    item.contextValue = CloudStatusContext.MAINTENANCE_GROUP;
    item.iconPath = new vscode.ThemeIcon(
      'calendar',
      new vscode.ThemeColor('list.deemphasizedForeground'),
    );
    item.tooltip = `${this.maintenances.length} scheduled maintenance${this.maintenances.length === 1 ? '' : 's'}`;
    return item;
  }

  getChildren(): Promise<CloudStatusTreeItem[]> {
    return Promise.resolve(this.maintenances.map((m) => new MaintenanceNode(m)));
  }
}

/**
 * Individual maintenance node
 */
class MaintenanceNode implements CloudStatusTreeItem {
  constructor(private readonly maintenance: ScheduledMaintenance) {}

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.maintenance.name, vscode.TreeItemCollapsibleState.None);
    item.contextValue = CloudStatusContext.MAINTENANCE;
    item.iconPath = new vscode.ThemeIcon(
      'tools',
      new vscode.ThemeColor('list.deemphasizedForeground'),
    );
    item.description = getIncidentStatusText(this.maintenance.status);

    const scheduledFor = new Date(this.maintenance.scheduled_for).toLocaleString();
    const scheduledUntil = new Date(this.maintenance.scheduled_until).toLocaleString();
    const affectedComponents = this.maintenance.components.map((c) => c.name).join(', ');

    let tooltipContent = `**${this.maintenance.name}**\n\n`;
    tooltipContent += `Status: ${getIncidentStatusText(this.maintenance.status)}\n`;
    tooltipContent += `Scheduled: ${scheduledFor} - ${scheduledUntil}\n`;
    if (affectedComponents) {
      tooltipContent += `\nAffected: ${affectedComponents}`;
    }

    item.tooltip = new vscode.MarkdownString(tooltipContent);
    item.command = {
      command: 'f5xc.cloudStatus.viewMaintenance',
      title: 'View Maintenance Details',
      arguments: [this.maintenance],
    };
    return item;
  }

  getChildren(): Promise<CloudStatusTreeItem[]> {
    return Promise.resolve([]);
  }
}

/**
 * Error node for displaying fetch failures
 */
class ErrorNode implements CloudStatusTreeItem {
  constructor(private readonly message: string) {}

  getTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem('Error loading status', vscode.TreeItemCollapsibleState.None);
    item.contextValue = CloudStatusContext.ERROR;
    item.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('list.errorForeground'));
    item.description = 'Click to retry';
    item.tooltip = this.message;
    item.command = {
      command: 'f5xc.cloudStatus.refresh',
      title: 'Retry',
    };
    return item;
  }

  getChildren(): Promise<CloudStatusTreeItem[]> {
    return Promise.resolve([]);
  }
}
