import type { NodeKindData, PathCommand, VisionEngine } from "@vision/wasm-bridge";
import { useCallback, useRef, useState } from "react";

import type { DesignPoint } from "@/types/design";

export interface PenToolState {
  /** Points accumulated so far (in design-space mm). */
  points: DesignPoint[];
  /** Whether the path is currently being created. */
  isDrawing: boolean;
}

export interface UsePenToolResult {
  penState: PenToolState;
  /** Add a point to the current path. */
  addPoint: (point: DesignPoint) => void;
  /** Finish the path (open path). Called on Enter or Escape. */
  finishPath: () => void;
  /** Close the path (click near start point). */
  closePath: () => void;
  /** Cancel the current path. */
  cancelPath: () => void;
}

/** Distance threshold to close a path by clicking near the start point. */
const CLOSE_THRESHOLD_MM = 2;

export function usePenTool(
  engine: VisionEngine | null,
  refreshScene: () => void,
  selectNode: (id: number) => void,
  setActiveTool: (tool: "select") => void,
): UsePenToolResult {
  const [penState, setPenState] = useState<PenToolState>({
    points: [],
    isDrawing: false,
  });
  const pointsRef = useRef<DesignPoint[]>([]);

  const createPathNode = useCallback(
    (points: DesignPoint[], closed: boolean) => {
      if (!engine || points.length < 2) return;

      const tree = engine.sceneGetTree();
      const layerId = tree.length > 0 ? tree[0].id["0"] : undefined;

      // Build path commands
      const commands: PathCommand[] = [];
      commands.push({ MoveTo: points[0] });
      for (let i = 1; i < points.length; i++) {
        commands.push({ LineTo: points[i] });
      }
      if (closed) {
        commands.push("Close");
      }

      const kind: NodeKindData = {
        Shape: {
          shape: {
            Path: {
              commands,
              closed,
            },
          },
          fill: closed ? { r: 88, g: 166, b: 255, a: 40 } : null,
          stroke: { r: 88, g: 166, b: 255, a: 255 },
          stroke_width: 0.15,
        },
      };

      const nodeId = engine.sceneAddNode("Path", kind, layerId);
      refreshScene();
      selectNode(nodeId);
      setActiveTool("select");
    },
    [engine, refreshScene, selectNode, setActiveTool],
  );

  const addPoint = useCallback(
    (point: DesignPoint) => {
      const points = pointsRef.current;

      // Check if clicking near the start point to close the path
      if (points.length >= 3) {
        const start = points[0];
        const dx = point.x - start.x;
        const dy = point.y - start.y;
        if (Math.sqrt(dx * dx + dy * dy) < CLOSE_THRESHOLD_MM) {
          createPathNode(points, true);
          pointsRef.current = [];
          setPenState({ points: [], isDrawing: false });
          return;
        }
      }

      const newPoints = [...points, point];
      pointsRef.current = newPoints;
      setPenState({ points: newPoints, isDrawing: true });
    },
    [createPathNode],
  );

  const finishPath = useCallback(() => {
    const points = pointsRef.current;
    if (points.length >= 2) {
      createPathNode(points, false);
    }
    pointsRef.current = [];
    setPenState({ points: [], isDrawing: false });
  }, [createPathNode]);

  const closePath = useCallback(() => {
    const points = pointsRef.current;
    if (points.length >= 3) {
      createPathNode(points, true);
    }
    pointsRef.current = [];
    setPenState({ points: [], isDrawing: false });
  }, [createPathNode]);

  const cancelPath = useCallback(() => {
    pointsRef.current = [];
    setPenState({ points: [], isDrawing: false });
  }, []);

  return {
    penState,
    addPoint,
    finishPath,
    closePath,
    cancelPath,
  };
}
