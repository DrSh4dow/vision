import type { NodeKindData, RoutingOptions, VisionEngine } from "@vision/wasm-bridge";
import { Download, FileUp } from "lucide-react";
import { useCallback, useRef } from "react";

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

export function ImportExportActions({
  engine,
  refreshScene,
  routingOptions,
  onRoutingOptionsChange,
}: ImportExportActionsProps) {
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
        onChange={(e) =>
          onRoutingOptionsChange({
            ...routingOptions,
            policy: e.target.value as RoutingOptions["policy"],
          })
        }
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
          onChange={(e) =>
            onRoutingOptionsChange({
              ...routingOptions,
              allow_reverse: e.target.checked,
            })
          }
          data-testid="routing-allow-reverse"
        />
        Reverse
      </label>
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
    </div>
  );
}
