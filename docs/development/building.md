# Building the Extension

Guide for building F5 Distributed Cloud Tools from source.

## Prerequisites

Before building the extension, ensure you have the following installed:

| Requirement | Version          | Purpose                    |
| ----------- | ---------------- | -------------------------- |
| **Node.js** | 22.x or higher   | Runtime environment        |
| **npm**     | 10.x or higher   | Package manager            |
| **VS Code** | 1.85.0 or higher | Extension development host |
| **Git**     | 2.x or higher    | Source control             |

### Platform Requirements

| Platform    | Additional Requirements                                  |
| ----------- | -------------------------------------------------------- |
| **macOS**   | Xcode Command Line Tools (`xcode-select --install`)      |
| **Linux**   | `build-essential`, `libsecret-1-dev` (for SecretStorage) |
| **Windows** | Visual Studio Build Tools 2019 or newer                  |

## Clone the Repository

```bash
git clone https://github.com/robinmordasiewicz/vscode-f5xc-tools.git
cd vscode-f5xc-tools
```

## Install Dependencies

Install all required npm packages:

```bash
npm install
```

This installs:

- **Production dependencies**: VS Code API, node-forge (P12 parsing), HTTPS
  client libraries
- **Development dependencies**: TypeScript, webpack, ESLint, Jest, testing
  frameworks
- **Type definitions**: @types packages for TypeScript intellisense

## Build Commands

### Development Build

Build the extension with source maps for debugging:

```bash
npm run compile
```

**What this does:**

- Compiles TypeScript to JavaScript using webpack
- Generates source maps for debugging
- Outputs to `dist/` directory
- Takes ~10-15 seconds

**Output:**

```text
dist/extension.js       # Compiled extension code
dist/extension.js.map   # Source map for debugging
```

### Watch Mode

Automatically rebuild on file changes during development:

```bash
npm run watch
```

**What this does:**

- Starts webpack in watch mode
- Recompiles automatically when source files change
- Keeps running in background
- Essential for active development

**Usage:**

1. Open VS Code workspace
2. Run `npm run watch` in terminal
3. Press `F5` to launch Extension Development Host
4. Edit source files - changes auto-compile

### Production Build

Create an optimized production build:

```bash
npm run package
```

**What this does:**

- Compiles with production optimizations
- Minifies JavaScript for smaller size
- Removes source maps
- Tree-shakes unused code
- Outputs optimized bundle

**Performance:**

- Development build: ~500KB
- Production build: ~200KB (60% smaller)

### Create VSIX Package

Package the extension for distribution:

```bash
npx @vscode/vsce package
```

**What this does:**

- Creates `.vsix` file for installation
- Includes compiled code, package.json, assets
- Excludes source files, tests, development dependencies
- Validates extension manifest

**Output:**

```text
vscode-f5xc-tools-2.0.8.vsix
```

**Install VSIX:**

```bash
code --install-extension vscode-f5xc-tools-2.0.8.vsix
```

## Code Quality

### Linting

Check code style and potential issues:

```bash
npm run lint
```

**Checks:**

- TypeScript code style (ESLint rules)
- Potential runtime errors
- Code smells and anti-patterns
- Import/export consistency

**Auto-fix issues:**

```bash
npm run lint:fix
```

### Type Checking

Verify TypeScript type correctness:

```bash
npm run typecheck
```

**Checks:**

- Type safety across entire codebase
- Interface compatibility
- Generic type constraints
- Strict null checks

### Code Formatting

Format code with Prettier:

```bash
npm run format
```

**Formats:**

- TypeScript/JavaScript files
- JSON configuration files
- Markdown documentation
- Uses .prettierrc configuration

## Testing

### Unit Tests

Run Jest unit tests:

```bash
npm run test:unit
```

**What this tests:**

- Individual functions and classes
- Authentication providers
- Resource type parsing
- Utility functions

**With coverage:**

```bash
npm run test:coverage
```

**Coverage report:**

```text
File                   | % Stmts | % Branch | % Funcs | % Lines
-----------------------|---------|----------|---------|--------
All files              |   85.42 |    78.31 |   82.14 |   86.73
```

### Integration Tests

Run VS Code integration tests:

```bash
npm run test
```

**What this tests:**

- Extension activation
- Command registration
- Tree view providers
- API client integration
- Profile management

**Requirements:**

- VS Code must be installed
- Tests run in VS Code Extension Host

### Run All Tests

Execute both unit and integration tests:

```bash
npm run test:all
```

## Debugging

### Launch Extension Development Host

1. Open workspace in VS Code
2. Press `F5` (or Run → Start Debugging)
3. Extension Development Host window opens
4. Extension is loaded and active

**Debugging features:**

- Set breakpoints in TypeScript source
- Inspect variables and call stack
- Step through code execution
- View console logs in Debug Console

### Debug Console Output

View extension logs in Debug Console:

```typescript
// In extension code
console.log('Debug message');
console.error('Error message');
```

**Output appears in:**

- Debug Console panel (Ctrl+Shift+Y / Cmd+Shift+Y)
- VS Code Output panel → "F5 XC Tools"

### Debug Configuration

VS Code launch configuration (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "preLaunchTask": "${defaultBuildTask}"
    }
  ]
}
```

### Debugging Tests

Debug unit tests with Jest:

```bash
npm run test:unit -- --watch
```

**Features:**

- Interactive watch mode
- Re-run tests on file change
- Attach debugger to test process

## Build Optimization

### Tree Shaking

Webpack removes unused code automatically:

```javascript
// webpack.config.js
mode: 'production',
optimization: {
  usedExports: true,
  minimize: true
}
```

### Bundle Analysis

Analyze bundle size and dependencies:

```bash
npx webpack-bundle-analyzer dist/stats.json
```

**Generates:**

- Interactive visualization of bundle contents
- Identifies large dependencies
- Helps optimize bundle size

## Environment Variables

### Development

```bash
# Enable debug logging
export LOG_LEVEL=debug

# Use local API endpoint (for testing)
export F5XC_API_URL=https://localhost:8443
```

### Build Time

```bash
# Specify Node.js version
export NODE_VERSION=22.11.0

# Enable webpack verbose output
export WEBPACK_VERBOSE=true
```

## Common Build Issues

### Node Version Mismatch

**Error:** `The engine "node" is incompatible with this module`

**Solution:**

```bash
nvm install 22
nvm use 22
npm install
```

### Missing Dependencies

**Error:** `Cannot find module 'node-forge'`

**Solution:**

```bash
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Compilation Errors

**Error:** `TS2307: Cannot find module '@vscode/extension'`

**Solution:**

```bash
npm install --save-dev @types/vscode
npm run compile
```

### Webpack Build Failures

**Error:** `Module not found: Error: Can't resolve 'fs'`

**Solution:** Check webpack.config.js externals configuration:

```javascript
externals: {
  vscode: 'commonjs vscode',
  'node-forge': 'commonjs node-forge'
}
```

### P12 Certificate Loading Issues

**Error:** `Cannot load P12 certificate`

**Solution:** Ensure node-forge is correctly installed:

```bash
npm install node-forge
npm install --save-dev @types/node-forge
```

## CI/CD Integration

### GitHub Actions

The repository includes automated workflows:

**`.github/workflows/ci.yml`** - Continuous Integration:

```yaml
- name: Install dependencies
  run: npm ci

- name: Lint code
  run: npm run lint

- name: Type check
  run: npm run typecheck

- name: Run tests
  run: npm run test:all

- name: Build extension
  run: npm run package
```

**`.github/workflows/release.yml`** - Release automation:

```yaml
- name: Package extension
  run: npx @vscode/vsce package

- name: Publish to marketplace
  run: npx @vscode/vsce publish
  env:
    VSCE_PAT: ${{ secrets.VSCE_PAT }}
```

### Local CI Emulation

Run the same checks as CI locally:

```bash
npm ci                  # Clean install
npm run lint            # Code style check
npm run typecheck       # Type safety check
npm run test:all        # All tests
npm run package         # Production build
```

## Build Scripts Reference

| Script          | Command                              | Purpose                            |
| --------------- | ------------------------------------ | ---------------------------------- |
| `compile`       | `webpack --mode development`         | Development build with source maps |
| `watch`         | `webpack --mode development --watch` | Auto-rebuild on file changes       |
| `package`       | `webpack --mode production`          | Optimized production build         |
| `lint`          | `eslint src --ext ts`                | Check code style and errors        |
| `lint:fix`      | `eslint src --ext ts --fix`          | Auto-fix linting issues            |
| `typecheck`     | `tsc --noEmit`                       | Verify TypeScript types            |
| `format`        | `prettier --write "src/**/*.ts"`     | Format code with Prettier          |
| `test`          | `node ./out/test/runTest.js`         | Run VS Code integration tests      |
| `test:unit`     | `jest`                               | Run Jest unit tests                |
| `test:coverage` | `jest --coverage`                    | Unit tests with coverage report    |
| `test:all`      | `npm run test:unit && npm run test`  | Run all tests                      |

## Next Steps

- [Understanding the architecture](architecture.md)
- [Contributing guidelines](contributing.md)
- [Running tests](testing.md)
