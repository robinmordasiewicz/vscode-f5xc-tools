import * as vscode from 'vscode';
import { ProfileManager } from './config/profiles';
import { F5XCExplorerProvider } from './tree/f5xcExplorer';
import { ProfilesProvider } from './tree/profilesProvider';
import { F5XCFileSystemProvider } from './providers/f5xcFileSystemProvider';
import { registerCrudCommands } from './commands/crud';
import { registerProfileCommands } from './commands/profile';
import { registerObservabilityCommands } from './commands/observability';
import { Logger } from './utils/logger';

let logger: Logger;

export function activate(context: vscode.ExtensionContext): void {
  logger = new Logger('F5 XC');
  logger.info('F5 Distributed Cloud extension is activating...');

  // Initialize profile manager with secure storage
  const profileManager = new ProfileManager(context, context.secrets);

  // Client factory for creating API clients
  const clientFactory = (profile: { apiUrl: string; name: string }) => {
    return profileManager.getClient(profile.name);
  };

  // Initialize tree view providers
  const explorerProvider = new F5XCExplorerProvider(profileManager, clientFactory);
  const profilesProvider = new ProfilesProvider(profileManager);

  // Initialize F5 XC file system provider for editing resources
  const fsProvider = new F5XCFileSystemProvider(profileManager, () => {
    explorerProvider.refresh();
  });

  // Register the file system provider
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider('f5xc', fsProvider, {
      isCaseSensitive: true,
      isReadonly: false,
    }),
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
  registerCrudCommands(context, explorerProvider, profileManager, fsProvider);

  // Register observability commands
  registerObservabilityCommands(context, profileManager);

  // Register views
  context.subscriptions.push(explorerView);
  context.subscriptions.push(profilesView);

  // Listen for profile changes
  profileManager.onDidChangeProfiles(() => {
    profilesProvider.refresh();
    explorerProvider.refresh();
  });

  logger.info('F5 Distributed Cloud extension activated successfully');
}

export function deactivate(): void {
  logger?.info('F5 Distributed Cloud extension deactivated');
}
