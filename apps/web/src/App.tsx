import type {
  NodeKindData,
  QualityMetrics,
  RenderItem,
  RouteMetrics,
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
import type { CanvasClickEvent, CanvasContextMenuEvent } from "@/hooks/useCanvas";
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

interface MenuShortcutCommand {
  menuId: MenuId;
  itemLabel: string;
  submenuLabel?: string;
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

function formatSewTime(stitchCount: number): string {
  const totalSeconds = Math.max(0, Math.round((stitchCount / 800) * 60));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function clampMenuPosition(
  screenX: number,
  screenY: number,
  menuWidth: number,
  menuHeight: number,
): { left: number; top: number } {
  if (typeof window === "undefined") {
    return { left: screenX, top: screenY };
  }
  const left = Math.max(8, Math.min(screenX, window.innerWidth - menuWidth - 8));
  const top = Math.max(8, Math.min(screenY, window.innerHeight - menuHeight - 8));
  return { left, top };
}

function normalizeShortcut(shortcut: string): string {
  return shortcut.toLowerCase().replace(/\s+/g, "");
}

function shortcutFromKeyboardEvent(event: KeyboardEvent): string | null {
  const tokens: string[] = [];
  if (event.ctrlKey || event.metaKey) tokens.push("ctrl");
  if (event.shiftKey) tokens.push("shift");
  if (event.altKey) tokens.push("alt");

  let key = event.key.toLowerCase();
  if (key === " ") key = "space";
  if (key === "plus" || (key === "=" && event.shiftKey)) key = "+";
  if (key === "subtract") key = "-";
  if (key === "escape") key = "esc";

  if (["control", "shift", "alt", "meta"].includes(key)) return null;

  if (tokens.length === 0 && !["f1", "delete"].includes(key)) {
    return null;
  }

  if (key === "delete") {
    key = "del";
  }

  tokens.push(key);
  return normalizeShortcut(tokens.join("+"));
}

function buildMenuShortcutCommands(): Record<string, MenuShortcutCommand> {
  const entries: [string, MenuShortcutCommand][] = [];
  for (const [menuId, menuEntries] of Object.entries(MENU_ENTRIES) as [MenuId, MenuEntry[]][]) {
    for (const entry of menuEntries) {
      entries.push([
        normalizeShortcut(entry.shortcut),
        {
          menuId,
          itemLabel: entry.label,
        },
      ]);

      if (!entry.submenu) continue;
      for (const submenuEntry of entry.submenu) {
        entries.push([
          normalizeShortcut(submenuEntry.shortcut),
          {
            menuId,
            itemLabel: entry.label,
            submenuLabel: submenuEntry.label,
          },
        ]);
      }
    }
  }

  return Object.fromEntries(entries);
}

const MENU_SHORTCUT_COMMANDS = buildMenuShortcutCommands();

const EMPTY_ROUTE_METRICS: RouteMetrics = {
  jump_count: 0,
  trim_count: 0,
  color_change_count: 0,
  travel_distance_mm: 0,
  longest_travel_mm: 0,
  route_score: 0,
};

const EMPTY_QUALITY_METRICS: QualityMetrics = {
  stitch_count: 0,
  jump_count: 0,
  trim_count: 0,
  color_change_count: 0,
  travel_distance_mm: 0,
  longest_travel_mm: 0,
  route_score: 0,
  mean_stitch_length_mm: 0,
  stitch_length_p95_mm: 0,
  density_error_mm: 0,
  angle_error_deg: 0,
  coverage_error_pct: 0,
};

type SimulationPreviewMode = "fast" | "quality";
type CanvasContextMenuKind = "object" | "background";

interface CanvasContextMenuState {
  kind: CanvasContextMenuKind;
  nodeId: number | null;
  screenX: number;
  screenY: number;
}

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
  const [diagnosticSummary, setDiagnosticSummary] = useState({
    errors: 0,
    warnings: 0,
    infos: 0,
  });
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [designInspectorOpen, setDesignInspectorOpen] = useState(false);
  const [inspectorRouteMetrics, setInspectorRouteMetrics] =
    useState<RouteMetrics>(EMPTY_ROUTE_METRICS);
  const [inspectorQualityMetrics, setInspectorQualityMetrics] =
    useState<QualityMetrics>(EMPTY_QUALITY_METRICS);
  const [inspectorDimensionsMm, setInspectorDimensionsMm] = useState({ width: 0, height: 0 });
  const [inspectorColorCount, setInspectorColorCount] = useState(0);
  const [canvasContextMenu, setCanvasContextMenu] = useState<CanvasContextMenuState | null>(null);
  const [lastMenuCommand, setLastMenuCommand] = useState("Idle");
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

  const executeMenuCommand = useCallback(
    (command: MenuShortcutCommand) => {
      const commandPath = command.submenuLabel
        ? `${command.itemLabel} > ${command.submenuLabel}`
        : command.itemLabel;
      const menuTitle =
        MENU_BAR_ITEMS.find((menuItem) => menuItem.toLowerCase() === command.menuId) ??
        command.menuId;
      setLastMenuCommand(`${menuTitle} / ${commandPath}`);

      const commandId = `${command.menuId}/${toTestSlug(command.itemLabel)}${
        command.submenuLabel ? `/${toTestSlug(command.submenuLabel)}` : ""
      }`;

      switch (commandId) {
        case "edit/undo":
          if (engine?.sceneUndo()) {
            refreshScene();
          }
          break;
        case "edit/redo":
          if (engine?.sceneRedo()) {
            refreshScene();
          }
          break;
        case "view/toggle-stitch-preview":
          setShowThreadPreview((previous) => !previous);
          break;
        case "view/simulation-mode/fast":
          setSimulationMode("fast");
          break;
        case "view/simulation-mode/quality":
          setSimulationMode("quality");
          break;
        case "view/toggle-diagnostics-panel":
          setDiagnosticsOpen((previous) => !previous);
          break;
        case "view/toggle-design-inspector":
          setDesignInspectorOpen((previous) => !previous);
          break;
        case "routing/allow-reverse":
          setRoutingOptions((previous) => ({
            ...previous,
            allow_reverse: !previous.allow_reverse,
          }));
          break;
        case "routing/open-full-routing-settings":
          setDesignInspectorOpen(true);
          break;
      }

      closeMenus();
    },
    [closeMenus, engine, refreshScene],
  );

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
    if (!engine) return;

    const refreshDiagnostics = (): void => {
      try {
        const diagnostics = engine.sceneValidationDiagnostics();
        let errors = 0;
        let warnings = 0;
        let infos = 0;
        for (const diagnostic of diagnostics) {
          if (diagnostic.severity === "error") errors += 1;
          else if (diagnostic.severity === "warning") warnings += 1;
          else infos += 1;
        }
        setDiagnosticSummary((previous) =>
          previous.errors === errors && previous.warnings === warnings && previous.infos === infos
            ? previous
            : { errors, warnings, infos },
        );
      } catch (_error) {
        setDiagnosticSummary((previous) =>
          previous.errors === 0 && previous.warnings === 0 && previous.infos === 0
            ? previous
            : { errors: 0, warnings: 0, infos: 0 },
        );
      }
    };

    refreshDiagnostics();
    const interval = window.setInterval(refreshDiagnostics, 300);
    return () => window.clearInterval(interval);
  }, [engine]);

  useEffect(() => {
    if (!engine) return;

    const refreshInspector = (): void => {
      try {
        const route = engine.sceneRouteMetricsWithOptions(DEFAULT_STITCH_LENGTH, routingOptions);
        const quality = engine.sceneQualityMetricsWithOptions(
          DEFAULT_STITCH_LENGTH,
          routingOptions,
        );
        const design = engine.sceneExportDesignWithOptions(DEFAULT_STITCH_LENGTH, routingOptions);

        setInspectorRouteMetrics(route);
        setInspectorQualityMetrics(quality);
        setInspectorColorCount(design.colors.length);

        if (design.stitches.length === 0) {
          setInspectorDimensionsMm({ width: 0, height: 0 });
        } else {
          let minX = Number.POSITIVE_INFINITY;
          let minY = Number.POSITIVE_INFINITY;
          let maxX = Number.NEGATIVE_INFINITY;
          let maxY = Number.NEGATIVE_INFINITY;
          for (const stitch of design.stitches) {
            minX = Math.min(minX, stitch.x);
            minY = Math.min(minY, stitch.y);
            maxX = Math.max(maxX, stitch.x);
            maxY = Math.max(maxY, stitch.y);
          }
          setInspectorDimensionsMm({
            width: Math.max(0, maxX - minX),
            height: Math.max(0, maxY - minY),
          });
        }
      } catch (_error) {
        setInspectorRouteMetrics(EMPTY_ROUTE_METRICS);
        setInspectorQualityMetrics(EMPTY_QUALITY_METRICS);
        setInspectorDimensionsMm({ width: 0, height: 0 });
        setInspectorColorCount(0);
      }
    };

    refreshInspector();
    const interval = window.setInterval(refreshInspector, 300);
    return () => window.clearInterval(interval);
  }, [engine, routingOptions]);

  useEffect(() => {
    if (!diagnosticsOpen) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setDiagnosticsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [diagnosticsOpen]);

  useEffect(() => {
    if (!canvasContextMenu) return;

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("[data-testid='canvas-object-context-menu']") ||
        target?.closest("[data-testid='canvas-background-context-menu']")
      ) {
        return;
      }
      setCanvasContextMenu(null);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setCanvasContextMenu(null);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canvasContextMenu]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      const normalizedShortcut = shortcutFromKeyboardEvent(event);
      if (!normalizedShortcut) return;
      const command = MENU_SHORTCUT_COMMANDS[normalizedShortcut];
      if (!command) return;

      event.preventDefault();
      executeMenuCommand(command);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [executeMenuCommand]);

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
      setCanvasContextMenu(null);
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

  const handleCanvasContextMenu = useCallback(
    (event: CanvasContextMenuEvent) => {
      if (event.nodeId !== null) {
        selectNode(event.nodeId);
      }

      setCanvasContextMenu({
        kind: event.nodeId === null ? "background" : "object",
        nodeId: event.nodeId,
        screenX: event.screenX,
        screenY: event.screenY,
      });
    },
    [selectNode],
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

  const handleDeleteContextNode = useCallback(() => {
    if (!engine || !canvasContextMenu || canvasContextMenu.nodeId === null) return;
    engine.sceneRemoveNode(canvasContextMenu.nodeId);
    deselectAll();
    refreshScene();
    setCanvasContextMenu(null);
  }, [canvasContextMenu, deselectAll, engine, refreshScene]);

  const handleDuplicateContextNode = useCallback(() => {
    if (!engine || !canvasContextMenu || canvasContextMenu.nodeId === null) return;
    const node = engine.sceneGetNode(canvasContextMenu.nodeId);
    if (!node) return;

    engine.sceneAddNodeWithTransform(
      `${node.name} Copy`,
      node.kind,
      {
        x: node.transform.x + 2,
        y: node.transform.y + 2,
        rotation: node.transform.rotation,
        scaleX: node.transform.scale_x,
        scaleY: node.transform.scale_y,
      },
      node.parent ?? undefined,
    );
    refreshScene();
    setCanvasContextMenu(null);
  }, [canvasContextMenu, engine, refreshScene]);

  const canvasRef = useCanvas({
    ready: !loading && !error,
    canvasData: canvasDataRef,
    activeTool,
    cursorStyle,
    onCanvasClick: handleCanvasClick,
    onCanvasHitTest: handleCanvasHitTest,
    onCanvasContextMenu: handleCanvasContextMenu,
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
  const sewTimeEstimate = formatSewTime(statusSummary.stitchCount);
  const inspectorSewTimeEstimate = formatSewTime(inspectorQualityMetrics.stitch_count);
  const hasDiagnosticIssues = diagnosticSummary.errors + diagnosticSummary.warnings > 0;

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
                                executeMenuCommand({
                                  menuId,
                                  itemLabel: entry.label,
                                });
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
                                      onClick={() =>
                                        executeMenuCommand({
                                          menuId,
                                          itemLabel: entry.label,
                                          submenuLabel: submenuEntry.label,
                                        })
                                      }
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

            {canvasContextMenu?.kind === "object" && (
              <div
                className="fixed z-50 w-64 rounded-md border border-border/60 bg-popover p-1 shadow-2xl"
                style={clampMenuPosition(
                  canvasContextMenu.screenX,
                  canvasContextMenu.screenY,
                  256,
                  420,
                )}
                data-testid="canvas-object-context-menu"
              >
                <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
                  Stitch Settings
                </div>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-object-stitch-type"
                >
                  Stitch Type
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-object-thread-color"
                >
                  Thread Color
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-object-density"
                >
                  Density
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-object-angle"
                >
                  Angle
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-object-underlay"
                >
                  Underlay
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-object-compensation"
                >
                  Compensation
                </button>

                <div className="my-1 border-t border-border/50" />
                <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
                  Routing
                </div>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-object-routing-overrides"
                >
                  Routing Overrides
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-object-trim-command"
                >
                  Trim Command
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-object-tie-command"
                >
                  Tie Command
                </button>

                <div className="my-1 border-t border-border/50" />
                <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
                  Object Management
                </div>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-object-lock"
                >
                  Lock
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-object-hide"
                >
                  Hide
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  onClick={handleDuplicateContextNode}
                  data-testid="context-object-duplicate"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs text-destructive hover:bg-destructive/10"
                  onClick={handleDeleteContextNode}
                  data-testid="context-object-delete"
                >
                  Delete
                </button>
              </div>
            )}

            {canvasContextMenu?.kind === "background" && (
              <div
                className="fixed z-50 w-56 rounded-md border border-border/60 bg-popover p-1 shadow-2xl"
                style={clampMenuPosition(
                  canvasContextMenu.screenX,
                  canvasContextMenu.screenY,
                  224,
                  220,
                )}
                data-testid="canvas-background-context-menu"
              >
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-background-paste"
                >
                  Paste
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-background-import"
                >
                  Import
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-background-zoom-in"
                >
                  Zoom In
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-background-zoom-out"
                >
                  Zoom Out
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-background-grid-settings"
                >
                  Grid Settings
                </button>
                <button
                  type="button"
                  className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
                  data-testid="context-background-snap-behavior"
                >
                  Snap Behavior
                </button>
              </div>
            )}

            {engine && designInspectorOpen && (
              <div
                className="absolute top-10 right-3 z-30 max-h-[70vh] w-[360px] overflow-y-auto rounded-md border border-border/60 bg-panel/95 p-3 shadow-2xl shadow-black/40 backdrop-blur"
                data-testid="design-inspector-panel"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Design Inspector</h2>
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                    onClick={() => setDesignInspectorOpen(false)}
                    data-testid="design-inspector-close"
                  >
                    Close
                  </button>
                </div>

                <section
                  className="mb-3 space-y-1.5 text-xs"
                  data-testid="design-inspector-summary"
                >
                  <h3 className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Stitch Summary
                  </h3>
                  <div data-testid="inspector-summary-stitches">
                    Stitches: {inspectorQualityMetrics.stitch_count}
                  </div>
                  <div data-testid="inspector-summary-colors">Colors: {inspectorColorCount}</div>
                  <div data-testid="inspector-summary-sew-time">
                    Sew Time: {inspectorSewTimeEstimate}
                  </div>
                  <div data-testid="inspector-summary-dimensions">
                    Dimensions: {inspectorDimensionsMm.width.toFixed(1)}mm x{" "}
                    {inspectorDimensionsMm.height.toFixed(1)}mm
                  </div>
                </section>

                <section
                  className="mb-3 space-y-1.5 text-xs"
                  data-testid="design-inspector-routing-metrics"
                >
                  <h3 className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Routing Metrics
                  </h3>
                  <div data-testid="inspector-routing-travel">
                    Travel: {inspectorRouteMetrics.travel_distance_mm.toFixed(2)} mm
                  </div>
                  <div data-testid="inspector-routing-jumps">
                    Jumps: {inspectorRouteMetrics.jump_count}
                  </div>
                  <div data-testid="inspector-routing-trims">
                    Trims: {inspectorRouteMetrics.trim_count}
                  </div>
                  <div data-testid="inspector-routing-colors">
                    Color Changes: {inspectorRouteMetrics.color_change_count}
                  </div>
                  <div data-testid="inspector-routing-longest">
                    Longest Travel: {inspectorRouteMetrics.longest_travel_mm.toFixed(2)} mm
                  </div>
                  <div data-testid="inspector-routing-score">
                    Route Score ({routingOptions.policy}):{" "}
                    {inspectorRouteMetrics.route_score.toFixed(2)}
                  </div>
                </section>

                <section
                  className="mb-3 space-y-1.5 text-xs"
                  data-testid="design-inspector-quality-metrics"
                >
                  <h3 className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Quality Analysis
                  </h3>
                  <div data-testid="inspector-quality-mean">
                    Mean Stitch: {inspectorQualityMetrics.mean_stitch_length_mm.toFixed(2)} mm
                  </div>
                  <div data-testid="inspector-quality-p95">
                    P95 Stitch: {inspectorQualityMetrics.stitch_length_p95_mm.toFixed(2)} mm
                  </div>
                  <div data-testid="inspector-quality-density">
                    Density Error: {inspectorQualityMetrics.density_error_mm.toFixed(2)} mm
                  </div>
                  <div data-testid="inspector-quality-angle">
                    Angle Error: {inspectorQualityMetrics.angle_error_deg.toFixed(2)} deg
                  </div>
                  <div data-testid="inspector-quality-coverage">
                    Coverage Error: {inspectorQualityMetrics.coverage_error_pct.toFixed(2)}%
                  </div>
                </section>

                <section
                  className="mb-3 space-y-1.5 text-xs"
                  data-testid="design-inspector-routing-settings"
                >
                  <h3 className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Routing Settings
                  </h3>
                  <label className="flex flex-col gap-1">
                    Policy
                    <select
                      value={routingOptions.policy}
                      onChange={(event) =>
                        setRoutingOptions((previous) => ({
                          ...previous,
                          policy: event.target.value as RoutingOptions["policy"],
                        }))
                      }
                      data-testid="inspector-setting-policy"
                    >
                      <option value="balanced">Balanced</option>
                      <option value="min_travel">Min Travel</option>
                      <option value="min_trims">Min Trims</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    Sequence Mode
                    <select
                      value={routingOptions.sequence_mode}
                      onChange={(event) =>
                        setRoutingOptions((previous) => ({
                          ...previous,
                          sequence_mode: event.target.value as RoutingOptions["sequence_mode"],
                        }))
                      }
                      data-testid="inspector-setting-sequence-mode"
                    >
                      <option value="strict_sequencer">Strict Sequencer</option>
                      <option value="optimizer">Optimizer</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={routingOptions.allow_reverse}
                      onChange={(event) =>
                        setRoutingOptions((previous) => ({
                          ...previous,
                          allow_reverse: event.target.checked,
                        }))
                      }
                      data-testid="inspector-setting-allow-reverse"
                    />
                    Allow Reverse
                  </label>
                  <label className="flex flex-col gap-1">
                    Entry / Exit
                    <select
                      value={routingOptions.entry_exit_mode}
                      onChange={(event) =>
                        setRoutingOptions((previous) => ({
                          ...previous,
                          entry_exit_mode: event.target.value as RoutingOptions["entry_exit_mode"],
                        }))
                      }
                      data-testid="inspector-setting-entry-exit"
                    >
                      <option value="auto">Auto</option>
                      <option value="preserve_shape_start">Preserve Start</option>
                      <option value="user_anchor">User Anchor</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    Tie Mode
                    <select
                      value={routingOptions.tie_mode}
                      onChange={(event) =>
                        setRoutingOptions((previous) => ({
                          ...previous,
                          tie_mode: event.target.value as RoutingOptions["tie_mode"],
                        }))
                      }
                      data-testid="inspector-setting-tie-mode"
                    >
                      <option value="off">Off</option>
                      <option value="shape_start_end">Shape Start/End</option>
                      <option value="color_change">Color Change</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    Max Jump (mm)
                    <input
                      type="number"
                      value={routingOptions.max_jump_mm}
                      onChange={(event) =>
                        setRoutingOptions((previous) => ({
                          ...previous,
                          max_jump_mm: Number(event.target.value),
                        }))
                      }
                      data-testid="inspector-setting-max-jump"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    Trim Threshold (mm)
                    <input
                      type="number"
                      value={routingOptions.trim_threshold_mm}
                      onChange={(event) =>
                        setRoutingOptions((previous) => ({
                          ...previous,
                          trim_threshold_mm: Number(event.target.value),
                        }))
                      }
                      data-testid="inspector-setting-trim-threshold"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    Min Run Before Trim (mm)
                    <input
                      type="number"
                      value={routingOptions.min_stitch_run_before_trim_mm}
                      onChange={(event) =>
                        setRoutingOptions((previous) => ({
                          ...previous,
                          min_stitch_run_before_trim_mm: Number(event.target.value),
                        }))
                      }
                      data-testid="inspector-setting-min-run-before-trim"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={routingOptions.allow_underpath}
                      onChange={(event) =>
                        setRoutingOptions((previous) => ({
                          ...previous,
                          allow_underpath: event.target.checked,
                        }))
                      }
                      data-testid="inspector-setting-underpath"
                    />
                    Allow Underpath
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={routingOptions.allow_color_merge}
                      onChange={(event) =>
                        setRoutingOptions((previous) => ({
                          ...previous,
                          allow_color_merge: event.target.checked,
                        }))
                      }
                      data-testid="inspector-setting-color-merge"
                    />
                    Allow Color Merge
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={routingOptions.preserve_color_order}
                      onChange={(event) =>
                        setRoutingOptions((previous) => ({
                          ...previous,
                          preserve_color_order: event.target.checked,
                        }))
                      }
                      data-testid="inspector-setting-preserve-color-order"
                    />
                    Preserve Color Order
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={routingOptions.preserve_layer_order}
                      onChange={(event) =>
                        setRoutingOptions((previous) => ({
                          ...previous,
                          preserve_layer_order: event.target.checked,
                        }))
                      }
                      data-testid="inspector-setting-preserve-layer-order"
                    />
                    Preserve Layer Order
                  </label>
                </section>

                <section
                  className="space-y-1.5 text-xs"
                  data-testid="design-inspector-format-compatibility"
                >
                  <h3 className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Format Compatibility
                  </h3>
                  <div>DST: Lossless</div>
                  <div>PES: Lossless</div>
                  <div>PEC: Lossless</div>
                  <div>JEF: Simplification Needed</div>
                  <div>EXP: Simplification Needed</div>
                  <div>VP3: Simplification Needed</div>
                  <div>HUS: Simplification Needed</div>
                  <div>XXX: Simplification Needed</div>
                </section>
              </div>
            )}

            {engine && (
              <div
                className={`absolute inset-x-2 bottom-8 z-20 transition-all duration-200 ease-out ${
                  diagnosticsOpen
                    ? "pointer-events-auto translate-y-0 opacity-100"
                    : "pointer-events-none invisible translate-y-4 opacity-0"
                }`}
                data-testid="diagnostics-drawer"
              >
                <div className="max-h-64 overflow-y-auto rounded-md border border-border/60 bg-panel/95 shadow-2xl shadow-black/40 backdrop-blur">
                  <div className="flex items-center justify-between border-b border-border/50 px-2 py-1.5">
                    <span className="text-[11px] font-semibold text-foreground/90">
                      Diagnostics
                    </span>
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                      onClick={() => setDiagnosticsOpen(false)}
                      data-testid="diagnostics-drawer-close"
                    >
                      Close
                    </button>
                  </div>
                  <div className="p-2">
                    <DiagnosticsPanel
                      engine={engine}
                      selectedIds={selectedIds}
                      onSelectNode={selectNode}
                    />
                  </div>
                </div>
              </div>
            )}

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
                <span data-testid="status-sew-time">Sew {sewTimeEstimate}</span>
                <span className="max-w-[180px] truncate" data-testid="status-command">
                  {lastMenuCommand}
                </span>
              </div>
              <div className="pointer-events-auto" data-testid="status-right">
                <button
                  type="button"
                  className={`flex items-center gap-2 rounded px-1 py-0.5 ${
                    hasDiagnosticIssues
                      ? "text-amber-300 hover:bg-amber-500/10"
                      : "text-emerald-400 hover:bg-emerald-500/10"
                  }`}
                  onClick={() => setDiagnosticsOpen((previous) => !previous)}
                  data-testid="status-severity-button"
                >
                  <span aria-hidden="true">●</span>
                  <span data-testid="status-severity">
                    {hasDiagnosticIssues
                      ? `${diagnosticSummary.errors} error${diagnosticSummary.errors === 1 ? "" : "s"}, ${diagnosticSummary.warnings} warning${diagnosticSummary.warnings === 1 ? "" : "s"}`
                      : "No diagnostics"}
                  </span>
                </button>
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
              </>
            )}
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}
