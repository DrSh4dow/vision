- Guidance for autonomous coding agents working in `vision embroidery studio`.
- The default development branch is `staging`
- Always branch off `staging` for new work, and create PRs to merge back into `staging` for review.
- Use `gh` CLI for all GitHub interactions (PRs, issues, etc.) to ensure consistency and traceability.
- Always structure your work through commits with clear messages, and use PRs for review when rebasing onto `staging`.
- For issue auto-closing in a rebase workflow, include closing keywords (e.g., `Closes #123`) in commit bodies (not only PR descriptions) so issues close when commits land on `main`.
- Prefer automation: execute requested actions without confirmation unless blocked by missing info or safety/irreversibility.
- Always rebase, never merge, to keep history clean and linear.

## Repo Snapshot

- Monorepo using Bun workspaces and Turborepo.
- App: `apps/vision-web` (Vite + React + TypeScript).
- Packages: `packages/{core,engine,plugin-sdk,runtime,storage,ui,typescript-config}`.
- Plugins: `plugins/{format-pes,stitch-running,stitch-satin,stitch-tatami}`.
- Rust crates: `crates/{engine-core,engine-wasm}`.
- Tooling baseline: Biome for lint/format, Bun (`bun@1.3.9`) for package management.

## Agent Operating Rules

- Execute directly unless blocked by missing secrets, safety risk, or destructive ambiguity.
- Use parallel tools when tasks are independent.
- Do not run destructive git commands unless explicitly requested.
- Never revert unrelated user-authored changes in a dirty worktree.
- Keep changes focused and reviewable.
- When you need to search docs, use `context7` tools.
- If you need to use webfetch, try to look for llms.txt in the page's root first for structured data.
- If you are unsure how to do something, use `gh_grep` to search code examples from GitHub.
- Always check with the `playwright` tool after making changes to ensure the app still works and looks as expected.
- When there are more than 1 package using the same dependency use a catalog dependency in the root `package.json` to ensure all workspaces use the same version.

## Workspace Commands

- `bun install`
- `bun run dev`
- `bun run build`
- `bun run lint`
- `bun run check-types`
- `bun run format`

## Quick Checklist

- Run filtered checks for touched workspaces when possible.
- Keep boundaries clean (`packages/core` stays DOM-free; plugins depend on `packages/plugin-sdk` contracts).
- Prefer Biome-driven formatting/linting behavior.

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests
- If adding tests, add workspace `test` scripts and wire a Turbo `test` task.

## Plan Mode

- Make the plan extremely concise. Sacrifice grammar for the sake of concision.
- At the end of each plan, give me a list of unresolved questions to answer, if any.
