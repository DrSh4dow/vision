import type { Point, VisionEngine } from "@vision/wasm-bridge";
import { MousePointer2, Pen, Shapes, Type } from "lucide-react";
import { useState } from "react";

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
          <span
            className="text-sm font-bold tracking-wide text-primary"
            data-testid="toolbar-brand"
          >
            Vision
          </span>
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

            <PanelSection title="Thread Palette">
              <p className="text-xs italic text-muted-foreground">No threads loaded</p>
            </PanelSection>
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
// Stitch Demo
// ============================================================================

function StitchDemo({ engine }: { engine: VisionEngine }) {
  const [stitchCount, setStitchCount] = useState<number | null>(null);

  function runDemo(): void {
    const path: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 30 },
      { x: 0, y: 30 },
    ];
    const stitches = engine.generateRunningStitches(path, 3.0);
    setStitchCount(stitches.length);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" size="sm" onClick={runDemo} data-testid="stitch-demo-btn">
        Generate
      </Button>
      {stitchCount !== null && (
        <p className="text-xs text-muted-foreground" data-testid="stitch-count">
          {stitchCount} stitch points
        </p>
      )}
    </div>
  );
}
