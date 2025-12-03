# Suggested Commands

## Development Commands

### Build & Compile
```bash
npm run compile          # Compile with webpack (development)
npm run watch            # Watch mode for development
npm run package          # Production build with source maps
npm run clean            # Remove dist and out directories
```

### Linting & Code Quality
```bash
npm run lint             # Run ESLint on src/**/*.ts
npm run lint:fix         # Auto-fix ESLint issues
```

### Testing
```bash
npm run test             # Run VSCode integration tests
npm run test:unit        # Run Jest unit tests
npm run pretest          # Compile + lint before tests
```

### Running the Extension
1. Open project in VSCode
2. Press `F5` to launch Extension Development Host
3. Use Command Palette: `F5 XC: Add Profile` to get started

## Git Commands
```bash
git status               # Check working directory status
git branch               # List branches
git checkout -b <name>   # Create feature branch
git diff                 # View changes
```

## Useful File Operations
```bash
ls -la src/              # List source files
find . -name "*.ts" -not -path "./node_modules/*"  # Find TypeScript files
```

## VSCode Extension Development
```bash
# Package extension for distribution
npx vsce package

# Publish to marketplace (requires publisher token)
npx vsce publish
```
