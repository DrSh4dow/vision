# Vision

**The open-source embroidery platform that makes professional digitizing accessible to everyone.**

Vision is embroidery software that runs in your browser. No install, no license key, no price tag. You open a tab and you have the same power that professional digitizers pay thousands for -- built on a Rust engine that generates stitches directly on your machine, with nothing sent to any server, ever.

It is simple by design. The surface is calm: a dark canvas, a minimal toolbar, a clean sequencer. The depth lives one right-click away. Every object on the canvas has a context menu that opens the full production digitizing toolkit -- stitch types, routing overrides, underlay configuration, compensation tuning, sequence controls. Beginners see a tool they can learn in an afternoon. Professionals find a tool that never slows them down. The power is always there; it just does not shout.

We stand on the shoulders of the incredible work done by the Ink/Stitch community. Their algorithms and embroidery knowledge are our north star -- reimplemented clean-room in Rust, because their quality deserves to run at native speed in the browser.

---

## What the user sees

Vision opens as a fullscreen application. A menu bar at the top, a canvas in the center, the sequencer on the left, properties on the right, a status bar at the bottom, and a floating toolbar over the canvas. There is no sidebar toggle, no collapsing panels, no mode switcher. The layout is fixed and intentional: everything a digitizer needs is visible, and nothing else is.

### The canvas

The canvas fills the center of the screen. It is an infinite workspace drawn at true embroidery scale -- millimeters, not pixels. A subtle grid fades in and out as you zoom. Origin crosshairs mark the machine center. You pan with middle-click or Alt+drag, zoom with the scroll wheel, and the viewport stays buttery at 60fps regardless of design complexity.

Objects on the canvas are not vector art. They are embroidery objects. Every shape is rendered with its assigned thread color, and when the stitch preview is active, you see the actual needle path overlaid in real time -- every stitch, every jump, every trim, exactly as the machine will execute it.

### The sequencer

The left panel is the sequencer. It represents the machine's execution order: the exact sequence of stitch blocks, top to bottom, that the needle will follow. Each row shows the block name, a stitch-type badge (Running, Satin, Tatami, Contour, Spiral, Motif, Lettering), a thread-color dot, and visibility/lock icons.

This is not a layer panel. Layers describe how a design looks on screen. The sequencer describes how a design is sewn. You drag rows to reorder them and the stitch plan updates instantly. Expand any row with its chevron to reveal per-block routing controls: tie mode, trim behavior, entry/exit strategy, reverse direction -- all defaulting to "Inherit Global" so you only override when you need to. Small badges (REV, TIE, TB, TA, TI, TO) appear inline when overrides are active, so you can scan the sequence at a glance and know exactly which blocks have custom behavior.

The sequencer is the single source of truth for machine output.

### The properties panel

The right panel is entirely contextual. When nothing is selected, it reads "Select an object." When one object is selected, it shows every parameter that controls how that object becomes thread on fabric. When multiple objects are selected, it shows the count and shared properties.

Below the properties sits the thread palette -- professional catalogs from Madeira, Isacord, and Sulky with nearest-color matching. The right panel is dedicated to properties and thread -- nothing else competes for its space.

### The menu bar

The top of the window is a native-feeling menu bar in the macOS tradition: **File | Edit | View | Design | Routing | Help**. Every command in Vision is discoverable here, with keyboard shortcuts listed next to each item. This is how a new user explores the application -- by reading the menus.

**File** -- New, Open, Import SVG, Import Bitmap, Export (with a submenu for every machine format: DST, PES, PEC, JEF, EXP, VP3, HUS, XXX), Export Production Worksheet, Save Project, Recent Files.

**Edit** -- Undo, Redo, Cut, Copy, Paste, Duplicate, Delete, Select All. The familiar foundation that makes Vision feel like software you already know.

**View** -- Zoom In, Zoom Out, Zoom to Fit, Zoom to Selection, Toggle Grid, Toggle Snap, Toggle Stitch Preview, Simulation Mode (Fast / Quality), Toggle Diagnostics Panel, Toggle Design Inspector. This is where you control what you see without hunting for tiny icon buttons.

**Design** -- Stitch Type submenu (Running, Satin, Tatami, Contour, Spiral, Motif), Assign Thread Color, Auto-Digitize Selection, Validate Design, Repair Geometry. The menu-bar path to operations that also live in the context menu -- because discoverability matters more than minimalism.

**Routing** -- Routing Policy (Balanced, Min Travel, Min Trims), Sequence Mode (Strict Sequencer, Optimizer), global tie mode, allow reverse, and a link to open the full routing settings. These are the same controls that live in the Design Inspector, surfaced here so they are one click away from the top level.

**Help** -- Keyboard Shortcuts, Documentation, About Vision.

A professional never opens the menus. They know the shortcuts, they live in the context menus, they have muscle memory for every operation. But the menus are there for everyone else -- and they make Vision feel like a real application, not a tech demo with icon buttons.

### The floating toolbar

A small, frosted-glass toolbar floats at the top center of the canvas. Five tools: Select (V), Pen (P), Text (T), Rectangle (R), Ellipse (E). That is the entire drawing toolset on the canvas surface. Everything else -- stitch assignment, routing, underlay, compensation, export -- lives in the menu bar, context menus, and property panel. The toolbar is deliberately minimal so the canvas dominates the experience.

### The status bar

At the bottom of the canvas sits a quiet, information-dense status bar. It is always visible and never demands attention -- but when you glance at it, you know the health of your design at a glance:

**Left side** -- cursor position in mm, zoom level, object count. The spatial awareness a digitizer needs while working.

**Center** -- a compact design summary: total stitch count, color count, estimated sew time. The numbers that matter for quoting a job.

**Right side** -- a severity summary: a green checkmark when the design is clean, or a warning/error count (e.g., "2 warnings") that you can click to open the diagnostics panel. This is the only persistent quality indicator on the screen. It is enough to tell you whether something needs attention, without showing you the details until you ask.

The status bar is calm, readable, and gives every important number in a format a beginner can understand without a legend.

### Context menus: where the power lives

Right-click any object on the canvas and the context menu opens. This is the gateway to everything the properties panel shows and more: change stitch type, assign thread color, adjust density and angle, configure underlay, set pull compensation, override routing behavior, insert trim/tie commands, lock or hide the object, duplicate it, delete it. The context menu is organized by workflow -- stitch settings first, then routing, then object management -- so the most common actions are always at the top.

Right-click the canvas background for workspace actions: paste, import, zoom controls, grid settings, snap behavior.

Right-click a sequencer row for sequence-specific actions: move to top/bottom, insert color change, group with adjacent blocks, duplicate, remove.

The context menu is the secret handshake between Vision's simple surface and its full production depth. A beginner might never right-click. A professional lives in it.

---

## The journey of a new user

### Opening Vision for the first time

You navigate to Vision in your browser. The engine initializes instantly. A dark canvas appears with a soft millimeter grid, origin crosshairs, and the floating toolbar. A clean menu bar sits at the top. The sequencer on the left reads "No stitch objects yet." The properties panel on the right reads "Select an object." The status bar at the bottom shows the zoom level and a green checkmark -- nothing to worry about.

There is nothing to configure. No project setup. No wizard. You see five tool icons on the canvas and a menu bar you can explore. You understand.

### Importing artwork: the bitmap autodigitizer

Most users arrive with a logo -- a PNG or JPEG that a client sent with "can you put this on a polo shirt?"

You open File > Import Bitmap and select the image. Vision's autodigitizer takes over:

1. **Color separation.** The bitmap is analyzed into distinct color regions. The algorithm clusters similar colors, eliminates noise, and presents a clean color-layer stack. Each layer maps to a thread color. You can merge layers, split them, or reassign colors before proceeding.

2. **Boundary tracing.** Each color region is traced into clean vector boundaries with sub-pixel accuracy. Small artifacts are filtered automatically. Holes and islands are preserved. The resulting geometry is already normalized -- correct winding order, no self-intersections, no degenerate edges.

3. **Automatic stitch assignment.** Vision classifies each shape by its geometry and assigns the optimal stitch type. Narrow elongated regions become satin columns with appropriate underlay. Large filled areas become tatami fills with sensible density and angle. Thin outlines become running stitches. Every parameter -- density, angle, pull compensation, underlay mode -- is set to production defaults based on the shape's size and aspect ratio.

4. **Sequence optimization.** The routing engine orders the stitch blocks to minimize jumps, trims, and thread changes. Same-color blocks are grouped. Entry and exit points are chosen to reduce travel. The result is scored and the metrics appear in the status bar.

You go from a client's JPEG to an embroidery-ready stitch plan in seconds. And nothing is hidden: every decision the autodigitizer made is visible in the sequencer and editable in the properties panel. Select any object, change its stitch type, tweak its density, drag it to a different position in the sequence. The autodigitizer is a starting point you can trust and a foundation you can refine.

For users who already have vector artwork, Vision imports SVG files. Each path becomes an embroidery object on the canvas, immediately ready for stitch parameter assignment.

### Drawing from scratch

Pick the Pen tool (P) and you have a full bezier path editor. Click to place a corner point. Click and drag to pull out curve handles -- the path bends into a smooth cubic bezier, and you see the curve form live as you move the mouse. Release, click the next point, drag again. You are sculpting the exact boundary that stitches will follow, and the feedback is immediate: the path previews on canvas as you build it, point by point, curve by curve.

Hold Shift while dragging a handle to constrain it to 45-degree increments -- useful for precise symmetry. Click back on the first point to close the shape, or press Enter to finish an open path. Press Escape to cancel. The moment the path is committed, it appears in the sequencer as a stitch object with default parameters assigned.

The bezier tool is how you trace complex shapes by hand: the curve of a letter, the outline of a mascot's head, the contour of a leaf. The curves you draw are not approximations -- they are the exact geometry the stitch engine will follow. A smooth bezier produces smooth satin rails. A sharp corner produces a clean stitch transition. What you draw is what you sew.

For simpler shapes, pick Rectangle (R) or Ellipse (E) and click-drag on the canvas. The rubber-band preview shows the shape in real time; release to commit it.

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

Lettering is half the embroidery business. Names on uniforms, monograms on towels, slogans on caps -- if a digitizing tool cannot do text well, it cannot do production work. Vision treats lettering as a first-class workflow, not an afterthought bolted onto a shape editor.

Press T for the Text tool. Click on the canvas and a text input activates. Type your text. Vision generates embroidery-optimized letter forms instantly -- not screen fonts rasterized into stitches, but purpose-built glyph outlines designed from the start for needle and thread.

Each glyph is constructed from satin columns with automatic two-rail generation. The engine analyzes the stroke geometry of every letter: straight segments get clean parallel rails, curves get smoothly interpolated rails with proper short-stitch handling, serifs and terminals get density-appropriate transitions. The result is lettering that sews cleanly at any size, from 6mm cap text to 50mm jacket backs.

The properties panel shows lettering-specific controls:
- **Font** -- a curated embroidery font library ships with Vision. These are not desktop fonts converted to outlines. They are fonts designed for stitch output: consistent stroke widths, clean corners, proper spacing at embroidery scales.
- **Size** -- in millimeters, because that is what the machine cares about.
- **Kerning and tracking** -- adjust letter spacing globally or between specific pairs.
- **Leading** -- line spacing for multi-line text.
- **Path text** -- attach the text to a baseline, a circle, an arc, or any arbitrary vector path drawn with the Pen tool. The letters flow along the curve with automatic spacing adjustment.
- **Stitch parameters** -- density, underlay, pull compensation. All the same controls available on any satin object, because lettering glyphs are satin objects.

Monogram templates provide one-click layouts for the jobs digitizers do every day: three-letter circle monograms, diamond frames, stacked initials, arc layouts for caps. Pick a template, type the initials, adjust the size, and the monogram is ready to sew. The template handles the layout, the spacing, and the decorative frame. You handle the thread color.

Every letter, every word, every monogram appears in the sequencer as individual stitch blocks. You can reorder them relative to the rest of the design, override their routing, split a word into individual letters for color changes, or merge adjacent letters into a single block for fewer trims. Lettering is not a special mode -- it is just another way to create embroidery objects that live in the same sequence, the same stitch plan, the same export pipeline as everything else.

### Previewing the stitch-out

Toggle the stitch preview from the View menu (or its shortcut). The canvas overlays a full stitch simulation: every stitch drawn in its assigned thread color, following the exact needle path.

Two rendering modes:
- **Fast** -- dots and lines. Lightweight, responsive, designed for editing. You tweak a parameter and see the result without lag.
- **Quality** -- thread simulation with realistic width (0.38mm), sheen, and layering. The stitches look like real thread on fabric. This is the mode you switch to when proofing a design or showing a client what the finished piece will look like.

Hit **Play** to animate the stitch-out. The playback follows the sequencer order. You watch the design build up stitch by stitch: see when color changes happen, where jumps occur, when trims fire. Scrub the timeline to jump to any point. This is the fastest way to catch routing problems, color mistakes, and coverage gaps before wasting thread.

The 3D GPU simulation takes this further: instanced thread geometry rendered through wgpu with anisotropic highlights for realistic thread sheen and density-aware fabric response -- puckering, pull-in, and texture. The 3D view stays interactive at 100k+ stitches and produces proof-quality renders you can share with clients as-is.

### The Design Inspector

Open the Design Inspector from the View menu (or its keyboard shortcut) and a dedicated panel appears with the full quality report for your design. This is not a cryptic line of abbreviations -- it is a proper, readable analysis:

- **Stitch summary** -- total stitch count, color count, estimated sew time, design dimensions in mm.
- **Routing metrics** -- total travel distance, jump count, trim count, color change count, longest single travel move, aggregate route score. Each metric has a label, a value, and a unit. No guessing what "T:12.4" means.
- **Quality analysis** -- mean and P95 stitch length, density error (how far actual density deviates from targets), angle error (how far stitch angles deviate from requested angles), coverage error percentage.
- **Routing settings** -- the full routing configuration in one place:
  - Policy: Balanced, Min Travel, or Min Trims.
  - Sequence Mode: Strict Sequencer (your manual order, exactly) or Optimizer (the engine reorders for efficiency).
  - Allow Reverse, Entry/Exit mode, Tie Mode.
  - Max Jump and Trim Threshold distances.
  - Min Run Before Trim.
  - Allow Underpath, Color Merge, Preserve Color Order, Preserve Layer Order.

Every setting has sensible defaults. Most users never change them. Professionals open the Design Inspector per-job, dial the routing policy, and watch the metrics update live as the engine re-scores the result.

The Design Inspector is also where you see format compatibility at a glance: which export formats can represent your design without loss, and which will require simplification. You know before you export, not after.

### Diagnostics

Click the warning/error count in the status bar -- or open View > Diagnostics -- and a panel slides up from the bottom of the canvas, like a terminal in a code editor. This is the diagnostics panel: a live preflight check on the entire design.

- **Errors** (red) -- geometry problems that will produce bad stitches. Self-intersecting polygons, degenerate shapes, invalid winding order.
- **Warnings** (amber) -- potential issues. Disjoint fill components, missing guide rails, narrow shapes assigned to fill types, suspicious parameter combinations.
- **Info** (grey) -- observations. Stitch count estimates, format notes, optimization suggestions.

The list is filterable by severity. Click any row and the problematic object highlights on the canvas and selects in the sequencer. Every message is actionable -- it says what is wrong and what to do about it, not just that something failed.

Vision automatically repairs common geometry issues during export: ring normalization, self-intersection resolution, tiny-shape fallback. Invalid geometry never crashes an export. The worst case is a warning you can inspect and fix.

The diagnostics panel closes with a click or a keypress. When the design is clean, the status bar shows a green checkmark and the panel has nothing to show. It exists for the moments you need it and vanishes when you do not.

### Choosing thread colors

The thread palette panel offers three professional catalogs: Madeira, Isacord, and Sulky. Pick any color and Vision finds the nearest physical thread match. Thread assignments carry through to every export format. The production worksheet lists exact thread codes, order, and yardage estimates so the machine operator knows exactly what to load.

### Exporting for production

Open File > Export and pick your format. One click, instant download:

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

**Six stitch types plus a dedicated lettering engine, production-grade:**
- **Running stitch** -- path-following stitches with configurable segment length, path smoothing, min/max segment clamping, bean stitch (triple-run reinforcement), and manual stitch placement.
- **Satin columns** -- two-rail satin with automatic rail pairing and seven underlay modes (center walk, edge walk, zigzag, and all combinations). Pull compensation with per-axis directional control. Short-stitch handling on tight curves. Width, density, and angle consistency across the full column length.
- **Tatami fill** -- row-scheduled parallel fill with configurable angle, stagger offsets between rows for organic texture, gap-fill rows to eliminate coverage holes, start/end entry strategies, edge-walk boundary rows, and precise overlap control.
- **Contour fill** -- inner-to-outer, single spiral, and double spiral strategies with join style controls at contour transitions.
- **Spiral fill** -- center-point stability, hole handling within fill regions, and density consistency across spiral arms.
- **Motif fill** -- extensible pattern library (diamond, wave, triangle, and more) with repeat alignment, scaling, phase, and rotation controls.
- **Lettering engine** -- glyph decomposition into satin columns with automatic two-rail generation, embroidery-optimized font library, kerning/tracking/leading controls, path text along arbitrary curves, and monogram template system.

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
