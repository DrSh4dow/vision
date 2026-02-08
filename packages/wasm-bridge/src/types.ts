/**
 * Vision WASM Bridge — Type Definitions
 *
 * All exported type/interface definitions used across the bridge layer.
 */

// ============================================================================
// Engine Types
// ============================================================================

/** 2D point in design space (millimeters). */
export interface Point {
  x: number;
  y: number;
}

/** RGBA color (0-255 per channel). */
export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Thread brand and color mapping. */
export interface ThreadColor {
  brand: string;
  code: string;
  name: string;
  r: number;
  g: number;
  b: number;
}

/** Thread brand identifiers. */
export type ThreadBrand = "madeira" | "isacord" | "sulky";

/** Stitch type enumeration (mirrors Rust StitchType). */
export type StitchType = "running" | "satin" | "tatami" | "spiral" | "contour" | "motif";

/** Motif pattern variant for motif fill stitches. */
export type MotifPattern = "diamond" | "wave" | "triangle";
/** Satin underlay mode variant. */
export type UnderlayMode =
  | "none"
  | "center_walk"
  | "edge_walk"
  | "zigzag"
  | "center_edge"
  | "center_zigzag"
  | "edge_zigzag"
  | "full";
/** Pull compensation mode for satin stitches. */
export type CompensationMode = "off" | "auto" | "directional";
/** Fill start strategy for fill stitches. */
export type FillStartMode = "auto" | "center" | "edge";

/** Stitch parameters for an embroidery object. */
export interface StitchParams {
  type: StitchType;
  density: number;
  angle: number;
  underlay_mode: UnderlayMode;
  underlay_spacing_mm: number;
  underlay_enabled: boolean;
  pull_compensation: number;
  compensation_mode: CompensationMode;
  compensation_x_mm: number;
  compensation_y_mm: number;
  fill_phase: number;
  min_segment_mm: number;
  overlap_mm: number;
  edge_walk_on_fill: boolean;
  fill_start_mode: FillStartMode;
  contour_step_mm: number;
  motif_pattern: MotifPattern;
  motif_scale: number;
}

/** A single stitch with metadata. */
export interface Stitch {
  position: Point;
  is_jump: boolean;
  is_trim: boolean;
}

/** Satin stitch underlay configuration. */
export interface UnderlayConfig {
  center_walk: boolean;
  edge_walk: boolean;
  zigzag: boolean;
  zigzag_spacing: number;
  stitch_length: number;
}

/** Result of satin stitch generation. */
export interface SatinResult {
  stitches: Stitch[];
  underlay_count: number;
}

/** Export stitch type. */
export type ExportStitchType = "Normal" | "Jump" | "Trim" | "ColorChange" | "End";

/** A single stitch for file export. */
export interface ExportStitch {
  x: number;
  y: number;
  stitch_type: ExportStitchType;
}

/** A complete design ready for export. */
export interface ExportDesign {
  name: string;
  stitches: ExportStitch[];
  colors: Color[];
}

/** Route quality metrics for an exported design. */
export interface RouteMetrics {
  jump_count: number;
  trim_count: number;
  color_change_count: number;
  travel_distance_mm: number;
  longest_travel_mm: number;
  route_score: number;
}

/** Routing optimization policy. */
export type RoutingPolicy = "balanced" | "min_travel" | "min_trims";
/** Entry/exit mode for stitch blocks. */
export type RoutingEntryExitMode = "auto" | "preserve_shape_start" | "user_anchor";
/** Tie stitch insertion mode. */
export type RoutingTieMode = "off" | "shape_start_end" | "color_change";
/** Sequencing mode for stitch block ordering. */
export type RoutingSequenceMode = "strict_sequencer" | "optimizer";

/** Routing options used when exporting scene stitches. */
export interface RoutingOptions {
  policy: RoutingPolicy;
  max_jump_mm: number;
  trim_threshold_mm: number;
  preserve_color_order: boolean;
  preserve_layer_order: boolean;
  allow_reverse: boolean;
  allow_color_merge: boolean;
  allow_underpath: boolean;
  entry_exit_mode: RoutingEntryExitMode;
  tie_mode: RoutingTieMode;
  min_stitch_run_before_trim_mm: number;
  sequence_mode: RoutingSequenceMode;
}

// ============================================================================
// Scene Graph Types
// ============================================================================

/** 2D affine transform. */
export interface TransformData {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

/** Path command (matches Rust serde JSON format). */
export type PathCommand =
  | { MoveTo: Point }
  | { LineTo: Point }
  | { CubicTo: { c1: Point; c2: Point; end: Point } }
  | { QuadTo: { ctrl: Point; end: Point } }
  | "Close";

/** Shape kind discriminated union. */
export type ShapeKindData =
  | { Path: { commands: PathCommand[]; closed: boolean } }
  | { Rect: { width: number; height: number; corner_radius: number } }
  | { Ellipse: { rx: number; ry: number } }
  | { Polygon: { sides: number; radius: number } };

/** Node kind (matches Rust NodeKind serde JSON format). */
export type NodeKindData =
  | { Layer: { name: string; visible: boolean; locked: boolean } }
  | "Group"
  | {
      Shape: {
        shape: ShapeKindData;
        fill: Color | null;
        stroke: Color | null;
        stroke_width: number;
        stitch: StitchParams;
      };
    };

/** Scene node info returned by getNode(). */
export interface SceneNodeInfo {
  id: number;
  name: string;
  transform: {
    x: number;
    y: number;
    rotation: number;
    scale_x: number;
    scale_y: number;
  };
  kind: NodeKindData;
  children: number[];
  parent: number | null;
}

/** Tree node kind for layers panel. */
export type TreeNodeKind = { Layer: { visible: boolean; locked: boolean } } | "Group" | "Shape";

/** Tree node for layers panel. */
export interface TreeNode {
  id: number;
  name: string;
  kind: TreeNodeKind;
  children: TreeNode[];
}

/** A render item — visible shape with computed world transform. */
export interface RenderItem {
  id: number;
  world_transform: [number, number, number, number, number, number];
  kind: NodeKindData;
  name: string;
}

/** Axis-aligned bounding box. */
export interface BoundingBox {
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
}

/** Path data with commands and closed flag. */
export interface PathData {
  commands: PathCommand[];
  closed: boolean;
}
