import { useCallback, useEffect, useRef } from "react";

import { MIN_DRAG_MM, MM_TO_PX, ZOOM_FACTOR, ZOOM_MAX, ZOOM_MIN } from "@/constants/canvas";
import type { ToolType } from "@/hooks/useTools";
import {
  CANVAS_COLORS,
  type Camera,
  clamp,
  drawAxes,
  drawGrid,
  drawPenPreview,
  drawRenderItem,
  drawShapeDragPreview,
  drawStitchOverlay,
} from "@/lib/canvas";
import type { CanvasData, DesignPoint } from "@/types/design";

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
  /** Called when the user clicks on the canvas (select tool). */
  onCanvasClick?: (event: CanvasClickEvent) => void;
  /** Called when a shape drag is completed (rect/ellipse tool). */
  onShapeDragEnd?: (startMm: DesignPoint, endMm: DesignPoint) => void;
  /** Called when pen tool clicks to add a point. */
  onPenClick?: (pointMm: DesignPoint) => void;
  /** Current pen tool points (for live preview). */
  penPoints?: DesignPoint[];
}

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
    ctx.fillStyle = CANVAS_COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // Apply camera transform
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    drawGrid(ctx, cam, width, height);
    drawAxes(ctx, cam, width, height);

    // Draw scene render items
    const data = canvasData.current;
    for (const item of data.renderItems) {
      drawRenderItem(ctx, cam, item, data.selectedIds.has(item.id));
    }

    // Draw stitch overlays
    for (const overlay of data.stitchOverlays) {
      drawStitchOverlay(ctx, cam, overlay);
    }

    // Draw shape drag preview (rubber band)
    if (isShapeDragging.current && shapeDragStart.current && shapeDragCurrent.current) {
      drawShapeDragPreview(ctx, cam, shapeDragStart.current, shapeDragCurrent.current, activeTool);
    }

    // Draw pen tool preview
    if (penPoints && penPoints.length > 0) {
      drawPenPreview(ctx, cam, penPoints);
    }

    ctx.restore();

    // Draw HUD (zoom level, camera position)
    const totalCount = data.renderItems.length + data.stitchOverlays.length;
    ctx.fillStyle = CANVAS_COLORS.hud;
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

      const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      const newZoom = clamp(cam.zoom * factor, ZOOM_MIN, ZOOM_MAX);

      // Adjust camera so the world point under the cursor stays fixed
      const worldX = cam.x + (mouseX - rect.width / 2) / cam.zoom;
      const worldY = cam.y + (mouseY - rect.height / 2) / cam.zoom;

      cam.zoom = newZoom;
      cam.x = worldX - (mouseX - rect.width / 2) / newZoom;
      cam.y = worldY - (mouseY - rect.height / 2) / newZoom;
    };

    const onMouseDown = (e: MouseEvent): void => {
      // Pan with middle-click or left-click + Alt
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
          if (onCanvasClick) {
            onCanvasClick({
              worldX: worldPt.x,
              worldY: worldPt.y,
              shiftKey: e.shiftKey,
              button: e.button,
            });
          }
        } else if (activeTool === "rect" || activeTool === "ellipse") {
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

        // Only create shape if drag was significant
        const dx = Math.abs(endPt.x - shapeDragStart.current.x);
        const dy = Math.abs(endPt.y - shapeDragStart.current.y);
        if (dx > MIN_DRAG_MM || dy > MIN_DRAG_MM) {
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
