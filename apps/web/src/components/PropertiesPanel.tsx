import type { SceneNodeInfo, VisionEngine } from "@vision/wasm-bridge";
import { useCallback, useEffect, useState } from "react";

import { Input } from "@/components/ui/input";

interface PropertiesPanelProps {
  engine: VisionEngine;
  selectedIds: Set<number>;
  onRefreshScene: () => void;
}

export function PropertiesPanel({ engine, selectedIds, onRefreshScene }: PropertiesPanelProps) {
  const [nodeInfo, setNodeInfo] = useState<SceneNodeInfo | null>(null);

  // Load selected node info
  useEffect(() => {
    if (selectedIds.size !== 1) {
      setNodeInfo(null);
      return;
    }

    const id = [...selectedIds][0];
    const info = engine.sceneGetNode(id);
    setNodeInfo(info);
  }, [engine, selectedIds]);

  if (selectedIds.size === 0) {
    return <p className="text-xs italic text-muted-foreground/60">Select an object</p>;
  }

  if (selectedIds.size > 1) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 items-center rounded-full bg-secondary px-2 text-[10px] font-medium text-secondary-foreground">
          {selectedIds.size}
        </span>
        <span className="text-xs text-muted-foreground">objects selected</span>
      </div>
    );
  }

  if (!nodeInfo) {
    return <p className="text-xs italic text-muted-foreground/60">Loading...</p>;
  }

  return (
    <div className="flex flex-col gap-3" data-testid="properties-panel">
      {/* Node name */}
      <div className="flex flex-col gap-1">
        <PropLabel htmlFor="prop-name">Name</PropLabel>
        <Input
          id="prop-name"
          type="text"
          className="h-7 rounded-md bg-surface px-2 text-xs"
          value={nodeInfo.name}
          onChange={(e) => {
            const id = [...selectedIds][0];
            engine.sceneRenameNode(id, e.target.value);
            setNodeInfo({ ...nodeInfo, name: e.target.value });
          }}
          data-testid="prop-name-input"
        />
      </div>

      {/* Transform */}
      <TransformFields
        engine={engine}
        nodeInfo={nodeInfo}
        selectedIds={selectedIds}
        onRefreshScene={onRefreshScene}
        setNodeInfo={setNodeInfo}
      />

      {/* Shape-specific properties */}
      <ShapeFields nodeInfo={nodeInfo} />
    </div>
  );
}

// ============================================================================
// Prop Label
// ============================================================================

function PropLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70"
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}

// ============================================================================
// Transform Fields
// ============================================================================

function TransformFields({
  engine,
  nodeInfo,
  selectedIds,
  onRefreshScene,
  setNodeInfo,
}: {
  engine: VisionEngine;
  nodeInfo: SceneNodeInfo;
  selectedIds: Set<number>;
  onRefreshScene: () => void;
  setNodeInfo: (info: SceneNodeInfo) => void;
}) {
  const t = nodeInfo.transform;

  const updateTransform = useCallback(
    (field: string, value: number) => {
      const id = [...selectedIds][0];
      const newTransform = {
        x: field === "x" ? value : t.x,
        y: field === "y" ? value : t.y,
        rotation: field === "rotation" ? value : t.rotation,
        scaleX: field === "scaleX" ? value : t.scale_x,
        scaleY: field === "scaleY" ? value : t.scale_y,
      };

      engine.sceneUpdateTransform(id, newTransform);
      onRefreshScene();

      // Update local state
      setNodeInfo({
        ...nodeInfo,
        transform: {
          x: newTransform.x,
          y: newTransform.y,
          rotation: newTransform.rotation,
          scale_x: newTransform.scaleX,
          scale_y: newTransform.scaleY,
        },
      });
    },
    [engine, selectedIds, t, nodeInfo, onRefreshScene, setNodeInfo],
  );

  return (
    <div className="flex flex-col gap-1.5">
      <PropLabel>Transform</PropLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <PropInput label="X" value={t.x} onChange={(v) => updateTransform("x", v)} />
        <PropInput label="Y" value={t.y} onChange={(v) => updateTransform("y", v)} />
        <PropInput
          label="R"
          value={Number(((t.rotation * 180) / Math.PI).toFixed(1))}
          onChange={(v) => updateTransform("rotation", (v * Math.PI) / 180)}
        />
        <PropInput label="S" value={t.scale_x} onChange={(v) => updateTransform("scaleX", v)} />
      </div>
    </div>
  );
}

// ============================================================================
// Shape Fields
// ============================================================================

function ShapeFields({ nodeInfo }: { nodeInfo: SceneNodeInfo }) {
  const kind = nodeInfo.kind;
  if (typeof kind === "string") return null;
  if (!("Shape" in kind)) return null;

  const { shape, fill, stroke, stroke_width } = kind.Shape;

  let shapeType = "Unknown";
  let shapeDetails = "";
  if ("Rect" in shape) {
    shapeType = "Rectangle";
    shapeDetails = `${shape.Rect.width.toFixed(1)} x ${shape.Rect.height.toFixed(1)} mm`;
  } else if ("Ellipse" in shape) {
    shapeType = "Ellipse";
    shapeDetails = `${shape.Ellipse.rx.toFixed(1)} x ${shape.Ellipse.ry.toFixed(1)} mm`;
  } else if ("Polygon" in shape) {
    shapeType = `Polygon (${shape.Polygon.sides} sides)`;
    shapeDetails = `r=${shape.Polygon.radius.toFixed(1)} mm`;
  } else if ("Path" in shape) {
    shapeType = "Path";
    shapeDetails = `${shape.Path.commands.length} commands`;
  }

  return (
    <div className="flex flex-col gap-2">
      <PropLabel>Shape</PropLabel>

      {/* Type badge + dimensions */}
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 items-center rounded-full bg-secondary px-2 text-[10px] font-medium text-secondary-foreground">
          {shapeType}
        </span>
        <span className="text-[10px] text-muted-foreground/60">{shapeDetails}</span>
      </div>

      {/* Fill & Stroke */}
      <div className="flex flex-col gap-1.5">
        {fill && (
          <div className="flex items-center gap-2">
            <div
              className="h-5 w-5 shrink-0 rounded-md border border-border/40"
              style={{ backgroundColor: `rgb(${fill.r},${fill.g},${fill.b})` }}
            />
            <span className="text-[10px] text-muted-foreground/70">Fill</span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground/50">
              {toHex(fill.r, fill.g, fill.b)}
            </span>
          </div>
        )}

        {stroke && (
          <div className="flex items-center gap-2">
            <div
              className="h-5 w-5 shrink-0 rounded-md border border-border/40"
              style={{ backgroundColor: `rgb(${stroke.r},${stroke.g},${stroke.b})` }}
            />
            <span className="text-[10px] text-muted-foreground/70">Stroke</span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground/50">
              {stroke_width.toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Prop Input (compact number field)
// ============================================================================

function PropInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(value.toFixed(1));

  useEffect(() => {
    setText(value.toFixed(1));
  }, [value]);

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-4 text-[10px] font-medium text-muted-foreground/60">{label}</span>
      <Input
        type="text"
        className="h-6 rounded-md bg-surface px-1.5 text-[11px] tabular-nums"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const v = Number.parseFloat(text);
          if (!Number.isNaN(v)) {
            onChange(v);
          } else {
            setText(value.toFixed(1));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const v = Number.parseFloat(text);
            if (!Number.isNaN(v)) {
              onChange(v);
            }
          }
        }}
      />
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function toHex(r: number, g: number, b: number): string {
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
