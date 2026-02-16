# Plugin System

This project is **plugin-first**: formats, stitch generators, and transforms are implemented as plugins from day one. The UI remains **sleek and consistent** because plugins do **not** render arbitrary React by default; instead they contribute **capabilities** (commands, schemas, handlers) and the host renders UI from those contributions.

## Goals

- **Simple UX**: users discover plugins through a registry and run them from consistent UI entry points.
- **Safe by default**: third-party plugins run in a sandbox (Worker) with explicit capabilities.
- **Stable integration**: plugins target `@vision/plugin-sdk` (single compatibility surface).
- **Future-proof**: local-first document operations now, sync/collab later.

---

## Key Concepts

### Host vs Plugin

- **Host**: the app (`apps/vision-web`) + runtime (`packages/runtime`) + document model (`packages/core`).
- **Plugin**: a package that exports a manifest + entry module implementing one or more capabilities.

### Capabilities

Capabilities are the only way plugins can affect the system.
Initial capabilities:

- `format.import` / `format.export` (PES first)
- `stitch.generate` (satin, tatami, running)
- `transform.optimize` (sequence optimization, trims/jumps suggestions)
- (later) `tool.interactive` (pointer-driven tools, host-controlled)

### Contributions (UI-facing “what shows up”)

Plugins register **contributions** which the host displays in specific UI slots:

- Command Palette / menu
- Context menu (Objects / Sequence)
- Inspector section(s)
- Import/Export panel
- Sequence actions

The host decides layout and components; plugins provide metadata + schemas.

### Operations (how plugins modify documents)

Plugins **never mutate the document directly**. They return:

- `ops`: a list of document operations (add blocks, set params, reorder, etc.)
- or `artifact`: exported bytes + metadata for downloads
- optionally `telemetry`: warnings/stats to show in UI

The host applies ops through `@vision/core` to preserve undo/redo and future sync.

---

## High-Level Architecture

```

UI (React)
|
v
Runtime Registry (packages/runtime)
|
|              -> Host Rendered Forms (from schemas)
v
Plugin Execution

* Worker sandbox (default)  <->  message protocol
* In-process (verified only) (optional, later)
  |
  v
  Returns: ops / artifact / progress
  |
  v
  Core applies ops -> updates doc -> UI rerenders

```

---

## Plugin Manifest

Each plugin ships a `plugin.json` (or equivalent exported object) that declares identity, compatibility, and requested capabilities.

Example:

```json
{
  "name": "format-pes",
  "version": "0.1.0",
  "displayName": "PES Format",
  "description": "Import/export PES embroidery files.",
  "engine": { "vision": "^0.1.0" },
  "capabilities": ["format.import", "format.export"],
  "entry": "dist/index.js",
  "sandbox": "worker",
  "permissions": {
    "network": false,
    "filesystem": false
  }
}
```

### Compatibility rules

- `engine.vision` must satisfy the host’s current version range.
- `@vision/plugin-sdk` version is pinned/compatible with `engine.vision`.
- Host may refuse to load incompatible plugins and surface a clear message.

---

## Plugin Entry Module

The entry exports a `register()` function that returns contributions + handlers.

Conceptual shape:

```ts
export function register(api: PluginAPI): PluginRegistration {
  return {
    contributions: [
      /* commands, inspector sections, format actions */
    ],
    handlers: {
      /* capability handlers */
    },
  };
}
```

Where:

- `PluginAPI` is provided by the host (logger, version, helpers, schema utilities).
- `PluginRegistration` contains:
  - `contributions`: what to show in UI and where
  - `handlers`: how to execute capabilities

---

## UI Integration (How plugins “hook into” the UI)

### Host-rendered UI (default)

Plugins provide:

- **command metadata**: id, label, icon (optional), where it appears
- **when clause**: availability based on context (selection, doc state)
- **parameter schema**: zod/json schema used to render a form in the Inspector/Modal
- **handler**: runs the action and returns ops/artifacts

The host renders:

- consistent shadcn-based forms
- consistent buttons, validation, error states
- consistent progress UI

#### Example: command contribution

- Appears in context menu when one or more objects selected
- Shows form fields from schema
- Applies returned ops as a single undoable transaction

### Interactive tools (optional, later)

If plugins add drawing tools, the host keeps control:

- Host owns pointer events and canvas rendering
- Plugin provides pure functions (data in/out), e.g.:
  - `hitTest()`
  - `onPointerEvent(event, state) -> { ops | previewGeometry }`

This avoids giving plugins direct access to React/canvas internals.

### Custom React panels (not default)

If ever supported:

- **Verified-only** to run in-process and share the design system
- Community plugins remain schema-driven
- Untrusted custom UI would require iframe sandbox + messaging (high complexity; avoid initially)

---

## Execution Model

### Sandbox by default (Worker)

- Plugin code runs in a Web Worker
- Communication via structured messages
- No DOM access
- Optional timeouts and cancellation support

### In-process execution (optional)

Only for:

- built-in plugins
- verified plugins where performance demands it

Host should preserve the same interface so switching execution mode does not change plugin code.

---

## Context Passed to Plugins

Plugins receive a minimal, serializable context:

- `documentSnapshot` (or a compact query result)
- `selection`: selected object IDs / stitch block IDs
- `units` and environment settings
- optional `engineCapabilities` (what features are supported)

Plugins should not rely on global state.

---

## Return Types

Plugins can return:

### 1) Document Update

```ts
{
  ops: Operation[],
  warnings?: UIMessage[],
  stats?: Record<string, number>
}
```

### 2) Export Artifact

```ts
{
  artifact: {
    filename: string,
    mime: string,
    bytes: Uint8Array
  },
  warnings?: UIMessage[]
}
```

### 3) Progress Events

Long-running tasks should stream:

- progress %
- stage messages
- cancellation checks

---

## Security & Permissions

### Permissions

Declared in manifest; enforced by runtime:

- `network`: allow fetch
- `filesystem`: (generally false in browser; for future desktop wrappers)
- `compute`: implied (always), but bounded by timeouts/memory guidelines

### Trust levels

- **Built-in**: maintained in repo
- **Verified**: vetted and signed (future)
- **Community**: registry-listed, sandboxed
- **Local**: sideloaded, sandboxed, warning shown

### Default policy

- Third-party plugins run in Worker sandbox
- Host UI renders all forms
- No arbitrary code injection into UI

---

## Packaging & Distribution

### Default user flows

1. **Official Registry** (recommended default)
   - in-app browse/install/update

2. **Install from file** (advanced)
   - import a plugin bundle
   - show permission prompts

3. (later, optional) **Install from URL** behind Developer/Unsafe mode

### Plugin bundle contents

- `plugin.json`
- compiled JS module(s)
- optional `.wasm` and assets
- integrity hash (recommended)

---

## Testing & Development

### Local development

- `plugins/*` are first-class workspaces in the monorepo
- Host loads local plugins automatically in dev mode
- Hot reload: contributions refresh; handlers restart worker

### Suggested tests

- unit tests for handler logic
- golden tests for deterministic stitch outputs
- compatibility tests against multiple host versions (if maintaining stable APIs)

---

## Roadmap (Suggested Capability Expansion)

- `format.import/export` (PES) ✅
- `stitch.generate` ✅
- `transform.optimize` (sequence optimizations + commands)
- `analyze.report` (quality metrics, warnings)
- `tool.interactive` (host-controlled pointer tools)
- verified plugins + signing
- registry metadata + screenshots + ratings

---

## Design Rules (Non-Negotiables)

- Plugins must target `@vision/plugin-sdk` only (public surface).
- Plugins do not mutate the document directly; they return ops/artifacts.
- Host owns UI rendering and selection state.
- Sandbox by default; explicit capabilities and permissions.
