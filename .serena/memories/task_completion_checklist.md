# Task Completion Checklist

When completing a development task, ensure the following steps:

## Before Committing

### 1. Build Verification
```bash
npm run compile
```
- Ensure no TypeScript errors
- Check webpack builds successfully

### 2. Linting
```bash
npm run lint
```
- Fix any ESLint errors/warnings
- Use `npm run lint:fix` for auto-fixable issues

### 3. Type Checking
- Ensure no `any` types without explicit eslint-disable comment
- Verify all promises are properly awaited
- Check for unused imports/variables

### 4. Testing (when applicable)
```bash
npm run test:unit   # For unit tests
npm run test        # For integration tests
```

### 5. Manual Verification
1. Press `F5` to launch Extension Development Host
2. Test the modified functionality
3. Verify tree views render correctly
4. Check commands work from Command Palette
5. Verify no console errors in Extension Host

## Code Quality Checks

- [ ] No hardcoded secrets or credentials
- [ ] Error messages are user-friendly
- [ ] Logging uses the logger utility, not console.log
- [ ] New commands are registered in `package.json`
- [ ] Context menus updated if new tree item types added
- [ ] Icons use VSCode codicons (`$(icon-name)`)

## Documentation

- [ ] Update JSDoc comments for new public APIs
- [ ] Update README if user-facing features changed
- [ ] Add inline comments for complex logic

## Git Commit

```bash
git status                    # Verify changes
git diff                      # Review changes
git add <files>               # Stage changes
git commit -m "descriptive message"
```

Commit message format:
- `feat: Add new feature`
- `fix: Fix bug description`
- `refactor: Improve code structure`
- `docs: Update documentation`
- `chore: Build/tooling changes`
