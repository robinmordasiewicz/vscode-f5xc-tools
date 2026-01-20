# F5 Distributed Cloud Tools for VS Code

Manage F5 Distributed Cloud (F5 XC) resources directly from Visual Studio Code.

## Features

- **Profile Management**: Configure multiple F5 XC tenant connections with
  secure credential storage
- **Resource Explorer**: Browse namespaces, resource types, and individual
  resources in a tree view
- **CRUD Operations**: Create, view, edit, and delete F5 XC resources
- **JSON Validation**: Built-in schema validation for resource configurations
- **Diff Support**: Compare local configurations with remote resources
- **Authentication**: Support for API Token and P12 certificate authentication

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "F5 Distributed Cloud Tools"
4. Click Install

### From VSIX

1. Download the `.vsix` file from the releases page
2. Open VS Code
3. Go to Extensions
4. Click the `...` menu and select "Install from VSIX..."
5. Select the downloaded file

## Getting Started

### Add a Profile

1. Open the F5 XC sidebar (click the F5 icon in the activity bar)
2. Click the `+` button in the Profiles section
3. Enter your profile details:
   - **Name**: A friendly name for this connection
   - **API URL**: Your F5 XC console URL (e.g.,
     `https://tenant.console.ves.volterra.io`)
   - **Auth Type**: Choose between API Token or P12 Certificate
4. Enter your credentials when prompted

### Browse Resources

Once a profile is configured and set as active:

1. The Resources tree view will show available namespaces
2. Expand a namespace to see resource categories
3. Expand a category to see resource types
4. Expand a resource type to see individual resources

### Manage Resources

Right-click on any resource to:

- **View**: Open the resource configuration in a new editor
- **Edit**: Modify the resource configuration
- **Delete**: Remove the resource (with confirmation)
- **Compare with Remote**: See differences between local and remote versions

## Configuration

Access settings via `File > Preferences > Settings` and search for "F5 XC":

| Setting                    | Description                                     | Default   |
| -------------------------- | ----------------------------------------------- | --------- |
| `f5xc.logLevel`            | Log level (debug, info, warn, error)            | `info`    |
| `f5xc.defaultNamespace`    | Default namespace for new resources             | `default` |
| `f5xc.confirmDelete`       | Show confirmation before deleting               | `true`    |
| `f5xc.autoRefreshInterval` | Auto-refresh interval in seconds (0 to disable) | `0`       |

## Keyboard Shortcuts

| Command             | Windows/Linux  | macOS         |
| ------------------- | -------------- | ------------- |
| Apply Configuration | `Ctrl+Shift+A` | `Cmd+Shift+A` |
| Refresh Explorer    | `Ctrl+Shift+R` | `Cmd+Shift+R` |

## Supported Resource Types

The extension supports 236 F5 XC resource types organized by category:

- **Load Balancing**: HTTP/TCP/UDP Load Balancers, Origin Pools, Health Checks
- **Security**: App Firewalls, Service Policies, Rate Limiters, WAF Exclusions
- **Networking**: Virtual Networks, Network Connectors, Network Policies
- **Sites**: AWS VPC, Azure VNET, GCP VPC, App Stack, SecureMesh
- **DNS**: DNS Zones, DNS Load Balancers, DNS LB Pools
- **IAM**: Namespaces, Users, Roles, API Credentials
- **Observability**: Alert Policies, Alert Receivers, Log Receivers

## Development

### Prerequisites

- Node.js 22.x or higher
- VS Code 1.85.0 or higher

### Setup

```bash
# Clone the repository
git clone https://github.com/robinmordasiewicz/vscode-f5xc-tools.git
cd vscode-f5xc-tools

# Install dependencies
npm install

# Compile the extension
npm run compile
```

### Running Tests

```bash
# Run unit tests
npm test

# Run unit tests with coverage
npm run test:coverage

# Run integration tests (requires VS Code)
npm run test:integration

# Run all tests
npm run test:all
```

### Development Commands

```bash
npm run compile      # Build with webpack
npm run watch        # Watch mode for development
npm run package      # Production build
npm run lint         # Run ESLint
npm run lint:fix     # Auto-fix ESLint issues
npm run typecheck    # TypeScript type checking
npm run format       # Format code with Prettier
```

### Debugging

Press `F5` in VS Code to launch the Extension Development Host with the
extension loaded.

### Form Maintenance

The healthcheck form (`src/providers/healthcheckFormProvider.ts`) must maintain
alignment with API spec recommendations to ensure consistency across all
resource creation methods (form-based, JSON editing, inline completions).

**Validation**: Run `npm run validate:forms` before committing changes

**Source of Truth**:

- API Specs: `docs/specifications/api/domains/virtual.json`
- Generated Types: `src/generated/resourceTypesBase.ts`
- Field Metadata: `x-f5xc-recommended-value` annotations

**Validation Process**:

```bash
# Validate form defaults match API spec recommendations
npm run validate:forms

# This runs automatically during pretest
npm test
```

**If form defaults need to diverge from specs**:

1. Document the reason in code comments with clear justification
2. Add exception to validation script (`scripts/validate-form-defaults.ts`)
3. Consider filing issue in upstream spec repo if spec is incorrect

## Contributing

Contributions are welcome! Please read our contributing guidelines before
submitting pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the Apache License 2.0 - see the
[LICENSE](LICENSE) file for details.

## Support

- [GitHub Issues](https://github.com/robinmordasiewicz/vscode-f5xc-tools/issues)
- [F5 Distributed Cloud Documentation](https://docs.cloud.f5.com/)
