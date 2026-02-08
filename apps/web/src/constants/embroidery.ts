import type { StitchParams, ThreadBrand } from "@vision/wasm-bridge";

/** Default stitch length in mm for embroidery export. */
export const DEFAULT_STITCH_LENGTH = 2.5;

/** Default row spacing in mm for fill stitches. */
export const DEFAULT_STITCH_DENSITY = 0.45;

/** Default stitch angle in degrees. */
export const DEFAULT_STITCH_ANGLE = 0;

/** Default stitch parameters for new shapes. */
export const DEFAULT_STITCH_PARAMS: StitchParams = {
  type: "running",
  density: DEFAULT_STITCH_DENSITY,
  angle: DEFAULT_STITCH_ANGLE,
  underlay_mode: "none",
  underlay_spacing_mm: 2,
  underlay_enabled: false,
  pull_compensation: 0,
  compensation_mode: "auto",
  compensation_x_mm: 0,
  compensation_y_mm: 0,
  fill_phase: 0,
  min_segment_mm: 0.4,
  overlap_mm: 0,
  edge_walk_on_fill: false,
  fill_start_mode: "auto",
  contour_step_mm: 1.2,
  motif_pattern: "diamond",
  motif_scale: 1,
};

/** Available thread brand options. */
export const THREAD_BRANDS: ThreadBrand[] = ["madeira", "isacord", "sulky"];

/** Maximum number of palette swatches to display. */
export const MAX_PALETTE_DISPLAY = 24;
