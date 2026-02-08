# Claude Code Project Instructions

## Repository Workflow

This repo enforces a strict governance workflow. Follow it exactly:

1. **Create a GitHub issue** before making any changes
2. **Create a feature branch** from `main` — never commit to `main` directly
3. **Open a PR** that links to the issue using `Closes #N`
4. **CI must pass** — the "Check linked issues" check blocks PRs without a linked issue
5. **Merge** — squash merge preferred, branch auto-deletes after merge

## Use the `/ship` Skill

When available, use `/ship` to handle the full workflow (issue creation, branch, commit, PR) in one step.

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
