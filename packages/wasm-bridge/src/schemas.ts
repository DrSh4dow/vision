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

const StitchTypeSchema = z.enum(["running", "satin", "tatami"]);

const StitchParamsSchema = z.object({
  type: StitchTypeSchema,
  density: z.number(),
  angle: z.number(),
  underlay_enabled: z.boolean(),
  pull_compensation: z.number(),
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
