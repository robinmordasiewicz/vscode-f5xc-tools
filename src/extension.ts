// Copyright (c) 2026 Robin Mordasiewicz. MIT License.

import * as vscode from 'vscode';
import { ProfileManager } from './config/profiles';
import { F5XCExplorerProvider } from './tree/f5xcExplorer';
import { ProfilesProvider } from './tree/profilesProvider';
import { CloudStatusProvider } from './tree/cloudStatusProvider';
import { SubscriptionProvider } from './tree/subscriptionProvider';
import { F5XCFileSystemProvider } from './providers/f5xcFileSystemProvider';
import { F5XCViewProvider } from './providers/f5xcViewProvider';
import { F5XCDescribeProvider } from './providers/f5xcDescribeProvider';
import { CloudStatusDashboardProvider } from './providers/cloudStatusDashboardProvider';
import { SubscriptionDashboardProvider } from './providers/subscriptionDashboardProvider';
import { registerCrudCommands } from './commands/crud';
import { registerProfileCommands } from './commands/profile';
import { registerObservabilityCommands } from './commands/observability';
import { registerDiagramCommands } from './commands/diagram';
import { registerCloudStatusCommands } from './commands/cloudStatus';
import { HealthcheckFormProvider } from './providers/healthcheckFormProvider';
import { getLogger, Logger } from './utils/logger';

let logger: Logger;

export function activate(context: vscode.ExtensionContext): void {
  logger = getLogger();
  logger.info('F5 Distributed Cloud extension is activating...');

  // Initialize profile manager with XDG-compliant file storage
  const profileManager = new ProfileManager();

  // Client factory for creating API clients
  const clientFactory = (profile: { apiUrl: string; name: string }) => {
    return profileManager.getClient(profile.name);
  };

  // Initialize tree view providers
  const explorerProvider = new F5XCExplorerProvider(profileManager, clientFactory);
  const profilesProvider = new ProfilesProvider(profileManager);
  const cloudStatusProvider = new CloudStatusProvider();
  const subscriptionProvider = new SubscriptionProvider(profileManager);
  const cloudStatusDashboardProvider = new CloudStatusDashboardProvider(profileManager);

  // Set context for active profile to control view visibility
  const updateHasActiveProfile = async () => {
    const hasActive = (await profileManager.getActiveProfile()) !== null;
    void vscode.commands.executeCommand('setContext', 'f5xc.hasActiveProfile', hasActive);
  };
  void updateHasActiveProfile();

  // Initialize F5 XC file system provider for editing resources
  const fsProvider = new F5XCFileSystemProvider(profileManager, () => {
    explorerProvider.refresh();
  });

  // Register the file system provider for editing resources
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider('f5xc', fsProvider, {
      isCaseSensitive: true,
      isReadonly: false,
    }),
  );

  // Initialize and register the view provider for read-only resource viewing
  const viewProvider = new F5XCViewProvider(profileManager);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('f5xc-view', viewProvider),
  );

  // Initialize the describe provider for formatted resource descriptions
  const describeProvider = new F5XCDescribeProvider(profileManager);

  // Initialize the subscription dashboard provider for Plan and Quotas views
  const subscriptionDashboardProvider = new SubscriptionDashboardProvider(profileManager);

  // Register subscription commands (f5xc.showPlan, f5xc.showQuotas)
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.showPlan', async (profileName?: string) => {
      const activeProfile = await profileManager.getActiveProfile();
      const profile = profileName || activeProfile?.name;
      if (profile) {
        void subscriptionDashboardProvider.showPlan(profile);
      } else {
        void vscode.window.showWarningMessage('No active profile selected');
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.showQuotas', async (profileName?: string) => {
      const activeProfile = await profileManager.getActiveProfile();
      const profile = profileName || activeProfile?.name;
      if (profile) {
        void subscriptionDashboardProvider.showQuotas(profile);
      } else {
        void vscode.window.showWarningMessage('No active profile selected');
      }
    }),
  );

  // Register addon activation command (for programmatic access)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'f5xc.activateAddon',
      async (addonName: string, profileName?: string) => {
        const activeProfile = await profileManager.getActiveProfile();
        const profile = profileName || activeProfile?.name;
        if (!profile) {
          void vscode.window.showWarningMessage('No active profile selected');
          return;
        }
        if (!addonName) {
          void vscode.window.showWarningMessage('Addon name is required');
          return;
        }
        // Show the plan dashboard which handles activation
        await subscriptionDashboardProvider.showPlan(profile);
        void vscode.window.showInformationMessage(
          `To activate "${addonName}", click the Activate button in the Plan dashboard.`,
        );
      },
    ),
  );

  // Register tree views
  const explorerView = vscode.window.createTreeView('f5xc.explorer', {
    treeDataProvider: explorerProvider,
    showCollapseAll: true,
    canSelectMany: false,
  });

  const profilesView = vscode.window.createTreeView('f5xc.profiles', {
    treeDataProvider: profilesProvider,
    showCollapseAll: false,
    canSelectMany: false,
  });

  const cloudStatusView = vscode.window.createTreeView('f5xc.cloudStatus', {
    treeDataProvider: cloudStatusProvider,
    showCollapseAll: true,
    canSelectMany: false,
  });

  const subscriptionView = vscode.window.createTreeView('f5xc.subscription', {
    treeDataProvider: subscriptionProvider,
    showCollapseAll: false,
    canSelectMany: false,
  });

  // Register refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.refresh', () => {
      explorerProvider.refresh();
      logger.info('Explorer refreshed');
    }),
  );

  // Register profile commands
  registerProfileCommands(context, profileManager, profilesProvider, explorerProvider);

  // Register CRUD commands
  registerCrudCommands(
    context,
    explorerProvider,
    profileManager,
    fsProvider,
    viewProvider,
    describeProvider,
  );

  // Register observability commands
  registerObservabilityCommands(context, profileManager);

  // Register diagram commands
  registerDiagramCommands(context, profileManager);

  // Register cloud status commands
  registerCloudStatusCommands(context, cloudStatusProvider, cloudStatusDashboardProvider);

  // Register healthcheck form provider
  const healthcheckFormProvider = new HealthcheckFormProvider(
    context,
    profileManager,
    explorerProvider,
    describeProvider,
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.createHealthcheckForm', async (arg?: unknown) => {
      // Extract namespace from context if available
      let namespace: string | undefined;
      if (arg && typeof arg === 'object' && 'getData' in arg) {
        const nodeData = (arg as { getData: () => { namespace?: string } }).getData();
        namespace = nodeData.namespace;
      }
      await healthcheckFormProvider.show(namespace);
    }),
  );

  // Register views
  context.subscriptions.push(explorerView);
  context.subscriptions.push(profilesView);
  context.subscriptions.push(cloudStatusView);
  context.subscriptions.push(subscriptionView);

  // Ensure the Resources view is the default focused view on initial activation
  vscode.commands.executeCommand('f5xc.explorer.focus').then(
    () => {
      logger.debug('Focused Resources view (f5xc.explorer) as default');
    },
    (error) => {
      logger.warn('Failed to focus Resources view (f5xc.explorer)', error as Error);
    },
  );

  // Listen for profile changes
  profileManager.onDidChangeProfiles(() => {
    profilesProvider.refresh();
    explorerProvider.refresh();
    subscriptionProvider.refresh();
    void updateHasActiveProfile();
  });

  logger.info('F5 Distributed Cloud extension activated successfully');
}

export function deactivate(): void {
  logger?.info('F5 Distributed Cloud extension deactivated');
}
