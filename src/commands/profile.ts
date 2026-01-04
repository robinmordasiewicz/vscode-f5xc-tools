import * as vscode from 'vscode';
import { ProfileManager, Profile } from '../config/profiles';
import { ProfilesProvider, ProfileTreeItem } from '../tree/profilesProvider';
import { F5XCExplorerProvider } from '../tree/f5xcExplorer';
import { withErrorHandling, showInfo, showWarning } from '../utils/errors';

/**
 * Auth type selection options
 */
type AuthType = 'apiToken' | 'p12Bundle' | 'certKey';

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
            if (value.length > 64) {
              return 'Profile name must be 64 characters or less';
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
        const authTypeChoice = await vscode.window.showQuickPick(
          [
            {
              label: 'API Token',
              description: 'Use an API token for authentication',
              value: 'apiToken' as AuthType,
            },
            {
              label: 'P12 Certificate Bundle',
              description:
                'Use a P12/PFX certificate file (password from F5XC_P12_PASSWORD env var)',
              value: 'p12Bundle' as AuthType,
            },
            {
              label: 'Certificate + Key Files',
              description: 'Use separate PEM certificate and key files',
              value: 'certKey' as AuthType,
            },
          ],
          {
            placeHolder: 'Select authentication method',
            ignoreFocusOut: true,
          },
        );

        if (!authTypeChoice) {
          return;
        }

        // Build profile based on auth type
        const profile: Profile = {
          name,
          apiUrl,
        };

        if (authTypeChoice.value === 'apiToken') {
          // Step 4a: API Token
          const apiToken = await vscode.window.showInputBox({
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

          if (!apiToken) {
            return;
          }

          profile.apiToken = apiToken;
        } else if (authTypeChoice.value === 'p12Bundle') {
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

          profile.p12Bundle = fileUris[0]?.fsPath;

          // Inform user about password environment variable
          showInfo('P12 password should be set via the F5XC_P12_PASSWORD environment variable.');
        } else if (authTypeChoice.value === 'certKey') {
          // Step 4c: Certificate file
          const certUris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
              'PEM Certificate': ['pem', 'crt', 'cer'],
            },
            title: 'Select Certificate File (PEM format)',
          });

          if (!certUris || certUris.length === 0) {
            return;
          }

          profile.cert = certUris[0]?.fsPath;

          // Step 4d: Key file
          const keyUris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
              'PEM Private Key': ['pem', 'key'],
            },
            title: 'Select Private Key File (PEM format)',
          });

          if (!keyUris || keyUris.length === 0) {
            return;
          }

          profile.key = keyUris[0]?.fsPath;
        }

        // Step 5: Optional default namespace
        const defaultNamespace = await vscode.window.showInputBox({
          prompt: 'Enter default namespace (optional)',
          placeHolder: 'system',
          ignoreFocusOut: true,
        });

        if (defaultNamespace && defaultNamespace.trim().length > 0) {
          profile.defaultNamespace = defaultNamespace.trim();
        }

        // Add profile
        await profileManager.addProfile(profile);

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
          const profiles = await profileManager.getProfiles();
          if (profiles.length === 0) {
            showWarning('No profiles configured');
            return;
          }

          const selected = await vscode.window.showQuickPick(
            profiles.map((p) => ({
              label: p.name,
              description: p.apiUrl,
              detail: getAuthTypeDescription(p),
            })),
            { placeHolder: 'Select profile to edit', ignoreFocusOut: true },
          );

          if (!selected) {
            return;
          }

          profileName = selected.label;
        }

        const profile = await profileManager.getProfile(profileName);
        if (!profile) {
          showWarning(`Profile "${profileName}" not found`);
          return;
        }

        // Build edit options based on current profile
        const editOptions: { label: string; description: string }[] = [
          { label: 'API URL', description: `Current: ${profile.apiUrl}` },
          {
            label: 'Default Namespace',
            description: `Current: ${profile.defaultNamespace || 'Not set'}`,
          },
        ];

        if (profile.apiToken) {
          editOptions.push({ label: 'API Token', description: 'Update API token' });
        }
        if (profile.p12Bundle) {
          editOptions.push({ label: 'P12 Bundle', description: `Current: ${profile.p12Bundle}` });
        }
        if (profile.cert) {
          editOptions.push({ label: 'Certificate', description: `Current: ${profile.cert}` });
        }
        if (profile.key) {
          editOptions.push({ label: 'Private Key', description: `Current: ${profile.key}` });
        }

        const editOption = await vscode.window.showQuickPick(editOptions, {
          placeHolder: 'What would you like to edit?',
          ignoreFocusOut: true,
        });

        if (!editOption) {
          return;
        }

        const updates: Partial<Profile> = {};

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

          case 'Default Namespace': {
            const newNamespace = await vscode.window.showInputBox({
              prompt: 'Enter new default namespace (leave empty to clear)',
              value: profile.defaultNamespace || '',
              ignoreFocusOut: true,
            });

            if (newNamespace === undefined) {
              return;
            }

            updates.defaultNamespace = newNamespace.trim() || undefined;
            break;
          }

          case 'API Token': {
            const newToken = await vscode.window.showInputBox({
              prompt: 'Enter new API token',
              password: true,
              placeHolder: 'New API token',
              ignoreFocusOut: true,
            });

            if (!newToken) {
              return;
            }

            updates.apiToken = newToken;
            break;
          }

          case 'P12 Bundle': {
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

            updates.p12Bundle = fileUris[0]?.fsPath;
            break;
          }

          case 'Certificate': {
            const certUris = await vscode.window.showOpenDialog({
              canSelectFiles: true,
              canSelectFolders: false,
              canSelectMany: false,
              filters: {
                'PEM Certificate': ['pem', 'crt', 'cer'],
              },
              title: 'Select new Certificate File',
            });

            if (!certUris || certUris.length === 0) {
              return;
            }

            updates.cert = certUris[0]?.fsPath;
            break;
          }

          case 'Private Key': {
            const keyUris = await vscode.window.showOpenDialog({
              canSelectFiles: true,
              canSelectFolders: false,
              canSelectMany: false,
              filters: {
                'PEM Private Key': ['pem', 'key'],
              },
              title: 'Select new Private Key File',
            });

            if (!keyUris || keyUris.length === 0) {
              return;
            }

            updates.key = keyUris[0]?.fsPath;
            break;
          }
        }

        // Apply updates
        await profileManager.updateProfile(profileName, updates);

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
          const profiles = await profileManager.getProfiles();
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
          const profiles = await profileManager.getProfiles();
          const activeName = await profileManager.getActiveProfileName();

          if (profiles.length === 0) {
            showWarning('No profiles configured');
            return;
          }

          const selected = await vscode.window.showQuickPick(
            profiles.map((p) => ({
              label: p.name,
              description: p.name === activeName ? '(active)' : '',
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

  // CLEAR AUTH CACHE
  context.subscriptions.push(
    vscode.commands.registerCommand('f5xc.clearAuthCache', async () => {
      await withErrorHandling(() => {
        profileManager.clearAllCachesPublic();
        showInfo('Authentication cache cleared. Re-authentication will occur on next request.');
        explorerProvider.refresh();
        return Promise.resolve();
      }, 'Clear auth cache');
    }),
  );
}

/**
 * Get a human-readable description of the profile's auth type
 */
function getAuthTypeDescription(profile: Profile): string {
  if (profile.apiToken) {
    return 'Auth: API Token';
  }
  if (profile.p12Bundle) {
    return 'Auth: P12 Certificate';
  }
  if (profile.cert && profile.key) {
    return 'Auth: Certificate + Key';
  }
  return 'Auth: Not configured';
}
