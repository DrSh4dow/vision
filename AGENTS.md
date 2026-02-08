# AGENTS.md — Vision

Collaborative embroidery design tool (Figma-like). Monorepo: **moonrepo** + **Bun** + **Rust/WASM** + **React 19**.
Assume senior-level knowledge. No explanations for standard practices. Terse, scannable, constraint-first.

## Architecture

```
React 19 UI (apps/web)  <->  WASM Bridge (packages/wasm-bridge)  <->  Rust Engine + Renderer (crates/)
```

## Commands

```sh
# Install
bun install
rustup target add wasm32-unknown-unknown

# Dev
bun run --cwd apps/web dev                   # Vite :5173

# Rust (run from crates/)
cargo fmt --all --check                       # MUST pass
cargo clippy --workspace                      # ZERO warnings — non-negotiable
cargo test --workspace                        # 131 tests (108 engine + 23 renderer)

# TypeScript
bunx biome check                              # Lint + format (MUST pass clean)
bunx biome check --write                      # Auto-fix
bunx tsc --noEmit --project apps/web          # Type check

# Build
wasm-pack build crates/engine --target web --out-dir ../../packages/wasm-bridge/pkg
bunx vite build  # (from apps/web)

# E2E
bunx playwright test e2e/app.spec.ts          # 18 tests (from apps/web)
```

## Code Quality — Zero Tolerance

**Every PR must pass ALL of these before merge:**

1. `cargo fmt --all --check` — clean
2. `cargo clippy --workspace` — zero warnings
3. `cargo test --workspace` — all green
4. `bunx biome check` — zero errors (lint + format)
5. `bunx tsc --noEmit --project apps/web` — zero errors
6. `bunx vite build` (apps/web) — succeeds
7. `bunx playwright test` — all green

## TypeScript Style

- **Biome** for linting + formatting (replaces oxlint). Config: `/biome.json`
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin. No `tailwind.config` file — config is CSS-native
- **shadcn/ui** (new-york style, dark theme). Config: `apps/web/components.json`
- Strict mode: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- Named exports only — `noDefaultExport` enforced (except vite/playwright configs)
- No `!` non-null assertions — use narrowing (`if (!x) return`) or optional chaining
- Import order (enforced by Biome): externals, then `@vision/*`, then `@/*` local
- `cn()` utility from `@/lib/utils` for merging Tailwind classes (clsx + tailwind-merge)
- UI components go in `src/components/ui/` (shadcn pattern)
- Hooks in `src/hooks/`, utilities in `src/lib/`
- Use `data-testid` for e2e selectors — never query by CSS classes in tests

## Rust Style

- Edition 2024, `cargo fmt` default settings, `cargo clippy` zero warnings
- Workspace deps in root `Cargo.toml`, reference with `.workspace = true`
- `#[wasm_bindgen]` on all JS-facing API; `Result<T, JsError>` for fallible ops
- `unwrap_throw()` / `expect_throw()` — never bare `unwrap()` across WASM boundary
- Tests in `#[cfg(test)] mod tests` at bottom of file; naming: `test_<what>_<scenario>`

## CSS / Styling

- **Tailwind v4** utility-first classes — no custom CSS classes for layout/components
- Theme tokens as CSS variables in `global.css` (oklch color space, shadcn convention)
- Dark-only app: `<html class="dark">`, variables set on `:root`
- Use shadcn components (`Button`, `Tooltip`, `Separator`, etc.) for UI elements
- Canvas rendering uses Canvas2D (not Tailwind) — keep hardcoded colors in `useCanvas.ts`

## Key Constraints

- **No backend** — all computation is client-side WASM
- **WASM bridge boundary** — web app imports from `@vision/wasm-bridge`, never WASM directly
- **Bun only** — never npm/yarn/pnpm
- **Biome only** — no ESLint, no Prettier, no oxlint
- **COOP/COEP headers** required for SharedArrayBuffer (set in vite.config.ts)

## Project Layout

```
apps/web/src/
  components/ui/    — shadcn components (Button, Tooltip, Separator)
  hooks/            — useEngine (WASM init), useCanvas (Canvas2D pan/zoom/grid)
  lib/utils.ts      — cn() utility
  styles/global.css — Tailwind v4 + shadcn CSS variables
  App.tsx, main.tsx — SVG import, DST/PES export, thread palette, stitch demos
apps/web/e2e/       — Playwright integration tests (18 tests)
packages/wasm-bridge/
  src/index.ts      — VisionEngine interface: stitches, SVG, threads, export
  pkg/              — wasm-pack generated (gitignored)
crates/engine/      — Scene graph, paths, shapes, stitch algorithms, format I/O
  src/svg.rs        — SVG path + document import (svgtypes + roxmltree)
  src/stitch/       — Running stitch, satin stitch (underlay + pull comp)
  src/thread.rs     — Thread palettes (Madeira, Isacord, Sulky)
  src/format/       — DST (Tajima) + PES/PEC (Brother) export
crates/renderer/    — Camera, mesh, vertex (native), GPU renderer (wasm32 only)
biome.json          — Root Biome config (lint + format for all TS)
```

## Plan Mode

- Plans must be extremely concise. Sacrifice grammar for brevity.
- End each plan with unresolved questions, if any.
