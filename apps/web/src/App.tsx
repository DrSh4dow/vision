import type {
  ExportDesign,
  NodeKindData,
  RenderItem,
  ThreadBrand,
  ThreadColor,
  VisionEngine,
} from "@vision/wasm-bridge";
import { Circle, Download, FileUp, MousePointer2, Palette, PenTool, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { LayersPanel } from "@/components/LayersPanel";
import { PropertiesPanel } from "@/components/PropertiesPanel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CanvasClickEvent } from "@/hooks/useCanvas";
import { useCanvas } from "@/hooks/useCanvas";
import { useEngine } from "@/hooks/useEngine";
import { usePenTool } from "@/hooks/usePenTool";
import { useSelection } from "@/hooks/useSelection";
import { useTools } from "@/hooks/useTools";
import type { CanvasData, DesignPoint, ParsedVectorPath } from "@/types/design";

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
      if (hitId >= 0) {
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

      // Get the default layer
      const tree = engine.sceneGetTree();
      const layerId = tree.length > 0 ? tree[0].id["0"] : undefined;

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
            fill: { r: 88, g: 166, b: 255, a: 60 },
            stroke: { r: 88, g: 166, b: 255, a: 255 },
            stroke_width: 0.15,
          },
        };
        name = "Rectangle";
      } else {
        kind = {
          Shape: {
            shape: { Ellipse: { rx: w / 2, ry: h / 2 } },
            fill: { r: 249, g: 117, b: 131, a: 60 },
            stroke: { r: 249, g: 117, b: 131, a: 255 },
            stroke_width: 0.15,
          },
        };
        name = "Ellipse";
      }

      const nodeId = engine.sceneAddNode(name, kind, layerId);

      // Position the shape at the drag start point
      if (activeTool === "rect") {
        engine.sceneUpdateTransform(nodeId, {
          x: minX,
          y: minY,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        });
      } else {
        // Ellipse is centered at origin, so position at center of drag
        engine.sceneUpdateTransform(nodeId, {
          x: minX + w / 2,
          y: minY + h / 2,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        });
      }

      refreshScene();
      selectNode(nodeId);

      // Switch back to select tool after creating a shape
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
    engine,
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

    // Create a default layer
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
        {/* ── Top bar ─────────────────────────────────────────────── */}
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
                <Separator orientation="vertical" className="!h-4 !bg-border/40" />
                <ImportExportActions engine={engine} refreshScene={refreshScene} />
              </>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground/70" data-testid="engine-status">
            {statusText}
          </span>
        </header>

        {/* ── Workspace ───────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — Layers */}
          <aside
            className="panel-scroll flex w-56 shrink-0 flex-col overflow-y-auto border-r border-border/40 bg-panel"
            data-testid="panel-left"
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
                <p className="px-1.5 text-xs italic text-muted-foreground/60">No layers yet</p>
              )}
            </div>
          </aside>

          {/* Canvas + floating toolbar */}
          <main className="relative flex-1 overflow-hidden">
            <canvas ref={canvasRef} className="block h-full w-full" data-testid="design-canvas" />

            {/* ── Floating Toolbar ─────────────────────────────────── */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center pt-3">
              <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-border/30 bg-card/80 px-1.5 py-1 shadow-2xl shadow-black/50 backdrop-blur-xl">
                <ToolButton
                  icon={<MousePointer2 className="!size-[15px]" />}
                  label="Select"
                  shortcut="V"
                  active={activeTool === "select"}
                  onClick={() => setActiveTool("select")}
                />
                <Separator orientation="vertical" className="!mx-0.5 !h-5 !bg-border/30" />
                <ToolButton
                  icon={<PenTool className="!size-[15px]" />}
                  label="Pen"
                  shortcut="P"
                  active={activeTool === "pen"}
                  onClick={() => setActiveTool("pen")}
                />
                <ToolButton
                  icon={<Square className="!size-[15px]" />}
                  label="Rect"
                  shortcut="R"
                  active={activeTool === "rect"}
                  onClick={() => setActiveTool("rect")}
                />
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
                <p className="text-xs italic text-muted-foreground/60">Select an object</p>
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

// ============================================================================
// Section Header
// ============================================================================

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="px-3 pt-3 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
      {children}
    </h3>
  );
}

// ============================================================================
// Tool Button (floating toolbar)
// ============================================================================

function ToolButton({
  icon,
  label,
  shortcut,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "default" : "ghost"}
          size="icon"
          title={label}
          className={
            active
              ? "h-8 w-8 rounded-lg shadow-sm shadow-primary/20 ring-1 ring-primary/20"
              : "h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          }
          onClick={onClick}
        >
          {icon}
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}{" "}
        <kbd className="ml-1.5 rounded bg-muted/80 px-1.5 py-0.5 text-[10px] font-mono">
          {shortcut}
        </kbd>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Import / Export Actions (top bar — icon only)
// ============================================================================

function ImportExportActions({
  engine,
  refreshScene,
}: {
  engine: VisionEngine;
  refreshScene: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSvgImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result;
        if (typeof content !== "string") return;

        const paths = engine.importSvgDocument(content) as ParsedVectorPath[];

        // Get the default layer (first root node)
        const tree = engine.sceneGetTree();
        const layerId = tree.length > 0 ? tree[0].id["0"] : undefined;

        // Add each imported path as a scene node
        const colors = [
          { r: 210, g: 168, b: 255, a: 255 },
          { r: 240, g: 136, b: 62, a: 255 },
          { r: 88, g: 166, b: 255, a: 255 },
          { r: 126, g: 231, b: 135, a: 255 },
          { r: 249, g: 117, b: 131, a: 255 },
        ];

        for (let i = 0; i < paths.length; i++) {
          const p = paths[i];
          const color = colors[i % colors.length];
          const kind: NodeKindData = {
            Shape: {
              shape: { Path: { commands: p.commands, closed: p.closed } },
              fill: p.closed ? { ...color, a: 50 } : null,
              stroke: color,
              stroke_width: 0.2,
            },
          };
          engine.sceneAddNode(`Imported Path ${i + 1}`, kind, layerId);
        }

        refreshScene();
      };
      reader.readAsText(file);

      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [engine, refreshScene],
  );

  const handleExportDst = useCallback(() => {
    const design = createDemoDesign();
    const data = engine.exportDst(design);
    downloadFile(data, "design.dst", "application/octet-stream");
  }, [engine]);

  const handleExportPes = useCallback(() => {
    const design = createDemoDesign();
    const data = engine.exportPes(design);
    downloadFile(data, "design.pes", "application/octet-stream");
  }, [engine]);

  return (
    <div className="flex items-center gap-0.5">
      <input
        ref={fileInputRef}
        type="file"
        accept=".svg"
        className="hidden"
        onChange={handleFileChange}
        data-testid="svg-file-input"
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleSvgImport}
            data-testid="import-svg-btn"
          >
            <FileUp className="!size-3.5" />
            <span className="sr-only">Import SVG</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Import SVG</TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" className="!mx-0.5 !h-3.5 !bg-border/30" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={handleExportDst}
            data-testid="export-dst-btn"
          >
            <Download className="!size-3" />
            DST
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export DST (Tajima)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={handleExportPes}
            data-testid="export-pes-btn"
          >
            <Download className="!size-3" />
            PES
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export PES (Brother)</TooltipContent>
      </Tooltip>
    </div>
  );
}

// ============================================================================
// Thread Palette Panel
// ============================================================================

function ThreadPalettePanel({ engine }: { engine: VisionEngine }) {
  const [palette, setPalette] = useState<ThreadColor[]>([]);
  const [activeBrand, setActiveBrand] = useState<ThreadBrand | null>(null);

  const loadPalette = useCallback(
    (brand: ThreadBrand) => {
      const colors = engine.getThreadPalette(brand);
      setPalette(colors.slice(0, 24));
      setActiveBrand(brand);
    },
    [engine],
  );

  return (
    <div className="flex flex-col gap-2.5" data-testid="thread-palette">
      <div className="flex gap-1">
        {(["madeira", "isacord", "sulky"] as const).map((brand) => (
          <Button
            key={brand}
            variant={activeBrand === brand ? "default" : "ghost"}
            size="sm"
            onClick={() => loadPalette(brand)}
            className={
              activeBrand === brand
                ? "h-7 flex-1 text-[10px] capitalize"
                : "h-7 flex-1 text-[10px] capitalize text-muted-foreground hover:text-foreground"
            }
            data-testid={`thread-brand-${brand}`}
          >
            {brand}
          </Button>
        ))}
      </div>
      {palette.length > 0 && (
        <div className="grid grid-cols-6 gap-1" data-testid="thread-swatches">
          {palette.map((thread, i) => (
            <Tooltip key={`${thread.code}-${i}`}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="aspect-square rounded-md border border-border/40 transition-all hover:scale-110 hover:ring-1 hover:ring-primary/30"
                  style={{
                    backgroundColor: `rgb(${thread.r}, ${thread.g}, ${thread.b})`,
                  }}
                  data-testid={`thread-swatch-${i}`}
                />
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">
                <span className="font-medium">{thread.name}</span>
                <br />
                <span className="text-muted-foreground">{thread.code}</span>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}
      {activeBrand && (
        <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
          <Palette className="h-3 w-3" />
          {palette.length} colors shown
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/** Create a simple demo design for export testing. */
function createDemoDesign(): ExportDesign {
  return {
    name: "demo",
    stitches: [
      { x: 0, y: 0, stitch_type: "Normal" },
      { x: 3, y: 0, stitch_type: "Normal" },
      { x: 6, y: 0, stitch_type: "Normal" },
      { x: 9, y: 0, stitch_type: "Normal" },
      { x: 12, y: 0, stitch_type: "Normal" },
      { x: 12, y: 3, stitch_type: "Normal" },
      { x: 12, y: 6, stitch_type: "Normal" },
      { x: 9, y: 6, stitch_type: "Normal" },
      { x: 6, y: 6, stitch_type: "Normal" },
      { x: 3, y: 6, stitch_type: "Normal" },
      { x: 0, y: 6, stitch_type: "Normal" },
      { x: 0, y: 3, stitch_type: "Normal" },
    ],
    colors: [{ r: 255, g: 0, b: 0, a: 255 }],
  };
}

/** Trigger a browser file download from binary data. */
function downloadFile(data: Uint8Array, filename: string, mimeType: string): void {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
