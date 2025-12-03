# Codebase Structure

```
vscode-f5xc-tools/
├── src/
│   ├── extension.ts              # Extension entry point (activate/deactivate)
│   ├── api/
│   │   ├── auth/
│   │   │   ├── index.ts          # AuthProvider interface + factory
│   │   │   ├── tokenAuth.ts      # API Token authentication provider
│   │   │   └── p12Auth.ts        # P12 certificate authentication provider
│   │   ├── client.ts             # F5 XC REST API client (CRUD operations)
│   │   └── resourceTypes.ts      # Resource type registry (40+ types)
│   ├── tree/
│   │   ├── treeTypes.ts          # Tree node interfaces and data types
│   │   ├── f5xcExplorer.ts       # Resource explorer tree provider
│   │   └── profilesProvider.ts   # Profile management tree provider
│   ├── commands/
│   │   ├── index.ts              # Command exports
│   │   ├── crud.ts               # Resource CRUD commands
│   │   └── profile.ts            # Profile management commands
│   ├── config/
│   │   └── profiles.ts           # Profile + SecretStorage management
│   └── utils/
│       ├── errors.ts             # Error handling utilities
│       └── logger.ts             # Logging system
├── resources/
│   └── f5-icon.svg               # Activity bar icon
├── schemas/                       # JSON schemas for validation (future)
├── docs/specifications/api/       # F5 XC OpenAPI specifications (269 files)
├── package.json                   # Extension manifest
├── tsconfig.json                  # TypeScript configuration
├── webpack.config.js              # Build configuration
└── .eslintrc.json                # ESLint rules
```

## Key Files

### Entry Point
- `src/extension.ts`: Exports `activate()` and `deactivate()` functions

### API Layer
- `src/api/client.ts`: `F5XCClient` class with methods: `create()`, `get()`, `list()`, `replace()`, `delete()`, `listNamespaces()`
- `src/api/resourceTypes.ts`: `RESOURCE_TYPES` registry mapping resource keys to API paths and metadata

### Tree Views
- `src/tree/f5xcExplorer.ts`: `F5XCExplorerProvider` - hierarchical view (Namespace → Category → ResourceType → Resource)
- `src/tree/profilesProvider.ts`: `ProfilesProvider` - profile list view

### Commands
- `src/commands/crud.ts`: get, edit, create, apply, delete, diff, copyName, copyAsJson, openInBrowser
- `src/commands/profile.ts`: addProfile, editProfile, deleteProfile, setActiveProfile
