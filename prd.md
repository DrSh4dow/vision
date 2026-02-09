# Vision

**The open-source embroidery platform that makes professional digitizing accessible to everyone.**

Vision is embroidery software that runs in your browser. No install, no license key, no price tag. You open a tab and you have the same power that professional digitizers pay thousands for -- built on a Rust engine that generates stitches directly on your machine, with nothing sent to any server, ever.

It is simple by design. The surface is calm: a dark canvas, a minimal toolbar, a clean sequencer. The depth lives one right-click away. Every object on the canvas has a context menu that opens the full production digitizing toolkit -- stitch types, routing overrides, underlay configuration, compensation tuning, sequence controls. Beginners see a tool they can learn in an afternoon. Professionals find a tool that never slows them down. The power is always there; it just does not shout.

We stand on the shoulders of the incredible work done by the Ink/Stitch community. Their algorithms and embroidery knowledge are our north star -- reimplemented clean-room in Rust, because their quality deserves to run at native speed in the browser.

---

## What the user sees

Vision opens as a fullscreen application with three areas and a floating toolbar. There is no sidebar toggle, no collapsing panels, no mode switcher. The layout is fixed and intentional: everything a digitizer needs is visible, and nothing else is.

### The canvas

The canvas fills the center of the screen. It is an infinite workspace drawn at true embroidery scale -- millimeters, not pixels. A subtle grid fades in and out as you zoom. Origin crosshairs mark the machine center. You pan with middle-click or Alt+drag, zoom with the scroll wheel, and the viewport stays buttery at 60fps regardless of design complexity.

Objects on the canvas are not vector art. They are embroidery objects. Every shape is rendered with its assigned thread color, and when the stitch preview is active, you see the actual needle path overlaid in real time -- every stitch, every jump, every trim, exactly as the machine will execute it.

### The sequencer

The left panel is the sequencer. It represents the machine's execution order: the exact sequence of stitch blocks, top to bottom, that the needle will follow. Each row shows the block name, a stitch-type badge (Running, Satin, Tatami, Contour, Spiral, Motif), a thread-color dot, and visibility/lock icons.

This is not a layer panel. Layers describe how a design looks on screen. The sequencer describes how a design is sewn. You drag rows to reorder them and the stitch plan updates instantly. Expand any row with its chevron to reveal per-block routing controls: tie mode, trim behavior, entry/exit strategy, reverse direction -- all defaulting to "Inherit Global" so you only override when you need to. Small badges (REV, TIE, TB, TA, TI, TO) appear inline when overrides are active, so you can scan the sequence at a glance and know exactly which blocks have custom behavior.

The sequencer is the single source of truth for machine output.

### The properties panel

The right panel is entirely contextual. When nothing is selected, it reads "Select an object." When one object is selected, it shows every parameter that controls how that object becomes thread on fabric. When multiple objects are selected, it shows the count and shared properties.

Below the properties sits the thread palette -- professional catalogs from Madeira, Isacord, and Sulky with nearest-color matching. Below that sits the diagnostics panel, a live preflight check that flags geometry errors, missing guide rails, and suspicious parameter combinations before you ever hit export.

### The floating toolbar

A small, frosted-glass toolbar floats at the top center of the canvas. Four tools: Select (V), Pen (P), Rectangle (R), Ellipse (E). That is the entire surface-level toolset. Everything else -- stitch assignment, routing, underlay, compensation, export options -- lives in the context menu and property panel. The toolbar is deliberately minimal so the canvas dominates the experience.

### The top bar

A slim 36px header carries the Vision brand, import/export actions, routing policy selector, simulation toggles (Thread On/Off, Play/Stop, Fast/Quality), and live quality metrics. At any moment you can read the jump count, travel distance, route score, density error, and angle error without opening a panel. The top bar is an information radiator, not a toolbar.

### Context menus: where the power lives

Right-click any object on the canvas and the context menu opens. This is the gateway to everything the properties panel shows and more: change stitch type, assign thread color, adjust density and angle, configure underlay, set pull compensation, override routing behavior, insert trim/tie commands, lock or hide the object, duplicate it, delete it. The context menu is organized by workflow -- stitch settings first, then routing, then object management -- so the most common actions are always at the top.

Right-click the canvas background for workspace actions: paste, import, zoom controls, grid settings, snap behavior.

Right-click a sequencer row for sequence-specific actions: move to top/bottom, insert color change, group with adjacent blocks, duplicate, remove.

The context menu is the secret handshake between Vision's simple surface and its full production depth. A beginner might never right-click. A professional lives in it.

---

## The journey of a new user

### Opening Vision for the first time

You navigate to Vision in your browser. The engine initializes instantly. A dark canvas appears with a soft millimeter grid, origin crosshairs, and the floating toolbar. The sequencer reads "No stitch objects yet." The properties panel reads "Select an object." The top bar shows the engine version and a quiet status indicator.

There is nothing to configure. No project setup. No wizard. You look at four tool icons and you understand.

### Importing artwork: the bitmap autodigitizer

Most users arrive with a logo -- a PNG or JPEG that a client sent with "can you put this on a polo shirt?"

You click Import in the top bar and select the image file. Vision's autodigitizer takes over:

1. **Color separation.** The bitmap is analyzed into distinct color regions. The algorithm clusters similar colors, eliminates noise, and presents a clean color-layer stack. Each layer maps to a thread color. You can merge layers, split them, or reassign colors before proceeding.

2. **Boundary tracing.** Each color region is traced into clean vector boundaries with sub-pixel accuracy. Small artifacts are filtered automatically. Holes and islands are preserved. The resulting geometry is already normalized -- correct winding order, no self-intersections, no degenerate edges.

3. **Automatic stitch assignment.** Vision classifies each shape by its geometry and assigns the optimal stitch type. Narrow elongated regions become satin columns with appropriate underlay. Large filled areas become tatami fills with sensible density and angle. Thin outlines become running stitches. Every parameter -- density, angle, pull compensation, underlay mode -- is set to production defaults based on the shape's size and aspect ratio.

4. **Sequence optimization.** The routing engine orders the stitch blocks to minimize jumps, trims, and thread changes. Same-color blocks are grouped. Entry and exit points are chosen to reduce travel. The result is scored and the metrics appear in the top bar.

You go from a client's JPEG to an embroidery-ready stitch plan in seconds. And nothing is hidden: every decision the autodigitizer made is visible in the sequencer and editable in the properties panel. Select any object, change its stitch type, tweak its density, drag it to a different position in the sequence. The autodigitizer is a starting point you can trust and a foundation you can refine.

For users who already have vector artwork, Vision imports SVG files. Each path becomes an embroidery object on the canvas, immediately ready for stitch parameter assignment.

### Drawing from scratch

Pick the Pen tool (P). Click points on the canvas to place a path. Press Enter to close it. The shape appears instantly in the sequencer with a default stitch type assigned. Pick Rectangle (R) or Ellipse (E) and click-drag on the canvas. The rubber-band preview shows you the shape in real time; release to commit it.

Every shape you create is an embroidery object from the moment it exists. There is no "convert to embroidery" step, no separate digitizing mode, no export pipeline to trigger. Vision is embroidery-first. Shapes exist to hold stitch parameters. The canvas is not a drawing surface that happens to export stitches -- it is a digitizing surface that happens to look like a drawing tool.

### Selecting and moving objects

Press V for the Select tool. Click any object to select it -- hit-testing runs in the Rust engine and is sub-millisecond precise. Drag to move. Shift-click to add to the selection. Drag a group and every selected object moves together. Release, and the stitch plan regenerates automatically. Every move records to the undo stack.

Ctrl+Z undoes. Ctrl+Shift+Z redoes. The undo history is deep and consistent across every operation: moves, parameter changes, sequencer reorders, imports, deletions.

### Editing stitch properties

Select an object. The properties panel activates:

- **Name** -- rename for clarity in the sequencer.
- **Transform** -- X, Y, rotation, scale with numeric precision.
- **Shape** -- type badge (Rectangle, Ellipse, Path) and dimensions in mm.
- **Fill and stroke** -- color swatches with hex codes.
- **Stitch type** -- Running, Satin, Tatami, Contour, Spiral, or Motif. Change it and the canvas preview updates instantly.
- **Density and angle** -- the two most fundamental stitch controls, always visible.

For **Satin** columns, additional controls appear contextually:
- Seven underlay modes: none, center walk, edge walk, zigzag, center+edge, center+zigzag, edge+zigzag, full.
- Pull compensation with mm precision.
- Compensation mode: off, auto, or directional with independent X/Y control.
- Underlay spacing for zigzag-based underlays.

For **Fill** types (Tatami, Contour, Spiral, Motif):
- Min segment length and row overlap.
- Fill start mode: auto, center, or edge.
- Edge walk toggle for boundary-following rows.
- Contour step size for contour fills.
- Motif pattern selector (diamond, wave, triangle), motif scale, and fill phase for motif fills.

These are the same controls available in Hatch Digitizer. Vision does not simplify them away. It organizes them so they appear only when relevant and never overwhelm a beginner who just wants to change a stitch type.

### Working with the sequencer

The sequencer is the design's heartbeat:

- Drag any row to a new position. The machine execution order changes immediately and the stitch preview updates to match.
- Expand a row to access its routing overrides:
  - **Allow Reverse** -- let the engine flip stitch direction for better entry/exit alignment.
  - **Entry/Exit mode** -- auto, preserve shape start, or user anchor.
  - **Tie Mode** -- off, shape start/end, or color change only.
  - **Trim Before/After** -- force or suppress trims around this block.
  - **Tie In/Out** -- force or suppress tie stitches.
- All overrides default to "Inherit" from the global routing policy. You only set them when a specific block needs special treatment.
- Inline badges mark which blocks have active overrides so the sequence is scannable at a glance.

The sequencer operates on the `SequenceTrack` -- a dedicated ordering that is independent of the visual layer stack. This is how production digitizing works: the machine does not care which layer an object belongs to. It cares about the order it will sew.

### Adding lettering

Click the Text tool or use the lettering shortcut. Type your text and Vision generates embroidery-ready letter forms:

- Each glyph is built from satin columns with automatic two-rail generation.
- Kerning, tracking, and leading are adjustable.
- Text follows a baseline, a curve, or an arbitrary vector path.
- Monogram templates provide quick presets: circle, diamond, stacked, and arc layouts for the monogramming jobs that are the bread and butter of commercial embroidery.
- A curated embroidery font library ships with Vision, optimized for stitch output rather than screen rendering -- proper stroke widths, clean corners, consistent density.

Lettering objects appear in the sequencer like any other stitch block. You can reorder them, override their routing, adjust their stitch parameters, and export them alongside the rest of the design.

### Previewing the stitch-out

Toggle "Thread On" in the top bar. The canvas overlays a full stitch simulation: every stitch drawn in its assigned thread color, following the exact needle path.

Two rendering modes:
- **Fast** -- dots and lines. Lightweight, responsive, designed for editing. You tweak a parameter and see the result without lag.
- **Quality** -- thread simulation with realistic width (0.38mm), sheen, and layering. The stitches look like real thread on fabric. This is the mode you switch to when proofing a design or showing a client what the finished piece will look like.

Hit **Play** to animate the stitch-out. The playback follows the sequencer order. You watch the design build up stitch by stitch: see when color changes happen, where jumps occur, when trims fire. Scrub the timeline to jump to any point. This is the fastest way to catch routing problems, color mistakes, and coverage gaps before wasting thread.

The 3D GPU simulation takes this further: instanced thread geometry rendered through wgpu with anisotropic highlights for realistic thread sheen and density-aware fabric response -- puckering, pull-in, and texture. The 3D view stays interactive at 100k+ stitches and produces proof-quality renders you can share with clients as-is.

### Checking quality

The top bar is a live quality dashboard:
- **T** -- total travel distance in mm. Lower is better.
- **J** -- jump count. Fewer jumps = cleaner production.
- **R** -- aggregate route score.
- **QD** -- density error. How far actual stitch density deviates from your targets.
- **QA** -- angle error. How far stitch angles deviate from your requested angles.

Open the advanced routing panel for the full picture: stitch count, mean and P95 stitch length, trim count, color change count, longest single travel move, and coverage error percentage. These metrics update live as you edit.

### Routing controls

Global routing settings sit in the top bar and the advanced routing panel:

- **Policy** -- Balanced, Min Travel, or Min Trims.
- **Sequence Mode** -- Strict Sequencer (your manual order, exactly) or Optimizer (the engine reorders for efficiency).
- **Allow Reverse** -- the engine can flip block stitch direction for better transitions.
- **Entry/Exit** -- auto, preserve shape start, or user-defined anchors.
- **Tie Mode** -- off, at shape boundaries, or at color changes.
- **Max Jump / Trim Threshold** -- distance thresholds controlling when a jump becomes a trim.
- **Min Run Before Trim** -- minimum stitch distance before the engine inserts a trim.
- **Allow Underpath / Color Merge / Preserve Color Order / Preserve Layer Order** -- advanced toggles for fine-grained control.

Defaults are tuned for production quality. Most users never change them. Professionals dial them per-job.

### Diagnostics

The diagnostics panel runs a live preflight check on the design:

- **Errors** (red) -- geometry problems that will produce bad stitches. Self-intersecting polygons, degenerate shapes, invalid winding order.
- **Warnings** (amber) -- potential issues. Disjoint fill components, missing guide rails, narrow shapes assigned to fill types, suspicious parameter combinations.
- **Info** (grey) -- observations. Stitch count estimates, format compatibility notes.

Click any diagnostic row and the problematic object highlights on the canvas. Every message is actionable -- it says what is wrong and what to do about it.

Vision automatically repairs common geometry issues during the export pipeline: ring normalization, self-intersection resolution, tiny-shape fallback. Invalid geometry never crashes an export. The worst case is a warning you can inspect and fix.

### Choosing thread colors

The thread palette panel offers three professional catalogs: Madeira, Isacord, and Sulky. Pick any color and Vision finds the nearest physical thread match. Thread assignments carry through to every export format. The production worksheet lists exact thread codes, order, and yardage estimates so the machine operator knows exactly what to load.

### Exporting for production

The top bar has dedicated export buttons. One click, instant download:

- **DST** (Tajima) -- the universal commercial format.
- **PES** (Brother) -- for Brother home and semi-pro machines.
- **PEC** -- Brother color block format.
- **JEF** (Janome) -- for Janome machines.
- **EXP** (Melco) -- for Melco commercial machines.
- **VP3** (Husqvarna/Viking/Pfaff) -- for the VP ecosystem.
- **HUS** (Husqvarna) -- legacy Husqvarna format.
- **XXX** (Singer) -- for Singer machines.

Every format is implemented independently in the Rust engine with per-format encoding rules and loss mapping. The export is client-side -- no upload, no server, no processing delay. The binary file downloads directly to your machine.

The production worksheet export generates a printable job sheet: design dimensions, stitch count, thread order with color codes, trim and stop positions, estimated sew time, and a stitch-out preview thumbnail. This is the sheet you hand to the machine operator or staple to the order.

Round-trip fidelity is tested for every format: export, re-import, compare. Machine constraint checks validate hoop size and format-specific limits before the file is written.

### Undo and redo

Every action in Vision is undoable. Move, resize, rotate, reparent, reorder, change stitch type, assign thread, override routing, import, delete -- Ctrl+Z takes it back, Ctrl+Shift+Z brings it forward. The undo stack lives in the engine and is consistent across the entire application. You cannot reach an inconsistent state.

---

## The stitch engine

All embroidery computation runs in a Rust engine compiled to WebAssembly. The engine is the core of Vision -- it generates stitches, validates geometry, routes stitch blocks, encodes machine formats, and assembles simulation timelines. Everything runs client-side. Nothing touches a server.

**Six stitch types, production-grade:**
- **Running stitch** -- path-following stitches with configurable segment length, path smoothing, min/max segment clamping, bean stitch (triple-run reinforcement), and manual stitch placement.
- **Satin columns** -- two-rail satin with automatic rail pairing and seven underlay modes (center walk, edge walk, zigzag, and all combinations). Pull compensation with per-axis directional control. Short-stitch handling on tight curves. Width, density, and angle consistency across the full column length.
- **Tatami fill** -- row-scheduled parallel fill with configurable angle, stagger offsets between rows for organic texture, gap-fill rows to eliminate coverage holes, start/end entry strategies, edge-walk boundary rows, and precise overlap control.
- **Contour fill** -- inner-to-outer, single spiral, and double spiral strategies with join style controls at contour transitions.
- **Spiral fill** -- center-point stability, hole handling within fill regions, and density consistency across spiral arms.
- **Motif fill** -- extensible pattern library (diamond, wave, triangle, and more) with repeat alignment, scaling, phase, and rotation controls.

**Auto-routing** -- travel path optimization between stitch blocks. The engine scores routes by jump count, trim count, and travel distance under the selected policy. Blocks can be reversed for optimal entry/exit alignment. Color grouping and sequencer order are respected.

**Stitch plan assembly** -- tie-in/tie-off stitches, jump/trim/color-change commands, and machine-safe command sequences. Every command is explicit, visible in the sequencer, and overridable per-block.

**Geometry validation and repair** -- ring normalization, self-intersection resolution, degenerate edge removal, tiny-shape fallback policies. The diagnostics pipeline runs deterministically and produces actionable warnings before export.

**Format encoding** -- independent Rust implementations for DST, PES, PEC, JEF, EXP, VP3, HUS, and XXX. A unified internal stitch representation with per-format loss mapping and round-trip integrity tests.

The algorithms are informed by the Ink/Stitch project's published behavior -- how satins handle pull compensation, how fills handle edge-walking, how routing minimizes travel. Every algorithm is reimplemented from scratch in Rust as an independent, clean-room implementation.

---

## Simulation

Vision renders stitch previews in two tiers:

**2.5D canvas preview** -- command-aware thread rendering on the HTML Canvas. Stitches, jumps, and trims are visually distinct. Thread colors are accurate. Thickness and layering approximate real thread. This is the editing preview -- it updates in real time as you change any parameter, with no perceptible delay.

**3D GPU simulation** -- a wgpu-based renderer using instanced thread geometry with anisotropic highlight shading for realistic thread sheen, density-aware fabric response (pull-in, puckering, texture deformation), and proper stitch layering at the fiber level. This is the proofing view: what you show the client, what you use for quality sign-off. It stays interactive at 100k+ stitches.

Both modes support timeline playback with play/pause and scrub. Watch the design build stitch by stitch, or jump to any point in the sequence. Playback is the fastest diagnostic tool in embroidery -- it reveals routing issues, color mistakes, and coverage gaps that static previews miss.

---

## Theming

Vision ships with a refined dark theme built on shadcn/ui design tokens in the oklch color space. The entire visual system is defined through CSS custom properties: `--background`, `--foreground`, `--card`, `--panel`, `--surface`, `--accent`, `--muted`, `--border`, `--destructive`, and their foreground counterparts. Changing themes is as simple as swapping token values -- the entire application adapts.

The component library uses base-ui primitives for maximum flexibility and minimal bundle overhead. The design language is intentionally quiet: neutral tones, tight spacing, 13px base type, Inter font stack. The canvas content is the star. The UI chrome stays out of the way.

Community themes are welcomed. A theme is just a CSS file that redefines the token values. Dark, light, high contrast, branded -- the architecture supports them all.

---

## Collaboration

Vision is built for collaboration from the ground up. The Yjs CRDT library handles document synchronization:

- Multiple users edit the same design simultaneously with live cursors and presence avatars.
- Edits merge deterministically -- no manual conflict resolution, no "your changes were overwritten" dialogs.
- Version history tracks every change. Branch a design to explore a variant, compare it side by side, merge it back.
- Team libraries share thread palettes, stitch presets, motif collections, and embroidery font packs across an organization.

This is where Vision leaves desktop software behind entirely. Hatch cannot do real-time collaboration. No installed digitizer can. Vision runs in the browser, and collaboration is the natural consequence.

---

## Architecture

```
React 19 UI  -->  @vision/wasm-bridge (Zod v4 validated)  -->  Rust Engine (WASM)
                                                           -->  GPU Renderer (wgpu)
```

- **`apps/web`** -- React 19 SPA. Vite, Tailwind v4, shadcn/ui (new-york style, dark theme). Biome for linting and formatting. Playwright for end-to-end and visual regression tests.
- **`packages/wasm-bridge`** -- typed TypeScript wrapper with Zod runtime validation on every value crossing the WASM boundary. ~50 methods covering scene graph, stitch generation, format export, simulation, and diagnostics.
- **`crates/engine`** -- the core Rust crate. Scene graph with command-pattern undo/redo, geometry primitives, SVG import, bitmap autodigitizer, six stitch generators, eight format encoders, routing optimizer, validation diagnostics, simulation timeline, and quality metrics.
- **`crates/renderer`** -- wgpu GPU renderer with WebGL2 and WebGPU backends. Camera, mesh, vertex layout, and WGSL shader pipeline for high-fidelity 3D stitch simulation.

Everything runs client-side. COOP/COEP headers enable SharedArrayBuffer for threaded WASM execution. The monorepo is managed by moonrepo with Bun as the JS runtime. Rust edition 2024, compiled to `wasm32-unknown-unknown` via wasm-pack.

**Performance targets:**
- 50k-stitch regeneration: <100ms median, <200ms P95.
- 100k-stitch simulation: interactive framerate in fast mode.
- Import/export: non-blocking, cancellable, instant for typical designs.
- Canvas interaction: 60fps pan/zoom/drag at any design complexity.

---

## What "done" looks like

Vision reaches its release milestone when a professional digitizer can complete end-to-end production jobs without opening another tool:

1. Drop in a bitmap and get a production-quality stitch plan in seconds through the autodigitizer.
2. Refine every stitch parameter with the same depth available in Hatch -- density, angle, underlay, compensation, routing -- through a UI that never gets in the way.
3. Sequence stitch blocks in exact machine execution order with per-block routing overrides.
4. Preview the result in a simulation that professionals trust for QA and that clients accept as proof.
5. Export to every major machine format and load the file on the machine with confidence.
6. Add lettering and monograms -- the jobs that make up half of commercial embroidery revenue -- without switching tools.
7. Collaborate with a team in real time, in the browser, with live cursors and version history.

Vision is open source because embroidery software should not cost $5,000 and lock you into a single operating system. The quality should be just as high. That is the entire point.
