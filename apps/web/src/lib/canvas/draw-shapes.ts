import type { RenderItem } from "@vision/wasm-bridge";
import { MM_TO_PX } from "@/constants/canvas";
import type { DesignPoint, PathCommand } from "@/types/design";
import type { Camera } from "./types";
import { CANVAS_COLORS } from "./types";

/** Convert a design-space point (mm) to canvas world coordinates. */
export function toCanvas(p: DesignPoint): { x: number; y: number } {
  return { x: p.x * MM_TO_PX, y: p.y * MM_TO_PX };
}

/** Color to CSS string. */
export function colorToCss(c: { r: number; g: number; b: number; a: number }): string {
  if (c.a === 255) return `rgb(${c.r}, ${c.g}, ${c.b})`;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${(c.a / 255).toFixed(2)})`;
}

/** Apply fill and stroke to the current path, with fallback defaults. */
export function applyFillAndStroke(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  fill: { r: number; g: number; b: number; a: number } | null,
  stroke: { r: number; g: number; b: number; a: number } | null,
  strokeWidth: number,
): void {
  if (fill) {
    ctx.fillStyle = colorToCss(fill);
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = colorToCss(stroke);
    ctx.lineWidth = ((strokeWidth || 1) * MM_TO_PX) / cam.zoom;
    ctx.stroke();
  } else if (!fill) {
    ctx.strokeStyle = CANVAS_COLORS.defaultStroke;
    ctx.lineWidth = 1.5 / cam.zoom;
    ctx.stroke();
  }
}

/** Draw a single render item from the scene graph. */
export function drawRenderItem(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  item: RenderItem,
  selected: boolean,
): void {
  const kind = item.kind;
  if (typeof kind === "string") return; // "Group" — skip

  if (!("Shape" in kind)) return;
  const { shape, fill, stroke, stroke_width } = kind.Shape;

  // Apply world transform: the transform is in design-space mm,
  // and we need to convert to canvas world coords (mm * MM_TO_PX)
  const [a, b, c, d, tx, ty] = item.world_transform;
  ctx.save();
  ctx.transform(a, b, c, d, tx * MM_TO_PX, ty * MM_TO_PX);

  if ("Path" in shape) {
    const { commands, closed } = shape.Path;
    drawShapePath(ctx, cam, commands, fill, stroke, stroke_width, closed);
  } else if ("Rect" in shape) {
    const { width, height, corner_radius } = shape.Rect;
    drawShapeRect(ctx, cam, width, height, corner_radius, fill, stroke, stroke_width);
  } else if ("Ellipse" in shape) {
    const { rx, ry } = shape.Ellipse;
    drawShapeEllipse(ctx, cam, rx, ry, fill, stroke, stroke_width);
  } else if ("Polygon" in shape) {
    const { sides, radius } = shape.Polygon;
    drawShapePolygon(ctx, cam, sides, radius, fill, stroke, stroke_width);
  }

  ctx.restore();

  if (selected) {
    drawSelectionHighlight(ctx, cam, item);
  }
}

/** Draw a Path shape using Canvas2D path commands. */
export function drawShapePath(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  commands: PathCommand[],
  fill: { r: number; g: number; b: number; a: number } | null,
  stroke: { r: number; g: number; b: number; a: number } | null,
  strokeWidth: number,
  closed: boolean,
): void {
  if (commands.length === 0) return;

  ctx.beginPath();

  for (const cmd of commands) {
    if (cmd === "Close") {
      ctx.closePath();
      continue;
    }

    if ("MoveTo" in cmd) {
      const p = toCanvas(cmd.MoveTo);
      ctx.moveTo(p.x, p.y);
    } else if ("LineTo" in cmd) {
      const p = toCanvas(cmd.LineTo);
      ctx.lineTo(p.x, p.y);
    } else if ("CubicTo" in cmd) {
      const c1 = toCanvas(cmd.CubicTo.c1);
      const c2 = toCanvas(cmd.CubicTo.c2);
      const end = toCanvas(cmd.CubicTo.end);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
    } else if ("QuadTo" in cmd) {
      const ctrl = toCanvas(cmd.QuadTo.ctrl);
      const end = toCanvas(cmd.QuadTo.end);
      ctx.quadraticCurveTo(ctrl.x, ctrl.y, end.x, end.y);
    }
  }

  // Path fill has special logic for closed/open paths
  if (fill) {
    ctx.fillStyle = closed ? colorToCss(fill) : `${colorToCss(fill)}20`;
    ctx.fill();
  } else if (closed) {
    ctx.fillStyle = stroke ? `${colorToCss(stroke)}20` : "rgba(255,255,255,0.05)";
    ctx.fill();
  }

  if (stroke) {
    ctx.strokeStyle = colorToCss(stroke);
    ctx.lineWidth = ((strokeWidth || 1) * MM_TO_PX) / cam.zoom;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  } else if (!fill) {
    ctx.strokeStyle = CANVAS_COLORS.defaultStroke;
    ctx.lineWidth = 1.5 / cam.zoom;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

/** Draw a rectangle shape. */
export function drawShapeRect(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  width: number,
  height: number,
  cornerRadius: number,
  fill: { r: number; g: number; b: number; a: number } | null,
  stroke: { r: number; g: number; b: number; a: number } | null,
  strokeWidth: number,
): void {
  const w = width * MM_TO_PX;
  const h = height * MM_TO_PX;
  const r = Math.min(cornerRadius * MM_TO_PX, w / 2, h / 2);

  ctx.beginPath();
  if (r > 0) {
    ctx.moveTo(r, 0);
    ctx.lineTo(w - r, 0);
    ctx.arcTo(w, 0, w, r, r);
    ctx.lineTo(w, h - r);
    ctx.arcTo(w, h, w - r, h, r);
    ctx.lineTo(r, h);
    ctx.arcTo(0, h, 0, h - r, r);
    ctx.lineTo(0, r);
    ctx.arcTo(0, 0, r, 0, r);
  } else {
    ctx.rect(0, 0, w, h);
  }
  ctx.closePath();

  applyFillAndStroke(ctx, cam, fill, stroke, strokeWidth);
}

/** Draw an ellipse shape. */
export function drawShapeEllipse(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  rx: number,
  ry: number,
  fill: { r: number; g: number; b: number; a: number } | null,
  stroke: { r: number; g: number; b: number; a: number } | null,
  strokeWidth: number,
): void {
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * MM_TO_PX, ry * MM_TO_PX, 0, 0, Math.PI * 2);
  ctx.closePath();

  applyFillAndStroke(ctx, cam, fill, stroke, strokeWidth);
}

/** Draw a regular polygon shape. */
export function drawShapePolygon(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  sides: number,
  radius: number,
  fill: { r: number; g: number; b: number; a: number } | null,
  stroke: { r: number; g: number; b: number; a: number } | null,
  strokeWidth: number,
): void {
  const r = radius * MM_TO_PX;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const x = r * Math.cos(angle);
    const y = r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  applyFillAndStroke(ctx, cam, fill, stroke, strokeWidth);
}

/** Draw selection highlight around a render item. */
export function drawSelectionHighlight(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  item: RenderItem,
): void {
  const kind = item.kind;
  if (typeof kind === "string" || !("Shape" in kind)) return;

  const { shape } = kind.Shape;
  const [a, b, c, d, tx, ty] = item.world_transform;

  // Compute approximate bounding box in world space
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Get shape bounds in local space (mm)
  if ("Rect" in shape) {
    const pts = [
      { x: 0, y: 0 },
      { x: shape.Rect.width, y: 0 },
      { x: shape.Rect.width, y: shape.Rect.height },
      { x: 0, y: shape.Rect.height },
    ];
    for (const p of pts) {
      const wx = (a * p.x + c * p.y + tx) * MM_TO_PX;
      const wy = (b * p.x + d * p.y + ty) * MM_TO_PX;
      minX = Math.min(minX, wx);
      minY = Math.min(minY, wy);
      maxX = Math.max(maxX, wx);
      maxY = Math.max(maxY, wy);
    }
  } else if ("Ellipse" in shape) {
    const { rx, ry } = shape.Ellipse;
    const pts = [
      { x: -rx, y: -ry },
      { x: rx, y: -ry },
      { x: rx, y: ry },
      { x: -rx, y: ry },
    ];
    for (const p of pts) {
      const wx = (a * p.x + c * p.y + tx) * MM_TO_PX;
      const wy = (b * p.x + d * p.y + ty) * MM_TO_PX;
      minX = Math.min(minX, wx);
      minY = Math.min(minY, wy);
      maxX = Math.max(maxX, wx);
      maxY = Math.max(maxY, wy);
    }
  } else if ("Path" in shape) {
    for (const cmd of shape.Path.commands) {
      let pt: DesignPoint | null = null;
      if (cmd === "Close") continue;
      if ("MoveTo" in cmd) pt = cmd.MoveTo;
      else if ("LineTo" in cmd) pt = cmd.LineTo;
      else if ("CubicTo" in cmd) pt = cmd.CubicTo.end;
      else if ("QuadTo" in cmd) pt = cmd.QuadTo.end;
      if (pt) {
        const wx = (a * pt.x + c * pt.y + tx) * MM_TO_PX;
        const wy = (b * pt.x + d * pt.y + ty) * MM_TO_PX;
        minX = Math.min(minX, wx);
        minY = Math.min(minY, wy);
        maxX = Math.max(maxX, wx);
        maxY = Math.max(maxY, wy);
      }
    }
  } else if ("Polygon" in shape) {
    const { sides, radius } = shape.Polygon;
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      const px = radius * Math.cos(angle);
      const py = radius * Math.sin(angle);
      const wx = (a * px + c * py + tx) * MM_TO_PX;
      const wy = (b * px + d * py + ty) * MM_TO_PX;
      minX = Math.min(minX, wx);
      minY = Math.min(minY, wy);
      maxX = Math.max(maxX, wx);
      maxY = Math.max(maxY, wy);
    }
  }

  if (minX === Infinity) return;

  // Draw selection outline
  const pad = 4 / cam.zoom;
  ctx.strokeStyle = CANVAS_COLORS.selection;
  ctx.lineWidth = 1.5 / cam.zoom;
  ctx.setLineDash([6 / cam.zoom, 3 / cam.zoom]);
  ctx.strokeRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
  ctx.setLineDash([]);

  // Draw 8 resize handles
  const handleSize = 5 / cam.zoom;
  const handles = [
    { x: minX - pad, y: minY - pad },
    { x: (minX + maxX) / 2, y: minY - pad },
    { x: maxX + pad, y: minY - pad },
    { x: maxX + pad, y: (minY + maxY) / 2 },
    { x: maxX + pad, y: maxY + pad },
    { x: (minX + maxX) / 2, y: maxY + pad },
    { x: minX - pad, y: maxY + pad },
    { x: minX - pad, y: (minY + maxY) / 2 },
  ];

  ctx.fillStyle = CANVAS_COLORS.handleFill;
  ctx.strokeStyle = CANVAS_COLORS.selection;
  ctx.lineWidth = 1 / cam.zoom;
  for (const h of handles) {
    ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
  }
}
