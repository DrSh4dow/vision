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

## Next Priority Queue
1. Phase 2 remaining: first-class `EmbroideryObject`/`StitchBlock`/`SequenceTrack` model separation.
2. Deterministic geometry-edit -> stitch-block regen semantics + persistence invariants.
3. Routing parity hardening against Ink/Stitch corpus with dual gate (visual + metric thresholds).

## Bench/Parity Notes
- Reference source for behavior inspiration: `../inkstitch`.
- Keep both gates active each wave: visual review + metric thresholds.

## Update Protocol
- Update this file at each meaningful milestone commit.
- Keep notes concise and decision-oriented.
