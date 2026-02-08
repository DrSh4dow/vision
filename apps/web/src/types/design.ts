/**
 * Design object types for canvas rendering.
 *
 * These represent drawable items on the infinite canvas.
 * Coordinates are in design space (millimeters).
 */

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
export interface StitchObject {
  type: "stitches";
  id: string;
  label: string;
  points: DesignPoint[];
  color: string;
  showDots: boolean;
}

/** A vector path object — SVG-like path commands rendered as strokes. */
export interface PathObject {
  type: "path";
  id: string;
  label: string;
  commands: PathCommand[];
  closed: boolean;
  color: string;
  strokeWidth: number;
}

/** Union of all renderable design objects. */
export type DesignObject = StitchObject | PathObject;
