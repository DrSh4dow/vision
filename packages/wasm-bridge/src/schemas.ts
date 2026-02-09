/**
 * Vision WASM Bridge — Zod v4 Schemas
 *
 * Runtime validation schemas for all types that come back from JSON.parse
 * at the WASM boundary. Use these to validate untrusted data from the engine.
 */

import { z } from "zod/v4";

import type { TreeNode } from "./types";

// ============================================================================
// Primitive Schemas
// ============================================================================

const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const ColorSchema = z.object({
  r: z.number(),
  g: z.number(),
  b: z.number(),
  a: z.number(),
});

// ============================================================================
// Thread Schemas
// ============================================================================

export const ThreadColorSchema = z.object({
  brand: z.string(),
  code: z.string(),
  name: z.string(),
  r: z.number(),
  g: z.number(),
  b: z.number(),
});

// ============================================================================
// Stitch Schemas
// ============================================================================

const StitchTypeSchema = z.enum(["running", "satin", "tatami", "spiral", "contour", "motif"]);
const MotifPatternSchema = z.enum(["diamond", "wave", "triangle"]);
const UnderlayModeSchema = z.enum([
  "none",
  "center_walk",
  "edge_walk",
  "zigzag",
  "center_edge",
  "center_zigzag",
  "edge_zigzag",
  "full",
]);
const CompensationModeSchema = z.enum(["off", "auto", "directional"]);
const FillStartModeSchema = z.enum(["auto", "center", "edge"]);

export const StitchParamsSchema = z.object({
  type: StitchTypeSchema,
  density: z.number(),
  angle: z.number(),
  underlay_mode: UnderlayModeSchema.default("none"),
  underlay_spacing_mm: z.number().default(2),
  underlay_enabled: z.boolean().default(false),
  pull_compensation: z.number().default(0),
  compensation_mode: CompensationModeSchema.default("auto"),
  compensation_x_mm: z.number().default(0),
  compensation_y_mm: z.number().default(0),
  fill_phase: z.number().default(0),
  min_segment_mm: z.number().default(0.4),
  overlap_mm: z.number().default(0),
  edge_walk_on_fill: z.boolean().default(false),
  fill_start_mode: FillStartModeSchema.default("auto"),
  contour_step_mm: z.number().default(1.2),
  motif_pattern: MotifPatternSchema.default("diamond"),
  motif_scale: z.number().default(1),
});

const StitchSchema = z.object({
  position: PointSchema,
  is_jump: z.boolean(),
  is_trim: z.boolean(),
});

export const SatinResultSchema = z.object({
  stitches: z.array(StitchSchema),
  underlay_count: z.number(),
});

// ============================================================================
// Export Schemas
// ============================================================================

const ExportStitchTypeSchema = z.enum(["Normal", "Jump", "Trim", "ColorChange", "End"]);

const ExportStitchSchema = z.object({
  x: z.number(),
  y: z.number(),
  stitch_type: ExportStitchTypeSchema,
});

export const ExportDesignSchema = z.object({
  name: z.string(),
  stitches: z.array(ExportStitchSchema),
  colors: z.array(ColorSchema),
});

export const RouteMetricsSchema = z.object({
  jump_count: z.number(),
  trim_count: z.number(),
  color_change_count: z.number(),
  travel_distance_mm: z.number(),
  longest_travel_mm: z.number().default(0),
  route_score: z.number().default(0),
});

export const QualityMetricsSchema = z.object({
  stitch_count: z.number(),
  jump_count: z.number(),
  trim_count: z.number(),
  color_change_count: z.number(),
  travel_distance_mm: z.number(),
  longest_travel_mm: z.number(),
  route_score: z.number(),
  mean_stitch_length_mm: z.number(),
  stitch_length_p95_mm: z.number(),
  density_error_mm: z.number(),
  angle_error_deg: z.number(),
  coverage_error_pct: z.number(),
});

const RoutingPolicySchema = z.enum(["balanced", "min_travel", "min_trims"]);
const RoutingEntryExitModeSchema = z.enum(["auto", "preserve_shape_start", "user_anchor"]);
const RoutingTieModeSchema = z.enum(["off", "shape_start_end", "color_change"]);
const RoutingSequenceModeSchema = z.enum(["strict_sequencer", "optimizer"]);

export const RoutingOptionsSchema = z.object({
  policy: RoutingPolicySchema.default("balanced"),
  max_jump_mm: z.number().default(25),
  trim_threshold_mm: z.number().default(12),
  preserve_color_order: z.boolean().default(true),
  preserve_layer_order: z.boolean().default(false),
  allow_reverse: z.boolean().default(true),
  allow_color_merge: z.boolean().default(false),
  allow_underpath: z.boolean().default(true),
  entry_exit_mode: RoutingEntryExitModeSchema.default("auto"),
  tie_mode: RoutingTieModeSchema.default("shape_start_end"),
  min_stitch_run_before_trim_mm: z.number().default(2),
  sequence_mode: RoutingSequenceModeSchema.default("strict_sequencer"),
});

export const ObjectRoutingOverridesSchema = z.object({
  allow_reverse: z.boolean().nullable().default(null),
  entry_exit_mode: RoutingEntryExitModeSchema.nullable().default(null),
  tie_mode: RoutingTieModeSchema.nullable().default(null),
});

export const EmbroideryObjectSchema = z.object({
  id: z.number(),
  source_node_id: z.number(),
  stitch: StitchParamsSchema,
  fill: ColorSchema.nullable(),
  stroke: ColorSchema.nullable(),
  stroke_width: z.number(),
});

export const StitchBlockSchema = z.object({
  id: z.number(),
  object_id: z.number(),
  source_node_id: z.number(),
  stitch_type: StitchTypeSchema,
  color: ColorSchema.nullable(),
  routing_overrides: ObjectRoutingOverridesSchema,
});

export const SequenceTrackSchema = z.object({
  ordered_block_ids: z.array(z.number()),
});

// ============================================================================
// Scene Graph Schemas
// ============================================================================

const PathCommandSchema: z.ZodType<
  | { MoveTo: { x: number; y: number } }
  | { LineTo: { x: number; y: number } }
  | {
      CubicTo: {
        c1: { x: number; y: number };
        c2: { x: number; y: number };
        end: { x: number; y: number };
      };
    }
  | {
      QuadTo: {
        ctrl: { x: number; y: number };
        end: { x: number; y: number };
      };
    }
  | "Close"
> = z.union([
  z.object({ MoveTo: PointSchema }),
  z.object({ LineTo: PointSchema }),
  z.object({
    CubicTo: z.object({
      c1: PointSchema,
      c2: PointSchema,
      end: PointSchema,
    }),
  }),
  z.object({
    QuadTo: z.object({ ctrl: PointSchema, end: PointSchema }),
  }),
  z.literal("Close"),
]);

const ShapeKindDataSchema = z.union([
  z.object({
    Path: z.object({
      commands: z.array(PathCommandSchema),
      closed: z.boolean(),
    }),
  }),
  z.object({
    Rect: z.object({
      width: z.number(),
      height: z.number(),
      corner_radius: z.number(),
    }),
  }),
  z.object({
    Ellipse: z.object({ rx: z.number(), ry: z.number() }),
  }),
  z.object({
    Polygon: z.object({ sides: z.number(), radius: z.number() }),
  }),
]);

const NodeKindDataSchema = z.union([
  z.object({
    Layer: z.object({
      name: z.string(),
      visible: z.boolean(),
      locked: z.boolean(),
    }),
  }),
  z.literal("Group"),
  z.object({
    Shape: z.object({
      shape: ShapeKindDataSchema,
      fill: ColorSchema.nullable(),
      stroke: ColorSchema.nullable(),
      stroke_width: z.number(),
      stitch: StitchParamsSchema,
    }),
  }),
]);

export const SceneNodeInfoSchema = z.object({
  id: z.number(),
  name: z.string(),
  transform: z.object({
    x: z.number(),
    y: z.number(),
    rotation: z.number(),
    scale_x: z.number(),
    scale_y: z.number(),
  }),
  kind: NodeKindDataSchema,
  children: z.array(z.number()),
  parent: z.number().nullable(),
});

const TreeNodeKindSchema = z.union([
  z.object({
    Layer: z.object({ visible: z.boolean(), locked: z.boolean() }),
  }),
  z.literal("Group"),
  z.literal("Shape"),
]);

export const TreeNodeSchema: z.ZodType<TreeNode> = z.object({
  id: z.number(),
  name: z.string(),
  kind: TreeNodeKindSchema,
  children: z.lazy(() => z.array(TreeNodeSchema)),
});

export const RenderItemSchema = z.object({
  id: z.number(),
  world_transform: z.tuple([
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
    z.number(),
  ]),
  kind: NodeKindDataSchema,
  name: z.string(),
});

export const StitchPlanRowSchema = z.object({
  block_id: z.number(),
  node_id: z.number(),
  parent: z.number().nullable(),
  name: z.string(),
  stitch_type: StitchTypeSchema,
  color: ColorSchema.nullable(),
  visible: z.boolean(),
  locked: z.boolean(),
  sequence_index: z.number(),
  overrides: ObjectRoutingOverridesSchema,
});

export const BoundingBoxSchema = z.object({
  min_x: z.number(),
  min_y: z.number(),
  max_x: z.number(),
  max_y: z.number(),
});

export const PathDataSchema = z.object({
  commands: z.array(PathCommandSchema),
  closed: z.boolean(),
});
