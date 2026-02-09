/**
 * Vision WASM Bridge — Engine Interface
 *
 * The VisionEngine interface defines the full typed API surface
 * available after WASM initialization.
 */

import type {
  BoundingBox,
  Color,
  EmbroideryObject,
  ExportDesign,
  NodeKindData,
  ObjectRoutingOverrides,
  PathData,
  Point,
  QualityMetrics,
  RenderItem,
  RouteMetrics,
  RoutingOptions,
  SatinResult,
  SceneNodeInfo,
  SequenceTrack,
  StitchBlock,
  StitchParams,
  StitchPlanRow,
  ThreadBrand,
  ThreadColor,
  TransformData,
  TreeNode,
  UnderlayConfig,
} from "./types";

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

  /**
   * Generate an ExportDesign from the current scene graph.
   * Walks visible shapes, generates running stitches along outlines.
   * @param stitchLength - Target stitch length in mm (0 = default 2.5mm).
   */
  sceneExportDesign(stitchLength: number): ExportDesign;

  /** Compute route quality metrics for the current scene export. */
  sceneRouteMetrics(stitchLength: number): RouteMetrics;

  /** Generate scene export design with explicit routing options. */
  sceneExportDesignWithOptions(stitchLength: number, options: RoutingOptions): ExportDesign;

  /** Compute route metrics with explicit routing options. */
  sceneRouteMetricsWithOptions(stitchLength: number, options: RoutingOptions): RouteMetrics;

  /** Compute extended quality metrics for the current scene export. */
  sceneQualityMetrics(stitchLength: number): QualityMetrics;

  /** Compute extended quality metrics with explicit routing options. */
  sceneQualityMetricsWithOptions(stitchLength: number, options: RoutingOptions): QualityMetrics;

  /** Return canonical engine defaults for stitch params. */
  engineDefaultStitchParams(): StitchParams;

  /** Return canonical engine defaults for routing options. */
  engineDefaultRoutingOptions(): RoutingOptions;

  // ==========================================================================
  // Scene Graph API
  // ==========================================================================

  /** Create/reset the global scene. */
  sceneCreate(): void;

  /** Add a node to the scene. Returns the new node ID. */
  sceneAddNode(name: string, kind: NodeKindData, parentId?: number): number;

  /** Add a node with an initial transform. Returns the new node ID. */
  sceneAddNodeWithTransform(
    name: string,
    kind: NodeKindData,
    transform: TransformData,
    parentId?: number,
  ): number;

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

  /** Reorder a stitch block within sequencer execution order. */
  sceneReorderStitchBlock(blockId: number, newIndex: number): void;

  /** Set object-level routing overrides for a stitch block. */
  sceneSetObjectRoutingOverrides(blockId: number, overrides: ObjectRoutingOverrides): void;

  /** Get the full scene tree (for sequencer/panel UI). */
  sceneGetTree(): TreeNode[];

  /** Get sequencer rows in machine execution order. */
  sceneGetStitchPlan(): StitchPlanRow[];

  /** Get first-class embroidery objects. */
  sceneGetEmbroideryObjects(): EmbroideryObject[];

  /** Get first-class stitch blocks in sequence-track order. */
  sceneGetStitchBlocks(): StitchBlock[];

  /** Get sequence-track ordering data. */
  sceneGetSequenceTrack(): SequenceTrack;

  /** Get the render list (visible shapes with world transforms). */
  sceneGetRenderList(): RenderItem[];

  /** Hit-test: find topmost node at world coordinates. Returns null if none. */
  sceneHitTest(x: number, y: number): number | null;

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
