import { useCallback, useEffect, useRef } from "react";

/** Camera state for 2D canvas pan/zoom. */
interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Options for the canvas hook. */
interface UseCanvasOptions {
  /** Whether the engine is ready (triggers initial render). */
  ready: boolean;
}

/**
 * Hook to manage a 2D canvas with pan/zoom and grid rendering.
 *
 * Returns a ref to attach to a `<canvas>` element. Handles:
 * - DPI-aware sizing via ResizeObserver
 * - Infinite grid rendering with zoom-adaptive spacing
 * - Pan (middle-click or Space+drag) and zoom (mouse wheel)
 * - Origin axes highlighting
 */
export function useCanvas({ ready }: UseCanvasOptions): React.RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const rafRef = useRef<number>(0);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

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

    ctx.restore();

    // Draw HUD (zoom level, camera position)
    ctx.fillStyle = "#8b949e";
    ctx.font = "11px -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      `Zoom: ${(cam.zoom * 100).toFixed(0)}%  |  ${cam.x.toFixed(1)}, ${cam.y.toFixed(1)}`,
      8,
      height - 8,
    );
  }, []);

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

  // Mouse event handlers for pan and zoom
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
      // Pan with middle-click or left-click + Alt
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        e.preventDefault();
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        el.style.cursor = "grabbing";
      }
    };

    const onMouseMove = (e: MouseEvent): void => {
      if (!isDragging.current) return;
      const cam = cameraRef.current;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      cam.x -= dx / cam.zoom;
      cam.y -= dy / cam.zoom;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = (): void => {
      if (isDragging.current) {
        isDragging.current = false;
        el.style.cursor = "";
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
  }, []);

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
