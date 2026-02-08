/**
 * Vision WASM Bridge — Helper Utilities
 *
 * Conversion functions between JS Point arrays and flat Float64Arrays
 * used by the WASM boundary.
 */

import type { Point } from "./types";

/** Convert a Point array to a flat Float64Array (interleaved x, y). */
export function pointsToFlat(points: Point[]): Float64Array {
  const flat = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    flat[i * 2] = points[i].x;
    flat[i * 2 + 1] = points[i].y;
  }
  return flat;
}

/** Convert a flat Float64Array (interleaved x, y) to a Point array. */
export function flatToPoints(flat: Float64Array): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    points.push({ x: flat[i], y: flat[i + 1] });
  }
  return points;
}
