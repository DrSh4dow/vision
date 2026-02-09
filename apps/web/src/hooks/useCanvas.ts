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

/** Canvas context-menu callback (world + screen coordinates). */
export interface CanvasContextMenuEvent {
  worldX: number;
  worldY: number;
  screenX: number;
  screenY: number;
  nodeId: number | null;
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
  /** Called to hit-test a point in world-space (mm). */
  onCanvasHitTest?: (worldX: number, worldY: number) => number | null;
  /** Called when the user requests a context menu on canvas. */
  onCanvasContextMenu?: (event: CanvasContextMenuEvent) => void;
  /** Called when a shape drag is completed (rect/ellipse tool). */
  onShapeDragEnd?: (startMm: DesignPoint, endMm: DesignPoint) => void;
  /** Called when pen tool clicks to add a point. */
  onPenClick?: (pointMm: DesignPoint) => void;
  /** Called when a select-tool drag commits node movement. */
  onSelectionDragCommit?: (nodeIds: number[], deltaMm: DesignPoint) => void;
  /** Current pen tool points (for live preview). */
  penPoints?: DesignPoint[];
  /** Reports current cursor position in world-space millimeters. */
  onCursorMove?: (pointMm: DesignPoint) => void;
  /** Reports camera changes (zoom/pan). */
  onCameraChange?: (camera: Camera) => void;
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
  onCanvasHitTest,
  onCanvasContextMenu,
  onShapeDragEnd,
  onPenClick,
  onSelectionDragCommit,
  penPoints,
  onCursorMove,
  onCameraChange,
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
  // Select-tool direct move drag state
  const isMoveDragPrimed = useRef(false);
  const isMoveDragging = useRef(false);
  const moveDragStart = useRef<DesignPoint | null>(null);
  const moveDragDelta = useRef<DesignPoint>({ x: 0, y: 0 });
  const moveDragNodeIds = useRef<number[]>([]);

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

    const movePreviewActive = isMoveDragging.current;

    // Draw scene render items
    const data = canvasData.current;
    for (const item of data.renderItems) {
      if (movePreviewActive && moveDragNodeIds.current.includes(item.id)) {
        const [a, b, c, d, tx, ty] = item.world_transform;
        const previewItem = {
          ...item,
          world_transform: [
            a,
            b,
            c,
            d,
            tx + moveDragDelta.current.x,
            ty + moveDragDelta.current.y,
          ] as [number, number, number, number, number, number],
        };
        drawRenderItem(ctx, cam, previewItem, data.selectedIds.has(item.id));
        continue;
      }
      drawRenderItem(ctx, cam, item, data.selectedIds.has(item.id));
    }

    // Draw stitch overlays (hide during direct-move preview to avoid stale mismatch)
    if (!movePreviewActive) {
      for (const overlay of data.stitchOverlays) {
        drawStitchOverlay(ctx, cam, overlay);
      }
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
      onCameraChange?.({ ...cam });
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
          const hitId = onCanvasHitTest ? onCanvasHitTest(worldPt.x, worldPt.y) : null;

          if (e.shiftKey) {
            if (onCanvasClick) {
              onCanvasClick({
                worldX: worldPt.x,
                worldY: worldPt.y,
                shiftKey: e.shiftKey,
                button: e.button,
              });
            }
            return;
          }

          if (hitId !== null) {
            const selected = canvasData.current.selectedIds;
            if (selected.has(hitId)) {
              moveDragNodeIds.current = Array.from(selected);
            } else {
              moveDragNodeIds.current = [hitId];
              if (onCanvasClick) {
                onCanvasClick({
                  worldX: worldPt.x,
                  worldY: worldPt.y,
                  shiftKey: false,
                  button: e.button,
                });
              }
            }

            isMoveDragPrimed.current = true;
            isMoveDragging.current = false;
            moveDragStart.current = worldPt;
            moveDragDelta.current = { x: 0, y: 0 };
            return;
          }

          if (onCanvasClick) {
            onCanvasClick({
              worldX: worldPt.x,
              worldY: worldPt.y,
              shiftKey: false,
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

    const onContextMenu = (e: MouseEvent): void => {
      e.preventDefault();
      const worldPt = screenToWorld(e.clientX, e.clientY);
      const hitId = onCanvasHitTest ? onCanvasHitTest(worldPt.x, worldPt.y) : null;
      onCanvasContextMenu?.({
        worldX: worldPt.x,
        worldY: worldPt.y,
        screenX: e.clientX,
        screenY: e.clientY,
        nodeId: hitId,
      });
    };

    const onMouseMove = (e: MouseEvent): void => {
      onCursorMove?.(screenToWorld(e.clientX, e.clientY));

      if (isDragging.current) {
        const cam = cameraRef.current;
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        cam.x -= dx / cam.zoom;
        cam.y -= dy / cam.zoom;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        onCameraChange?.({ ...cam });
        return;
      }

      if (isShapeDragging.current) {
        shapeDragCurrent.current = screenToWorld(e.clientX, e.clientY);
        return;
      }

      if (isMoveDragPrimed.current && moveDragStart.current) {
        const currentPt = screenToWorld(e.clientX, e.clientY);
        moveDragDelta.current = {
          x: currentPt.x - moveDragStart.current.x,
          y: currentPt.y - moveDragStart.current.y,
        };

        if (!isMoveDragging.current) {
          const dist = Math.hypot(moveDragDelta.current.x, moveDragDelta.current.y);
          if (dist > MIN_DRAG_MM) {
            isMoveDragging.current = true;
            el.style.cursor = "grabbing";
          }
        }
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
        return;
      }

      if (isMoveDragPrimed.current) {
        if (isMoveDragging.current && moveDragNodeIds.current.length > 0 && onSelectionDragCommit) {
          const delta = moveDragDelta.current;
          if (Math.abs(delta.x) > f64Epsilon || Math.abs(delta.y) > f64Epsilon) {
            onSelectionDragCommit(moveDragNodeIds.current, delta);
          }
        }
        isMoveDragPrimed.current = false;
        isMoveDragging.current = false;
        moveDragStart.current = null;
        moveDragNodeIds.current = [];
        moveDragDelta.current = { x: 0, y: 0 };
        el.style.cursor = cursorStyle;
      }
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      if (!isMoveDragPrimed.current) return;
      isMoveDragPrimed.current = false;
      isMoveDragging.current = false;
      moveDragStart.current = null;
      moveDragNodeIds.current = [];
      moveDragDelta.current = { x: 0, y: 0 };
      el.style.cursor = cursorStyle;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    onCameraChange?.({ ...cameraRef.current });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    activeTool,
    canvasData,
    cursorStyle,
    onCanvasClick,
    onCanvasHitTest,
    onCanvasContextMenu,
    onShapeDragEnd,
    onPenClick,
    onSelectionDragCommit,
    onCameraChange,
    onCursorMove,
    screenToWorld,
  ]);

  return canvasRef;
}

const f64Epsilon = 1e-9;
