/**
 * Cloud Status Command Handlers
 * Commands for interacting with the Cloud Status feature
 */

import * as vscode from 'vscode';
import { CloudStatusProvider } from '../tree/cloudStatusProvider';
import { CloudStatusDashboardProvider } from '../providers/cloudStatusDashboardProvider';

/**
 * Register Cloud Status commands
 */
export function registerCloudStatusCommands(
  context: vscode.ExtensionContext,
  treeProvider: CloudStatusProvider,
  dashboardProvider: CloudStatusDashboardProvider,
): void {
  // Refresh tree view
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.cloudStatus.refresh', () => {
      treeProvider.refresh();
    }),
  );

  // Open dashboard
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.cloudStatus.openDashboard', async () => {
      await dashboardProvider.showDashboard();
    }),
  );

  // Open external status page
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.cloudStatus.openExternal', async () => {
      await vscode.env.openExternal(vscode.Uri.parse('https://www.f5cloudstatus.com'));
    }),
  );

  // View maintenance details in WebView
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.cloudStatus.viewMaintenance', (maintenance: unknown) => {
      dashboardProvider.showMaintenanceDetails(
        maintenance as Parameters<typeof dashboardProvider.showMaintenanceDetails>[0],
      );
    }),
  );

  // View incident details in WebView
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.cloudStatus.viewIncident', (incident: unknown) => {
      dashboardProvider.showIncidentDetails(
        incident as Parameters<typeof dashboardProvider.showIncidentDetails>[0],
      );
    }),
  );

  // View component details in WebView
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'f5xc.cloudStatus.viewComponent',
      async (component: unknown) => {
        await dashboardProvider.showComponentDetails(
          component as Parameters<typeof dashboardProvider.showComponentDetails>[0],
        );
      },
    ),
  );

  // View PoP (Regional Edge) details in WebView
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.cloudStatus.viewPoP', async (component: unknown) => {
      await dashboardProvider.showPoPDetails(
        component as Parameters<typeof dashboardProvider.showPoPDetails>[0],
      );
    }),
  );
}
