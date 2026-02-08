import type { VisionEngine } from "@vision/wasm-bridge";
import { useCallback, useEffect, useState } from "react";

/** Selection state and actions. */
export interface UseSelectionResult {
  selectedIds: Set<number>;
  hoveredId: number | null;
  selectNode: (id: number, addToSelection?: boolean) => void;
  deselectAll: () => void;
  deleteSelected: () => void;
  setHoveredId: (id: number | null) => void;
}

/**
 * Hook to manage selection state with undo/redo keyboard shortcuts.
 */
export function useSelection(
  engine: VisionEngine | null,
  refreshScene: () => void,
): UseSelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const selectNode = useCallback((id: number, addToSelection = false) => {
    setSelectedIds((prev) => {
      if (addToSelection) {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      }
      return new Set([id]);
    });
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const deleteSelected = useCallback(() => {
    if (!engine || selectedIds.size === 0) return;
    for (const id of selectedIds) {
      try {
        engine.sceneRemoveNode(id);
      } catch {
        // Node may already be removed as child of another deleted node
      }
    }
    setSelectedIds(new Set());
    refreshScene();
  }, [engine, selectedIds, refreshScene]);

  // Keyboard shortcuts: Delete, Ctrl+Z, Ctrl+Shift+Z
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // Delete selected nodes
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.size > 0) {
          e.preventDefault();
          deleteSelected();
        }
      }

      // Undo: Ctrl+Z
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        if (engine) {
          engine.sceneUndo();
          refreshScene();
        }
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if (
        (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
        (e.key === "y" && (e.ctrlKey || e.metaKey))
      ) {
        e.preventDefault();
        if (engine) {
          engine.sceneRedo();
          refreshScene();
        }
      }

      // Escape: deselect all
      if (e.key === "Escape") {
        deselectAll();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [engine, selectedIds, deleteSelected, deselectAll, refreshScene]);

  return {
    selectedIds,
    hoveredId,
    selectNode,
    deselectAll,
    deleteSelected,
    setHoveredId,
  };
}
