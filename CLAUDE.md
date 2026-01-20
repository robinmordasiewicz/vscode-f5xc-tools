# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Build Commands

```bash
npm run compile          # Build with webpack (development)
npm run watch            # Watch mode for development
npm run package          # Production build
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix ESLint issues
npm run test             # Run VSCode integration tests
npm run test:unit        # Run Jest unit tests
```

To test the extension: Press `F5` in VSCode to launch Extension Development
Host.

## Architecture

This is a VSCode extension for managing F5 Distributed Cloud (F5 XC) resources.

### Layered Structure

```text
src/extension.ts                    # Entry point (activate/deactivate)
        │
        ├── commands/               # Command handlers
        │   ├── crud.ts             # Resource operations (get, edit, create, apply, delete, diff)
        │   └── profile.ts          # Profile management (add, edit, delete, setActive)
        │
        ├── tree/                   # Tree view providers
        │   ├── f5xcExplorer.ts     # Resource explorer (Namespace → Category → ResourceType → Resource)
        │   └── profilesProvider.ts # Profile list view
        │
        ├── api/                    # API layer
        │   ├── client.ts           # F5XCClient - REST operations (create, get, list, replace, delete)
        │   ├── resourceTypes.ts    # RESOURCE_TYPES registry (40+ F5 XC resource types)
        │   └── auth/               # Authentication providers
        │       ├── tokenAuth.ts    # API Token auth (Authorization: APIToken {token})
        │       └── p12Auth.ts      # P12 certificate auth (mTLS via node-forge)
        │
        └── config/
            └── profiles.ts         # ProfileManager - credentials in VSCode SecretStorage
```

### Key Patterns

- **Authentication**: Two providers implementing `AuthProvider` interface -
  credentials stored in VSCode SecretStorage, never in settings
- **Tree Hierarchy**: `F5XCExplorerProvider` uses lazy-loading with node types:
  NamespaceNode → CategoryNode → ResourceTypeNode → ResourceNode
- **Commands**: Registered in `package.json` contributes.commands, implemented
  in `commands/`, use `withErrorHandling()` wrapper
- **Resource Types**: `RESOURCE_TYPES` maps keys (e.g., `http_loadbalancer`) to
  API paths and metadata

### Extension Points

- New resource types: Add to `RESOURCE_TYPES` in `src/api/resourceTypes.ts`
- New commands: Register in `package.json`, implement in `src/commands/`, wire
  in `extension.ts`
- New tree nodes: Extend `F5XCTreeItem` interface from `src/tree/treeTypes.ts`

## WebView Content Security Policy (CSP)

**CRITICAL**: All webview providers MUST include `webview.cspSource` in their
Content Security Policy.

### Why This Matters

VSCode webviews use a Content Security Policy (CSP) to secure content. Without
including the `cspSource`:

- Webview resources (scripts, styles) won't load
- Forms become non-interactive (read-only inputs, non-clickable buttons)
- Dropdown menus and interactive elements fail silently

### Required Pattern

Every webview provider method that generates HTML content MUST:

1. **Get the CSP source**:

```typescript
const cspSource = this.panel!.webview.cspSource;
// OR for methods that create new panels:
const cspSource = webview.cspSource;
```

2. **Include in CSP meta tag**:

```typescript
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               style-src ${cspSource} 'unsafe-inline';
               script-src 'nonce-${nonce}' ${cspSource};">
```

### Examples

#### Standard WebView (uses this.panel)

```typescript
private getWebviewContent(): string {
  const nonce = this.getNonce();
  const cspSource = this.panel!.webview.cspSource;

  return `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${cspSource} 'unsafe-inline';
                 script-src 'nonce-${nonce}' ${cspSource};">
</head>
...`;
}
```

#### Detail View (creates new panel)

```typescript
showDetails(item: Item): void {
  const panel = vscode.window.createWebviewPanel(...);
  panel.webview.html = this.getDetailsContent(item, panel.webview);
}

private getDetailsContent(item: Item, webview: vscode.Webview): string {
  const nonce = this.getNonce();
  const cspSource = webview.cspSource;

  return `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${cspSource} 'unsafe-inline';
                 script-src 'nonce-${nonce}' ${cspSource};">
</head>
...`;
}
```

#### WebView with External Resources (e.g., CDN)

```typescript
private getWebviewContent(): string {
  const nonce = this.getNonce();
  const cspSource = this.panel!.webview.cspSource;

  return `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${cspSource} 'unsafe-inline';
                 script-src 'nonce-${nonce}' ${cspSource} https://cdn.jsdelivr.net;
                 img-src data:;">
  <!-- Note: cspSource comes BEFORE external CDN -->
</head>
...`;
}
```

### Current Providers

All providers have been updated with correct CSP:

- ✅ `healthcheckFormProvider.ts` - Form for creating healthchecks
- ✅ `subscriptionDashboardProvider.ts` - Plan and quota dashboards
- ✅ `cloudStatusDashboardProvider.ts` - Cloud status and detail views
- ✅ `f5xcDescribeProvider.ts` - Resource description viewer
- ✅ `f5xcDiagramProvider.ts` - HTTP Load Balancer diagrams

### Testing CSP Configuration

When creating or modifying webview providers, verify CSP:

1. **Open webview** with developer tools (`Cmd+Alt+I` or `Ctrl+Shift+I`)
2. **Check Console** for CSP logs and errors:

```text
✅ Good: CSP Source: vscode-webview://...
❌ Bad: CSP Source: undefined
❌ Bad: CSP violation errors
```

3. **Test interactivity**:

- Input fields accept keyboard input
- Buttons respond to clicks
- Dropdowns open and respond
- No read-only behavior

### Common Mistakes

❌ **WRONG** - Missing cspSource:

```typescript
const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;
```

❌ **WRONG** - Forgot to get cspSource:

```typescript
private getWebviewContent(): string {
  const nonce = this.getNonce();
  // Missing: const cspSource = this.panel!.webview.cspSource;
  return `<meta http-equiv="Content-Security-Policy" content="...">`;
}
```

❌ **WRONG** - External CDN comes before cspSource:

```typescript
script-src 'nonce-${nonce}' https://cdn.jsdelivr.net ${cspSource};
// Should be: script-src 'nonce-${nonce}' ${cspSource} https://cdn.jsdelivr.net;
```

✅ **CORRECT** - Complete pattern:

```typescript
private getWebviewContent(): string {
  const nonce = this.getNonce();
  const cspSource = this.panel!.webview.cspSource;

  const csp = `default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${cspSource};`;

  return `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
}
```

### Related Issues

- Issue #111: CSP regression causing non-interactive healthcheck forms
- PR #112: Restored `cspSource` to healthcheck form provider
- PR #XXX: Added `cspSource` to all remaining webview providers

### References

- [VSCode Webview API - Content Security Policy](https://code.visualstudio.com/api/extension-guides/webview#content-security-policy)
- [MDN - Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
