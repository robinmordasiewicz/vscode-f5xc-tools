# Installation

Install F5 Distributed Cloud Tools for VS Code from the marketplace or from a
VSIX file.

## Prerequisites

Before installing, ensure you have:

- **VS Code**: Version 1.85.0 or higher
- **F5 XC Account**: Valid F5 Distributed Cloud tenant access
- **Credentials**: Either an API Token or P12 certificate

## From VS Code Marketplace

The recommended way to install F5 Distributed Cloud Tools:

1. Open Visual Studio Code
2. Go to Extensions view (`Ctrl+Shift+X` on Windows/Linux, `Cmd+Shift+X` on
   macOS)
3. Search for **"F5 Distributed Cloud Tools"**
4. Click the **Install** button
5. Reload VS Code if prompted

## From VSIX File

For offline installation or pre-release versions:

1. Download the `.vsix` file from the
   [releases page](https://github.com/robinmordasiewicz/vscode-f5xc-tools/releases)
2. Open Visual Studio Code
3. Go to Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
4. Click the `...` menu (top-right of Extensions view)
5. Select **"Install from VSIX..."**
6. Navigate to and select the downloaded `.vsix` file
7. Reload VS Code if prompted

## Verify Installation

After installation, verify the extension is active:

1. Open the Activity Bar (left sidebar)
2. Look for the F5 icon
3. Click the icon to open the F5 XC sidebar
4. You should see empty Profiles and Resources views

## Next Steps

- [Create your first profile](quick-start.md)
- [Set up authentication](authentication.md)
- [Explore resources](../user-guide/explorer.md)

## System Requirements

| Component           | Requirement                   |
| ------------------- | ----------------------------- |
| VS Code             | 1.85.0 or higher              |
| Operating System    | Windows, macOS, or Linux      |
| Internet Connection | Required for F5 XC API access |
| Disk Space          | ~10 MB for extension          |

## Troubleshooting

### Extension Not Appearing

If the extension doesn't appear after installation:

1. Check the **Output** panel (`View > Output`)
2. Select **"F5 XC Tools"** from the dropdown
3. Look for any error messages
4. Try reloading VS Code (`Developer: Reload Window` command)

### Installation Fails

If installation fails:

- Check your internet connection
- Ensure you have the latest VS Code version
- Try clearing the VS Code extensions cache
- Install from VSIX as an alternative

### Permission Issues

On some systems, you may need:

- Adequate disk space in your user profile directory
- Write permissions to VS Code's extensions folder
- Administrative privileges (on Windows with restricted policies)

## Uninstall

To remove the extension:

1. Go to Extensions view
2. Find "F5 Distributed Cloud Tools"
3. Click the gear icon
4. Select **"Uninstall"**
5. Reload VS Code

Note: Uninstalling the extension will remove all stored credentials from VS Code
SecretStorage.
