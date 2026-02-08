/**
 * Design object types for canvas rendering.
 *
 * These represent drawable items on the infinite canvas.
 * Coordinates are in design space (millimeters).
 */

import type { RenderItem } from "@vision/wasm-bridge";

/** A 2D point in design space (mm). */
export interface DesignPoint {
  x: number;
  y: number;
}

/** Path command matching the Rust PathCommand serde output. */
export type PathCommand =
  | { MoveTo: DesignPoint }
  | { LineTo: DesignPoint }
  | { CubicTo: { c1: DesignPoint; c2: DesignPoint; end: DesignPoint } }
  | { QuadTo: { ctrl: DesignPoint; end: DesignPoint } }
  | "Close";

/** A parsed VectorPath from the WASM engine (serde JSON shape). */
export interface ParsedVectorPath {
  commands: PathCommand[];
  closed: boolean;
}

/** A stitch visualization object — connected stitch points rendered on the canvas. */
export interface StitchOverlay {
  id: string;
  label: string;
  points: DesignPoint[];
  color: string;
  showDots: boolean;
}

/** Canvas render data: scene render items + stitch overlays. */
export interface CanvasData {
  /** Scene graph render items (shapes with world transforms). */
  renderItems: RenderItem[];
  /** Stitch overlays (computed, not in scene graph). */
  stitchOverlays: StitchOverlay[];
  /** Currently selected node IDs. */
  selectedIds: Set<number>;
}
