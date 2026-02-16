## Roadmap for **Vision** (browser-first, plugin-first, 3 modes, full scope)

Each block below is **actionable** and has **acceptance criteria** that are verifiable. Blocks are ordered to minimize rework and keep the app usable early.

---

# 0) Repo + Delivery Foundations

### 0.1 Monorepo scaffolding

**Deliverables**

- Bun workspaces with `apps/vision-web`, `packages/*`, `crates/*`, `plugins/*`
- `@vision/*` package naming + TS project refs
- Biome + typecheck + test runners wired
- Turbo pipeline (build/lint/test/typecheck/wasm)

**Acceptance criteria**

- `bun run build|lint|typecheck|test` succeed on a clean checkout
- CI runs the same tasks deterministically

### 0.2 Dev ergonomics baseline

**Deliverables**

- Command palette scaffold (`⌘K`) and command registry (host-side)
- Logging + debug panel toggle
- Feature flags system (compile-time + runtime)

**Acceptance criteria**

- New command can be added in one place and appears in UI
- Feature flags can disable whole subsystems (preview/3D/plugins)

---

# 1) Core Architecture (the “truth”)

### 1.1 `@vision/core` document model + operations

**Deliverables**

- `VisionDocument` schema (zod) + migrations
- Stable IDs for objects/stitch blocks/assets
- Operation (op) union: add/remove/update/reorder for objects, stitch blocks, commands, assets
- Undo/redo via op stack + transaction boundaries
- Deterministic serialization rules (canonical ordering)

**Acceptance criteria**

- Any change in the app is representable as `Operation[]`
- Undo/redo works for object transforms and sequence reorder
- Loading invalid docs yields structured validation errors (no silent corruption)

### 1.2 Selection + context model

**Deliverables**

- Selection types: object IDs, stitch-block IDs, command IDs
- Cross-highlighting contract: selection in one mode maps to the others
- Context object passed to plugins (serializable)

**Acceptance criteria**

- Selecting an object highlights its stitch block(s) in sequencer and preview
- Selection state is stable across mode switching

---

# 2) Storage + Project Files (`*.vision`) — local-first, modern

### 2.1 Storage adapter interface (`@vision/storage`)

**Deliverables**

- Storage API: `createProject`, `openProject`, `saveSnapshot`, `appendOps`, `compact`, `exportVisionFile`, `importVisionFile`
- Namespaced plugin storage: `getPluginKV(pluginId)` / `getPluginFiles(pluginId)`

**Acceptance criteria**

- App can autosave + recover after reload with no data loss
- Plugin state is isolated per plugin ID

### 2.2 OPFS-backed project store (modern browsers only)

**Deliverables**

- OPFS implementation with Worker IO (sync access handle where appropriate)
- Snapshot + append-only oplog format
- Compaction strategy (e.g., on size threshold or on-demand)

**Acceptance criteria**

- Large projects remain responsive during autosave (no UI jank)
- Export/import of a single `*.vision` file round-trips losslessly

---

# 3) Plugin System (core of the product)

### 3.1 Plugin runtime MVP (`@vision/runtime`)

**Deliverables**

- Plugin manifest schema + validation
- Built-in plugin loader (from `plugins/*` bundles)
- Capability routing: `format.*`, `stitch.generate`, `transform.*`, `preview.*`, `ui.*`
- Worker sandbox execution (default) + structured message protocol
- Progress + cancellation protocol

**Acceptance criteria**

- A plugin can register a command and be invoked from UI
- Worker plugin can stream progress events and be cancelled
- Invalid plugin manifests are rejected with actionable errors

### 3.2 Host-rendered plugin UI (schema-driven)

**Deliverables**

- Contributions: command palette entries, inspector sections, context menu items, preview overlays
- Parameter forms rendered from schemas (zod/json-schema -> shadcn form)
- “Plugin Dock” area with plugin-provided panels (host rendered)

**Acceptance criteria**

- Plugin can add an inspector section with validated inputs
- Plugin can add a command that appears only when context matches (selection/doc state)

---

# 4) Rendering Engine Decision + Baseline (future-proof)

### 4.1 Rendering tech spike (short, decisive)

**Deliverables**

- Choose: **WebGPU-first** renderer with fallback (recommended), and define the abstraction
- Proof-of-life: render 10k vector segments + pan/zoom + selection highlight

**Acceptance criteria**

- Stable 60fps pan/zoom at “reasonably large” scenes
- Rendering abstraction supports: 2D editor + 2D preview overlays

> Recommendation to implement: **WebGPU-first** (with fallback) for the 2D editor + **Three.js/Babylon** for 3D preview, behind a shared render facade. (No business logic in the renderer.)

### 4.2 `@vision/rendering` package

**Deliverables**

- Camera, transforms, grid, rulers, snapping guides
- Render layers: objects, selection, helpers, stitch overlays, jump overlays
- Picking/hit-testing (GPU or CPU spatial index)

**Acceptance criteria**

- Hit-testing works for paths/shapes/groups
- Selection highlight matches design behavior

---

# 5) Object Mode (Vector + Asset Editor)

### 5.1 Object primitives + editing

**Deliverables**

- Primitives: paths (bezier), shapes (rect/circle/polygon), text, groups
- Edit tools: select, pen, shape tools, transform, align, distribute
- Constraints: snapping, guides, bounding boxes, multi-select

**Acceptance criteria**

- Create/edit/move/rotate/scale objects with undo/redo
- Grouping works and preserves transforms correctly
- Object list matches canvas selection (bidirectional)

### 5.2 Assets (images) + SVG I/O as first-class

**Deliverables**

- Image import as asset + placement object
- SVG import -> vector objects (paths/text where possible)
- SVG export of vector layer (configurable)

**Acceptance criteria**

- Imported SVG round-trips for core shapes/paths
- Images can be used as reference underlay and preserved in `*.vision`

### 5.3 Object → stitch mapping surface

**Deliverables**

- Per-object “stitch intent”: outline/fill/satin/running etc (as plugin-provided inspector)
- Object metadata required by stitch generators (angle, density, underlay hints)

**Acceptance criteria**

- Object mode edits update stitch intent inputs without generating stitches yet
- All stitch-related inputs are validated and stored in the doc model

---

# 6) Stitch Pipeline (plugin-first, expandable to point editing)

### 6.1 Stitch object model (`@vision/core`)

**Deliverables**

- Stitch blocks (logical embroidery blocks) and machine commands (trim/jump/tie)
- Representation is expandable to point-level later:
  - store generated stitch points as an optional payload + provenance metadata
  - support “manual override” flag at block or point layer (future)

**Acceptance criteria**

- Sequencer can display blocks without needing point editing UI
- Model can store stitches without forcing the UI to expose point edits

### 6.2 Built-in stitch generator plugins (v1 quality)

**Deliverables**

- `stitch-running` plugin
- `stitch-satin` plugin (rails + column logic, pull comp, underlay options)
- `stitch-tatami` plugin (fill with angle, spacing/density, underlay options)
- Shared utilities package for geometry + constraints

**Acceptance criteria**

- Same input produces deterministic output (golden tests)
- Parameters in UI match generator behavior (no “ignored” knobs)

### 6.3 Machine command generation + editability

**Deliverables**

- `transform-commands` plugin:
  - auto tie-in/out, trims, jump insertion policy
  - “show commands” toggle in sequencer
  - per-command override + revert-to-auto

**Acceptance criteria**

- Default: commands auto-generated and hidden
- When shown: commands are editable and survive regeneration unless reverted

---

# 7) Sequencer Mode (stitch object editor)

### 7.1 Sequence view + reorder + grouping

**Deliverables**

- List of stitch blocks in execution order
- Grouping by color/needle change; folder/group entries
- Drag reorder with constraints + undo/redo
- Per-block stats (stitches, trims, jumps, thread length)

**Acceptance criteria**

- Reordering updates preview path and exported order
- Group expand/collapse works on large lists without lag

### 7.2 Properties inspector for stitch blocks

**Deliverables**

- Stitch type selector and parameters panel (plugin-rendered)
- Advanced section collapsible
- “Regenerate block” vs “Detach/manual override” behaviors

**Acceptance criteria**

- Editing params triggers regenerate for that block only
- Detach prevents overwrite unless user explicitly regenerates

---

# 8) Preview Mode (2D, 2.5D, 3D cloth sim)

### 8.1 2D preview (fast, always available)

**Deliverables**

- Render stitch paths + jumps + trims overlays
- Playback scrub + speed control + stage markers
- “Show jumps” toggle

**Acceptance criteria**

- Preview matches stitch order from sequencer
- Playback can be paused/scrubbed reliably

### 8.2 2.5D preview (thread thickness + shading)

**Deliverables**

- Thread rendering approximation (thickness, bevel, subtle lighting)
- Material presets (basic, high quality)

**Acceptance criteria**

- Visual improvement is clear, performance remains acceptable on mid-range GPUs

### 8.3 3D cloth simulation (resource-heavy, gated)

**Deliverables**

- Cloth plane + hoop constraints + needle penetration approximation
- Stitch-by-stitch simulation mode (optional), plus “final result” mode
- Quality/performance presets and auto-downshift

**Acceptance criteria**

- 3D mode runs without affecting other modes (isolated pipeline)
- The app remains usable if 3D is disabled (feature flag + fallback)

---

# 9) Auto-sequencer / Auto-digitizer (plugin)

### 9.1 Vector auto-sequencer plugin

**Deliverables**

- Takes SVG/vector objects and generates best-effort stitch blocks + sequencing
- Heuristics: grouping by proximity, minimizing jumps, ordering by color, respecting hole/outline priorities
- Wizard UI (host-rendered): “aggressiveness”, “detail level”, “min stitch length”, etc.

**Acceptance criteria**

- User can run wizard and get a coherent sequencer output for common logos
- Produces warnings rather than failing on complex inputs

### 9.2 Image-assisted digitizing plugin (from raster reference)

**Deliverables**

- Image import -> vectorization step (basic) OR guided tracing workflow
- Optional: edge detection + region proposal (best-effort)
- Output: vector objects + suggested stitch intents

**Acceptance criteria**

- “Best-effort” works on high-contrast logos; guided tracing always works

---

# 10) File Formats + Thread System (plugins)

### 10.1 PES import/export plugin (v1)

**Deliverables**

- PES export from internal sequence (stitches + commands + colors)
- PES import into internal doc (best-effort mapping -> objects/stitch blocks)
- Fixtures and round-trip tests

**Acceptance criteria**

- Exported PES runs on target machines tested (Brother baseline)
- Import produces usable sequencer blocks even if object reconstruction is partial

### 10.2 SVG and image IO plugins (formalized)

**Deliverables**

- `format-svg` plugin: import/export vectors
- `asset-image` plugin: image ingestion + embedding + thumbnailing

**Acceptance criteria**

- All I/O goes through plugin system (no hidden built-ins)

### 10.3 Madeira thread catalog plugin

**Deliverables**

- Madeira catalog dataset + search + nearest-match (RGB to thread)
- Palette assignment UI, thread swap, warnings for missing matches
- Thread length estimator (ties into stats)

**Acceptance criteria**

- Selecting a thread updates preview and export mappings
- Nearest-match is deterministic and test-covered

---

# 11) Performance, Determinism, and Quality Gates

### 11.1 Golden tests for stitch generation

**Deliverables**

- Golden fixtures (input objects + params) -> expected stitch outputs
- Regression harness in CI

**Acceptance criteria**

- Stitch generators cannot change output without updating fixtures intentionally

### 11.2 Large-design benchmarks

**Deliverables**

- Bench cases: 50k/200k/1M stitches
- Budgets for pan/zoom, sequencer interactions, preview toggles
- Profiling scripts + perf CI smoke checks

**Acceptance criteria**

- App remains interactive under target workloads
- Worst-case operations degrade gracefully (progress + cancel)

### 11.3 Plugin safety + robustness

**Deliverables**

- Worker sandbox enforced
- Timeouts, memory limits (where enforceable), crash recovery
- Structured error reporting surfaced in UI

**Acceptance criteria**

- A crashing plugin does not crash the host
- User gets actionable error messages and can disable the plugin (built-ins togglable in dev)

---

# 12) Packaging, Offline, and Release Readiness

### 12.1 PWA + offline readiness

**Deliverables**

- App loads offline after first load
- Local projects persist reliably
- Import/export `*.vision` works without network

**Acceptance criteria**

- Offline smoke test passes
- No network required for core workflows

### 12.2 Documentation set (in `docs/`)

**Deliverables**

- `docs/architecture.md` (packages + boundaries)
- `docs/plugins.md` (capabilities + UI contributions + sandbox)
- `docs/storage.md` (OPFS + snapshot/oplog + compaction)
- `docs/document-model.md` (schemas + ops + migrations)
- `docs/rendering.md` (2D + preview pipelines)
- `docs/stitch-pipeline.md` (generators + commands + determinism)
- `docs/formats/pes.md`, `docs/formats/svg.md`
- `docs/thread-system.md` (Madeira mapping)

**Acceptance criteria**

- A new dev can implement a new plugin by following docs end-to-end

---

## Implementation order (practical)

1. **Core + ops + undo/redo** → 2) **Storage + \*.vision** → 3) **Plugin runtime + schema UI**
2. **2D rendering + object mode basics** → 5) **Stitch generators** → 6) **Sequencer**
3. **2D preview** → 8) **2.5D preview** → 9) **3D cloth sim**
4. **PES + Madeira + auto-sequencer** → 11) **Quality/perf gates** → 12) **Release readiness**

If you want, the next step is I produce this as a **checklist-style epic list** with explicit dependency links (what must be completed before what) and a “definition of done” template per epic that you can copy into Linear/GitHub Issues.
