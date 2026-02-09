import type { SceneDiagnostic, VisionEngine } from "@vision/wasm-bridge";
import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

interface DiagnosticsPanelProps {
  engine: VisionEngine;
  selectedIds: Set<number>;
  onSelectNode: (id: number, addToSelection?: boolean) => void;
}

function severityLabel(severity: SceneDiagnostic["severity"]): string {
  if (severity === "error") return "Error";
  if (severity === "warning") return "Warning";
  return "Info";
}

function severityIcon(severity: SceneDiagnostic["severity"]): ReactNode {
  if (severity === "error") return <OctagonAlert className="h-3.5 w-3.5 text-destructive" />;
  if (severity === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
  return <Info className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function DiagnosticsPanel({ engine, selectedIds, onSelectNode }: DiagnosticsPanelProps) {
  const [diagnostics, setDiagnostics] = useState<SceneDiagnostic[]>([]);
  const [filter, setFilter] = useState<SceneDiagnostic["severity"] | "all">("all");

  useEffect(() => {
    const refresh = () => {
      try {
        setDiagnostics(engine.sceneValidationDiagnostics());
      } catch (_error) {
        setDiagnostics([]);
      }
    };
    refresh();
    const interval = window.setInterval(refresh, 500);
    return () => window.clearInterval(interval);
  }, [engine]);

  const summary = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    let infos = 0;
    for (const diagnostic of diagnostics) {
      if (diagnostic.severity === "error") errors += 1;
      else if (diagnostic.severity === "warning") warnings += 1;
      else infos += 1;
    }
    return { errors, warnings, infos };
  }, [diagnostics]);

  const filteredDiagnostics = useMemo(() => {
    if (filter === "all") return diagnostics;
    return diagnostics.filter((diagnostic) => diagnostic.severity === filter);
  }, [diagnostics, filter]);

  return (
    <div className="space-y-2" data-testid="diagnostics-panel">
      <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
        <div className="rounded border border-border/50 bg-card/60 px-1.5 py-1">
          <span className="text-destructive" data-testid="diagnostics-count-error">
            {summary.errors}
          </span>{" "}
          errors
        </div>
        <div className="rounded border border-border/50 bg-card/60 px-1.5 py-1">
          <span className="text-amber-400" data-testid="diagnostics-count-warning">
            {summary.warnings}
          </span>{" "}
          warnings
        </div>
        <div className="rounded border border-border/50 bg-card/60 px-1.5 py-1">
          <span data-testid="diagnostics-count-info">{summary.infos}</span> info
        </div>
      </div>

      <div className="flex flex-wrap gap-1" data-testid="diagnostics-filters">
        <button
          type="button"
          className={cn(
            "rounded border px-1.5 py-0.5 text-[10px]",
            filter === "all"
              ? "border-foreground/30 bg-accent/50 text-foreground"
              : "border-border/50 text-muted-foreground hover:bg-accent/30",
          )}
          onClick={() => setFilter("all")}
          data-testid="diagnostics-filter-all"
        >
          All
        </button>
        <button
          type="button"
          className={cn(
            "rounded border px-1.5 py-0.5 text-[10px]",
            filter === "error"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border/50 text-muted-foreground hover:bg-accent/30",
          )}
          onClick={() => setFilter("error")}
          data-testid="diagnostics-filter-error"
        >
          Errors
        </button>
        <button
          type="button"
          className={cn(
            "rounded border px-1.5 py-0.5 text-[10px]",
            filter === "warning"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
              : "border-border/50 text-muted-foreground hover:bg-accent/30",
          )}
          onClick={() => setFilter("warning")}
          data-testid="diagnostics-filter-warning"
        >
          Warnings
        </button>
        <button
          type="button"
          className={cn(
            "rounded border px-1.5 py-0.5 text-[10px]",
            filter === "info"
              ? "border-foreground/30 bg-foreground/10 text-foreground"
              : "border-border/50 text-muted-foreground hover:bg-accent/30",
          )}
          onClick={() => setFilter("info")}
          data-testid="diagnostics-filter-info"
        >
          Info
        </button>
      </div>

      {filteredDiagnostics.length === 0 ? (
        <p className="text-xs italic text-muted-foreground/80">No diagnostics</p>
      ) : (
        <ul className="space-y-1.5">
          {filteredDiagnostics.map((diagnostic, index) => {
            const nodeId = diagnostic.node_id;
            const isSelected = nodeId !== null && selectedIds.has(nodeId);
            const severityClass =
              diagnostic.severity === "error"
                ? "border-destructive/40 bg-destructive/10"
                : diagnostic.severity === "warning"
                  ? "border-amber-500/40 bg-amber-500/10"
                  : "border-border/50 bg-card/60";
            return (
              <li key={`${diagnostic.code}-${nodeId ?? -1}-${index}`}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded border px-2 py-1.5 text-left text-[11px]",
                    severityClass,
                    "hover:bg-accent/40",
                    isSelected && "border-accent/70 bg-accent/30",
                  )}
                  disabled={nodeId === null}
                  onClick={() => {
                    if (nodeId !== null) onSelectNode(nodeId);
                  }}
                  data-testid={`diagnostic-row-${index}`}
                  data-severity={diagnostic.severity}
                >
                  <span className="mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {severityIcon(diagnostic.severity)}
                    {severityLabel(diagnostic.severity)}
                    <span className="truncate">{diagnostic.code}</span>
                  </span>
                  <span className="text-foreground/90">{diagnostic.message}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
