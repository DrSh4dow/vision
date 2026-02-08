import type { Camera } from "./types";
import { CANVAS_COLORS } from "./types";

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Compute grid spacing for the current zoom level. */
export function computeGridSpacing(zoom: number): number {
  const targetScreenSpacing = 25;
  const rawSpacing = targetScreenSpacing / zoom;
  const log10 = Math.log10(rawSpacing);
  const power = Math.floor(log10);
  const base = 10 ** power;
  const normalized = rawSpacing / base;

  let nice: number;
  if (normalized < 1.5) nice = 1;
  else if (normalized < 3.5) nice = 2.5;
  else if (normalized < 7.5) nice = 5;
  else nice = 10;

  return nice * base;
}

/** Draw the infinite grid. */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  viewW: number,
  viewH: number,
): void {
  const spacing = computeGridSpacing(cam.zoom);
  const majorSpacing = spacing * 5;

  const halfW = viewW / (2 * cam.zoom);
  const halfH = viewH / (2 * cam.zoom);

  const left = cam.x - halfW;
  const right = cam.x + halfW;
  const top = cam.y - halfH;
  const bottom = cam.y + halfH;

  // Vertical lines
  const startX = Math.floor(left / spacing) * spacing;
  ctx.lineWidth = 0.5 / cam.zoom;

  for (let x = startX; x <= right; x += spacing) {
    const isMajor = Math.abs(Math.round(x / majorSpacing) * majorSpacing - x) < 0.01;
    ctx.strokeStyle = isMajor ? CANVAS_COLORS.gridMajor : CANVAS_COLORS.gridMinor;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  // Horizontal lines
  const startY = Math.floor(top / spacing) * spacing;
  for (let y = startY; y <= bottom; y += spacing) {
    const isMajor = Math.abs(Math.round(y / majorSpacing) * majorSpacing - y) < 0.01;
    ctx.strokeStyle = isMajor ? CANVAS_COLORS.gridMajor : CANVAS_COLORS.gridMinor;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }
}

/** Draw origin axes. */
export function drawAxes(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  viewW: number,
  viewH: number,
): void {
  const halfW = viewW / (2 * cam.zoom);
  const halfH = viewH / (2 * cam.zoom);
  const left = cam.x - halfW;
  const right = cam.x + halfW;
  const top = cam.y - halfH;
  const bottom = cam.y + halfH;

  ctx.lineWidth = 1.0 / cam.zoom;

  // X axis (horizontal)
  if (top <= 0 && bottom >= 0) {
    ctx.strokeStyle = CANVAS_COLORS.axisX;
    ctx.beginPath();
    ctx.moveTo(left, 0);
    ctx.lineTo(right, 0);
    ctx.stroke();
  }

  // Y axis (vertical)
  if (left <= 0 && right >= 0) {
    ctx.strokeStyle = CANVAS_COLORS.axisY;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(0, bottom);
    ctx.stroke();
  }
}
