import type { RenderItem, VisionEngine } from "@vision/wasm-bridge";
import { useCallback, useEffect, useRef } from "react";
import type { ToolType } from "@/hooks/useTools";
import type { CanvasData, DesignPoint, PathCommand, StitchOverlay } from "@/types/design";

/** Camera state for 2D canvas pan/zoom. */
interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Canvas mouse click callback (world coordinates in design space mm). */
export interface CanvasClickEvent {
  worldX: number;
  worldY: number;
  shiftKey: boolean;
  button: number;
}

/** Options for the canvas hook. */
interface UseCanvasOptions {
  /** Whether the engine is ready (triggers initial render). */
  ready: boolean;
  /** Mutable ref to the current canvas data to render. */
  canvasData: React.RefObject<CanvasData>;
  /** Active tool type. */
  activeTool: ToolType;
  /** Cursor style from tool system. */
  cursorStyle: string;
  /** Engine reference for hit-testing. */
  engine: VisionEngine | null;
  /** Called when the user clicks on the canvas (select tool). */
  onCanvasClick?: (event: CanvasClickEvent) => void;
  /** Called when a shape drag is completed (rect/ellipse tool). */
  onShapeDragEnd?: (startMm: DesignPoint, endMm: DesignPoint) => void;
  /** Called when pen tool clicks to add a point. */
  onPenClick?: (pointMm: DesignPoint) => void;
  /** Current pen tool points (for live preview). */
  penPoints?: DesignPoint[];
}

/** Scale factor: 1 mm in design space = this many canvas units (pixels at zoom 1). */
const MM_TO_PX = 10;

/**
 * Hook to manage a 2D canvas with pan/zoom, grid rendering, and design object display.
 *
 * Returns a ref to attach to a `<canvas>` element. Handles:
 * - DPI-aware sizing via ResizeObserver
 * - Infinite grid rendering with zoom-adaptive spacing
 * - Pan (middle-click or Alt+drag) and zoom (mouse wheel)
 * - Origin axes highlighting
 * - Rendering scene graph shapes and stitch overlays
 */
export function useCanvas({
  ready,
  canvasData,
  activeTool,
  cursorStyle,
  engine: _engine,
  onCanvasClick,
  onShapeDragEnd,
  onPenClick,
  penPoints,
}: UseCanvasOptions): React.RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const rafRef = useRef<number>(0);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  // Shape creation drag state
  const shapeDragStart = useRef<DesignPoint | null>(null);
  const shapeDragCurrent = useRef<DesignPoint | null>(null);
  const isShapeDragging = useRef(false);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set actual canvas resolution
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cam = cameraRef.current;

    // Clear background
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, width, height);

    // Apply camera transform
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    // Draw grid
    drawGrid(ctx, cam, width, height);

    // Draw origin axes
    drawAxes(ctx, cam, width, height);

    // Draw scene render items (shapes with world transforms)
    const data = canvasData.current;
    for (const item of data.renderItems) {
      drawRenderItem(ctx, cam, item, data.selectedIds.has(item.id["0"]));
    }

    // Draw stitch overlays (computed, not in scene graph)
    for (const overlay of data.stitchOverlays) {
      drawStitchOverlay(ctx, cam, overlay);
    }

    // Draw shape drag preview (rubber band)
    if (isShapeDragging.current && shapeDragStart.current && shapeDragCurrent.current) {
      drawShapeDragPreview(ctx, cam, shapeDragStart.current, shapeDragCurrent.current, activeTool);
    }

    // Draw pen tool preview (live path being created)
    if (penPoints && penPoints.length > 0) {
      drawPenPreview(ctx, cam, penPoints);
    }

    ctx.restore();

    // Draw HUD (zoom level, camera position)
    const totalCount = data.renderItems.length + data.stitchOverlays.length;
    ctx.fillStyle = "#8b949e";
    ctx.font = "11px -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      `Zoom: ${(cam.zoom * 100).toFixed(0)}%  |  ${cam.x.toFixed(1)}, ${cam.y.toFixed(1)}`,
      8,
      height - 8,
    );

    // Object count indicator
    if (totalCount > 0) {
      ctx.textAlign = "right";
      ctx.fillText(`${totalCount} object${totalCount !== 1 ? "s" : ""}`, width - 8, height - 8);
    }
  }, [canvasData, activeTool, penPoints]);

  // Render loop
  useEffect(() => {
    if (!ready) return;

    function loop(): void {
      render();
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [ready, render]);

  // Set cursor based on tool
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || isDragging.current) return;
    el.style.cursor = cursorStyle;
  }, [cursorStyle]);

  // Convert screen coordinates to world-space design coordinates (mm)
  const screenToWorld = useCallback((clientX: number, clientY: number): DesignPoint => {
    const el = canvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const cam = cameraRef.current;
    const worldX = cam.x + (clientX - rect.left - rect.width / 2) / cam.zoom;
    const worldY = cam.y + (clientY - rect.top - rect.height / 2) / cam.zoom;
    // Convert from canvas world coords to design space (mm)
    return { x: worldX / MM_TO_PX, y: worldY / MM_TO_PX };
  }, []);

  // Mouse event handlers for pan, zoom, and tool interactions
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const cam = cameraRef.current;
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Zoom towards cursor
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = clamp(cam.zoom * factor, 0.01, 256);

      // Adjust camera so the world point under the cursor stays fixed
      const worldX = cam.x + (mouseX - rect.width / 2) / cam.zoom;
      const worldY = cam.y + (mouseY - rect.height / 2) / cam.zoom;

      cam.zoom = newZoom;
      cam.x = worldX - (mouseX - rect.width / 2) / newZoom;
      cam.y = worldY - (mouseY - rect.height / 2) / newZoom;
    };

    const onMouseDown = (e: MouseEvent): void => {
      // Pan with middle-click or left-click + Alt (always available)
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        el.style.cursor = "grabbing";
        return;
      }

      // Left-click tool interactions
      if (e.button === 0) {
        const worldPt = screenToWorld(e.clientX, e.clientY);

        if (activeTool === "select") {
          // Hit-test and select
          if (onCanvasClick) {
            onCanvasClick({
              worldX: worldPt.x,
              worldY: worldPt.y,
              shiftKey: e.shiftKey,
              button: e.button,
            });
          }
        } else if (activeTool === "rect" || activeTool === "ellipse") {
          // Start shape drag
          isShapeDragging.current = true;
          shapeDragStart.current = worldPt;
          shapeDragCurrent.current = worldPt;
          el.style.cursor = "crosshair";
        } else if (activeTool === "pen") {
          if (onPenClick) {
            onPenClick(worldPt);
          }
        }
      }
    };

    const onMouseMove = (e: MouseEvent): void => {
      if (isDragging.current) {
        const cam = cameraRef.current;
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        cam.x -= dx / cam.zoom;
        cam.y -= dy / cam.zoom;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        return;
      }

      if (isShapeDragging.current) {
        shapeDragCurrent.current = screenToWorld(e.clientX, e.clientY);
        return;
      }

      // Hover hit-test for select tool
      // (lightweight — only update cursor, don't re-render)
    };

    const onMouseUp = (e: MouseEvent): void => {
      if (isDragging.current) {
        isDragging.current = false;
        el.style.cursor = cursorStyle;
        return;
      }

      if (isShapeDragging.current && shapeDragStart.current) {
        const endPt = screenToWorld(e.clientX, e.clientY);
        isShapeDragging.current = false;

        // Only create shape if drag was significant (> 1mm)
        const dx = Math.abs(endPt.x - shapeDragStart.current.x);
        const dy = Math.abs(endPt.y - shapeDragStart.current.y);
        if (dx > 1 || dy > 1) {
          if (onShapeDragEnd) {
            onShapeDragEnd(shapeDragStart.current, endPt);
          }
        }

        shapeDragStart.current = null;
        shapeDragCurrent.current = null;
        el.style.cursor = cursorStyle;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [activeTool, cursorStyle, onCanvasClick, onShapeDragEnd, onPenClick, screenToWorld]);

  return canvasRef;
}

// ============================================================================
// Drawing helpers
// ============================================================================

/** Clamp a number between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Compute grid spacing for the current zoom level. */
function computeGridSpacing(zoom: number): number {
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
function drawGrid(ctx: CanvasRenderingContext2D, cam: Camera, viewW: number, viewH: number): void {
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
    ctx.strokeStyle = isMajor ? "rgba(48, 54, 61, 0.8)" : "rgba(48, 54, 61, 0.4)";
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  // Horizontal lines
  const startY = Math.floor(top / spacing) * spacing;
  for (let y = startY; y <= bottom; y += spacing) {
    const isMajor = Math.abs(Math.round(y / majorSpacing) * majorSpacing - y) < 0.01;
    ctx.strokeStyle = isMajor ? "rgba(48, 54, 61, 0.8)" : "rgba(48, 54, 61, 0.4)";
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }
}

/** Draw origin axes. */
function drawAxes(ctx: CanvasRenderingContext2D, cam: Camera, viewW: number, viewH: number): void {
  const halfW = viewW / (2 * cam.zoom);
  const halfH = viewH / (2 * cam.zoom);
  const left = cam.x - halfW;
  const right = cam.x + halfW;
  const top = cam.y - halfH;
  const bottom = cam.y + halfH;

  ctx.lineWidth = 1.0 / cam.zoom;

  // X axis (horizontal)
  if (top <= 0 && bottom >= 0) {
    ctx.strokeStyle = "rgba(88, 166, 255, 0.5)";
    ctx.beginPath();
    ctx.moveTo(left, 0);
    ctx.lineTo(right, 0);
    ctx.stroke();
  }

  // Y axis (vertical)
  if (left <= 0 && right >= 0) {
    ctx.strokeStyle = "rgba(255, 120, 100, 0.5)";
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(0, bottom);
    ctx.stroke();
  }
}

// ============================================================================
// Scene render item drawing
// ============================================================================

/** Convert a design-space point (mm) to canvas world coordinates. */
function toCanvas(p: DesignPoint): { x: number; y: number } {
  return { x: p.x * MM_TO_PX, y: p.y * MM_TO_PX };
}

/** Color to CSS string. */
function colorToCss(c: { r: number; g: number; b: number; a: number }): string {
  if (c.a === 255) return `rgb(${c.r}, ${c.g}, ${c.b})`;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${(c.a / 255).toFixed(2)})`;
}

/** Draw a single render item from the scene graph. */
function drawRenderItem(
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
  // Apply the world transform scaled to canvas units
  ctx.transform(a, b, c, d, tx * MM_TO_PX, ty * MM_TO_PX);

  // Extract path commands from shape kind
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

  // Draw selection highlight
  if (selected) {
    drawSelectionHighlight(ctx, cam, item);
  }
}

/** Draw a Path shape using Canvas2D path commands. */
function drawShapePath(
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

  if (fill) {
    ctx.fillStyle = closed ? colorToCss(fill) : `${colorToCss(fill)}20`;
    ctx.fill();
  } else if (closed) {
    // Semi-transparent fill for closed paths even without explicit fill
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
    // Default stroke for shapes with no fill and no stroke
    ctx.strokeStyle = "#8b949e";
    ctx.lineWidth = 1.5 / cam.zoom;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

/** Draw a rectangle shape. */
function drawShapeRect(
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

  if (fill) {
    ctx.fillStyle = colorToCss(fill);
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = colorToCss(stroke);
    ctx.lineWidth = ((strokeWidth || 1) * MM_TO_PX) / cam.zoom;
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#8b949e";
    ctx.lineWidth = 1.5 / cam.zoom;
    ctx.stroke();
  }
}

/** Draw an ellipse shape. */
function drawShapeEllipse(
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

  if (fill) {
    ctx.fillStyle = colorToCss(fill);
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = colorToCss(stroke);
    ctx.lineWidth = ((strokeWidth || 1) * MM_TO_PX) / cam.zoom;
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#8b949e";
    ctx.lineWidth = 1.5 / cam.zoom;
    ctx.stroke();
  }
}

/** Draw a regular polygon shape. */
function drawShapePolygon(
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

  if (fill) {
    ctx.fillStyle = colorToCss(fill);
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = colorToCss(stroke);
    ctx.lineWidth = ((strokeWidth || 1) * MM_TO_PX) / cam.zoom;
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#8b949e";
    ctx.lineWidth = 1.5 / cam.zoom;
    ctx.stroke();
  }
}

/** Draw selection highlight around a render item. */
function drawSelectionHighlight(
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
    // Use commands to compute bounds
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
  ctx.strokeStyle = "#58a6ff";
  ctx.lineWidth = 1.5 / cam.zoom;
  ctx.setLineDash([6 / cam.zoom, 3 / cam.zoom]);
  ctx.strokeRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
  ctx.setLineDash([]);

  // Draw 8 resize handles
  const handleSize = 5 / cam.zoom;
  const handles = [
    { x: minX - pad, y: minY - pad }, // top-left
    { x: (minX + maxX) / 2, y: minY - pad }, // top-center
    { x: maxX + pad, y: minY - pad }, // top-right
    { x: maxX + pad, y: (minY + maxY) / 2 }, // middle-right
    { x: maxX + pad, y: maxY + pad }, // bottom-right
    { x: (minX + maxX) / 2, y: maxY + pad }, // bottom-center
    { x: minX - pad, y: maxY + pad }, // bottom-left
    { x: minX - pad, y: (minY + maxY) / 2 }, // middle-left
  ];

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#58a6ff";
  ctx.lineWidth = 1 / cam.zoom;
  for (const h of handles) {
    ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
  }
}

/** Draw a rubber-band shape preview during drag creation. */
function drawShapeDragPreview(
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

  ctx.strokeStyle = "#58a6ff";
  ctx.lineWidth = 1.5 / cam.zoom;
  ctx.setLineDash([6 / cam.zoom, 3 / cam.zoom]);
  ctx.fillStyle = "rgba(88, 166, 255, 0.1)";

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
function drawPenPreview(ctx: CanvasRenderingContext2D, cam: Camera, points: DesignPoint[]): void {
  if (points.length === 0) return;

  // Draw lines between points
  ctx.strokeStyle = "#58a6ff";
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

    // First point has a special highlight (click here to close)
    ctx.fillStyle = isFirst ? "#7ee787" : "#58a6ff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1 / cam.zoom;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pointRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Close indicator: if >= 3 points, draw a small circle around the start
  if (points.length >= 3) {
    const start = toCanvas(points[0]);
    ctx.strokeStyle = "#7ee787";
    ctx.lineWidth = 1.5 / cam.zoom;
    ctx.setLineDash([3 / cam.zoom, 2 / cam.zoom]);
    ctx.beginPath();
    ctx.arc(start.x, start.y, 8 / cam.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ============================================================================
// Stitch overlay drawing
// ============================================================================

/** Draw a stitch overlay (computed stitch points, not in scene graph). */
function drawStitchOverlay(
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
  ctx.fillStyle = "#7ee787";
  ctx.beginPath();
  ctx.arc(startP.x, startP.y, markerRadius, 0, Math.PI * 2);
  ctx.fill();

  // End marker — red circle
  ctx.fillStyle = "#f85149";
  ctx.beginPath();
  ctx.arc(endP.x, endP.y, markerRadius, 0, Math.PI * 2);
  ctx.fill();
}
