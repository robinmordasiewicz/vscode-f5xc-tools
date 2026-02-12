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

## Documentation Pipeline

All repos publish docs to GitHub Pages using a
shared pipeline:

| Repo | Role |
| ---- | ---- |
| `f5xc-docs-theme` | Astro/Starlight config, CSS, logos, layout |
| `f5xc-docs-builder` | Dockerfile, npm deps, build scripts |
| `f5xc-template` | CI workflow, governance files |

Content repos only need a `docs/` directory — the
build container and workflow handle everything else.
CI builds trigger when files in `docs/` change on
`main`.

### Where to make changes

- **Site appearance, navigation, or Astro config** —
  change `f5xc-docs-theme` (owns
  `astro.config.mjs`, `content.config.ts`,
  CSS, and logos)
- **Build process, Docker image, or npm deps** —
  change `f5xc-docs-builder` (owns the
  Dockerfile and dependency set)
- **CI workflow or governance files** —
  change `f5xc-template`
- **Page content and images** —
  change the `docs/` directory in the content
  repo itself
- **Never** add `astro.config.mjs`,
  `package.json`, or build config to a content
  repo — the pipeline provides these

## Content Authoring

### Structure

- Place `.md` or `.mdx` files in the `docs/`
  directory
- `docs/index.mdx` is required — include YAML
  frontmatter with at least a `title:` field
- Static assets (images, diagrams) go in
  subdirectories like `docs/images/` — folders
  with no `.md`/`.mdx` files are auto-mounted
  as public assets
- Reference assets with root-relative paths:
  `![alt](/images/diagram.png)`

### MDX Rules

- Bare `<` is treated as a JSX tag — use `&lt;`
  or wrap in backtick inline code
- `{` and `}` are JSX expressions — use `\{`
  and `\}` or wrap in backtick inline code
- Never use curly braces in `.mdx` filenames

### Local Preview

Run the live dev server (restart to pick up
changes):

```bash
docker run --rm -it \
  -v "$(pwd)/docs:/content/docs" \
  -p 4321:4321 \
  --entrypoint sh \
  ghcr.io/robinmordasiewicz/f5xc-docs-builder:latest \
  -c '
    npm install --legacy-peer-deps && \
    npm update --legacy-peer-deps && \
    cp /app/node_modules/f5xc-docs-theme/astro.config.mjs \
       /app/astro.config.mjs && \
    cp /app/node_modules/f5xc-docs-theme/src/content.config.ts \
       /app/src/content.config.ts && \
    cp -r /content/docs/* /app/src/content/docs/ && \
    npx astro dev --host
  '
```

Open `http://localhost:4321`. File changes on the
host require restarting the container.

For a full production build:

```bash
docker run --rm \
  -v "$(pwd)/docs:/content/docs:ro" \
  -v "$(pwd)/output:/output" \
  -e GITHUB_REPOSITORY="<owner>/<repo>" \
  ghcr.io/robinmordasiewicz/f5xc-docs-builder:latest
```

Serve with `npx serve output/ -l 8080` and open
`http://localhost:8080/<repo>/`.

Full content authoring guide:
<https://robinmordasiewicz.github.io/f5xc-docs-builder/06-content-authors/>

## Reference

Read `CONTRIBUTING.md` for full governance details.
