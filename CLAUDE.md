# Claude Code Project Instructions

## Repository Workflow

This repo enforces a strict governance workflow. Follow it exactly:

1. **Create a GitHub issue** before making any changes
2. **Create a feature branch** from `main` — never commit to `main` directly
3. **Open a PR** that links to the issue using `Closes #N`
4. **CI must pass** — the "Check linked issues" check blocks PRs without a
   linked issue
5. **Merge** — squash merge preferred, branch auto-deletes after merge

## Use the `/ship` Skill

When available, use `/ship` to handle the full workflow (issue creation, branch,
commit, PR) in one step.

## Branch Naming

Use the format `<prefix>/<issue-number>-short-description`:

- `feature/42-add-rate-limiting`
- `fix/17-correct-threshold`
- `docs/8-update-guide`

## Rules

- Never push directly to `main`
- Never force push
- Every PR must link to an issue
- Fill out the PR template completely
- Follow conventional commit messages (`feat:`, `fix:`, `docs:`)

## Reference

Read `CONTRIBUTING.md` for full governance details.

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

### Current Providers

All providers have been updated with correct CSP:

- `healthcheckFormProvider.ts` - Form for creating healthchecks
- `subscriptionDashboardProvider.ts` - Plan and quota dashboards
- `cloudStatusDashboardProvider.ts` - Cloud status and detail views
- `f5xcDescribeProvider.ts` - Resource description viewer
- `f5xcDiagramProvider.ts` - HTTP Load Balancer diagrams
