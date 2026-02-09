# AGENTS.md — Vision

Open-source embroidery-first digitizing platform. Not a vector editor. Stitch objects are first-class citizens.
Monorepo: moonrepo + Bun + Rust/WASM + React 19. Assume senior-level knowledge. Terse, constraint-first.

## Architecture

React 19 UI (apps/web) <-> WASM Bridge (packages/wasm-bridge, Zod v4) <-> Rust Engine + Renderer (crates/)

## Commands (common)

- Install: `bun install`; `rustup target add wasm32-unknown-unknown`
- Dev: `bun run --cwd apps/web dev` (Vite :5173)
- Build WASM: `wasm-pack build crates/engine --target web --out-dir ../../packages/wasm-bridge/pkg`

## Required checks (must pass before PR)

- `cargo fmt --all --check`
- `cargo clippy --workspace` (zero warnings)
- `cargo test --workspace`
- `bunx biome check`
- `bunx tsc --noEmit --project apps/web`
- `bunx vite build` (from apps/web)
- `bunx playwright test e2e/app.spec.ts` (from apps/web)

## TypeScript

- Biome only (`/biome.json`); no ESLint/Prettier
- Tailwind v4 via `@tailwindcss/vite`; no `tailwind.config`
- shadcn/ui (new-york, dark), config `apps/web/components.json`
- Strict TS; named exports only (except vite/playwright configs); no `!` non-null
- Import order: externals, `@vision/*`, `@/*`
- `cn()` from `@/lib/utils`; UI in `src/components/ui/`; hooks in `src/hooks/`
- Use `data-testid` for e2e selectors

## Rust

- Edition 2024; workspace deps in root `Cargo.toml` with `.workspace = true`
- JS API: `#[wasm_bindgen]`, `Result<T, JsError>`, `unwrap_throw()`/`expect_throw()`
- Tests in `#[cfg(test)] mod tests` at file end; naming `test_<what>_<scenario>`

## UI / Layout

- Menu bar (File|Edit|View|Design|Routing|Help), canvas center, sequencer left, properties right, status bar bottom
- Floating toolbar: Select(V), Pen(P), Text(T), Rect(R), Ellipse(E). Power lives in context menus
- Design Inspector (View menu): quality report + routing settings. Diagnostics: bottom slide-up panel
- Tailwind v4 utilities only; no custom layout classes
- Theme tokens in `styles/global.css` (oklch, shadcn); themeable via CSS custom properties
- Prefer base-ui primitives over Radix; shadcn components for UI; Canvas2D colors in `useCanvas.ts`

## Constraints

- No backend; compute is client-side WASM
- Web imports only from `@vision/wasm-bridge`
- Bun only; Biome only
- COOP/COEP headers required (vite.config.ts)
- Clean-room Rust implementations only; Ink/Stitch as behavior reference, never source copy

## Testing

- Avoid mocks as much as possible
- Test actual implementation; do not duplicate logic in tests

## Documentation

- `ROADMAP.md` must include an end-of-file `## Changelog` section
- Each changelog update must be maximum 2 lines

## Plan Mode

- Plans must be extremely concise; sacrifice grammar for brevity
- End each plan with unresolved questions, if any
