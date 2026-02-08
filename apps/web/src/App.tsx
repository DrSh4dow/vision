import type { NodeKindData, RenderItem } from "@vision/wasm-bridge";
import { Circle, MousePointer2, PenTool, Square } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { ImportExportActions } from "@/components/ImportExportActions";
import { LayersPanel } from "@/components/LayersPanel";
import { PropertiesPanel } from "@/components/PropertiesPanel";
import { ThreadPalettePanel } from "@/components/ThreadPalettePanel";
import { ToolButton } from "@/components/ToolButton";
import { SectionHeader } from "@/components/ui/section-header";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ELLIPSE_FILL, ELLIPSE_STROKE, RECT_FILL, RECT_STROKE } from "@/constants/colors";
import type { CanvasClickEvent } from "@/hooks/useCanvas";
import { useCanvas } from "@/hooks/useCanvas";
import { useEngine } from "@/hooks/useEngine";
import { usePenTool } from "@/hooks/usePenTool";
import { useSelection } from "@/hooks/useSelection";
import { useTools } from "@/hooks/useTools";
import type { CanvasData, DesignPoint } from "@/types/design";

export function App() {
  const { engine, loading, error, version } = useEngine();
  const { activeTool, setActiveTool, cursorStyle } = useTools();

  // Canvas data: scene render items + stitch overlays
  const canvasDataRef = useRef<CanvasData>({
    renderItems: [],
    stitchOverlays: [],
    selectedIds: new Set(),
  });

  /** Refresh the render list from the scene graph. */
  const refreshScene = useCallback(() => {
    if (!engine) return;
    const items: RenderItem[] = engine.sceneGetRenderList();
    canvasDataRef.current = {
      ...canvasDataRef.current,
      renderItems: items,
    };
  }, [engine]);

  const { selectedIds, selectNode, deselectAll } = useSelection(engine, refreshScene);
  const { penState, addPoint, finishPath, cancelPath } = usePenTool(
    engine,
    refreshScene,
    selectNode,
    setActiveTool,
  );

  // Pen tool keyboard handlers (Enter = finish, Escape = cancel)
  useEffect(() => {
    if (activeTool !== "pen") return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Enter") {
        e.preventDefault();
        finishPath();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelPath();
        setActiveTool("select");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTool, finishPath, cancelPath, setActiveTool]);

  // Sync selected IDs into canvas data ref
  useEffect(() => {
    canvasDataRef.current = {
      ...canvasDataRef.current,
      selectedIds,
    };
  }, [selectedIds]);

  /** Handle canvas click (select tool). */
  const handleCanvasClick = useCallback(
    (event: CanvasClickEvent) => {
      if (!engine) return;
      const hitId = engine.sceneHitTest(event.worldX, event.worldY);
      if (hitId !== null) {
        selectNode(hitId, event.shiftKey);
      } else {
        deselectAll();
      }
    },
    [engine, selectNode, deselectAll],
  );

  /** Handle shape drag end (rect/ellipse tool). */
  const handleShapeDragEnd = useCallback(
    (startMm: DesignPoint, endMm: DesignPoint) => {
      if (!engine) return;

      const tree = engine.sceneGetTree();
      const layerId = tree.length > 0 ? tree[0].id : undefined;

      const minX = Math.min(startMm.x, endMm.x);
      const minY = Math.min(startMm.y, endMm.y);
      const w = Math.abs(endMm.x - startMm.x);
      const h = Math.abs(endMm.y - startMm.y);

      let kind: NodeKindData;
      let name: string;

      if (activeTool === "rect") {
        kind = {
          Shape: {
            shape: { Rect: { width: w, height: h, corner_radius: 0 } },
            fill: RECT_FILL,
            stroke: RECT_STROKE,
            stroke_width: 0.15,
          },
        };
        name = "Rectangle";
      } else {
        kind = {
          Shape: {
            shape: { Ellipse: { rx: w / 2, ry: h / 2 } },
            fill: ELLIPSE_FILL,
            stroke: ELLIPSE_STROKE,
            stroke_width: 0.15,
          },
        };
        name = "Ellipse";
      }

      const transform =
        activeTool === "rect"
          ? {
              x: minX,
              y: minY,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
            }
          : {
              x: minX + w / 2,
              y: minY + h / 2,
              rotation: 0,
              scaleX: 1,
              scaleY: 1,
            };

      const nodeId = engine.sceneAddNodeWithTransform(name, kind, transform, layerId);

      refreshScene();
      selectNode(nodeId);
      setActiveTool("select");
    },
    [engine, activeTool, refreshScene, selectNode, setActiveTool],
  );

  /** Handle pen tool click. */
  const handlePenClick = useCallback(
    (pointMm: DesignPoint) => {
      addPoint(pointMm);
    },
    [addPoint],
  );

  const canvasRef = useCanvas({
    ready: !loading && !error,
    canvasData: canvasDataRef,
    activeTool,
    cursorStyle,
    onCanvasClick: handleCanvasClick,
    onShapeDragEnd: handleShapeDragEnd,
    onPenClick: handlePenClick,
    penPoints: penState.points,
  });

  // Track if scene has been initialized
  const sceneInitRef = useRef(false);

  // Initialize scene graph when engine is ready
  useEffect(() => {
    if (!engine || sceneInitRef.current) return;
    sceneInitRef.current = true;
    engine.sceneCreate();

    engine.sceneAddNode("Layer 1", {
      Layer: { name: "Layer 1", visible: true, locked: false },
    });
  }, [engine]);

  const statusText = error
    ? `Error: ${error}`
    : loading
      ? "Loading WASM engine..."
      : `Engine v${version}`;

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col bg-background">
        {/* Top bar */}
        <header className="flex h-9 shrink-0 items-center justify-between border-b border-border/40 bg-panel px-3">
          <div className="flex items-center gap-2.5">
            <span
              className="text-[13px] font-semibold tracking-wide text-foreground"
              data-testid="toolbar-brand"
            >
              Vision
            </span>
            {engine && (
              <>
                <Separator orientation="vertical" className="h-4 bg-border/40" />
                <ImportExportActions engine={engine} refreshScene={refreshScene} />
              </>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground/80" data-testid="engine-status">
            {statusText}
          </span>
        </header>

        {/* Workspace */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — Layers */}
          <aside
            className="panel-scroll flex w-56 shrink-0 flex-col overflow-y-auto border-r border-border/40 bg-panel"
            data-testid="panel-left"
            aria-label="Layers"
          >
            <SectionHeader>Layers</SectionHeader>
            <div className="flex-1 px-1.5 pb-3">
              {engine ? (
                <LayersPanel
                  engine={engine}
                  selectedIds={selectedIds}
                  onSelectNode={selectNode}
                  onRefreshScene={refreshScene}
                />
              ) : (
                <p className="px-1.5 text-xs italic text-muted-foreground/80">No layers yet</p>
              )}
            </div>
          </aside>

          {/* Canvas + floating toolbar */}
          <main className="relative flex-1 overflow-hidden">
            <div role="application" aria-label="Design canvas" className="h-full w-full">
              <canvas ref={canvasRef} className="block h-full w-full" data-testid="design-canvas" />
            </div>

            {/* Floating Toolbar */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-3">
              <div
                role="toolbar"
                aria-label="Drawing tools"
                className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-border/30 bg-card/80 px-1.5 py-1 shadow-2xl shadow-black/50 backdrop-blur-xl"
              >
                {/* !size-[15px]: overrides Button's [&_svg]:size-4 default */}
                <ToolButton
                  icon={<MousePointer2 className="!size-[15px]" />}
                  label="Select"
                  shortcut="V"
                  active={activeTool === "select"}
                  onClick={() => setActiveTool("select")}
                />
                <Separator orientation="vertical" className="mx-0.5 h-5 bg-border/30" />
                {/* !size-[15px]: overrides Button's [&_svg]:size-4 default */}
                <ToolButton
                  icon={<PenTool className="!size-[15px]" />}
                  label="Pen"
                  shortcut="P"
                  active={activeTool === "pen"}
                  onClick={() => setActiveTool("pen")}
                />
                {/* !size-[15px]: overrides Button's [&_svg]:size-4 default */}
                <ToolButton
                  icon={<Square className="!size-[15px]" />}
                  label="Rect"
                  shortcut="R"
                  active={activeTool === "rect"}
                  onClick={() => setActiveTool("rect")}
                />
                {/* !size-[15px]: overrides Button's [&_svg]:size-4 default */}
                <ToolButton
                  icon={<Circle className="!size-[15px]" />}
                  label="Ellipse"
                  shortcut="E"
                  active={activeTool === "ellipse"}
                  onClick={() => setActiveTool("ellipse")}
                />
              </div>
            </div>
          </main>

          {/* Right panel — Properties + Thread Palette */}
          <aside
            className="panel-scroll flex w-56 shrink-0 flex-col overflow-y-auto border-l border-border/40 bg-panel"
            data-testid="panel-right"
            aria-label="Properties"
          >
            <SectionHeader>Properties</SectionHeader>
            <div className="px-3 pb-2">
              {engine ? (
                <PropertiesPanel
                  engine={engine}
                  selectedIds={selectedIds}
                  onRefreshScene={refreshScene}
                />
              ) : (
                <p className="text-xs italic text-muted-foreground/80">Select an object</p>
              )}
            </div>

            <div className="mx-3 border-t border-border/50" />

            {engine && (
              <>
                <SectionHeader>Thread Palette</SectionHeader>
                <div className="px-3 pb-3">
                  <ThreadPalettePanel engine={engine} />
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}
