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

## Next Priority Queue
1. Phase 2 remaining: first-class `EmbroideryObject`/`StitchBlock`/`SequenceTrack` model separation.
2. Deterministic geometry-edit -> stitch-block regen semantics + persistence invariants.
3. Expand parity corpus beyond smoke fixtures and tune algorithm quality gaps vs `../inkstitch`.

## Bench/Parity Notes
- Reference source for behavior inspiration: `../inkstitch`.
- Keep both gates active each wave: visual review + metric thresholds.

## Update Protocol
- Update this file at each meaningful milestone commit.
- Keep notes concise and decision-oriented.
