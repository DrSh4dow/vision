import type { TreeNode, TreeNodeKind, VisionEngine } from "@vision/wasm-bridge";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FolderClosed,
  FolderOpen,
  Layers,
  Lock,
  Spline,
  Unlock,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface LayersPanelProps {
  engine: VisionEngine;
  selectedIds: Set<number>;
  onSelectNode: (id: number, addToSelection?: boolean) => void;
  onRefreshScene: () => void;
}

export function LayersPanel({
  engine,
  selectedIds,
  onSelectNode,
  onRefreshScene,
}: LayersPanelProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Refresh tree from scene
  const refreshTree = useCallback(() => {
    const t = engine.sceneGetTree();
    setTree(t);

    // Auto-expand all layers on first load
    const layerIds = new Set<number>();
    for (const node of t) {
      if (typeof node.kind !== "string" && "Layer" in node.kind) {
        layerIds.add(node.id["0"]);
      }
    }
    setExpanded((prev) => {
      if (prev.size === 0 && layerIds.size > 0) return layerIds;
      return prev;
    });
  }, [engine]);

  // Refresh tree when scene changes (poll on interval since we have no event system)
  useEffect(() => {
    refreshTree();
    const interval = setInterval(refreshTree, 500);
    return () => clearInterval(interval);
  }, [refreshTree]);

  const toggleExpanded = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleVisibility = useCallback(
    (id: number, kind: TreeNodeKind) => {
      if (typeof kind === "string" || !("Layer" in kind)) return;
      const node = engine.sceneGetNode(id);
      const name = node?.name ?? "Layer";
      const newKind = {
        Layer: {
          name,
          visible: !kind.Layer.visible,
          locked: kind.Layer.locked,
        },
      };
      engine.sceneUpdateKind(id, newKind);
      onRefreshScene();
      refreshTree();
    },
    [engine, onRefreshScene, refreshTree],
  );

  const toggleLock = useCallback(
    (id: number, kind: TreeNodeKind) => {
      if (typeof kind === "string" || !("Layer" in kind)) return;
      const node = engine.sceneGetNode(id);
      const name = node?.name ?? "Layer";
      const newKind = {
        Layer: {
          name,
          visible: kind.Layer.visible,
          locked: !kind.Layer.locked,
        },
      };
      engine.sceneUpdateKind(id, newKind);
      onRefreshScene();
      refreshTree();
    },
    [engine, onRefreshScene, refreshTree],
  );

  if (tree.length === 0) {
    return <p className="px-1.5 text-xs italic text-muted-foreground/60">No layers yet</p>;
  }

  return (
    <div className="flex flex-col" data-testid="layers-tree">
      {tree.map((node) => (
        <LayerTreeNode
          key={node.id["0"]}
          node={node}
          depth={0}
          selectedIds={selectedIds}
          expanded={expanded}
          onSelect={onSelectNode}
          onToggleExpanded={toggleExpanded}
          onToggleVisibility={toggleVisibility}
          onToggleLock={toggleLock}
        />
      ))}
    </div>
  );
}

function LayerTreeNode({
  node,
  depth,
  selectedIds,
  expanded,
  onSelect,
  onToggleExpanded,
  onToggleVisibility,
  onToggleLock,
}: {
  node: TreeNode;
  depth: number;
  selectedIds: Set<number>;
  expanded: Set<number>;
  onSelect: (id: number, addToSelection?: boolean) => void;
  onToggleExpanded: (id: number) => void;
  onToggleVisibility: (id: number, kind: TreeNodeKind) => void;
  onToggleLock: (id: number, kind: TreeNodeKind) => void;
}) {
  const id = node.id["0"];
  const isSelected = selectedIds.has(id);
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(id);
  const isLayer = typeof node.kind !== "string" && "Layer" in node.kind;
  const isGroup = node.kind === "Group";

  let visible = true;
  let locked = false;
  if (isLayer) {
    const layerKind = node.kind as { Layer: { visible: boolean; locked: boolean } };
    visible = layerKind.Layer.visible;
    locked = layerKind.Layer.locked;
  }

  return (
    <>
      <div
        className={cn(
          "group relative flex h-7 items-center gap-1 rounded-md px-1 text-[11px] cursor-pointer select-none transition-colors",
          isSelected
            ? "bg-accent/70 text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/30 hover:text-foreground",
          !visible && "opacity-40",
        )}
        style={{ paddingLeft: `${depth * 14 + 6}px` }}
        data-testid={`layer-node-${id}`}
        onClick={(e) => onSelect(id, e.shiftKey)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSelect(id);
        }}
        role="treeitem"
        tabIndex={0}
      >
        {/* Indent guide line */}
        {depth > 0 && (
          <span
            className="absolute top-0 bottom-0 w-px bg-border/20"
            style={{ left: `${depth * 14 + 2}px` }}
          />
        )}

        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors hover:bg-muted/50"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded(id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Kind icon */}
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground/60">
          {isLayer ? (
            <Layers className="h-3 w-3" />
          ) : isGroup ? (
            isExpanded ? (
              <FolderOpen className="h-3 w-3" />
            ) : (
              <FolderClosed className="h-3 w-3" />
            )
          ) : (
            <Spline className="h-3 w-3" />
          )}
        </span>

        {/* Node name */}
        <span className="flex-1 truncate">{node.name}</span>

        {/* Layer-specific controls — show on hover, always when toggled */}
        {isLayer && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded transition-all",
                visible
                  ? "opacity-0 group-hover:opacity-100 hover:bg-muted/50"
                  : "opacity-100 hover:bg-muted/50",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility(id, node.kind);
              }}
              title={visible ? "Hide layer" : "Show layer"}
            >
              {visible ? (
                <Eye className="h-3 w-3 text-muted-foreground/60" />
              ) : (
                <EyeOff className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
            <button
              type="button"
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded transition-all",
                !locked
                  ? "opacity-0 group-hover:opacity-100 hover:bg-muted/50"
                  : "opacity-100 hover:bg-muted/50",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock(id, node.kind);
              }}
              title={locked ? "Unlock layer" : "Lock layer"}
            >
              {locked ? (
                <Lock className="h-3 w-3 text-muted-foreground" />
              ) : (
                <Unlock className="h-3 w-3 text-muted-foreground/60" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren &&
        isExpanded &&
        node.children.map((child) => (
          <LayerTreeNode
            key={child.id["0"]}
            node={child}
            depth={depth + 1}
            selectedIds={selectedIds}
            expanded={expanded}
            onSelect={onSelect}
            onToggleExpanded={onToggleExpanded}
            onToggleVisibility={onToggleVisibility}
            onToggleLock={onToggleLock}
          />
        ))}
    </>
  );
}
