import type { ThreadBrand } from "@vision/wasm-bridge";

/** Default stitch length in mm for embroidery export. */
export const DEFAULT_STITCH_LENGTH = 2.5;

/** Available thread brand options. */
export const THREAD_BRANDS: ThreadBrand[] = ["madeira", "isacord", "sulky"];

/** Maximum number of palette swatches to display. */
export const MAX_PALETTE_DISPLAY = 24;
