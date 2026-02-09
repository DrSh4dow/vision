import type {
  ObjectRoutingOverrides,
  RoutingEntryExitMode,
  RoutingTieMode,
  StitchBlockCommandOverrides,
  StitchPlanRow,
  StitchType,
  VisionEngine,
} from "@vision/wasm-bridge";
import { ChevronDown, ChevronRight, Eye, EyeOff, GripVertical, Lock } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

interface SequencerPanelProps {
  engine: VisionEngine;
  selectedIds: Set<number>;
  onSelectNode: (id: number, addToSelection?: boolean) => void;
  onRefreshScene: () => void;
}

interface SequencerRow {
  blockId: number;
  nodeId: number;
  name: string;
  stitchType: StitchType;
  color: { r: number; g: number; b: number; a: number } | null;
  visible: boolean;
  locked: boolean;
  overrides: ObjectRoutingOverrides;
  commandOverrides: StitchBlockCommandOverrides;
}

type DropPosition = "before" | "after";
type AllowReverseControlValue = "inherit" | "force_on" | "force_off";
type EntryExitControlValue = "inherit" | RoutingEntryExitMode;
type TieModeControlValue = "inherit" | RoutingTieMode;
type BoolOverrideControlValue = "inherit" | "force_on" | "force_off";

interface DropHint {
  targetId: number;
  position: DropPosition;
}

interface SequencerContextMenuState {
  row: SequencerRow;
  screenX: number;
  screenY: number;
}

function formatStitchType(stitchType: StitchType): string {
  return stitchType.replaceAll("_", " ");
}

function toAllowReverseControlValue(value: boolean | null): AllowReverseControlValue {
  if (value === null) {
    return "inherit";
  }
  return value ? "force_on" : "force_off";
}

function fromAllowReverseControlValue(value: AllowReverseControlValue): boolean | null {
  if (value === "inherit") {
    return null;
  }
  return value === "force_on";
}

function toBoolOverrideControlValue(value: boolean | null): BoolOverrideControlValue {
  if (value === null) {
    return "inherit";
  }
  return value ? "force_on" : "force_off";
}

function fromBoolOverrideControlValue(value: BoolOverrideControlValue): boolean | null {
  if (value === "inherit") {
    return null;
  }
  return value === "force_on";
}

function toEntryExitControlValue(value: RoutingEntryExitMode | null): EntryExitControlValue {
  return value ?? "inherit";
}

function toTieModeControlValue(value: RoutingTieMode | null): TieModeControlValue {
  return value ?? "inherit";
}

function hasOverrideBadges(overrides: ObjectRoutingOverrides): boolean {
  return (
    overrides.allow_reverse !== null ||
    overrides.entry_exit_mode !== null ||
    overrides.tie_mode !== null
  );
}

function hasCommandOverrideBadges(overrides: StitchBlockCommandOverrides): boolean {
  return (
    overrides.trim_before !== null ||
    overrides.trim_after !== null ||
    overrides.tie_in !== null ||
    overrides.tie_out !== null
  );
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

export function SequencerPanel({
  engine,
  selectedIds,
  onSelectNode,
  onRefreshScene,
}: SequencerPanelProps) {
  const [rows, setRows] = useState<SequencerRow[]>([]);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set<number>());
  const [contextMenu, setContextMenu] = useState<SequencerContextMenuState | null>(null);

  const rowById = useMemo(() => {
    return new Map(rows.map((row) => [row.blockId, row]));
  }, [rows]);

  const refreshRows = useCallback(() => {
    const stitchPlan = engine.sceneGetStitchPlan();
    const next: SequencerRow[] = stitchPlan.map((row: StitchPlanRow) => ({
      blockId: row.block_id,
      nodeId: row.node_id,
      name: row.name,
      stitchType: row.stitch_type,
      color: row.color,
      visible: row.visible,
      locked: row.locked,
      overrides: row.overrides,
      commandOverrides: row.command_overrides,
    }));
    setRows(next);
  }, [engine]);

  useEffect(() => {
    refreshRows();
    const interval = setInterval(refreshRows, 500);
    return () => clearInterval(interval);
  }, [refreshRows]);

  useEffect(() => {
    if (!contextMenu) return;

    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-testid='sequencer-context-menu']")) {
        return;
      }
      setContextMenu(null);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [contextMenu]);

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
    setDragId(row.blockId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(row.blockId));
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setDropHint(null);
  }, []);

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>, row: SequencerRow) => {
      if (dragId === null || dragId === row.blockId || row.locked) {
        return;
      }

      const dragged = rowById.get(dragId);
      if (!dragged || dragged.locked) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      const position = computeDropPosition(event);
      setDropHint((prev) => {
        if (prev && prev.targetId === row.blockId && prev.position === position) {
          return prev;
        }
        return { targetId: row.blockId, position };
      });
    },
    [computeDropPosition, dragId, rowById],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>, target: SequencerRow) => {
      event.preventDefault();
      if (dragId === null || dragId === target.blockId) {
        return;
      }

      const dragged = rowById.get(dragId);
      if (!dragged || dragged.locked || target.locked) {
        setDropHint(null);
        return;
      }

      const orderedIds = rows.map((row) => row.blockId);
      const oldIndex = orderedIds.indexOf(dragId);
      const targetIndex = orderedIds.indexOf(target.blockId);
      if (oldIndex < 0 || targetIndex < 0) {
        setDropHint(null);
        return;
      }

      const hint = dropHint && dropHint.targetId === target.blockId ? dropHint : null;
      const position = hint?.position ?? computeDropPosition(event);
      let intendedIndex = position === "before" ? targetIndex : targetIndex + 1;
      if (oldIndex < intendedIndex) {
        intendedIndex -= 1;
      }

      if (intendedIndex !== oldIndex) {
        engine.sceneReorderStitchBlock(dragId, intendedIndex);
        onRefreshScene();
        refreshRows();
      }

      setDropHint(null);
      setDragId(null);
    },
    [computeDropPosition, dragId, dropHint, engine, onRefreshScene, refreshRows, rowById, rows],
  );

  const toggleExpandedRow = useCallback((blockId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  }, []);

  const applyOverridePatch = useCallback(
    (row: SequencerRow, patch: Partial<ObjectRoutingOverrides>) => {
      const nextOverrides: ObjectRoutingOverrides = {
        ...row.overrides,
        ...patch,
      };

      setRows((prev) =>
        prev.map((candidate) =>
          candidate.blockId === row.blockId
            ? {
                ...candidate,
                overrides: nextOverrides,
              }
            : candidate,
        ),
      );

      try {
        engine.sceneSetObjectRoutingOverrides(row.blockId, nextOverrides);
        onRefreshScene();
        refreshRows();
      } catch (error) {
        console.error("Failed to set per-row routing overrides", error);
        refreshRows();
      }
    },
    [engine, onRefreshScene, refreshRows],
  );

  const applyCommandOverridePatch = useCallback(
    (row: SequencerRow, patch: Partial<StitchBlockCommandOverrides>) => {
      const nextOverrides: StitchBlockCommandOverrides = {
        ...row.commandOverrides,
        ...patch,
      };

      setRows((prev) =>
        prev.map((candidate) =>
          candidate.blockId === row.blockId
            ? {
                ...candidate,
                commandOverrides: nextOverrides,
              }
            : candidate,
        ),
      );

      try {
        engine.sceneSetStitchBlockCommandOverrides(row.blockId, nextOverrides);
        onRefreshScene();
        refreshRows();
      } catch (error) {
        console.error("Failed to set per-row command overrides", error);
        refreshRows();
      }
    },
    [engine, onRefreshScene, refreshRows],
  );

  const handleSequencerContextAction = useCallback(
    (action: "move_top" | "move_bottom" | "duplicate" | "remove", row: SequencerRow) => {
      if (action === "move_top") {
        engine.sceneReorderStitchBlock(row.blockId, 0);
      } else if (action === "move_bottom") {
        engine.sceneReorderStitchBlock(row.blockId, Math.max(0, rows.length - 1));
      } else if (action === "remove") {
        engine.sceneRemoveNode(row.nodeId);
      } else if (action === "duplicate") {
        const node = engine.sceneGetNode(row.nodeId);
        if (node) {
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
        }
      }

      setContextMenu(null);
      onRefreshScene();
      refreshRows();
    },
    [engine, onRefreshScene, refreshRows, rows.length],
  );

  if (rows.length === 0) {
    return <p className="px-1.5 text-xs italic text-muted-foreground/80">No stitch objects yet</p>;
  }

  return (
    <>
      <ul
        className="flex flex-col gap-1"
        data-testid="sequencer-tree"
        aria-label="Stitch sequencer"
      >
        {rows.map((row) => {
          const isSelected = selectedIds.has(row.nodeId);
          const isExpanded = expandedRows.has(row.blockId);
          const showDropBefore =
            dropHint?.targetId === row.blockId && dropHint.position === "before";
          const showDropAfter = dropHint?.targetId === row.blockId && dropHint.position === "after";

          return (
            <li
              key={row.blockId}
              data-testid={`sequencer-row-${row.blockId}`}
              className={cn(
                "group relative rounded-md",
                row.locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
              )}
              draggable={!row.locked}
              onDragStart={(event) => handleDragStart(event, row)}
              onDragEnd={handleDragEnd}
              onDragOver={(event) => handleDragOver(event, row)}
              onDrop={(event) => handleDrop(event, row)}
              onContextMenu={(event) => {
                event.preventDefault();
                setContextMenu({
                  row,
                  screenX: event.clientX,
                  screenY: event.clientY,
                });
              }}
            >
              <div
                className={cn(
                  "relative flex h-8 items-center gap-1 rounded-md border border-transparent px-1.5 text-[11px] transition-colors",
                  isSelected
                    ? "bg-accent/70 text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/30 hover:text-foreground",
                  !row.visible && "opacity-50",
                  showDropBefore && "border-t-primary",
                  showDropAfter && "border-b-primary",
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={(event) => onSelectNode(row.nodeId, event.shiftKey)}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground/70">
                    <GripVertical className="h-3 w-3" />
                  </span>

                  <span className="min-w-0 flex-1 truncate">{row.name}</span>

                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-secondary-foreground">
                    {formatStitchType(row.stitchType)}
                  </span>

                  {hasOverrideBadges(row.overrides) && (
                    <span className="hidden items-center gap-1 md:flex">
                      {row.overrides.allow_reverse !== null && (
                        <span
                          className="rounded border border-border/60 px-1 py-0.5 text-[8px] uppercase tracking-wide"
                          title={`allow reverse override: ${row.overrides.allow_reverse ? "on" : "off"}`}
                          data-testid={`sequencer-routing-badge-rev-${row.blockId}`}
                        >
                          REV
                        </span>
                      )}
                      {row.overrides.entry_exit_mode !== null && (
                        <span
                          className="rounded border border-border/60 px-1 py-0.5 text-[8px] uppercase tracking-wide"
                          title={`entry/exit override: ${row.overrides.entry_exit_mode}`}
                          data-testid={`sequencer-routing-badge-entry-${row.blockId}`}
                        >
                          ENTRY
                        </span>
                      )}
                      {row.overrides.tie_mode !== null && (
                        <span
                          className="rounded border border-border/60 px-1 py-0.5 text-[8px] uppercase tracking-wide"
                          title={`tie mode override: ${row.overrides.tie_mode}`}
                          data-testid={`sequencer-routing-badge-tie-${row.blockId}`}
                        >
                          TIE
                        </span>
                      )}
                    </span>
                  )}

                  {hasCommandOverrideBadges(row.commandOverrides) && (
                    <span className="hidden items-center gap-1 md:flex">
                      {row.commandOverrides.trim_before !== null && (
                        <span
                          className="rounded border border-border/60 px-1 py-0.5 text-[8px] uppercase tracking-wide"
                          title={`trim before override: ${row.commandOverrides.trim_before ? "on" : "off"}`}
                          data-testid={`sequencer-command-badge-trim-before-${row.blockId}`}
                        >
                          TB
                        </span>
                      )}
                      {row.commandOverrides.trim_after !== null && (
                        <span
                          className="rounded border border-border/60 px-1 py-0.5 text-[8px] uppercase tracking-wide"
                          title={`trim after override: ${row.commandOverrides.trim_after ? "on" : "off"}`}
                          data-testid={`sequencer-command-badge-trim-after-${row.blockId}`}
                        >
                          TA
                        </span>
                      )}
                      {row.commandOverrides.tie_in !== null && (
                        <span
                          className="rounded border border-border/60 px-1 py-0.5 text-[8px] uppercase tracking-wide"
                          title={`tie in override: ${row.commandOverrides.tie_in ? "on" : "off"}`}
                          data-testid={`sequencer-command-badge-tie-in-${row.blockId}`}
                        >
                          TI
                        </span>
                      )}
                      {row.commandOverrides.tie_out !== null && (
                        <span
                          className="rounded border border-border/60 px-1 py-0.5 text-[8px] uppercase tracking-wide"
                          title={`tie out override: ${row.commandOverrides.tie_out ? "on" : "off"}`}
                          data-testid={`sequencer-command-badge-tie-out-${row.blockId}`}
                        >
                          TO
                        </span>
                      )}
                    </span>
                  )}

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

                <button
                  type="button"
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border/50 text-muted-foreground/80 hover:bg-accent/40 hover:text-foreground",
                    isExpanded && "text-foreground",
                  )}
                  onClick={() => toggleExpandedRow(row.blockId)}
                  title="Per-row routing controls"
                  data-testid={`sequencer-routing-toggle-${row.blockId}`}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              {isExpanded && (
                <div className="mt-1 space-y-1 rounded-md border border-border/60 bg-card/80 p-2">
                  <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                    Allow Reverse
                    <select
                      className="h-7 rounded border border-border/40 bg-card px-2 text-[11px] text-foreground"
                      value={toAllowReverseControlValue(row.overrides.allow_reverse)}
                      onChange={(event) =>
                        applyOverridePatch(row, {
                          allow_reverse: fromAllowReverseControlValue(
                            event.target.value as AllowReverseControlValue,
                          ),
                        })
                      }
                      disabled={row.locked}
                      data-testid={`sequencer-routing-allow-reverse-${row.blockId}`}
                    >
                      <option value="inherit">Inherit Global</option>
                      <option value="force_on">Force On</option>
                      <option value="force_off">Force Off</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                    Entry / Exit
                    <select
                      className="h-7 rounded border border-border/40 bg-card px-2 text-[11px] text-foreground"
                      value={toEntryExitControlValue(row.overrides.entry_exit_mode)}
                      onChange={(event) =>
                        applyOverridePatch(row, {
                          entry_exit_mode:
                            event.target.value === "inherit"
                              ? null
                              : (event.target.value as RoutingEntryExitMode),
                        })
                      }
                      disabled={row.locked}
                      data-testid={`sequencer-routing-entry-exit-${row.blockId}`}
                      title="User Anchor requires anchor editing workflow (planned)"
                    >
                      <option value="inherit">Inherit Global</option>
                      <option value="auto">Auto</option>
                      <option value="preserve_shape_start">Preserve Start</option>
                      <option value="user_anchor">User Anchor</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                    Tie Mode
                    <select
                      className="h-7 rounded border border-border/40 bg-card px-2 text-[11px] text-foreground"
                      value={toTieModeControlValue(row.overrides.tie_mode)}
                      onChange={(event) =>
                        applyOverridePatch(row, {
                          tie_mode:
                            event.target.value === "inherit"
                              ? null
                              : (event.target.value as RoutingTieMode),
                        })
                      }
                      disabled={row.locked}
                      data-testid={`sequencer-routing-tie-mode-${row.blockId}`}
                    >
                      <option value="inherit">Inherit Global</option>
                      <option value="off">Off</option>
                      <option value="shape_start_end">Shape Start/End</option>
                      <option value="color_change">Color Change</option>
                    </select>
                  </label>

                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                      Trim Before
                      <select
                        className="h-7 rounded border border-border/40 bg-card px-2 text-[11px] text-foreground"
                        value={toBoolOverrideControlValue(row.commandOverrides.trim_before)}
                        onChange={(event) =>
                          applyCommandOverridePatch(row, {
                            trim_before: fromBoolOverrideControlValue(
                              event.target.value as BoolOverrideControlValue,
                            ),
                          })
                        }
                        disabled={row.locked}
                        data-testid={`sequencer-command-trim-before-${row.blockId}`}
                      >
                        <option value="inherit">Inherit</option>
                        <option value="force_on">Force On</option>
                        <option value="force_off">Force Off</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                      Trim After
                      <select
                        className="h-7 rounded border border-border/40 bg-card px-2 text-[11px] text-foreground"
                        value={toBoolOverrideControlValue(row.commandOverrides.trim_after)}
                        onChange={(event) =>
                          applyCommandOverridePatch(row, {
                            trim_after: fromBoolOverrideControlValue(
                              event.target.value as BoolOverrideControlValue,
                            ),
                          })
                        }
                        disabled={row.locked}
                        data-testid={`sequencer-command-trim-after-${row.blockId}`}
                      >
                        <option value="inherit">Inherit</option>
                        <option value="force_on">Force On</option>
                        <option value="force_off">Force Off</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                      Tie In
                      <select
                        className="h-7 rounded border border-border/40 bg-card px-2 text-[11px] text-foreground"
                        value={toBoolOverrideControlValue(row.commandOverrides.tie_in)}
                        onChange={(event) =>
                          applyCommandOverridePatch(row, {
                            tie_in: fromBoolOverrideControlValue(
                              event.target.value as BoolOverrideControlValue,
                            ),
                          })
                        }
                        disabled={row.locked}
                        data-testid={`sequencer-command-tie-in-${row.blockId}`}
                      >
                        <option value="inherit">Inherit</option>
                        <option value="force_on">Force On</option>
                        <option value="force_off">Force Off</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 text-[10px] text-muted-foreground">
                      Tie Out
                      <select
                        className="h-7 rounded border border-border/40 bg-card px-2 text-[11px] text-foreground"
                        value={toBoolOverrideControlValue(row.commandOverrides.tie_out)}
                        onChange={(event) =>
                          applyCommandOverridePatch(row, {
                            tie_out: fromBoolOverrideControlValue(
                              event.target.value as BoolOverrideControlValue,
                            ),
                          })
                        }
                        disabled={row.locked}
                        data-testid={`sequencer-command-tie-out-${row.blockId}`}
                      >
                        <option value="inherit">Inherit</option>
                        <option value="force_on">Force On</option>
                        <option value="force_off">Force Off</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {contextMenu && (
        <div
          className="fixed z-50 w-56 rounded-md border border-border/60 bg-popover p-1 shadow-2xl"
          style={clampMenuPosition(contextMenu.screenX, contextMenu.screenY, 224, 220)}
          data-testid="sequencer-context-menu"
        >
          <button
            type="button"
            className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
            onClick={() => handleSequencerContextAction("move_top", contextMenu.row)}
            data-testid="sequencer-context-move-top"
          >
            Move to Top
          </button>
          <button
            type="button"
            className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
            onClick={() => handleSequencerContextAction("move_bottom", contextMenu.row)}
            data-testid="sequencer-context-move-bottom"
          >
            Move to Bottom
          </button>
          <button
            type="button"
            className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
            onClick={() => setContextMenu(null)}
            data-testid="sequencer-context-insert-color-change"
          >
            Insert Color Change
          </button>
          <button
            type="button"
            className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
            onClick={() => setContextMenu(null)}
            data-testid="sequencer-context-group-adjacent"
          >
            Group with Adjacent
          </button>
          <button
            type="button"
            className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/40"
            onClick={() => handleSequencerContextAction("duplicate", contextMenu.row)}
            data-testid="sequencer-context-duplicate"
          >
            Duplicate
          </button>
          <button
            type="button"
            className="block w-full rounded px-2 py-1 text-left text-xs text-destructive hover:bg-destructive/10"
            onClick={() => handleSequencerContextAction("remove", contextMenu.row)}
            data-testid="sequencer-context-remove"
          >
            Remove
          </button>
        </div>
      )}
    </>
  );
}
