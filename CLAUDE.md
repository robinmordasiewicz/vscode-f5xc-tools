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
