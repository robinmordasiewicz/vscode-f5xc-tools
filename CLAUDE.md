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

## CI Monitoring and Problem Reporting

When monitoring CI workflows, **never ignore
failures** — even pre-existing or unrelated ones.
You are authorized to create GitHub issues without
asking for confirmation. This is a standing
instruction, not a suggestion.

For every problem observed:

1. **Immediately create a GitHub issue** — do not
   ask whether to create it, just create it
   - Use a clear, descriptive title
   - Include the workflow run URL or relevant logs
   - Note it was discovered during CI monitoring
   - Apply the `bug` label
2. **Continue with your primary task** — issue
   creation must not block your current work
3. **Report to the user** what issues you created

Do not ask "Want me to create an issue?" — the
answer is always yes. See a problem, file an issue,
move on.

## Reference

Read `CONTRIBUTING.md` for full governance details.
