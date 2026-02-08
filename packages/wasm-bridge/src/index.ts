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
  generate_running_stitches,
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
  color: Color;
}

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
   *
   * @param path - Array of points defining the path.
   * @param stitchLength - Target stitch length in mm.
   * @returns Array of stitch points.
   */
  generateRunningStitches(path: Point[], stitchLength: number): Point[];

  /** Create a WASM Point object. */
  createPoint(x: number, y: number): WasmPoint;

  /** Create a WASM Color object. */
  createColor(r: number, g: number, b: number, a: number): WasmColor;

  /** Get the stitch type string from a numeric WASM enum value. */
  stitchTypeName(value: number): StitchType | undefined;
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
        // Convert Point[] to flat Float64Array [x0, y0, x1, y1, ...]
        const flat = new Float64Array(path.length * 2);
        for (let i = 0; i < path.length; i++) {
          flat[i * 2] = path[i].x;
          flat[i * 2 + 1] = path[i].y;
        }

        const result = generate_running_stitches(flat, stitchLength);

        // Convert flat Float64Array back to Point[]
        const points: Point[] = [];
        for (let i = 0; i < result.length; i += 2) {
          points.push({ x: result[i], y: result[i + 1] });
        }
        return points;
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
