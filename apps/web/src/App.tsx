import type {
  ExportDesign,
  Point,
  ThreadBrand,
  ThreadColor,
  VisionEngine,
} from "@vision/wasm-bridge";
import { Download, FileUp, MousePointer2, Palette, Pen, Shapes, Type } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCanvas } from "@/hooks/useCanvas";
import { useEngine } from "@/hooks/useEngine";

export function App() {
  const { engine, loading, error, version } = useEngine();
  const canvasRef = useCanvas({ ready: !loading && !error });

  const statusText = error
    ? `Error: ${error}`
    : loading
      ? "Loading WASM engine..."
      : `Engine v${version}`;

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        {/* Toolbar */}
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-card px-3">
          <div className="flex items-center gap-3">
            <span
              className="text-sm font-bold tracking-wide text-primary"
              data-testid="toolbar-brand"
            >
              Vision
            </span>
            {engine && <ImportExportActions engine={engine} />}
          </div>
          <span className="text-xs text-muted-foreground" data-testid="engine-status">
            {statusText}
          </span>
        </header>

        {/* Workspace */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel */}
          <aside
            className="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-card"
            data-testid="panel-left"
          >
            <PanelSection title="Tools">
              <div className="grid grid-cols-2 gap-1">
                <ToolButton icon={<MousePointer2 />} label="Select" shortcut="V" />
                <ToolButton icon={<Pen />} label="Pen" shortcut="P" />
                <ToolButton icon={<Shapes />} label="Shape" shortcut="S" />
                <ToolButton icon={<Type />} label="Text" shortcut="T" />
              </div>
            </PanelSection>

            <PanelSection title="Layers">
              <p className="text-xs italic text-muted-foreground">No layers yet</p>
            </PanelSection>

            {engine && (
              <PanelSection title="Stitch Demo">
                <StitchDemo engine={engine} />
              </PanelSection>
            )}

            {engine && (
              <PanelSection title="SVG Import">
                <SvgImportDemo engine={engine} />
              </PanelSection>
            )}
          </aside>

          {/* Canvas */}
          <main className="relative flex-1 overflow-hidden">
            <canvas ref={canvasRef} className="block h-full w-full" data-testid="design-canvas" />
          </main>

          {/* Right panel */}
          <aside
            className="flex w-60 shrink-0 flex-col overflow-y-auto border-l border-border bg-card"
            data-testid="panel-right"
          >
            <PanelSection title="Properties">
              <p className="text-xs italic text-muted-foreground">Select an object</p>
            </PanelSection>

            <PanelSection title="Stitch Settings">
              <p className="text-xs italic text-muted-foreground">No stitch parameters</p>
            </PanelSection>

            {engine && (
              <PanelSection title="Thread Palette">
                <ThreadPalettePanel engine={engine} />
              </PanelSection>
            )}
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// Panel Section
// ============================================================================

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 p-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      {children}
      <Separator className="mt-1" />
    </div>
  );
}

// ============================================================================
// Tool Button
// ============================================================================

function ToolButton({
  icon,
  label,
  shortcut,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" title={label} className="h-8 w-full">
          {icon}
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {label} <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">{shortcut}</kbd>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// Import / Export Actions (Toolbar)
// ============================================================================

function ImportExportActions({ engine }: { engine: VisionEngine }) {
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

        const paths = engine.importSvgDocument(content);
        // For now just log — will be wired to scene graph later
        console.log(`Imported ${paths.length} path(s) from SVG`);
      };
      reader.readAsText(file);

      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [engine],
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
    <div className="flex items-center gap-1">
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
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={handleSvgImport}
            data-testid="import-svg-btn"
          >
            <FileUp className="h-3.5 w-3.5" />
            Import SVG
          </Button>
        </TooltipTrigger>
        <TooltipContent>Import SVG file</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={handleExportDst}
            data-testid="export-dst-btn"
          >
            <Download className="h-3.5 w-3.5" />
            DST
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export as DST (Tajima)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={handleExportPes}
            data-testid="export-pes-btn"
          >
            <Download className="h-3.5 w-3.5" />
            PES
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export as PES (Brother)</TooltipContent>
      </Tooltip>
    </div>
  );
}

// ============================================================================
// Stitch Demo
// ============================================================================

function StitchDemo({ engine }: { engine: VisionEngine }) {
  const [stitchCount, setStitchCount] = useState<number | null>(null);
  const [satinCount, setSatinCount] = useState<number | null>(null);

  const runRunningDemo = useCallback(() => {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 30 },
      { x: 0, y: 30 },
    ];
    const stitches = engine.generateRunningStitches(path, 3.0);
    setStitchCount(stitches.length);
  }, [engine]);

  const runSatinDemo = useCallback(() => {
    const rail1: Point[] = [
      { x: 0, y: 0 },
      { x: 30, y: 0 },
    ];
    const rail2: Point[] = [
      { x: 0, y: 5 },
      { x: 30, y: 5 },
    ];
    const result = engine.generateSatinStitches(rail1, rail2, 0.4, 0.2, {
      center_walk: true,
      edge_walk: false,
      zigzag: false,
      zigzag_spacing: 2.0,
      stitch_length: 2.5,
    });
    setSatinCount(result.stitches.length);
  }, [engine]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        <Button
          variant="secondary"
          size="sm"
          onClick={runRunningDemo}
          data-testid="stitch-demo-btn"
          className="flex-1 text-xs"
        >
          Running
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={runSatinDemo}
          data-testid="satin-demo-btn"
          className="flex-1 text-xs"
        >
          Satin
        </Button>
      </div>
      {stitchCount !== null && (
        <p className="text-xs text-muted-foreground" data-testid="stitch-count">
          Running: {stitchCount} pts
        </p>
      )}
      {satinCount !== null && (
        <p className="text-xs text-muted-foreground" data-testid="satin-count">
          Satin: {satinCount} pts
        </p>
      )}
    </div>
  );
}

// ============================================================================
// SVG Import Demo
// ============================================================================

function SvgImportDemo({ engine }: { engine: VisionEngine }) {
  const [pathCount, setPathCount] = useState<number | null>(null);

  const handleImport = useCallback(() => {
    // Import a simple SVG path
    const result = engine.importSvgPath("M 0 0 L 10 0 L 10 10 L 0 10 Z");
    if (result && typeof result === "object") {
      setPathCount(1);
    }
  }, [engine]);

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={handleImport}
        data-testid="svg-import-demo-btn"
        className="text-xs"
      >
        Parse SVG Path
      </Button>
      {pathCount !== null && (
        <p className="text-xs text-muted-foreground" data-testid="svg-path-count">
          Parsed {pathCount} path(s)
        </p>
      )}
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
      setPalette(colors.slice(0, 24)); // Show first 24 colors
      setActiveBrand(brand);
    },
    [engine],
  );

  return (
    <div className="flex flex-col gap-2" data-testid="thread-palette">
      <div className="flex gap-1">
        {(["madeira", "isacord", "sulky"] as const).map((brand) => (
          <Button
            key={brand}
            variant={activeBrand === brand ? "default" : "outline"}
            size="sm"
            onClick={() => loadPalette(brand)}
            className="flex-1 text-[10px] capitalize"
            data-testid={`thread-brand-${brand}`}
          >
            {brand}
          </Button>
        ))}
      </div>
      {palette.length > 0 && (
        <div className="grid grid-cols-6 gap-0.5" data-testid="thread-swatches">
          {palette.map((thread, i) => (
            <Tooltip key={`${thread.code}-${i}`}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="aspect-square rounded-sm border border-border transition-transform hover:scale-110"
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
        <p className="text-[10px] text-muted-foreground">
          <Palette className="mr-1 inline-block h-3 w-3" />
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
