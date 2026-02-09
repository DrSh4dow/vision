import type {
  NodeKindData,
  RenderItem,
  RoutingOptions,
  SimulationTimeline,
  StitchParams,
} from "@vision/wasm-bridge";
import { Circle, MousePointer2, PenTool, Square, Type } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { DiagnosticsPanel } from "@/components/DiagnosticsPanel";
import { ImportExportActions } from "@/components/ImportExportActions";
import { PropertiesPanel } from "@/components/PropertiesPanel";
import { SequencerPanel } from "@/components/SequencerPanel";
import { ThreadPalettePanel } from "@/components/ThreadPalettePanel";
import { ToolButton } from "@/components/ToolButton";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ELLIPSE_FILL, ELLIPSE_STROKE, RECT_FILL, RECT_STROKE } from "@/constants/colors";
import { DEFAULT_STITCH_LENGTH, DEFAULT_STITCH_PARAMS } from "@/constants/embroidery";
import type { CanvasClickEvent } from "@/hooks/useCanvas";
import { useCanvas } from "@/hooks/useCanvas";
import { useEngine } from "@/hooks/useEngine";
import { usePenTool } from "@/hooks/usePenTool";
import { useSelection } from "@/hooks/useSelection";
import { useTools } from "@/hooks/useTools";
import type { CanvasData, DesignPoint } from "@/types/design";

const FALLBACK_ROUTING_OPTIONS: RoutingOptions = {
  policy: "balanced",
  max_jump_mm: 25,
  trim_threshold_mm: 12,
  preserve_color_order: true,
  preserve_layer_order: false,
  allow_reverse: true,
  allow_color_merge: false,
  allow_underpath: true,
  entry_exit_mode: "auto",
  tie_mode: "shape_start_end",
  min_stitch_run_before_trim_mm: 2,
  sequence_mode: "strict_sequencer",
};

const PREVIEW_ROUTING_OVERRIDES: Pick<RoutingOptions, "sequence_mode"> = {
  sequence_mode: "strict_sequencer",
};

const MENU_BAR_ITEMS = ["File", "Edit", "View", "Design", "Routing", "Help"] as const;
type MenuBarItem = (typeof MENU_BAR_ITEMS)[number];
type MenuId = Lowercase<MenuBarItem>;

interface MenuEntry {
  label: string;
  shortcut: string;
  submenu?: MenuEntry[];
}

const MENU_ENTRIES: Record<MenuId, MenuEntry[]> = {
  file: [
    { label: "New", shortcut: "Ctrl+N" },
    { label: "Open", shortcut: "Ctrl+O" },
    { label: "Import SVG", shortcut: "Ctrl+Shift+O" },
    { label: "Import Bitmap", shortcut: "Ctrl+Shift+B" },
    {
      label: "Export",
      shortcut: "Ctrl+E",
      submenu: [
        { label: "DST", shortcut: "Alt+1" },
        { label: "PES", shortcut: "Alt+2" },
        { label: "PEC", shortcut: "Alt+3" },
        { label: "JEF", shortcut: "Alt+4" },
        { label: "EXP", shortcut: "Alt+5" },
        { label: "VP3", shortcut: "Alt+6" },
        { label: "HUS", shortcut: "Alt+7" },
        { label: "XXX", shortcut: "Alt+8" },
      ],
    },
    { label: "Export Production Worksheet", shortcut: "Ctrl+Shift+P" },
    { label: "Save Project", shortcut: "Ctrl+S" },
    { label: "Recent Files", shortcut: "Ctrl+R" },
  ],
  edit: [
    { label: "Undo", shortcut: "Ctrl+Z" },
    { label: "Redo", shortcut: "Ctrl+Shift+Z" },
    { label: "Cut", shortcut: "Ctrl+X" },
    { label: "Copy", shortcut: "Ctrl+C" },
    { label: "Paste", shortcut: "Ctrl+V" },
    { label: "Duplicate", shortcut: "Ctrl+D" },
    { label: "Delete", shortcut: "Del" },
    { label: "Select All", shortcut: "Ctrl+A" },
  ],
  view: [
    { label: "Zoom In", shortcut: "Ctrl++" },
    { label: "Zoom Out", shortcut: "Ctrl+-" },
    { label: "Zoom to Fit", shortcut: "Ctrl+0" },
    { label: "Zoom to Selection", shortcut: "Ctrl+1" },
    { label: "Toggle Grid", shortcut: "Ctrl+G" },
    { label: "Toggle Snap", shortcut: "Ctrl+Shift+G" },
    { label: "Toggle Stitch Preview", shortcut: "Ctrl+Shift+P" },
    {
      label: "Simulation Mode",
      shortcut: "Ctrl+M",
      submenu: [
        { label: "Fast", shortcut: "Ctrl+Alt+F" },
        { label: "Quality", shortcut: "Ctrl+Alt+Q" },
      ],
    },
    { label: "Toggle Diagnostics Panel", shortcut: "Ctrl+Shift+D" },
    { label: "Toggle Design Inspector", shortcut: "Ctrl+Shift+I" },
  ],
  design: [
    {
      label: "Stitch Type",
      shortcut: "Ctrl+T",
      submenu: [
        { label: "Running", shortcut: "Ctrl+Alt+R" },
        { label: "Satin", shortcut: "Ctrl+Alt+S" },
        { label: "Tatami", shortcut: "Ctrl+Alt+T" },
        { label: "Contour", shortcut: "Ctrl+Alt+C" },
        { label: "Spiral", shortcut: "Ctrl+Alt+P" },
        { label: "Motif", shortcut: "Ctrl+Alt+M" },
      ],
    },
    { label: "Assign Thread Color", shortcut: "Ctrl+Shift+C" },
    { label: "Auto-Digitize Selection", shortcut: "Ctrl+Shift+A" },
    { label: "Validate Design", shortcut: "Ctrl+Shift+V" },
    { label: "Repair Geometry", shortcut: "Ctrl+Shift+R" },
  ],
  routing: [
    {
      label: "Routing Policy",
      shortcut: "Ctrl+Shift+P",
      submenu: [
        { label: "Balanced", shortcut: "Ctrl+Alt+B" },
        { label: "Min Travel", shortcut: "Ctrl+Alt+T" },
        { label: "Min Trims", shortcut: "Ctrl+Alt+M" },
      ],
    },
    {
      label: "Sequence Mode",
      shortcut: "Ctrl+Shift+M",
      submenu: [
        { label: "Strict Sequencer", shortcut: "Ctrl+Alt+S" },
        { label: "Optimizer", shortcut: "Ctrl+Alt+O" },
      ],
    },
    { label: "Global Tie Mode", shortcut: "Ctrl+Shift+T" },
    { label: "Allow Reverse", shortcut: "Ctrl+Shift+R" },
    { label: "Open Full Routing Settings", shortcut: "Ctrl+Shift+F" },
  ],
  help: [
    { label: "Keyboard Shortcuts", shortcut: "Ctrl+/" },
    { label: "Documentation", shortcut: "F1" },
    { label: "About Vision", shortcut: "Ctrl+I" },
  ],
};

function colorToCss(color: { r: number; g: number; b: number }): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function toTestSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type SimulationPreviewMode = "fast" | "quality";

function buildStitchOverlays(
  timeline: SimulationTimeline,
  playhead: number,
  previewMode: SimulationPreviewMode,
): CanvasData["stitchOverlays"] {
  if (timeline.stitches.length === 0 || timeline.segments.length === 0) {
    return [];
  }

  return timeline.segments
    .map((segment) => {
      const start = Math.max(0, segment.start_stitch_index);
      const end = Math.min(timeline.stitches.length - 1, segment.end_stitch_index);
      const stitches = timeline.stitches.slice(start, end + 1);
      const points = stitches.map((stitch) => ({ x: stitch.x, y: stitch.y }));
      const commands = stitches.map((stitch) => stitch.stitch_type);
      if (points.length <= 1) {
        return null;
      }
      return {
        id: `stitch-${segment.color_index}-${start}`,
        label: `Thread ${segment.color_index + 1}`,
        points,
        commands,
        color: colorToCss(segment.color),
        showDots: previewMode === "fast",
        simulateThread: previewMode === "quality",
        threadWidthMm: previewMode === "quality" ? 0.38 : 0.26,
        playhead: Math.max(-1, playhead - start),
      };
    })
    .filter((overlay): overlay is NonNullable<typeof overlay> => overlay !== null);
}

export function App() {
  const { engine, loading, error, version } = useEngine();
  const { activeTool, setActiveTool, cursorStyle } = useTools();
  const [showThreadPreview, setShowThreadPreview] = useState(true);
  const [playbackEnabled, setPlaybackEnabled] = useState(false);
  const [playbackTick, setPlaybackTick] = useState(0);
  const [simulationMode, setSimulationMode] = useState<SimulationPreviewMode>("quality");
  const [routingOptions, setRoutingOptions] = useState<RoutingOptions>(FALLBACK_ROUTING_OPTIONS);
  const [defaultStitchParams, setDefaultStitchParams] =
    useState<StitchParams>(DEFAULT_STITCH_PARAMS);
  const [cursorPositionMm, setCursorPositionMm] = useState<DesignPoint>({ x: 0, y: 0 });
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [statusSummary, setStatusSummary] = useState({
    objectCount: 0,
    stitchCount: 0,
    colorCount: 0,
  });
  const defaultsLoadedRef = useRef(false);
  const menuBarRef = useRef<HTMLElement | null>(null);
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null);
  const closeMenus = useCallback(() => {
    setOpenMenu(null);
    setOpenSubmenuIndex(null);
  }, []);
  const toggleMenu = useCallback((menuId: MenuId) => {
    setOpenSubmenuIndex(null);
    setOpenMenu((current) => (current === menuId ? null : menuId));
  }, []);

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
    let stitchOverlays = canvasDataRef.current.stitchOverlays;
    if (showThreadPreview) {
      try {
        const timeline = engine.sceneSimulationTimelineWithOptions(
          DEFAULT_STITCH_LENGTH,
          routingOptions,
        );
        const totalSteps = Math.max(1, timeline.total_steps);
        const playhead = playbackEnabled ? playbackTick % totalSteps : totalSteps - 1;
        stitchOverlays = buildStitchOverlays(timeline, playhead, simulationMode);
      } catch (_err) {
        stitchOverlays = [];
      }
    } else {
      stitchOverlays = [];
    }

    canvasDataRef.current = {
      ...canvasDataRef.current,
      renderItems: items,
      stitchOverlays,
    };

    const nextSummary = {
      objectCount: items.length,
      stitchCount: stitchOverlays.reduce((total, overlay) => total + overlay.points.length, 0),
      colorCount: new Set(stitchOverlays.map((overlay) => overlay.color)).size,
    };
    setStatusSummary((prev) =>
      prev.objectCount === nextSummary.objectCount &&
      prev.stitchCount === nextSummary.stitchCount &&
      prev.colorCount === nextSummary.colorCount
        ? prev
        : nextSummary,
    );
  }, [engine, playbackEnabled, playbackTick, routingOptions, showThreadPreview, simulationMode]);

  const { selectedIds, selectNode, deselectAll } = useSelection(engine, refreshScene);
  const { penState, addPoint, finishPath, cancelPath } = usePenTool(
    engine,
    refreshScene,
    selectNode,
    setActiveTool,
    defaultStitchParams,
  );

  useEffect(() => {
    if (!engine || defaultsLoadedRef.current) return;
    defaultsLoadedRef.current = true;

    try {
      const routingDefaults = engine.engineDefaultRoutingOptions();
      setRoutingOptions({
        ...routingDefaults,
        ...PREVIEW_ROUTING_OVERRIDES,
      });
    } catch (err) {
      console.warn("[vision] Failed to load routing defaults from engine", err);
    }

    try {
      setDefaultStitchParams(engine.engineDefaultStitchParams());
    } catch (err) {
      console.warn("[vision] Failed to load stitch defaults from engine", err);
    }
  }, [engine]);

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

  useEffect(() => {
    if (!playbackEnabled) return;
    const id = window.setInterval(() => {
      setPlaybackTick((prev) => prev + 1);
    }, 32);
    return () => window.clearInterval(id);
  }, [playbackEnabled]);

  useEffect(() => {
    refreshScene();
  }, [refreshScene]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      const menuRoot = menuBarRef.current;
      if (!menuRoot) return;
      if (!menuRoot.contains(event.target as Node)) {
        closeMenus();
      }
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        closeMenus();
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenus]);

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

  const handleCanvasHitTest = useCallback(
    (worldX: number, worldY: number) => {
      if (!engine) return null;
      return engine.sceneHitTest(worldX, worldY);
    },
    [engine],
  );

  const handleSelectionDragCommit = useCallback(
    (nodeIds: number[], deltaMm: DesignPoint) => {
      if (!engine) return;
      if (Math.abs(deltaMm.x) < 1e-9 && Math.abs(deltaMm.y) < 1e-9) return;

      for (const id of nodeIds) {
        const node = engine.sceneGetNode(id);
        if (!node) continue;
        if (typeof node.kind === "string" || !("Shape" in node.kind)) continue;

        engine.sceneUpdateTransform(id, {
          x: node.transform.x + deltaMm.x,
          y: node.transform.y + deltaMm.y,
          rotation: node.transform.rotation,
          scaleX: node.transform.scale_x,
          scaleY: node.transform.scale_y,
        });
      }

      refreshScene();
    },
    [engine, refreshScene],
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
            stitch: { ...defaultStitchParams },
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
            stitch: { ...defaultStitchParams },
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
    [engine, activeTool, refreshScene, selectNode, setActiveTool, defaultStitchParams],
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
    onCanvasHitTest: handleCanvasHitTest,
    onSelectionDragCommit: handleSelectionDragCommit,
    onShapeDragEnd: handleShapeDragEnd,
    onPenClick: handlePenClick,
    onCursorMove: setCursorPositionMm,
    onCameraChange: (camera) => setCanvasZoom(camera.zoom),
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
        {/* Top menu bar */}
        <header
          className="flex h-8 shrink-0 items-center border-b border-border/40 bg-panel px-3"
          data-testid="menu-bar"
        >
          <nav
            ref={menuBarRef}
            className="flex items-center text-[12px] font-medium text-foreground/90"
            aria-label="Main menu"
          >
            {MENU_BAR_ITEMS.map((item, index) => {
              const menuId = item.toLowerCase() as MenuId;
              const isOpen = openMenu === menuId;
              const entries = MENU_ENTRIES[menuId];

              return (
                <div key={item} className="relative flex items-center">
                  <button
                    type="button"
                    className={`rounded-sm px-2 py-1 hover:bg-accent/40 ${
                      isOpen ? "bg-accent/40" : ""
                    }`}
                    onClick={() => toggleMenu(menuId)}
                    data-testid={`menu-${menuId}`}
                    aria-expanded={isOpen}
                    aria-haspopup="menu"
                  >
                    {item}
                  </button>

                  {isOpen && (
                    <div
                      className="absolute top-full left-0 z-50 mt-1 min-w-[260px] rounded-md border border-border/60 bg-popover p-1 shadow-2xl"
                      role="menu"
                      data-testid={`menu-${menuId}-panel`}
                    >
                      {entries.map((entry, entryIndex) => {
                        const itemSlug = toTestSlug(entry.label);
                        const itemTestId = `menu-${menuId}-item-${itemSlug}`;
                        const hasSubmenu = entry.submenu !== undefined;
                        const submenuOpen = openSubmenuIndex === entryIndex;

                        return (
                          <div key={entry.label} className="relative">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-4 rounded-sm px-2 py-1 text-left text-xs text-foreground hover:bg-accent/40"
                              onMouseEnter={() =>
                                setOpenSubmenuIndex(hasSubmenu ? entryIndex : null)
                              }
                              onClick={() => {
                                if (hasSubmenu) {
                                  setOpenSubmenuIndex((current) =>
                                    current === entryIndex ? null : entryIndex,
                                  );
                                  return;
                                }
                                closeMenus();
                              }}
                              data-testid={itemTestId}
                            >
                              <span>{entry.label}</span>
                              <span className="flex items-center gap-2 text-[10px] text-muted-foreground/80">
                                <span data-testid={`${itemTestId}-shortcut`}>{entry.shortcut}</span>
                                {hasSubmenu && (
                                  <span aria-hidden="true" className="text-muted-foreground/70">
                                    ›
                                  </span>
                                )}
                              </span>
                            </button>

                            {hasSubmenu && submenuOpen && (
                              <div
                                className="absolute top-0 left-full z-50 ml-1 min-w-[180px] rounded-md border border-border/60 bg-popover p-1 shadow-2xl"
                                role="menu"
                                data-testid={`menu-${menuId}-submenu-${itemSlug}`}
                              >
                                {entry.submenu?.map((submenuEntry) => {
                                  const submenuSlug = toTestSlug(submenuEntry.label);
                                  const submenuItemTestId = `menu-${menuId}-submenu-${itemSlug}-item-${submenuSlug}`;
                                  return (
                                    <button
                                      key={submenuEntry.label}
                                      type="button"
                                      className="flex w-full items-center justify-between gap-4 rounded-sm px-2 py-1 text-left text-xs text-foreground hover:bg-accent/40"
                                      onClick={closeMenus}
                                      data-testid={submenuItemTestId}
                                    >
                                      <span>{submenuEntry.label}</span>
                                      <span
                                        className="text-[10px] text-muted-foreground/80"
                                        data-testid={`${submenuItemTestId}-shortcut`}
                                      >
                                        {submenuEntry.shortcut}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {index < MENU_BAR_ITEMS.length - 1 && (
                    <span className="px-0.5 text-muted-foreground/70" aria-hidden="true">
                      |
                    </span>
                  )}
                </div>
              );
            })}
          </nav>
        </header>

        {/* Utility bar */}
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
                <ImportExportActions
                  engine={engine}
                  refreshScene={refreshScene}
                  routingOptions={routingOptions}
                  onRoutingOptionsChange={setRoutingOptions}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => setShowThreadPreview((prev) => !prev)}
                  data-testid="toggle-thread-preview"
                >
                  {showThreadPreview ? "Thread On" : "Thread Off"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => setPlaybackEnabled((prev) => !prev)}
                  disabled={!showThreadPreview}
                  data-testid="toggle-thread-playback"
                >
                  {playbackEnabled ? "Stop" : "Play"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setSimulationMode((prev) => (prev === "quality" ? "fast" : "quality"))
                  }
                  disabled={!showThreadPreview}
                  data-testid="toggle-simulation-mode"
                >
                  {simulationMode === "quality" ? "Sim Quality" : "Sim Fast"}
                </Button>
              </>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground/80" data-testid="engine-status">
            {statusText}
          </span>
        </header>

        {/* Workspace */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — Sequencer */}
          <aside
            className="panel-scroll flex w-56 shrink-0 flex-col overflow-y-auto border-r border-border/40 bg-panel"
            data-testid="panel-left"
            aria-label="Sequencer"
          >
            <SectionHeader>Sequencer</SectionHeader>
            <div className="flex-1 px-1.5 pb-3">
              {engine ? (
                <SequencerPanel
                  engine={engine}
                  selectedIds={selectedIds}
                  onSelectNode={selectNode}
                  onRefreshScene={refreshScene}
                />
              ) : (
                <p className="px-1.5 text-xs italic text-muted-foreground/80">
                  No stitch objects yet
                </p>
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
                  icon={<Type className="!size-[15px]" />}
                  label="Text"
                  shortcut="T"
                  active={activeTool === "text"}
                  onClick={() => setActiveTool("text")}
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

            <footer
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-8 items-center justify-between border-t border-border/40 bg-panel/90 px-3 text-[10px] text-muted-foreground backdrop-blur-sm"
              data-testid="status-bar"
            >
              <div className="flex items-center gap-3" data-testid="status-left">
                <span data-testid="status-cursor">
                  {cursorPositionMm.x.toFixed(1)}mm, {cursorPositionMm.y.toFixed(1)}mm
                </span>
                <span data-testid="status-zoom">Zoom {Math.round(canvasZoom * 100)}%</span>
                <span data-testid="status-objects">Objects {statusSummary.objectCount}</span>
              </div>
              <div className="flex items-center gap-3" data-testid="status-center">
                <span data-testid="status-stitches">Stitches {statusSummary.stitchCount}</span>
                <span data-testid="status-colors">Colors {statusSummary.colorCount}</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400" data-testid="status-right">
                <span aria-hidden="true">●</span>
                <span data-testid="status-severity">No diagnostics</span>
              </div>
            </footer>
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

                <div className="mx-3 border-t border-border/50" />

                <SectionHeader>Diagnostics</SectionHeader>
                <div className="px-3 pb-3">
                  <DiagnosticsPanel
                    engine={engine}
                    selectedIds={selectedIds}
                    onSelectNode={selectNode}
                  />
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}
