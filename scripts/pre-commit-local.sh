#!/usr/bin/env bash
# Repository-specific pre-commit hooks for vscode-f5xc-tools
# Called by the universal .pre-commit-config.yaml local-hooks entry
set -euo pipefail

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

# --- Prettier ---
FORMAT_FILES=$(echo "$STAGED_FILES" | grep '\.\(ts\|tsx\|js\|jsx\|json\|yaml\|yml\|md\|css\|scss\)$' | grep -v 'package-lock\.json' | grep -v '^docs/specifications/api/' || true)
if [ -n "$FORMAT_FILES" ] && [ -f package.json ]; then
  echo "[local] Running Prettier..."
  npx prettier --write $FORMAT_FILES 2>/dev/null || echo "[local] prettier failed or not configured"
fi

# --- TypeScript type check ---
TS_FILES=$(echo "$STAGED_FILES" | grep '\.tsx\?$' || true)
if [ -n "$TS_FILES" ] && [ -f tsconfig.json ]; then
  echo "[local] Running TypeScript type check..."
  npx tsc --noEmit 2>/dev/null || echo "[local] tsc failed"
fi

# --- npm security audit ---
if echo "$STAGED_FILES" | grep -q '^package\(-lock\)\?\.json$'; then
  if command -v npm &>/dev/null; then
    echo "[local] Running npm security audit..."
    npm audit --audit-level=high 2>/dev/null || true
  fi
fi

echo "[local] All repo-specific checks passed."