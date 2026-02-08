/** Camera state for 2D canvas pan/zoom. */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Hardcoded canvas rendering colors (Canvas2D, not Tailwind). */
export const CANVAS_COLORS = {
  background: "#0d1117",
  hud: "#8b949e",
  gridMinor: "rgba(48, 54, 61, 0.4)",
  gridMajor: "rgba(48, 54, 61, 0.8)",
  axisX: "rgba(88, 166, 255, 0.5)",
  axisY: "rgba(255, 120, 100, 0.5)",
  selection: "#58a6ff",
  handleFill: "#ffffff",
  preview: "rgba(88, 166, 255, 0.1)",
  penFirst: "#7ee787",
  penPoint: "#58a6ff",
  penPointStroke: "#ffffff",
  penClose: "#7ee787",
  defaultStroke: "#8b949e",
  stitchStart: "#7ee787",
  stitchEnd: "#f85149",
} as const;
