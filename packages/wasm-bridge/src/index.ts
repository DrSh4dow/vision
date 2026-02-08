/**
 * Vision WASM Bridge
 *
 * Typed API layer between the JavaScript UI shell and the Rust/WASM core engine.
 * This package wraps the WASM module exports with ergonomic TypeScript interfaces.
 *
 * Architecture:
 *   React UI Shell <-> wasm-bridge <-> Rust/WASM Engine
 */

import initWasm, {
  export_dst,
  export_pes,
  find_nearest_thread,
  generate_running_stitches,
  generate_satin_stitches,
  get_thread_palette,
  import_svg_document,
  import_svg_path,
  scene_add_node,
  scene_add_node_with_transform,
  scene_create,
  scene_export_design,
  scene_export_design_with_options,
  scene_get_node,
  scene_get_path_commands,
  scene_get_render_list,
  scene_get_tree,
  scene_hit_test,
  scene_move_node,
  scene_node_bbox,
  scene_node_count,
  scene_redo,
  scene_remove_node,
  scene_rename_node,
  scene_reorder_child,
  scene_route_metrics,
  scene_route_metrics_with_options,
  scene_set_fill,
  scene_set_path_commands,
  scene_set_stroke,
  scene_set_stroke_width,
  scene_undo,
  scene_update_kind,
  scene_update_transform,
  StitchType as WasmStitchType,
  version as wasmVersion,
} from "../pkg/vision_engine.js";
import type { VisionEngine } from "./engine";
import { flatToPoints, pointsToFlat } from "./helpers";
import {
  BoundingBoxSchema,
  ExportDesignSchema,
  PathDataSchema,
  RenderItemSchema,
  RouteMetricsSchema,
  RoutingOptionsSchema,
  SatinResultSchema,
  SceneNodeInfoSchema,
  ThreadColorSchema,
  TreeNodeSchema,
} from "./schemas";
import type {
  BoundingBox,
  Color,
  ExportDesign,
  NodeKindData,
  PathData,
  Point,
  RenderItem,
  RouteMetrics,
  RoutingOptions,
  SatinResult,
  SceneNodeInfo,
  StitchType,
  ThreadBrand,
  ThreadColor,
  TransformData,
  TreeNode,
  UnderlayConfig,
} from "./types";

export type { VisionEngine } from "./engine";
// Re-export schemas for consumers that need runtime validation
export {
  BoundingBoxSchema,
  ExportDesignSchema,
  PathDataSchema,
  RenderItemSchema,
  RouteMetricsSchema,
  RoutingOptionsSchema,
  SatinResultSchema,
  SceneNodeInfoSchema,
  ThreadColorSchema,
  TreeNodeSchema,
} from "./schemas";
// Re-export all public types
export type {
  BoundingBox,
  Color,
  CompensationMode,
  ExportDesign,
  ExportStitch,
  ExportStitchType,
  FillStartMode,
  MotifPattern,
  NodeKindData,
  PathCommand,
  PathData,
  Point,
  RenderItem,
  RouteMetrics,
  RoutingEntryExitMode,
  RoutingOptions,
  RoutingPolicy,
  RoutingSequenceMode,
  RoutingTieMode,
  SatinResult,
  SceneNodeInfo,
  ShapeKindData,
  Stitch,
  StitchParams,
  StitchType,
  ThreadBrand,
  ThreadColor,
  TransformData,
  TreeNode,
  TreeNodeKind,
  UnderlayConfig,
  UnderlayMode,
} from "./types";

// ============================================================================
// WASM Stitch Type mapping
// ============================================================================

/** Map numeric WASM StitchType enum to string union. */
export const STITCH_TYPE_MAP: Record<number, StitchType> = {
  [WasmStitchType.Running]: "running",
  [WasmStitchType.Satin]: "satin",
  [WasmStitchType.Tatami]: "tatami",
  [WasmStitchType.Spiral]: "spiral",
  [WasmStitchType.Contour]: "contour",
  [WasmStitchType.Motif]: "motif",
};

// ============================================================================
// WASM Module Loader
// ============================================================================

let engineInstance: VisionEngine | null = null;
let initPromise: Promise<VisionEngine> | null = null;

/**
 * Initialize the Vision WASM engine.
 *
 * Loads and instantiates the WASM module. Safe to call multiple times
 * concurrently — deduplicates the init call and caches the result.
 *
 * @returns The engine API interface.
 */
export async function initEngine(): Promise<VisionEngine> {
  if (engineInstance) {
    return engineInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async (): Promise<VisionEngine> => {
    await initWasm();

    const instance: VisionEngine = {
      version: (): string => wasmVersion(),

      generateRunningStitches: (path: Point[], stitchLength: number): Point[] => {
        const flat = pointsToFlat(path);
        const result = generate_running_stitches(flat, stitchLength);
        return flatToPoints(result);
      },

      generateSatinStitches: (
        rail1: Point[],
        rail2: Point[],
        density: number,
        pullCompensation: number,
        underlay: UnderlayConfig,
      ): SatinResult => {
        const r1 = pointsToFlat(rail1);
        const r2 = pointsToFlat(rail2);
        const underlayJson = JSON.stringify(underlay);
        const resultJson = generate_satin_stitches(r1, r2, density, pullCompensation, underlayJson);
        return SatinResultSchema.parse(JSON.parse(resultJson));
      },

      importSvgPath: (d: string): unknown => {
        const json = import_svg_path(d);
        return JSON.parse(json);
      },

      importSvgDocument: (svgContent: string): unknown[] => {
        const json = import_svg_document(svgContent);
        return JSON.parse(json) as unknown[];
      },

      getThreadPalette: (brand: ThreadBrand): ThreadColor[] => {
        const json = get_thread_palette(brand);
        const parsed: unknown = JSON.parse(json);
        return (parsed as unknown[]).map((item) => ThreadColorSchema.parse(item));
      },

      findNearestThread: (
        brand: ThreadBrand,
        color: { r: number; g: number; b: number },
      ): ThreadColor => {
        const json = find_nearest_thread(brand, color.r, color.g, color.b);
        return ThreadColorSchema.parse(JSON.parse(json));
      },

      exportDst: (design: ExportDesign): Uint8Array => {
        const json = JSON.stringify(design);
        return export_dst(json);
      },

      exportPes: (design: ExportDesign): Uint8Array => {
        const json = JSON.stringify(design);
        return export_pes(json);
      },

      sceneExportDesign: (stitchLength: number): ExportDesign => {
        const json = scene_export_design(stitchLength);
        return ExportDesignSchema.parse(JSON.parse(json));
      },

      sceneRouteMetrics: (stitchLength: number): RouteMetrics => {
        const json = scene_route_metrics(stitchLength);
        return RouteMetricsSchema.parse(JSON.parse(json));
      },

      sceneExportDesignWithOptions: (
        stitchLength: number,
        options: RoutingOptions,
      ): ExportDesign => {
        const routing = RoutingOptionsSchema.parse(options);
        const json = scene_export_design_with_options(stitchLength, JSON.stringify(routing));
        return ExportDesignSchema.parse(JSON.parse(json));
      },

      sceneRouteMetricsWithOptions: (
        stitchLength: number,
        options: RoutingOptions,
      ): RouteMetrics => {
        const routing = RoutingOptionsSchema.parse(options);
        const json = scene_route_metrics_with_options(stitchLength, JSON.stringify(routing));
        return RouteMetricsSchema.parse(JSON.parse(json));
      },

      // ====================================================================
      // Scene Graph API
      // ====================================================================

      sceneCreate: (): void => {
        scene_create();
      },

      sceneAddNode: (name: string, kind: NodeKindData, parentId?: number): number => {
        const kindJson = JSON.stringify(kind);
        const pid = parentId !== undefined ? BigInt(parentId) : BigInt(-1);
        const id = scene_add_node(name, kindJson, pid);
        return Number(id);
      },

      sceneAddNodeWithTransform: (
        name: string,
        kind: NodeKindData,
        transform: TransformData,
        parentId?: number,
      ): number => {
        const kindJson = JSON.stringify(kind);
        const pid = parentId !== undefined ? BigInt(parentId) : BigInt(-1);
        const id = scene_add_node_with_transform(
          name,
          kindJson,
          pid,
          transform.x,
          transform.y,
          transform.rotation,
          transform.scaleX,
          transform.scaleY,
        );
        return Number(id);
      },

      sceneRemoveNode: (nodeId: number): void => {
        scene_remove_node(BigInt(nodeId));
      },

      sceneGetNode: (nodeId: number): SceneNodeInfo | null => {
        const json = scene_get_node(BigInt(nodeId));
        if (json === "null") return null;
        return SceneNodeInfoSchema.parse(JSON.parse(json));
      },

      sceneUpdateTransform: (nodeId: number, transform: TransformData): void => {
        scene_update_transform(
          BigInt(nodeId),
          transform.x,
          transform.y,
          transform.rotation,
          transform.scaleX,
          transform.scaleY,
        );
      },

      sceneUpdateKind: (nodeId: number, kind: NodeKindData): void => {
        scene_update_kind(BigInt(nodeId), JSON.stringify(kind));
      },

      sceneMoveNode: (nodeId: number, parentId: number, index: number): void => {
        scene_move_node(BigInt(nodeId), BigInt(parentId), index);
      },

      sceneReorderChild: (nodeId: number, newIndex: number): void => {
        scene_reorder_child(BigInt(nodeId), newIndex);
      },

      sceneGetTree: (): TreeNode[] => {
        const json = scene_get_tree();
        const parsed: unknown = JSON.parse(json);
        return (parsed as unknown[]).map((item) => TreeNodeSchema.parse(item));
      },

      sceneGetRenderList: (): RenderItem[] => {
        const json = scene_get_render_list();
        const parsed: unknown = JSON.parse(json);
        return (parsed as unknown[]).map((item) => RenderItemSchema.parse(item));
      },

      sceneHitTest: (x: number, y: number): number | null => {
        const raw = Number(scene_hit_test(x, y));
        return raw < 0 ? null : raw;
      },

      sceneUndo: (): boolean => {
        return scene_undo();
      },

      sceneRedo: (): boolean => {
        return scene_redo();
      },

      sceneRenameNode: (nodeId: number, newName: string): void => {
        scene_rename_node(BigInt(nodeId), newName);
      },

      sceneSetFill: (nodeId: number, fill: Color | null): void => {
        const json = fill ? JSON.stringify(fill) : "";
        scene_set_fill(BigInt(nodeId), json);
      },

      sceneSetStroke: (nodeId: number, stroke: Color | null): void => {
        const json = stroke ? JSON.stringify(stroke) : "";
        scene_set_stroke(BigInt(nodeId), json);
      },

      sceneSetStrokeWidth: (nodeId: number, width: number): void => {
        scene_set_stroke_width(BigInt(nodeId), width);
      },

      sceneGetPathCommands: (nodeId: number): PathData => {
        const json = scene_get_path_commands(BigInt(nodeId));
        return PathDataSchema.parse(JSON.parse(json));
      },

      sceneSetPathCommands: (nodeId: number, data: PathData): void => {
        scene_set_path_commands(BigInt(nodeId), JSON.stringify(data));
      },

      sceneNodeCount: (): number => {
        return scene_node_count();
      },

      sceneNodeBbox: (nodeId: number): BoundingBox => {
        const json = scene_node_bbox(BigInt(nodeId));
        return BoundingBoxSchema.parse(JSON.parse(json));
      },
    };

    engineInstance = instance;
    return instance;
  })();

  return initPromise;
}

/**
 * Get the current engine instance, or null if not yet initialized.
 */
export function getEngine(): VisionEngine | null {
  return engineInstance;
}
