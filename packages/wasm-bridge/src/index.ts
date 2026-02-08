/**
 * Vision WASM Bridge
 *
 * Typed API layer between the JavaScript UI shell and the Rust/WASM core engine.
 * This package wraps the WASM module exports with ergonomic TypeScript interfaces.
 *
 * Architecture:
 *   React UI Shell <-> wasm-bridge <-> Rust/WASM Engine
 */

// Re-export generated WASM bindings
import initWasm, {
  export_dst,
  export_pes,
  find_nearest_thread,
  generate_running_stitches,
  generate_satin_stitches,
  get_thread_palette,
  import_svg_document,
  import_svg_path,
  Color as WasmColor,
  Point as WasmPoint,
  StitchType as WasmStitchType,
  version as wasmVersion,
} from "../pkg/vision_engine.js";

// ============================================================================
// Engine Types
// ============================================================================

/** 2D point in design space (millimeters). */
export interface Point {
  x: number;
  y: number;
}

/** RGBA color (0-255 per channel). */
export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Thread brand and color mapping. */
export interface ThreadColor {
  brand: string;
  code: string;
  name: string;
  r: number;
  g: number;
  b: number;
}

/** Thread brand identifiers. */
export type ThreadBrand = "madeira" | "isacord" | "sulky";

/** Stitch type enumeration (mirrors Rust StitchType). */
export type StitchType = "running" | "satin" | "tatami_fill" | "spiral_fill" | "contour_fill";

/** Stitch parameters for an embroidery object. */
export interface StitchParams {
  type: StitchType;
  density: number;
  angle: number;
  underlayEnabled: boolean;
  pullCompensation: number;
}

/** A single stitch with metadata. */
export interface Stitch {
  position: Point;
  is_jump: boolean;
  is_trim: boolean;
}

/** Satin stitch underlay configuration. */
export interface UnderlayConfig {
  center_walk: boolean;
  edge_walk: boolean;
  zigzag: boolean;
  zigzag_spacing: number;
  stitch_length: number;
}

/** Result of satin stitch generation. */
export interface SatinResult {
  stitches: Stitch[];
  underlay_count: number;
}

/** Export stitch type. */
export type ExportStitchType = "Normal" | "Jump" | "Trim" | "ColorChange" | "End";

/** A single stitch for file export. */
export interface ExportStitch {
  x: number;
  y: number;
  stitch_type: ExportStitchType;
}

/** A complete design ready for export. */
export interface ExportDesign {
  name: string;
  stitches: ExportStitch[];
  colors: Color[];
}

// ============================================================================
// WASM Stitch Type mapping
// ============================================================================

/** Map numeric WASM StitchType enum to string union. */
const STITCH_TYPE_MAP: Record<number, StitchType> = {
  [WasmStitchType.Running]: "running",
  [WasmStitchType.Satin]: "satin",
  [WasmStitchType.TatamiFill]: "tatami_fill",
  [WasmStitchType.SpiralFill]: "spiral_fill",
  [WasmStitchType.ContourFill]: "contour_fill",
};

// ============================================================================
// Engine Interface
// ============================================================================

/** The Vision engine API available after WASM initialization. */
export interface VisionEngine {
  /** Engine version string. */
  version(): string;

  /**
   * Generate running stitches along a path.
   * @param path - Array of points defining the path.
   * @param stitchLength - Target stitch length in mm.
   * @returns Array of stitch points.
   */
  generateRunningStitches(path: Point[], stitchLength: number): Point[];

  /**
   * Generate satin stitches between two guide rails.
   * @param rail1 - First guide rail points.
   * @param rail2 - Second guide rail points.
   * @param density - Stitch spacing in mm (0.3-0.5 typical).
   * @param pullCompensation - Extra width per side in mm (0.1-0.3 typical).
   * @param underlay - Underlay configuration.
   * @returns Satin stitch result with stitches and underlay count.
   */
  generateSatinStitches(
    rail1: Point[],
    rail2: Point[],
    density: number,
    pullCompensation: number,
    underlay: UnderlayConfig,
  ): SatinResult;

  /**
   * Import an SVG path `d` attribute string into vector path data.
   * @param d - The SVG path `d` attribute string.
   * @returns Parsed path data as JSON.
   */
  importSvgPath(d: string): unknown;

  /**
   * Import all paths from an SVG document.
   * @param svgContent - The full SVG XML content.
   * @returns Array of parsed path data.
   */
  importSvgDocument(svgContent: string): unknown[];

  /**
   * Get thread palette for a brand.
   * @param brand - Thread brand identifier.
   * @returns Array of thread color entries.
   */
  getThreadPalette(brand: ThreadBrand): ThreadColor[];

  /**
   * Find the nearest thread color in a brand's palette.
   * @param brand - Thread brand identifier.
   * @param color - Target RGB color.
   * @returns The closest matching thread entry.
   */
  findNearestThread(brand: ThreadBrand, color: { r: number; g: number; b: number }): ThreadColor;

  /**
   * Export design to DST (Tajima) format.
   * @param design - The design to export.
   * @returns Binary DST file data.
   */
  exportDst(design: ExportDesign): Uint8Array;

  /**
   * Export design to PES (Brother) format.
   * @param design - The design to export.
   * @returns Binary PES file data.
   */
  exportPes(design: ExportDesign): Uint8Array;

  /** Create a WASM Point object. */
  createPoint(x: number, y: number): WasmPoint;

  /** Create a WASM Color object. */
  createColor(r: number, g: number, b: number, a: number): WasmColor;

  /** Get the stitch type string from a numeric WASM enum value. */
  stitchTypeName(value: number): StitchType | undefined;
}

// ============================================================================
// Helper: Convert Point[] to flat Float64Array
// ============================================================================

function pointsToFlat(points: Point[]): Float64Array {
  const flat = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    flat[i * 2] = points[i].x;
    flat[i * 2 + 1] = points[i].y;
  }
  return flat;
}

function flatToPoints(flat: Float64Array): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    points.push({ x: flat[i], y: flat[i + 1] });
  }
  return points;
}

// ============================================================================
// WASM Module Loader
// ============================================================================

let engineInstance: VisionEngine | null = null;
let initPromise: Promise<VisionEngine> | null = null;

/**
 * Initialize the Vision WASM engine.
 *
 * Loads and instantiates the WASM module. Safe to call multiple times
 * concurrently — deduplicates the init call and caches the result.
 *
 * @returns The engine API interface.
 */
export async function initEngine(): Promise<VisionEngine> {
  if (engineInstance) {
    return engineInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async (): Promise<VisionEngine> => {
    await initWasm();

    const instance: VisionEngine = {
      version: (): string => wasmVersion(),

      generateRunningStitches: (path: Point[], stitchLength: number): Point[] => {
        const flat = pointsToFlat(path);
        const result = generate_running_stitches(flat, stitchLength);
        return flatToPoints(result);
      },

      generateSatinStitches: (
        rail1: Point[],
        rail2: Point[],
        density: number,
        pullCompensation: number,
        underlay: UnderlayConfig,
      ): SatinResult => {
        const r1 = pointsToFlat(rail1);
        const r2 = pointsToFlat(rail2);
        const underlayJson = JSON.stringify(underlay);
        const resultJson = generate_satin_stitches(r1, r2, density, pullCompensation, underlayJson);
        return JSON.parse(resultJson) as SatinResult;
      },

      importSvgPath: (d: string): unknown => {
        const json = import_svg_path(d);
        return JSON.parse(json);
      },

      importSvgDocument: (svgContent: string): unknown[] => {
        const json = import_svg_document(svgContent);
        return JSON.parse(json) as unknown[];
      },

      getThreadPalette: (brand: ThreadBrand): ThreadColor[] => {
        const json = get_thread_palette(brand);
        return JSON.parse(json) as ThreadColor[];
      },

      findNearestThread: (
        brand: ThreadBrand,
        color: { r: number; g: number; b: number },
      ): ThreadColor => {
        const json = find_nearest_thread(brand, color.r, color.g, color.b);
        return JSON.parse(json) as ThreadColor;
      },

      exportDst: (design: ExportDesign): Uint8Array => {
        const json = JSON.stringify(design);
        return export_dst(json);
      },

      exportPes: (design: ExportDesign): Uint8Array => {
        const json = JSON.stringify(design);
        return export_pes(json);
      },

      createPoint: (x: number, y: number): WasmPoint => new WasmPoint(x, y),

      createColor: (r: number, g: number, b: number, a: number): WasmColor =>
        new WasmColor(r, g, b, a),

      stitchTypeName: (value: number): StitchType | undefined => STITCH_TYPE_MAP[value],
    };

    engineInstance = instance;
    return instance;
  })();

  return initPromise;
}

/**
 * Get the current engine instance, or null if not yet initialized.
 */
export function getEngine(): VisionEngine | null {
  return engineInstance;
}
