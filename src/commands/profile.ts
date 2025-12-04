import * as vscode from 'vscode';
import { ProfileManager, F5XCProfile } from '../config/profiles';
import { ProfilesProvider, ProfileTreeItem } from '../tree/profilesProvider';
import { F5XCExplorerProvider } from '../tree/f5xcExplorer';
import { withErrorHandling, showInfo, showWarning } from '../utils/errors';

/**
 * Register profile management commands
 */
export function registerProfileCommands(
  context: vscode.ExtensionContext,
  profileManager: ProfileManager,
  profilesProvider: ProfilesProvider,
  explorerProvider: F5XCExplorerProvider,
): void {
  // ADD PROFILE
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.addProfile', async () => {
      await withErrorHandling(async () => {
        // Step 1: Profile name
        const name = await vscode.window.showInputBox({
          prompt: 'Enter a name for this profile',
          placeHolder: 'production',
          ignoreFocusOut: true,
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return 'Profile name is required';
            }
            if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
              return 'Profile name can only contain letters, numbers, underscores, and hyphens';
            }
            return null;
          },
        });

        if (!name) {
          return;
        }

        // Step 2: API URL
        const apiUrl = await vscode.window.showInputBox({
          prompt: 'Enter F5 XC API URL',
          placeHolder: 'https://tenant.console.ves.volterra.io',
          value: 'https://',
          ignoreFocusOut: true,
          validateInput: (value) => {
            if (!value || !value.startsWith('https://')) {
              return 'API URL must start with https://';
            }
            try {
              new URL(value);
              return null;
            } catch {
              return 'Invalid URL format';
            }
          },
        });

        if (!apiUrl) {
          return;
        }

        // Step 3: Authentication type
        const authType = await vscode.window.showQuickPick(
          [
            {
              label: 'API Token',
              description: 'Use an API token for authentication',
              value: 'token' as const,
            },
            {
              label: 'P12 Certificate',
              description: 'Use a P12 certificate file for authentication',
              value: 'p12' as const,
            },
          ],
          {
            placeHolder: 'Select authentication method',
            ignoreFocusOut: true,
          },
        );

        if (!authType) {
          return;
        }

        const credentials: { token?: string; p12Password?: string } = {};
        let p12Path: string | undefined;

        if (authType.value === 'token') {
          // Step 4a: API Token
          const token = await vscode.window.showInputBox({
            prompt: 'Enter your API token',
            password: true,
            placeHolder: 'Your API token',
            ignoreFocusOut: true,
            validateInput: (value) => {
              if (!value || value.trim().length === 0) {
                return 'API token is required';
              }
              return null;
            },
          });

          if (!token) {
            return;
          }

          credentials.token = token;
        } else {
          // Step 4b: P12 file path
          const fileUris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
              'P12 Certificate': ['p12', 'pfx'],
            },
            title: 'Select P12 Certificate File',
          });

          if (!fileUris || fileUris.length === 0) {
            return;
          }

          p12Path = fileUris[0]?.fsPath;

          // Step 5: P12 password
          const p12Password = await vscode.window.showInputBox({
            prompt: 'Enter P12 certificate password',
            password: true,
            placeHolder: 'Certificate password',
            ignoreFocusOut: true,
            validateInput: (value) => {
              if (!value) {
                return 'Password is required';
              }
              return null;
            },
          });

          if (!p12Password) {
            return;
          }

          credentials.p12Password = p12Password;
        }

        // Create profile
        const profile: F5XCProfile = {
          name,
          apiUrl,
          authType: authType.value,
          p12Path,
        };

        // Add profile
        await profileManager.addProfile(profile, credentials);

        // Validate credentials
        const validating = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Validating credentials...',
            cancellable: false,
          },
          async () => {
            return profileManager.validateProfile(name);
          },
        );

        if (validating) {
          showInfo(`Profile "${name}" added and validated successfully`);
        } else {
          showWarning(
            `Profile "${name}" added but credentials could not be validated. Check your settings.`,
          );
        }

        profilesProvider.refresh();
        explorerProvider.refresh();
      }, 'Add profile');
    }),
  );

  // EDIT PROFILE
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.editProfile', async (node?: ProfileTreeItem) => {
      await withErrorHandling(async () => {
        let profileName: string | undefined;

        if (node) {
          profileName = node.getProfile().name;
        } else {
          // Prompt user to select profile
          const profiles = profileManager.getProfiles();
          if (profiles.length === 0) {
            showWarning('No profiles configured');
            return;
          }

          const selected = await vscode.window.showQuickPick(
            profiles.map((p) => ({
              label: p.name,
              description: p.apiUrl,
              detail: `Auth: ${p.authType}`,
            })),
            { placeHolder: 'Select profile to edit', ignoreFocusOut: true },
          );

          if (!selected) {
            return;
          }

          profileName = selected.label;
        }

        const profile = profileManager.getProfile(profileName);
        if (!profile) {
          showWarning(`Profile "${profileName}" not found`);
          return;
        }

        // Show options for what to edit
        const editOption = await vscode.window.showQuickPick(
          [
            { label: 'API URL', description: `Current: ${profile.apiUrl}` },
            { label: 'Credentials', description: 'Update authentication credentials' },
            ...(profile.authType === 'p12'
              ? [{ label: 'P12 File', description: `Current: ${profile.p12Path || 'Not set'}` }]
              : []),
          ],
          { placeHolder: 'What would you like to edit?', ignoreFocusOut: true },
        );

        if (!editOption) {
          return;
        }

        const updates: Partial<F5XCProfile> = {};
        const credentials: { token?: string; p12Password?: string } = {};

        switch (editOption.label) {
          case 'API URL': {
            const newUrl = await vscode.window.showInputBox({
              prompt: 'Enter new API URL',
              value: profile.apiUrl,
              ignoreFocusOut: true,
              validateInput: (value) => {
                if (!value || !value.startsWith('https://')) {
                  return 'API URL must start with https://';
                }
                return null;
              },
            });

            if (!newUrl) {
              return;
            }

            updates.apiUrl = newUrl;
            break;
          }

          case 'Credentials': {
            if (profile.authType === 'token') {
              const newToken = await vscode.window.showInputBox({
                prompt: 'Enter new API token',
                password: true,
                placeHolder: 'New API token',
                ignoreFocusOut: true,
              });

              if (!newToken) {
                return;
              }

              credentials.token = newToken;
            } else {
              const newPassword = await vscode.window.showInputBox({
                prompt: 'Enter new P12 password',
                password: true,
                placeHolder: 'New P12 password',
                ignoreFocusOut: true,
              });

              if (!newPassword) {
                return;
              }

              credentials.p12Password = newPassword;
            }
            break;
          }

          case 'P12 File': {
            const fileUris = await vscode.window.showOpenDialog({
              canSelectFiles: true,
              canSelectFolders: false,
              canSelectMany: false,
              filters: {
                'P12 Certificate': ['p12', 'pfx'],
              },
              title: 'Select new P12 Certificate File',
            });

            if (!fileUris || fileUris.length === 0) {
              return;
            }

            updates.p12Path = fileUris[0]?.fsPath;
            break;
          }
        }

        // Apply updates
        await profileManager.updateProfile(
          profileName,
          updates,
          Object.keys(credentials).length > 0 ? credentials : undefined,
        );

        showInfo(`Profile "${profileName}" updated`);
        profilesProvider.refresh();
        explorerProvider.refresh();
      }, 'Edit profile');
    }),
  );

  // DELETE PROFILE
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.deleteProfile', async (node?: ProfileTreeItem) => {
      await withErrorHandling(async () => {
        let profileName: string | undefined;

        if (node) {
          profileName = node.getProfile().name;
        } else {
          // Prompt user to select profile
          const profiles = profileManager.getProfiles();
          if (profiles.length === 0) {
            showWarning('No profiles configured');
            return;
          }

          const selected = await vscode.window.showQuickPick(
            profiles.map((p) => ({
              label: p.name,
              description: p.apiUrl,
            })),
            { placeHolder: 'Select profile to delete', ignoreFocusOut: true },
          );

          if (!selected) {
            return;
          }

          profileName = selected.label;
        }

        // Confirm deletion
        const confirm = await vscode.window.showWarningMessage(
          `Delete profile "${profileName}"? This cannot be undone.`,
          { modal: true },
          'Delete',
        );

        if (confirm !== 'Delete') {
          return;
        }

        await profileManager.removeProfile(profileName);
        showInfo(`Profile "${profileName}" deleted`);
        profilesProvider.refresh();
        explorerProvider.refresh();
      }, 'Delete profile');
    }),
  );

  // SET ACTIVE PROFILE
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.setActiveProfile', async (node?: ProfileTreeItem) => {
      await withErrorHandling(async () => {
        let profileName: string | undefined;

        if (node) {
          profileName = node.getProfile().name;
        } else {
          // Prompt user to select profile
          const profiles = profileManager.getProfiles();
          if (profiles.length === 0) {
            showWarning('No profiles configured');
            return;
          }

          const selected = await vscode.window.showQuickPick(
            profiles.map((p) => ({
              label: p.name,
              description: p.isActive ? '(active)' : '',
              detail: p.apiUrl,
            })),
            { placeHolder: 'Select profile to activate', ignoreFocusOut: true },
          );

          if (!selected) {
            return;
          }

          profileName = selected.label;
        }

        await profileManager.setActiveProfile(profileName);
        showInfo(`Active profile set to "${profileName}"`);
        profilesProvider.refresh();
        explorerProvider.refresh();
      }, 'Set active profile');
    }),
  );
}
