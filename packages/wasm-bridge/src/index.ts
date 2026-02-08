/**
 * Vision WASM Bridge
 *
 * Typed API layer between the JavaScript UI shell and the Rust/WASM core engine.
 * This package wraps the WASM module exports with ergonomic TypeScript interfaces.
 *
 * Architecture:
 *   React UI Shell <-> wasm-bridge <-> Rust/WASM Engine
 */

// Re-export generated WASM bindings
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
  scene_create,
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
  scene_set_fill,
  scene_set_path_commands,
  scene_set_stroke,
  scene_set_stroke_width,
  scene_undo,
  scene_update_kind,
  scene_update_transform,
  Color as WasmColor,
  Point as WasmPoint,
  StitchType as WasmStitchType,
  version as wasmVersion,
} from "../pkg/vision_engine.js";

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
export type StitchType = "running" | "satin" | "tatami_fill" | "spiral_fill" | "contour_fill";

/** Stitch parameters for an embroidery object. */
export interface StitchParams {
  type: StitchType;
  density: number;
  angle: number;
  underlayEnabled: boolean;
  pullCompensation: number;
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
      };
    };

/** Scene node info returned by getNode(). */
export interface SceneNodeInfo {
  id: { "0": number };
  name: string;
  transform: {
    x: number;
    y: number;
    rotation: number;
    scale_x: number;
    scale_y: number;
  };
  kind: NodeKindData;
  children: Array<{ "0": number }>;
  parent: { "0": number } | null;
}

/** Tree node kind for layers panel. */
export type TreeNodeKind = { Layer: { visible: boolean; locked: boolean } } | "Group" | "Shape";

/** Tree node for layers panel. */
export interface TreeNode {
  id: { "0": number };
  name: string;
  kind: TreeNodeKind;
  children: TreeNode[];
}

/** A render item — visible shape with computed world transform. */
export interface RenderItem {
  id: { "0": number };
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

// ============================================================================
// WASM Stitch Type mapping
// ============================================================================

/** Map numeric WASM StitchType enum to string union. */
const STITCH_TYPE_MAP: Record<number, StitchType> = {
  [WasmStitchType.Running]: "running",
  [WasmStitchType.Satin]: "satin",
  [WasmStitchType.TatamiFill]: "tatami_fill",
  [WasmStitchType.SpiralFill]: "spiral_fill",
  [WasmStitchType.ContourFill]: "contour_fill",
};

// ============================================================================
// Engine Interface
// ============================================================================

/** The Vision engine API available after WASM initialization. */
export interface VisionEngine {
  /** Engine version string. */
  version(): string;

  /**
   * Generate running stitches along a path.
   * @param path - Array of points defining the path.
   * @param stitchLength - Target stitch length in mm.
   * @returns Array of stitch points.
   */
  generateRunningStitches(path: Point[], stitchLength: number): Point[];

  /**
   * Generate satin stitches between two guide rails.
   */
  generateSatinStitches(
    rail1: Point[],
    rail2: Point[],
    density: number,
    pullCompensation: number,
    underlay: UnderlayConfig,
  ): SatinResult;

  /** Import an SVG path `d` attribute string. */
  importSvgPath(d: string): unknown;

  /** Import all paths from an SVG document. */
  importSvgDocument(svgContent: string): unknown[];

  /** Get thread palette for a brand. */
  getThreadPalette(brand: ThreadBrand): ThreadColor[];

  /** Find the nearest thread color in a brand's palette. */
  findNearestThread(brand: ThreadBrand, color: { r: number; g: number; b: number }): ThreadColor;

  /** Export design to DST (Tajima) format. */
  exportDst(design: ExportDesign): Uint8Array;

  /** Export design to PES (Brother) format. */
  exportPes(design: ExportDesign): Uint8Array;

  /** Create a WASM Point object. */
  createPoint(x: number, y: number): WasmPoint;

  /** Create a WASM Color object. */
  createColor(r: number, g: number, b: number, a: number): WasmColor;

  /** Get the stitch type string from a numeric WASM enum value. */
  stitchTypeName(value: number): StitchType | undefined;

  // ==========================================================================
  // Scene Graph API
  // ==========================================================================

  /** Create/reset the global scene. */
  sceneCreate(): void;

  /** Add a node to the scene. Returns the new node ID. */
  sceneAddNode(name: string, kind: NodeKindData, parentId?: number): number;

  /** Remove a node and its descendants. */
  sceneRemoveNode(nodeId: number): void;

  /** Get a node's data. Returns null if not found. */
  sceneGetNode(nodeId: number): SceneNodeInfo | null;

  /** Update a node's transform. */
  sceneUpdateTransform(nodeId: number, transform: TransformData): void;

  /** Update a node's kind. */
  sceneUpdateKind(nodeId: number, kind: NodeKindData): void;

  /** Move a node to a different parent. parentId -1 = root. index -1 = append. */
  sceneMoveNode(nodeId: number, parentId: number, index: number): void;

  /** Reorder a node within its parent's children. */
  sceneReorderChild(nodeId: number, newIndex: number): void;

  /** Get the full scene tree (for layers panel). */
  sceneGetTree(): TreeNode[];

  /** Get the render list (visible shapes with world transforms). */
  sceneGetRenderList(): RenderItem[];

  /** Hit-test: find topmost node at world coordinates. Returns -1 if none. */
  sceneHitTest(x: number, y: number): number;

  /** Undo the last scene command. Returns true if something was undone. */
  sceneUndo(): boolean;

  /** Redo the last undone command. Returns true if something was redone. */
  sceneRedo(): boolean;

  /** Rename a node. */
  sceneRenameNode(nodeId: number, newName: string): void;

  /** Set fill color on a shape node. null = no fill. */
  sceneSetFill(nodeId: number, fill: Color | null): void;

  /** Set stroke color on a shape node. null = no stroke. */
  sceneSetStroke(nodeId: number, stroke: Color | null): void;

  /** Set stroke width on a shape node. */
  sceneSetStrokeWidth(nodeId: number, width: number): void;

  /** Get path commands of a Path shape node. */
  sceneGetPathCommands(nodeId: number): PathData;

  /** Set path commands on a Path shape node. */
  sceneSetPathCommands(nodeId: number, data: PathData): void;

  /** Get number of nodes in the scene. */
  sceneNodeCount(): number;

  /** Get bounding box of a node. */
  sceneNodeBbox(nodeId: number): BoundingBox;
}

// ============================================================================
// Helper: Convert Point[] to flat Float64Array
// ============================================================================

function pointsToFlat(points: Point[]): Float64Array {
  const flat = new Float64Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    flat[i * 2] = points[i].x;
    flat[i * 2 + 1] = points[i].y;
  }
  return flat;
}

function flatToPoints(flat: Float64Array): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    points.push({ x: flat[i], y: flat[i + 1] });
  }
  return points;
}

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
        return JSON.parse(resultJson) as SatinResult;
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
        return JSON.parse(json) as ThreadColor[];
      },

      findNearestThread: (
        brand: ThreadBrand,
        color: { r: number; g: number; b: number },
      ): ThreadColor => {
        const json = find_nearest_thread(brand, color.r, color.g, color.b);
        return JSON.parse(json) as ThreadColor;
      },

      exportDst: (design: ExportDesign): Uint8Array => {
        const json = JSON.stringify(design);
        return export_dst(json);
      },

      exportPes: (design: ExportDesign): Uint8Array => {
        const json = JSON.stringify(design);
        return export_pes(json);
      },

      createPoint: (x: number, y: number): WasmPoint => new WasmPoint(x, y),

      createColor: (r: number, g: number, b: number, a: number): WasmColor =>
        new WasmColor(r, g, b, a),

      stitchTypeName: (value: number): StitchType | undefined => STITCH_TYPE_MAP[value],

      // ======================================================================
      // Scene Graph API
      // ======================================================================

      sceneCreate: (): void => {
        scene_create();
      },

      sceneAddNode: (name: string, kind: NodeKindData, parentId?: number): number => {
        const kindJson = JSON.stringify(kind);
        const pid = parentId !== undefined ? BigInt(parentId) : BigInt(-1);
        const id = scene_add_node(name, kindJson, pid);
        return Number(id);
      },

      sceneRemoveNode: (nodeId: number): void => {
        scene_remove_node(BigInt(nodeId));
      },

      sceneGetNode: (nodeId: number): SceneNodeInfo | null => {
        const json = scene_get_node(BigInt(nodeId));
        if (json === "null") return null;
        return JSON.parse(json) as SceneNodeInfo;
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
        return JSON.parse(json) as TreeNode[];
      },

      sceneGetRenderList: (): RenderItem[] => {
        const json = scene_get_render_list();
        return JSON.parse(json) as RenderItem[];
      },

      sceneHitTest: (x: number, y: number): number => {
        return Number(scene_hit_test(x, y));
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
        return JSON.parse(json) as PathData;
      },

      sceneSetPathCommands: (nodeId: number, data: PathData): void => {
        scene_set_path_commands(BigInt(nodeId), JSON.stringify(data));
      },

      sceneNodeCount: (): number => {
        return scene_node_count();
      },

      sceneNodeBbox: (nodeId: number): BoundingBox => {
        const json = scene_node_bbox(BigInt(nodeId));
        return JSON.parse(json) as BoundingBox;
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
