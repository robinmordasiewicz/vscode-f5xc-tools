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
}
