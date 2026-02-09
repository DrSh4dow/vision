# Vision Scratchpad

## Current Branch
- main

## Latest Completed Slice
- Phase 2 sequencer-first controls: per-row `allow_reverse`, `entry_exit_mode`, `tie_mode` in left panel.
- End-to-end wiring: UI -> wasm-bridge -> engine overrides.
- Validation status: cargo fmt/clippy/test + biome + tsc + vite build + playwright all green.

## Current Wave Checkpoint
- Wave A (hybrid model foundation) in progress.
- Added first-class engine model structs (`EmbroideryObject`, `StitchBlock`, `SequenceTrack`) with deterministic shape-sync hooks in `Scene`.
- Updated command mutation paths to keep stitch-plan state synchronized after shape-kind/stitch-relevant edits.
- Added scene tests covering hybrid lifecycle + sequencer/override synchronization.
- Exposed hybrid scene APIs through WASM + bridge (`sceneGetEmbroideryObjects`, `sceneGetStitchBlocks`, `sceneGetSequenceTrack`) with Zod schemas and typed engine interface support.
- Gate status for this checkpoint: required Rust + web checks all passing (`fmt`, `clippy`, `test`, `biome`, `tsc`, `vite build`, `playwright`).
- Added Phase 1 dual gate script (`scripts/check-phase1-gate.sh`) to enforce both metric-threshold parity and visual snapshot parity.
- Added Playwright visual baseline suite (`apps/web/e2e/visual.spec.ts`) with committed snapshots for home and satin-control workspace review.
- Sequencer block reorder now executes against `SequenceTrack` directly (with metadata sync for compatibility) and is covered by a dedicated engine test.
- Added deterministic scene diagnostics end-to-end (`Scene::validation_diagnostics` -> wasm -> bridge -> `DiagnosticsPanel`) for geometry/routing preflight visibility.
- Added simulation timeline APIs (`sceneSimulationTimeline*`) and switched canvas thread preview to timeline-driven playback with `fast` / `quality` mode toggle.
- Added PEC export end-to-end (`engine.exportPec`, UI action, e2e coverage) and introduced `scripts/check-production-gate.sh` to enforce one-command release gates.

## Next Priority Queue
1. Phase 2 remaining: persist stitch-block command edits independent from source shape regeneration.
2. Phase 5B: add true 3D thread renderer path (WebGL/WebGPU) behind quality mode.
3. Phase 6/7: expand import coverage and lettering/monogram workflows with benchmark fixtures vs `../inkstitch`.

## Bench/Parity Notes
- Reference source for behavior inspiration: `../inkstitch`.
- Keep both gates active each wave: visual review + metric thresholds.

## Update Protocol
- Update this file at each meaningful milestone commit.
- Keep notes concise and decision-oriented.
