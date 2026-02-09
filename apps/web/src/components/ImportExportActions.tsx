import type {
  NodeKindData,
  QualityMetrics,
  RouteMetrics,
  RoutingOptions,
  VisionEngine,
} from "@vision/wasm-bridge";
import { Download, FileUp, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SVG_IMPORT_COLORS } from "@/constants/colors";
import { DEFAULT_STITCH_LENGTH, DEFAULT_STITCH_PARAMS } from "@/constants/embroidery";
import { downloadFile } from "@/lib/download";
import type { ParsedVectorPath } from "@/types/design";

interface ImportExportActionsProps {
  engine: VisionEngine;
  refreshScene: () => void;
  routingOptions: RoutingOptions;
  onRoutingOptionsChange: (next: RoutingOptions) => void;
}

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

export function ImportExportActions({
  engine,
  refreshScene,
  routingOptions,
  onRoutingOptionsChange,
}: ImportExportActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showRoutingPanel, setShowRoutingPanel] = useState(false);
  const [routeMetrics, setRouteMetrics] = useState<RouteMetrics>(EMPTY_ROUTE_METRICS);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics>(EMPTY_QUALITY_METRICS);
  const isStrictSequencer = routingOptions.sequence_mode === "strict_sequencer";

  const setRoutingOption = useCallback(
    (key: keyof RoutingOptions, value: RoutingOptions[keyof RoutingOptions]) => {
      onRoutingOptionsChange({
        ...routingOptions,
        [key]: value,
      });
    },
    [onRoutingOptionsChange, routingOptions],
  );

  useEffect(() => {
    try {
      const route = engine.sceneRouteMetricsWithOptions(DEFAULT_STITCH_LENGTH, routingOptions);
      const quality = engine.sceneQualityMetricsWithOptions(DEFAULT_STITCH_LENGTH, routingOptions);
      setRouteMetrics(route);
      setQualityMetrics(quality);
    } catch (_err) {
      setRouteMetrics(EMPTY_ROUTE_METRICS);
      setQualityMetrics(EMPTY_QUALITY_METRICS);
    }
  }, [engine, routingOptions]);

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

        // Cast is intentional: importSvgDocument returns unknown[] from WASM.
        // Full SVG schema validation is pending — for now we trust the
        // engine's serde output matches ParsedVectorPath.
        const paths = engine.importSvgDocument(content) as ParsedVectorPath[];

        // Get the default layer (first root node)
        const tree = engine.sceneGetTree();
        const layerId = tree.length > 0 ? tree[0].id : undefined;

        // Add each imported path as a scene node
        for (let i = 0; i < paths.length; i++) {
          const p = paths[i];
          const color = SVG_IMPORT_COLORS[i % SVG_IMPORT_COLORS.length];
          const kind: NodeKindData = {
            Shape: {
              shape: {
                Path: { commands: p.commands, closed: p.closed },
              },
              fill: p.closed ? { ...color, a: 50 } : null,
              stroke: color,
              stroke_width: 0.2,
              stitch: { ...DEFAULT_STITCH_PARAMS },
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
    try {
      const metrics = engine.sceneRouteMetricsWithOptions(DEFAULT_STITCH_LENGTH, routingOptions);
      console.info("DST route metrics", metrics);
      const design = engine.sceneExportDesignWithOptions(DEFAULT_STITCH_LENGTH, routingOptions);
      const data = engine.exportDst(design);
      downloadFile(data, "design.dst", "application/octet-stream");
    } catch (err) {
      console.warn("DST export failed:", err);
    }
  }, [engine, routingOptions]);

  const handleExportPes = useCallback(() => {
    try {
      const metrics = engine.sceneRouteMetricsWithOptions(DEFAULT_STITCH_LENGTH, routingOptions);
      console.info("PES route metrics", metrics);
      const design = engine.sceneExportDesignWithOptions(DEFAULT_STITCH_LENGTH, routingOptions);
      const data = engine.exportPes(design);
      downloadFile(data, "design.pes", "application/octet-stream");
    } catch (err) {
      console.warn("PES export failed:", err);
    }
  }, [engine, routingOptions]);

  const handleExportPec = useCallback(() => {
    try {
      const metrics = engine.sceneRouteMetricsWithOptions(DEFAULT_STITCH_LENGTH, routingOptions);
      console.info("PEC route metrics", metrics);
      const design = engine.sceneExportDesignWithOptions(DEFAULT_STITCH_LENGTH, routingOptions);
      const data = engine.exportPec(design);
      downloadFile(data, "design.pec", "application/octet-stream");
    } catch (err) {
      console.warn("PEC export failed:", err);
    }
  }, [engine, routingOptions]);

  return (
    <div className="relative flex items-center gap-0.5">
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
            {/* !size-3.5: overrides Button's [&_svg]:size-4 default */}
            <FileUp className="!size-3.5" />
            <span className="sr-only">Import SVG</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Import SVG</TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" className="mx-0.5 h-3.5 bg-border/30" />
      <select
        className="h-7 rounded border border-border/40 bg-card px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
        value={routingOptions.policy}
        onChange={(e) => setRoutingOption("policy", e.target.value as RoutingOptions["policy"])}
        data-testid="routing-policy-select"
        aria-label="Routing policy"
      >
        <option value="balanced">Balanced</option>
        <option value="min_travel">Min Travel</option>
        <option value="min_trims">Min Trims</option>
      </select>
      <label className="inline-flex h-7 items-center gap-1 rounded border border-border/40 bg-card px-1.5 text-[10px] text-muted-foreground">
        <input
          type="checkbox"
          checked={routingOptions.allow_reverse}
          onChange={(e) => setRoutingOption("allow_reverse", e.target.checked)}
          data-testid="routing-allow-reverse"
        />
        Reverse
      </label>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={() => setShowRoutingPanel((prev) => !prev)}
        data-testid="routing-advanced-toggle"
      >
        <SlidersHorizontal className="!size-3.5" />
        <span className="sr-only">Advanced Routing</span>
      </Button>
      <span
        className="px-1 text-[10px] text-muted-foreground/90"
        data-testid="routing-metrics-inline"
      >
        T:{routeMetrics.travel_distance_mm.toFixed(1)} J:{routeMetrics.jump_count} R:
        {routeMetrics.route_score.toFixed(1)}
      </span>
      <span
        className="px-1 text-[10px] text-muted-foreground/80"
        data-testid="quality-metrics-inline"
      >
        QD:{qualityMetrics.density_error_mm.toFixed(2)} QA:
        {qualityMetrics.angle_error_deg.toFixed(1)}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={handleExportDst}
            data-testid="export-dst-btn"
          >
            {/* !size-3: overrides Button's [&_svg]:size-4 default */}
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
            {/* !size-3: overrides Button's [&_svg]:size-4 default */}
            <Download className="!size-3" />
            PES
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export PES (Brother)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={handleExportPec}
            data-testid="export-pec-btn"
          >
            <Download className="!size-3" />
            PEC
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export PEC</TooltipContent>
      </Tooltip>

      {showRoutingPanel && (
        <div
          className="absolute top-8 left-0 z-40 w-[360px] rounded-md border border-border/50 bg-popover p-3 shadow-2xl"
          data-testid="routing-advanced-panel"
        >
          <div className="mb-2 grid grid-cols-2 gap-2">
            <label className="col-span-2 flex flex-col gap-1 text-[10px] text-muted-foreground">
              Sequence Mode
              <select
                className="h-7 rounded border border-border/40 bg-card px-2 text-xs text-foreground"
                value={routingOptions.sequence_mode}
                onChange={(e) =>
                  setRoutingOption(
                    "sequence_mode",
                    e.target.value as RoutingOptions["sequence_mode"],
                  )
                }
                data-testid="routing-sequence-mode"
              >
                <option value="strict_sequencer">Strict Sequencer</option>
                <option value="optimizer">Optimizer</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              Entry/Exit
              <select
                className="h-7 rounded border border-border/40 bg-card px-2 text-xs text-foreground"
                value={routingOptions.entry_exit_mode}
                onChange={(e) =>
                  setRoutingOption(
                    "entry_exit_mode",
                    e.target.value as RoutingOptions["entry_exit_mode"],
                  )
                }
                data-testid="routing-entry-exit"
              >
                <option value="auto">Auto</option>
                <option value="preserve_shape_start">Preserve Start</option>
                <option value="user_anchor">User Anchor</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              Tie Mode
              <select
                className="h-7 rounded border border-border/40 bg-card px-2 text-xs text-foreground"
                value={routingOptions.tie_mode}
                onChange={(e) =>
                  setRoutingOption("tie_mode", e.target.value as RoutingOptions["tie_mode"])
                }
                data-testid="routing-tie-mode"
              >
                <option value="off">Off</option>
                <option value="shape_start_end">Shape Start/End</option>
                <option value="color_change">Color Change</option>
              </select>
            </label>
          </div>

          <div className="mb-2 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              Max Jump (mm)
              <input
                type="number"
                step="0.5"
                min="0"
                className="h-7 rounded border border-border/40 bg-card px-2 text-xs text-foreground"
                value={routingOptions.max_jump_mm}
                onChange={(e) =>
                  setRoutingOption("max_jump_mm", Number.parseFloat(e.target.value) || 0)
                }
                data-testid="routing-max-jump"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
              Trim Threshold (mm)
              <input
                type="number"
                step="0.5"
                min="0"
                className="h-7 rounded border border-border/40 bg-card px-2 text-xs text-foreground"
                value={routingOptions.trim_threshold_mm}
                onChange={(e) =>
                  setRoutingOption("trim_threshold_mm", Number.parseFloat(e.target.value) || 0)
                }
                data-testid="routing-trim-threshold"
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-[10px] text-muted-foreground">
              Min Run Before Trim (mm)
              <input
                type="number"
                step="0.25"
                min="0"
                className="h-7 rounded border border-border/40 bg-card px-2 text-xs text-foreground"
                value={routingOptions.min_stitch_run_before_trim_mm}
                onChange={(e) =>
                  setRoutingOption(
                    "min_stitch_run_before_trim_mm",
                    Number.parseFloat(e.target.value) || 0,
                  )
                }
                data-testid="routing-min-run-before-trim"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
            {!isStrictSequencer && (
              <>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={routingOptions.preserve_color_order}
                    onChange={(e) => setRoutingOption("preserve_color_order", e.target.checked)}
                    data-testid="routing-preserve-color"
                  />
                  Preserve Color
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={routingOptions.preserve_layer_order}
                    onChange={(e) => setRoutingOption("preserve_layer_order", e.target.checked)}
                    data-testid="routing-preserve-layer"
                  />
                  Preserve Layer
                </label>
              </>
            )}
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={routingOptions.allow_underpath}
                onChange={(e) => setRoutingOption("allow_underpath", e.target.checked)}
                data-testid="routing-allow-underpath"
              />
              Allow Underpath
            </label>
            {!isStrictSequencer && (
              <label className="inline-flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={routingOptions.allow_color_merge}
                  onChange={(e) => setRoutingOption("allow_color_merge", e.target.checked)}
                  data-testid="routing-allow-color-merge"
                />
                Allow Color Merge
              </label>
            )}
          </div>

          {isStrictSequencer && (
            <p className="mt-2 rounded border border-border/40 bg-card/80 px-2 py-1.5 text-[10px] text-muted-foreground">
              Strict Sequencer keeps object order exactly as listed in the Sequencer panel. Routing
              still optimizes transitions between consecutive objects.
            </p>
          )}

          <div
            className="mt-3 rounded border border-border/40 bg-card/80 px-2 py-1.5 text-[10px] text-muted-foreground"
            data-testid="routing-metrics-panel"
          >
            <p>Travel: {routeMetrics.travel_distance_mm.toFixed(2)} mm</p>
            <p>Longest move: {routeMetrics.longest_travel_mm.toFixed(2)} mm</p>
            <p>
              Jumps: {routeMetrics.jump_count} | Trims: {routeMetrics.trim_count} | Colors:{" "}
              {routeMetrics.color_change_count}
            </p>
            <p>Route score: {routeMetrics.route_score.toFixed(2)}</p>
          </div>
          <div
            className="mt-2 rounded border border-border/40 bg-card/80 px-2 py-1.5 text-[10px] text-muted-foreground"
            data-testid="quality-metrics-panel"
          >
            <p>Stitches: {qualityMetrics.stitch_count}</p>
            <p>
              Mean/P95 length: {qualityMetrics.mean_stitch_length_mm.toFixed(2)} /{" "}
              {qualityMetrics.stitch_length_p95_mm.toFixed(2)} mm
            </p>
            <p>
              Density error: {qualityMetrics.density_error_mm.toFixed(2)} mm | Angle error:{" "}
              {qualityMetrics.angle_error_deg.toFixed(1)}°
            </p>
            <p>Coverage proxy error: {qualityMetrics.coverage_error_pct.toFixed(2)}%</p>
          </div>
        </div>
      )}
    </div>
  );
}
