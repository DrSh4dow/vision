# Browser-Based Embroidery Design Software
## Architecture & Technical Roadmap

---

## Vision

A Figma-like collaborative embroidery design tool running entirely in the browser — free tier supported by premium features. Users can design, digitize, simulate, and export production-ready embroidery files without installing anything.

---

## Core Technical Challenges

The reason desktop apps like Hatch and Embrilliance still dominate is that embroidery digitizing involves **computationally heavy vector-to-stitch pathfinding**, real-time **stitch simulation rendering**, and support for **dozens of proprietary file formats**. Solving these in the browser is the entire moat.

---

## Phase 1 — Canvas & Design Primitives

**Goal:** A usable vector editor with embroidery-aware primitives.

### Tech Stack
- **Rendering Engine:** Custom WebGL2/WebGPU renderer (not a wrapper around Fabric.js or Konva — you'll outgrow them immediately). Study Figma's approach: a custom 2D renderer on top of WebGL with their own scene graph. Use **wgpu** compiled to WebGPU/WebGL via wasm for future-proofing.
- **Core Engine:** **Rust → WebAssembly**. This is non-negotiable for the geometry and stitch generation performance you need. The entire engine (scene graph, stitch solver, file I/O) lives in Rust/WASM.
- **UI Shell:** **React or SolidJS** for panels, toolbars, layers, properties. The canvas itself is NOT React — it's your custom WebGL surface. React only owns the chrome.
- **State Management:** CRDT-based document model from the start (even before multiplayer). Use **Automerge** or **Yjs** as your document backbone. This gives you undo/redo, offline, and future collaboration for free.

### Key Deliverables
- Infinite canvas with pan/zoom/rotate (GPU-accelerated)
- Vector primitives: paths, bezier curves, shapes, text-to-outline
- Node editing (pen tool equivalent)
- Layers, groups, boolean operations (union, subtract, intersect)
- SVG/PNG import with auto-trace to vector (potrace algorithm, compiled to WASM)
- Color palette system mapped to thread brands (Madeira, Isacord, Sulky — these are just databases)

### Architecture Note
```
┌─────────────────────────────────────┐
│           React UI Shell            │
│  (panels, tools, properties, layers)│
├─────────────────────────────────────┤
│         Bridge Layer (JS ↔ WASM)    │
│     (thin typed API, SharedArrayBuffer) │
├─────────────────────────────────────┤
│        Rust/WASM Core Engine        │
│  ┌───────────┬──────────┬─────────┐ │
│  │Scene Graph│Stitch Gen│ File I/O│ │
│  └───────────┴──────────┴─────────┘ │
├─────────────────────────────────────┤
│     WebGL2 / WebGPU Renderer        │
│   (custom 2D renderer, instanced    │
│    drawing for stitch preview)      │
└─────────────────────────────────────┘
```

---

## Phase 2 — Digitizing Engine (The Hard Part)

**Goal:** Convert vector designs into production-quality stitch data.

This is where 90% of the IP lives. Embroidery digitizing is essentially a **constrained pathfinding and fill optimization problem**.

### Stitch Types to Implement (in order)
1. **Running stitch** — simplest, path following with configurable length
2. **Satin/column stitch** — two-rail sweep with density control, underlay generation
3. **Fill stitches** — the beast:
   - Tatami fill (row-based with stagger)
   - Spiral fill
   - Contour fill
   - Motif fill (pattern-based)
4. **Underlay generation** — automatic stabilization stitches beneath fills and satins
5. **Pull compensation** — automatically widen shapes to counteract fabric pull (critical for quality)
6. **Auto-routing / travel stitches** — minimize jump stitches and thread trims between sections

### Key Algorithms
- **Computational geometry:** Polygon offsetting (Clipper2 library — has a Rust port), Voronoi diagrams for even spacing, sweep line algorithms for fill generation
- **Pathfinding:** Modified TSP / Eulerian path solvers for optimal stitch ordering
- **Pull compensation:** Directional morphological dilation based on stitch angle and density

### Recommended Approach
- Study **Ink/Stitch** source code deeply (Python + C extensions, GPL licensed). You already know Ink/Stitch — its digitizing algorithms are solid but unoptimized. Rewrite the core algorithms in Rust with proper computational geometry primitives.
- The **libembroidery** project (C library) has useful file format implementations.
- Build a **stitch parameter panel** per object: users select stitch type, density, angle, underlay, compensation — the engine regenerates stitches in real-time.

### Performance Target
Regenerating stitches for a 50k-stitch design should take <100ms in WASM. This is achievable in Rust with proper spatial indexing (R-tree for object queries, sweep line for fill generation).

---

## Phase 3 — Realistic Stitch Simulation

**Goal:** Show a photorealistic preview of the embroidered result.

This is the "wow factor" feature that will differentiate from desktop software.

### Approach
- **GPU instanced rendering:** Each stitch is a textured quad (or short cylinder for 3D). A 100k-stitch design = 100k instances — trivial for modern GPUs via WebGPU instanced draw calls.
- **Thread shading model:** Custom fragment shader that simulates thread luster — a anisotropic specular model (like hair/fur shading — Ward or Kajiya-Kay model adapted for thread).
- **Fabric simulation:** Background texture with displacement based on stitch density (optional: compute shader for real-time fabric deformation).
- **Stitch order animation:** Playback the stitching sequence to visualize machine pathing — useful for debugging jump stitches and ordering issues.

### Reference
Look at **Wilcom's TrueView** technology as the gold standard. Also study hair/fur rendering papers — embroidery thread rendering is mathematically similar.

---

## Phase 4 — File Format Support

**Goal:** Read and write every major embroidery format.

### Formats (priority order)
| Format | Extension | Notes |
|--------|-----------|-------|
| DST | .dst | Tajima — most universal, simple format |
| PES | .pes | Brother — you know this from your PE910L |
| JEF | .jef | Janome |
| EXP | .exp | Melco |
| VP3 | .vp3 | Husqvarna/Viking |
| HUS | .hus | Husqvarna |
| XXX | .xxx | Singer |
| PEC | .pec | Brother (embedded in PES) |
| SVG | .svg | Import/export vector layer |
| Native | .json/.bin | Your own format (CRDT-friendly) |

### Implementation
- All format parsers/writers in **Rust/WASM**. Use **libembroidery** as reference (MIT licensed C library with most format specs reverse-engineered).
- Build a unified internal stitch representation that all formats serialize to/from.
- Client-side only — no server roundtrip for file conversion.

---

## Phase 5 — Collaboration & Cloud

**Goal:** Figma-like multiplayer editing and cloud storage.

### Tech Stack
- **Real-time sync:** Yjs or Automerge CRDT (already in your document model from Phase 1) + WebSocket relay server
- **Backend:** Rust (Axum) or TypeScript (Bun/Hono) — your call based on team
- **Storage:** S3-compatible object store for design files, PostgreSQL for metadata
- **Auth:** Standard OAuth2 / passkeys
- **Presence:** Cursor positions, selections, viewport awareness (lightweight WebSocket messages)

### Architecture
- **Relay server model** (like Figma): clients send CRDT updates to a relay that broadcasts to other clients and persists to storage. No OT needed — CRDTs handle conflict resolution.
- **Lazy loading:** Large designs load progressively — viewport-based tile loading for the canvas, stitch data loaded on demand per object.

---

## Phase 6 — Advanced Features & Polish

- **Auto-digitize:** ML-based raster image → vector → stitch pipeline (use a fine-tuned segmentation model like SAM2 for region detection, then apply stitch parameters per region)
- **Lettering engine:** Built-in embroidery font system with proper kerning, satin column generation per glyph
- **Template library:** Pre-digitized designs, monogram frames, borders
- **Machine profiles:** Configure hoop sizes, max stitch lengths, supported features per machine model
- **Design marketplace:** Community sharing, premium designs (monetization path)
- **PDF/print worksheets:** Color sequence sheets, placement guides

---

## Monetization Model

| Tier | Features |
|------|----------|
| **Free** | Full design & digitize, local file export (DST, PES), 3 cloud saves |
| **Pro** | All formats, cloud storage, collaboration, stitch simulation, auto-digitize |
| **Team** | Shared libraries, brand management, API access |

---

## Build vs. Buy Decision Matrix

| Component | Recommendation |
|-----------|---------------|
| 2D Renderer | **Build** — no existing browser lib handles embroidery-scale instanced rendering well |
| Vector editing | **Build on top of** computational geometry crates (geo, clipper2) |
| Stitch generation | **Build** — this is your core IP. Reference Ink/Stitch algorithms |
| File formats | **Build** using libembroidery as reference |
| CRDT | **Buy** — use Yjs or Automerge |
| Auth/payments | **Buy** — Clerk/Auth.js + Stripe |
| Image tracing | **Adapt** — potrace compiled to WASM |
| Auto-digitize ML | **Build** — fine-tune existing vision models |

---

## Staffing Suggestions

Given you'd be the technical architect:

- **1-2 Rust/WASM engineers** — core engine, stitch algorithms, file formats
- **1 WebGL/WebGPU specialist** — renderer, stitch simulation shaders
- **1 senior frontend engineer** — React UI, design tool UX (someone with Figma/design-tool experience is gold)
- **1 computational geometry person** (can overlap with Rust eng) — fill algorithms, pull compensation, pathfinding
- **You** — architecture, system design, critical path decisions, ML pipeline

Minimum viable team: **3 engineers + you** to reach a usable MVP.

---

## Key Risks & Mitigations

**Risk: Stitch quality parity with Hatch/Wilcom**
→ Mitigation: Focus on satin and tatami fill quality first. These cover 80% of designs. Pull compensation is the secret sauce — invest heavily here.

**Risk: WebGPU adoption**
→ Mitigation: Build renderer with WebGL2 fallback. WebGPU is the future but WebGL2 covers 97%+ of browsers today.

**Risk: WASM memory limits**
→ Mitigation: Stream large designs, use SharedArrayBuffer for renderer ↔ engine communication. Modern browsers support 4GB+ WASM memory.

**Risk: File format edge cases**
→ Mitigation: Build a comprehensive test suite with real-world files from every machine brand. The embroidery community is passionate — leverage beta testers early.

---

## Suggested First 3 Months Focus

1. Rust/WASM scaffold with basic canvas rendering (WebGL2)
2. Vector primitives + pen tool + SVG import
3. Running stitch + satin stitch generation on vector paths
4. DST + PES export
5. Deploy as static site (Cloudflare Pages or Vercel) — usable MVP

This alone would be more capable than most free online tools and would validate the architecture.
