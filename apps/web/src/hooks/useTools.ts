import { useCallback, useEffect, useState } from "react";

// TODO: Text tool implementation — Phase 2
/** Available tool types. */
export type ToolType = "select" | "pen" | "rect" | "ellipse" | "text";

/** Tool state and actions. */
export interface UseToolsResult {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  cursorStyle: string;
}

/** Keyboard shortcuts for tools. */
const TOOL_SHORTCUTS: Record<string, ToolType> = {
  v: "select",
  p: "pen",
  r: "rect",
  e: "ellipse",
  t: "text",
};

/** Cursor styles for each tool. */
const TOOL_CURSORS: Record<ToolType, string> = {
  select: "default",
  pen: "crosshair",
  rect: "crosshair",
  ellipse: "crosshair",
  text: "text",
};

/**
 * Hook to manage the active tool state with keyboard shortcuts.
 */
export function useTools(): UseToolsResult {
  const [activeTool, setActiveTool] = useState<ToolType>("select");

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      // Don't capture shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
      if (tool) {
        e.preventDefault();
        setActiveTool(tool);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const cursorStyle = TOOL_CURSORS[activeTool];

  return {
    activeTool,
    setActiveTool: useCallback((tool: ToolType) => setActiveTool(tool), []),
    cursorStyle,
  };
}
