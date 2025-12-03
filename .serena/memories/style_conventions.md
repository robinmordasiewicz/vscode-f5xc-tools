# Code Style and Conventions

## TypeScript Conventions

### Naming
- **Files**: camelCase for modules (`resourceTypes.ts`), PascalCase for classes if single-class file
- **Classes**: PascalCase (`F5XCClient`, `ProfileManager`, `TokenAuthProvider`)
- **Interfaces**: PascalCase with descriptive names (`AuthProvider`, `F5XCProfile`, `ResourceMetadata`)
- **Functions**: camelCase (`getClient`, `withErrorHandling`)
- **Constants**: UPPER_SNAKE_CASE for registries (`RESOURCE_TYPES`, `ResourceCategory`)
- **Variables**: camelCase, prefix unused with `_` (`_unused`)

### Type Annotations
- Explicit return types on exported functions
- Interface over type for object shapes
- Use `unknown` over `any` where possible (eslint warns on `any`)
- Generic types for API client methods: `async get<T extends Resource>(...)`

### Imports
- Use named imports: `import { ProfileManager } from './config/profiles';`
- Group imports: vscode → external packages → internal modules
- No default exports (use named exports)

## ESLint Rules (Key)
- **Semi-colons**: Required (warning)
- **Curly braces**: Required for blocks
- **Equality**: Use `===` / `!==`
- **No floating promises**: Error - all promises must be awaited or handled
- **Unused vars**: Warning, underscore prefix allowed for intentionally unused

## File Organization
- One primary export per file where practical
- Group related functionality in directories (`api/auth/`, `commands/`, `tree/`)
- Shared types in dedicated files (`treeTypes.ts`, `api/client.ts` exports types)

## Documentation
- JSDoc comments for exported functions and classes
- Inline comments for complex logic
- No excessive documentation - code should be self-explanatory

## Error Handling Pattern
```typescript
import { withErrorHandling, showWarning, showError } from '../utils/errors';

await withErrorHandling(async () => {
    // operation that may fail
}, 'Operation name');
```

## VSCode Extension Patterns
- Use `context.subscriptions.push()` for disposables
- Register commands with `vscode.commands.registerCommand()`
- Use `vscode.SecretStorage` for credentials (never store in settings)
- TreeDataProvider pattern for tree views
