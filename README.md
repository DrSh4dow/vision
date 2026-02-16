# Vision - Embroidery Studio (Web + WASM)

Browser-first embroidery design and sequencing tool, built as a monorepo with a Rust/WASM engine and a plugin-first architecture.

## Goals

- **Simple by default**: design objects, stitches, and sequencing without overwhelming UI.
- **Powerful when needed**: advanced machine commands, optimization, and deep stitch controls via progressive disclosure.
- **Plugin-first**: formats, stitch generators, and transforms are extensible from the start.
- **Local-first** now, **cloud sync/collab** later (without rewriting the core).

## Tech stack

- **Bun**: package manager/runtime
- **Vite + React + TypeScript**: web app
- **Turborepo**: task orchestration + caching across packages
- **Rust → WASM**: performance-critical engine
- **shadcn/ui + Tailwind**: UI system
- **zod**: schema validation for document model + plugin manifests
- **Biome**: formatting + linting
- **React Compiler**: optional, enabled when stable for the codebase patterns

## Repository layout

```text

apps/
vision-web/            # Vite React app

packages/
ui/                    # shadcn wrappers + design tokens
core/                  # document model + ops + zod schemas (no DOM)
runtime/               # plugin host runtime (workers, perms, registry)
plugin-sdk/            # public plugin API: types + helpers
engine/                # typed TS façade over WASM engine
storage/               # IndexedDB/OPFS abstractions; sync hooks later

crates/
engine-core/           # Rust algorithms (geometry, fills, optimization)
engine-wasm/           # wasm-bindgen bindings + build outputs

plugins/
format-pes/            # PES import/export plugin (starter format)
stitch-satin/          # stitch generator plugin
stitch-tatami/
stitch-running/

```

## Prerequisites

- **Bun** installed
- **Rust toolchain** (stable) + wasm target:
  - `rustup target add wasm32-unknown-unknown`
- (Recommended) `wasm-pack` if you choose that build path

## Quick start

```bash
bun install
bun run dev
```

If the WASM engine needs a separate build step:

```bash
bun run wasm:build
bun run dev
```

## Common commands

```bash
bun run dev          # dev server for the web app
bun run build        # build everything (via turbo)
bun run test         # run tests
bun run lint         # biome lint
bun run format       # biome format
bun run typecheck    # tsc across packages
bun run wasm:build   # build Rust/WASM (if configured)
```

> Recommended: run tasks via Turbo for correct ordering and caching:

```bash
bunx turbo run build
bunx turbo run dev
```

## Plugin system (user experience)

- Default: **Official Registry** (simple and safe)
- Advanced: **Install from file** (sideload)
- Optional (later): **Install from URL** behind a Developer/Unsafe mode toggle

Plugins run in a **Web Worker** sandbox where possible, and request explicit capabilities (e.g., format import/export, stitch generation, transforms).

### Plugin manifest (example)

```json
{
  "name": "format-pes",
  "version": "0.1.0",
  "displayName": "PES Format",
  "capabilities": ["format.import", "format.export"],
  "entry": "dist/index.js"
}
```

## Architectural principles

- **Single source of truth**: the exported result is a single Sequence (execution order).
- **Progressive disclosure**: machine commands (cuts/jumps/ties) are hidden by default and shown on demand.
- **Local-first data model**: document changes are represented as operations for undo/redo and future sync/collab.

## Contributing

1. Create a branch from `staging`
2. Ensure formatting/lint passes:

   ```bash
   bun run format
   bun run lint
   bun run test
   ```

3. Keep package boundaries clean:
   - `packages/core` is DOM-free
   - Plugins only import from `packages/plugin-sdk`

## Security

- Treat third-party plugins as untrusted code.
- Capabilities and sandbox boundaries are enforced by `packages/runtime`.

## License

MIT
