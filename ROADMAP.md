# Vision Roadmap
## Browser-Native Embroidery Platform with Hatch-Level Feature Parity

## 1) Product Goal

Build a full browser-native embroidery design and digitizing platform that reaches practical feature parity with Hatch Digitizer for core production workflows, while delivering a modern UX, fast iteration, and collaboration-ready architecture.

## 2) Parity Definition (What "Feature Parity with Hatch" Means)

Parity is achieved when a professional digitizer can complete end-to-end production jobs in Vision without switching to Hatch for core tasks:

1. Vector drawing/editing and object transforms
2. Full object digitizing controls (running, satin, tatami, advanced fills, compensation, underlay)
3. Reliable auto-routing/travel/jump/trim behavior
4. Accurate stitch sequence controls and machine commands
5. Realistic stitch simulation and stitch playback diagnostics
6. Multi-format production export/import for mainstream machine ecosystems
7. Lettering/monogram workflows used in common commercial jobs
8. Print/export production sheets and job metadata

## 3) Constraints and Principles

1. Browser-native compute first: digitizing and simulation run client-side in Rust/WASM.
2. JS/TS web app imports engine APIs only from `@vision/wasm-bridge`.
3. No backend dependency for stitch generation, simulation, or file conversion.
4. Engineering quality gates are blocking, not advisory.
5. Reference Ink/Stitch algorithms, but implement clean-room Rust versions.

## 4) Reuse Strategy from Ink/Stitch (Knowledge Reuse, Not Code Copy)

Use Ink/Stitch as algorithm and behavior reference for mature embroidery logic:

1. Auto-fill graph construction + Eulerian traversal concepts
2. Stitch-plan assembly semantics (tie-in/tie-off, jump/trim/color-change handling)
3. Fill and satin validation heuristics (small shapes, invalid geometry, warnings)
4. Realistic stitch rendering patterns and command-aware visualization
5. Parameter taxonomy and defaults for practical digitizing controls

Mandatory legal boundary:

1. Do not copy GPL source into Vision.
2. Implement independent Rust algorithms from documented behavior/tests.
3. Keep behavior notes and test vectors as references, not copied implementation.

## 5) Target Architecture (Final State)

1. `apps/web`: React shell, tools, property panels, timeline, simulation controls
2. `packages/wasm-bridge`: strict type-safe bridge, schema validation, stable API surface
3. `crates/engine`: scene graph, geometry, digitizing, stitch plan, format IO, routing metrics
4. Renderer split:
   1. Immediate 2D Canvas/WebGL preview path for editing responsiveness
   2. High-fidelity WebGL/WebGPU thread simulation path for TrueView-like output

## 6) Phased Delivery Plan

## Phase 0 — Baseline Hardening (Immediate)
Goal: make current progress stable before deeper parity work.

Deliverables:

1. Freeze/verify stitch schema defaults across Rust + bridge + UI
2. Expand deterministic test corpus for running/satin/tatami/contour/spiral/motif
3. Add regression fixtures for jump/trim/color-change behavior
4. Add benchmark harness for stitch generation latency and memory

Exit criteria:

1. Full required checks pass consistently
2. Engine test suite includes golden-reference stitch snapshots
3. Baseline metrics captured for 10k/50k/100k stitch jobs

## Phase 1 — Core Digitizing Parity (Production-Critical 80%)
Goal: match reliable quality for the most common commercial workflows.

Scope:

1. Running stitch: path smoothing, min/max segment handling, bean/manual variants
2. Satin columns:
   1. robust two-rail behavior
   2. center/edge/zigzag underlay modes
   3. pull compensation controls
   4. width/density/angle behavior consistency
3. Tatami fill:
   1. better row scheduling and stagger behavior
   2. gap-fill rows
   3. start/end strategy
   4. edge-walk support and overlap controls

Exit criteria:

1. Core objects produce stable stitchouts on representative designs
2. Jump/trim count and travel distance are within agreed benchmark thresholds
3. E2E tests cover object creation -> parameter edit -> export -> preview

## Phase 2 — Stitch Plan and Routing Parity
Goal: make sequence quality comparable to mature desktop digitizers.

Scope:

1. First-class stitch-plan pipeline in engine:
   1. color blocks
   2. object boundaries
   3. command-aware transitions
2. Tie policies:
   1. off
   2. shape start/end
   3. color-change only
3. Travel optimization improvements:
   1. route scoring tuned by policy
   2. reversible block routing
   3. color/layer preservation policies
4. Jump collapse and trim insertion logic aligned with machine-safe behavior

Exit criteria:

1. Route metrics dashboard reflects true command sequence outcomes
2. Routing policies are deterministic and test-covered
3. Reduced unnecessary trims/jumps on standard benchmark designs

## Phase 3 — Advanced Fill Parity
Goal: close major fill-quality gap with Hatch-class tools.

Scope:

1. Contour fill:
   1. inner->outer
   2. single spiral
   3. double spiral strategies
   4. join style controls
2. Spiral fill quality tuning:
   1. center stability
   2. hole handling
   3. density consistency
3. Motif fill:
   1. pattern library expansion
   2. repeat alignment
   3. scaling and phase control
4. Guided/meander-style fill path (if enabled in Vision scope)
5. Fill-specific compensation and underlay interplay

Exit criteria:

1. Advanced fills pass geometry stress fixtures (holes, islands, self-touching outlines)
2. Parameter panel supports practical controls expected by power users
3. Quality review set shows no critical artifacts in standard test pack

## Phase 4 — Geometry Robustness and Validation
Goal: prevent silent bad stitch plans and give actionable guidance.

Scope:

1. Geometry repair pipeline:
   1. ring normalization
   2. invalid polygon repair
   3. tiny-shape fallback policy
2. Validation warnings/errors:
   1. invalid shape
   2. disjoint fill components
   3. missing guide markers
   4. unsupported parameter combinations
3. UI diagnostics panel for per-object embroidery warnings

Exit criteria:

1. Invalid geometry does not crash export pipeline
2. Validation messages are deterministic and actionable
3. Known bad SVG fixtures are handled gracefully

## Phase 5 — Simulation Parity (2.5D then 3D)
Goal: modern, trustworthy visual preview for design QA and client proofing.

Scope:

1. Phase 5A (2.5D):
   1. command-aware thread rendering
   2. better thread thickness and sheen
   3. clean playback/timeline controls
2. Phase 5B (3D/WebGL-WebGPU):
   1. instanced thread geometry
   2. anisotropic highlight model
   3. density-aware fabric response
3. Fast/quality render modes for edit vs proof output

Exit criteria:

1. Simulation visually distinguishes stitch type, angle, and layering
2. Playback diagnostics expose routing and trim issues clearly
3. High-quality preview stays interactive for large stitch counts

## Phase 6 — File Format Parity
Goal: reliable production interoperability.

Scope:

1. Export priority: DST, PES, JEF, EXP, VP3, HUS, XXX, PEC
2. Import priority: DST, PES, JEF first, then remaining formats
3. Unified internal stitch representation with loss mapping notes per format
4. Machine constraints and hoop/profile compatibility checks

Exit criteria:

1. Round-trip tests for each supported format family
2. Real-machine validation pack for representative files
3. Production worksheet export includes thread order, trims, stops, dimensions

## Phase 7 — Lettering and Productivity Parity
Goal: cover high-frequency commercial workflows beyond base digitizing.

Scope:

1. Embroidery lettering engine:
   1. satin columns per glyph
   2. kerning/tracking controls
   3. baseline/path text
2. Monogram templates and quick presets
3. Object and layer command tools:
   1. trim/jump insertion
   2. reorder tools
   3. sequence editor/timeline

Exit criteria:

1. Common name/monogram jobs can be completed fully in Vision
2. Lettering quality acceptable for standard garment/thread scenarios
3. Sequence editing works without destructive data loss

## Phase 8 — Collaboration and Cloud (Post-Parity)
Goal: exceed desktop software with browser-native collaboration.

Scope:

1. CRDT document sync
2. Presence and multi-user editing
3. Version history and branch/merge for design variants
4. Team libraries and shared thread/preset catalogs

Exit criteria:

1. Multi-user editing stable under latency and reconnection scenarios
2. Conflict resolution is deterministic and user-understandable

## 7) Hatch Parity Workstream Matrix

Priority order (highest first):

1. Satin/tatami quality and underlay behavior
2. Stitch-plan command semantics and auto-routing quality
3. Advanced fill robustness
4. Simulation fidelity for proofing and QA
5. Format interoperability breadth
6. Lettering and sequence productivity tools

## 8) Quality Gates (Must Stay Green)

Existing required checks remain mandatory:

1. `cargo fmt --all --check`
2. `cargo clippy --workspace` with zero warnings
3. `cargo test --workspace`
4. `bunx biome check`
5. `bunx tsc --noEmit --project apps/web`
6. `bunx vite build` (from `apps/web`)
7. `bunx playwright test e2e/app.spec.ts` (from `apps/web`)

Additional parity gates:

1. Golden stitch snapshot tests by stitch type and routing policy
2. Route metrics benchmark thresholds on standard design pack
3. Visual regression checks for simulation quality modes
4. Cross-format import/export regression pack

## 9) Performance Targets

1. 50k-stitch regeneration target: <100ms median, <200ms p95 on reference hardware
2. 100k-stitch simulation preview: interactive editing at practical framerate in fast mode
3. Import/export operations must be non-blocking in UI and cancellable

## 10) Risks and Mitigations

1. Risk: quality parity stalls on advanced fills
   1. Mitigation: prioritize graph-based auto-fill and stitch-plan semantics before feature breadth
2. Risk: simulation fidelity impacts interactivity
   1. Mitigation: dual render paths (fast edit vs high-quality proof)
3. Risk: file format edge cases
   1. Mitigation: fixture library + real-machine validation loop
4. Risk: legal exposure from GPL reference misuse
   1. Mitigation: clean-room implementation policy and review checklist

## 11) Execution Order for Next Development Cycles

1. Complete Phase 0 hardening and benchmark harness
2. Finish Phase 1 quality tuning for satin/tatami underlay/compensation
3. Finalize Phase 2 stitch-plan/routing semantics and metrics confidence
4. Push Phase 3 advanced fill parity with robust geometry handling
5. Deliver Phase 5A simulation uplift before Phase 5B 3D renderer
6. Expand Phase 6 format coverage with continuous real-file validation

## 12) Definition of Done for "Hatch-Parity Core"

Vision can be considered Hatch-parity for core workflows when all are true:

1. Core digitizing workflows (running, satin, tatami, advanced fills) are production-usable
2. Routing and stitch plan behavior are reliable and tunable for commercial jobs
3. Simulation is trusted for pathing/quality review and customer proofing
4. Major machine formats are export/import reliable for normal shop pipelines
5. Lettering and sequence tools support common business use cases without tool switching
