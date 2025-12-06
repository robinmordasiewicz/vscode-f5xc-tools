import * as vscode from 'vscode';
import { ResourceNode } from '../tree/f5xcExplorer';
import { ProfileManager } from '../config/profiles';
import { F5XCDiagramProvider } from '../providers/f5xcDiagramProvider';
import { withErrorHandling, showWarning } from '../utils/errors';
import { getLogger } from '../utils/logger';

const logger = getLogger();

/**
 * Register diagram commands for F5 XC HTTP Load Balancers
 */
export function registerDiagramCommands(
  context: vscode.ExtensionContext,
  profileManager: ProfileManager,
): void {
  // Create diagram provider instance
  const diagramProvider = new F5XCDiagramProvider(profileManager);

  // Register dispose handler
  context.subscriptions.push({
    dispose: () => diagramProvider.dispose(),
  });

  // DIAGRAM - Generate Mermaid diagram for HTTP Load Balancer
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.diagram', async (node: ResourceNode) => {
      await withErrorHandling(async () => {
        const data = node.getData();
        const profile = profileManager.getProfile(data.profileName);

        if (!profile) {
          showWarning(`Profile "${data.profileName}" not found`);
          return;
        }

        // Verify this is an HTTP Load Balancer
        if (data.resourceTypeKey !== 'http_loadbalancer') {
          showWarning('Diagram generation is only available for HTTP Load Balancers');
          return;
        }

        logger.info(`Generating diagram for ${data.name} in ${data.namespace}`);

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Generating diagram for ${data.name}...`,
            cancellable: false,
          },
          async () => {
            await diagramProvider.showDiagram(data.profileName, data.namespace, data.name);
          },
        );
      }, 'Generate diagram');
    }),
  );
}
