import type { StitchType, TreeNode, VisionEngine } from "@vision/wasm-bridge";
import { Eye, EyeOff, GripVertical, Lock } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

interface SequencerPanelProps {
  engine: VisionEngine;
  selectedIds: Set<number>;
  onSelectNode: (id: number, addToSelection?: boolean) => void;
  onRefreshScene: () => void;
}

interface SequencerRow {
  id: number;
  parentId: number | null;
  name: string;
  stitchType: StitchType;
  color: { r: number; g: number; b: number; a: number } | null;
  visible: boolean;
  locked: boolean;
}

type DropPosition = "before" | "after";

interface DropHint {
  targetId: number;
  position: DropPosition;
}

function formatStitchType(stitchType: StitchType): string {
  return stitchType.replaceAll("_", " ");
}

function resolveSiblingIds(engine: VisionEngine, parentId: number | null): number[] {
  if (parentId === null) {
    return engine.sceneGetTree().map((node) => node.id);
  }
  const parent = engine.sceneGetNode(parentId);
  return parent?.children ?? [];
}

export function SequencerPanel({
  engine,
  selectedIds,
  onSelectNode,
  onRefreshScene,
}: SequencerPanelProps) {
  const [rows, setRows] = useState<SequencerRow[]>([]);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);

  const rowById = useMemo(() => {
    return new Map(rows.map((row) => [row.id, row]));
  }, [rows]);

  const refreshRows = useCallback(() => {
    const tree = engine.sceneGetTree();
    const next: SequencerRow[] = [];

    const collect = (
      nodes: TreeNode[],
      inheritedVisible: boolean,
      inheritedLocked: boolean,
    ): void => {
      for (const node of nodes) {
        let currentVisible = inheritedVisible;
        let currentLocked = inheritedLocked;

        if (typeof node.kind !== "string" && "Layer" in node.kind) {
          currentVisible = inheritedVisible && node.kind.Layer.visible;
          currentLocked = inheritedLocked || node.kind.Layer.locked;
        }

        if (node.kind === "Shape") {
          const info = engine.sceneGetNode(node.id);
          if (info && typeof info.kind !== "string" && "Shape" in info.kind) {
            next.push({
              id: node.id,
              parentId: info.parent,
              name: info.name,
              stitchType: info.kind.Shape.stitch.type,
              color: info.kind.Shape.stroke ?? info.kind.Shape.fill,
              visible: currentVisible,
              locked: currentLocked,
            });
          }
        }

        if (node.children.length > 0) {
          collect(node.children, currentVisible, currentLocked);
        }
      }
    };

    collect(tree, true, false);
    setRows(next);
  }, [engine]);

  useEffect(() => {
    refreshRows();
    const interval = setInterval(refreshRows, 500);
    return () => clearInterval(interval);
  }, [refreshRows]);

  const computeDropPosition = useCallback((event: React.DragEvent<HTMLElement>): DropPosition => {
    const rect = event.currentTarget.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    return event.clientY < mid ? "before" : "after";
  }, []);

  const handleDragStart = useCallback((event: React.DragEvent<HTMLElement>, row: SequencerRow) => {
    if (row.locked) {
      event.preventDefault();
      return;
    }
    setDragId(row.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(row.id));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDropHint(null);
  }, []);

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>, row: SequencerRow) => {
      if (dragId === null || dragId === row.id || row.locked) {
        return;
      }

      const dragged = rowById.get(dragId);
      if (!dragged || dragged.locked || dragged.parentId !== row.parentId) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      const position = computeDropPosition(event);
      setDropHint((prev) => {
        if (prev && prev.targetId === row.id && prev.position === position) {
          return prev;
        }
        return { targetId: row.id, position };
      });
    },
    [computeDropPosition, dragId, rowById],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>, target: SequencerRow) => {
      event.preventDefault();
      if (dragId === null || dragId === target.id) {
        return;
      }

      const dragged = rowById.get(dragId);
      if (!dragged || dragged.locked || target.locked || dragged.parentId !== target.parentId) {
        setDropHint(null);
        return;
      }

      const siblingIds = resolveSiblingIds(engine, dragged.parentId);
      const oldIndex = siblingIds.indexOf(dragId);
      const targetIndex = siblingIds.indexOf(target.id);
      if (oldIndex < 0 || targetIndex < 0) {
        setDropHint(null);
        return;
      }

      const hint = dropHint && dropHint.targetId === target.id ? dropHint : null;
      const position = hint?.position ?? computeDropPosition(event);
      let intendedIndex = position === "before" ? targetIndex : targetIndex + 1;
      if (oldIndex < intendedIndex) {
        intendedIndex -= 1;
      }

      if (intendedIndex !== oldIndex) {
        engine.sceneReorderChild(dragId, intendedIndex);
        onRefreshScene();
        refreshRows();
      }

      setDropHint(null);
      setDragId(null);
    },
    [computeDropPosition, dragId, dropHint, engine, onRefreshScene, refreshRows, rowById],
  );

  if (rows.length === 0) {
    return <p className="px-1.5 text-xs italic text-muted-foreground/80">No stitch objects yet</p>;
  }

  return (
    <ul className="flex flex-col gap-1" data-testid="sequencer-tree" aria-label="Stitch sequencer">
      {rows.map((row) => {
        const isSelected = selectedIds.has(row.id);
        const showDropBefore = dropHint?.targetId === row.id && dropHint.position === "before";
        const showDropAfter = dropHint?.targetId === row.id && dropHint.position === "after";

        return (
          <li
            key={row.id}
            className={cn(
              "group relative flex h-8 items-center gap-2 rounded-md border border-transparent px-1.5 text-[11px] transition-colors",
              row.locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
              isSelected
                ? "bg-accent/70 text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/30 hover:text-foreground",
              !row.visible && "opacity-50",
              showDropBefore && "border-t-primary",
              showDropAfter && "border-b-primary",
            )}
            data-testid={`sequencer-row-${row.id}`}
            draggable={!row.locked}
            onDragStart={(event) => handleDragStart(event, row)}
            onDragEnd={handleDragEnd}
            onDragOver={(event) => handleDragOver(event, row)}
            onDrop={(event) => handleDrop(event, row)}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left"
              onClick={(event) => onSelectNode(row.id, event.shiftKey)}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground/70">
                <GripVertical className="h-3 w-3" />
              </span>

              <span className="min-w-0 flex-1 truncate">{row.name}</span>

              <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-secondary-foreground">
                {formatStitchType(row.stitchType)}
              </span>

              <span
                className="h-3 w-3 shrink-0 rounded-full border border-border/60"
                style={{
                  backgroundColor: row.color
                    ? `rgb(${row.color.r}, ${row.color.g}, ${row.color.b})`
                    : "transparent",
                }}
                title="Thread color"
              />

              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground/70"
                title={row.visible ? "Visible" : "Hidden"}
              >
                {row.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </span>

              {row.locked && (
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground/80"
                  title="Locked"
                >
                  <Lock className="h-3 w-3" />
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
