import type { ToolType } from "@/hooks/useTools";
import type { DesignPoint, StitchOverlay } from "@/types/design";
import { toCanvas } from "./draw-shapes";
import type { Camera } from "./types";
import { CANVAS_COLORS } from "./types";

/** Draw a rubber-band shape preview during drag creation. */
export function drawShapeDragPreview(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  start: DesignPoint,
  end: DesignPoint,
  tool: ToolType,
): void {
  const s = toCanvas(start);
  const e = toCanvas(end);
  const x = Math.min(s.x, e.x);
  const y = Math.min(s.y, e.y);
  const w = Math.abs(e.x - s.x);
  const h = Math.abs(e.y - s.y);

  ctx.strokeStyle = CANVAS_COLORS.selection;
  ctx.lineWidth = 1.5 / cam.zoom;
  ctx.setLineDash([6 / cam.zoom, 3 / cam.zoom]);
  ctx.fillStyle = CANVAS_COLORS.preview;

  if (tool === "rect") {
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  } else if (tool === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

/** Draw the pen tool live preview (points placed so far). */
export function drawPenPreview(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  points: DesignPoint[],
): void {
  if (points.length === 0) return;

  // Draw lines between points
  ctx.strokeStyle = CANVAS_COLORS.selection;
  ctx.lineWidth = 1.5 / cam.zoom;
  ctx.setLineDash([4 / cam.zoom, 2 / cam.zoom]);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();

  const first = toCanvas(points[0]);
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const p = toCanvas(points[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw point markers
  const pointRadius = 3.5 / cam.zoom;
  for (let i = 0; i < points.length; i++) {
    const p = toCanvas(points[i]);
    const isFirst = i === 0;

    ctx.fillStyle = isFirst ? CANVAS_COLORS.penFirst : CANVAS_COLORS.penPoint;
    ctx.strokeStyle = CANVAS_COLORS.penPointStroke;
    ctx.lineWidth = 1 / cam.zoom;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pointRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Close indicator: if >= 3 points, draw a small circle around the start
  if (points.length >= 3) {
    const start = toCanvas(points[0]);
    ctx.strokeStyle = CANVAS_COLORS.penClose;
    ctx.lineWidth = 1.5 / cam.zoom;
    ctx.setLineDash([3 / cam.zoom, 2 / cam.zoom]);
    ctx.beginPath();
    ctx.arc(start.x, start.y, 8 / cam.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/** Draw a stitch overlay (computed stitch points, not in scene graph). */
export function drawStitchOverlay(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  overlay: StitchOverlay,
): void {
  const points = overlay.points;
  if (points.length === 0) return;

  // Draw connecting lines
  ctx.strokeStyle = overlay.color;
  ctx.lineWidth = 1.5 / cam.zoom;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();

  const first = toCanvas(points[0]);
  ctx.moveTo(first.x, first.y);

  for (let i = 1; i < points.length; i++) {
    const p = toCanvas(points[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  // Draw dots at each stitch point
  if (overlay.showDots) {
    const dotRadius = 2.0 / cam.zoom;
    ctx.fillStyle = overlay.color;
    for (const pt of points) {
      const p = toCanvas(pt);
      ctx.beginPath();
      ctx.arc(p.x, p.y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw start/end markers
  const startP = toCanvas(points[0]);
  const endP = toCanvas(points[points.length - 1]);
  const markerRadius = 3.5 / cam.zoom;

  // Start marker — green circle
  ctx.fillStyle = CANVAS_COLORS.stitchStart;
  ctx.beginPath();
  ctx.arc(startP.x, startP.y, markerRadius, 0, Math.PI * 2);
  ctx.fill();

  // End marker — red circle
  ctx.fillStyle = CANVAS_COLORS.stitchEnd;
  ctx.beginPath();
  ctx.arc(endP.x, endP.y, markerRadius, 0, Math.PI * 2);
  ctx.fill();
}
