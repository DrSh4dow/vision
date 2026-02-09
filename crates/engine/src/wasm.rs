//! WASM bindings for the Vision engine.
//!
//! All `#[wasm_bindgen]` functions live here to keep the public API surface
//! in one place. Functions delegate to the internal modules and convert errors
//! to `JsError` for clean JavaScript interop.

use wasm_bindgen::prelude::*;

use crate::command::{self, SceneCommand};
use crate::scene::{self, NodeId};
use crate::state::{execute_command, redo, reset_scene, undo, with_scene, with_scene_mut};
use crate::thread;
use crate::{format, shapes, stitch, svg};

// =============================================================================
// Initialization
// =============================================================================

/// Initialize the engine. Called once when the WASM module is loaded.
#[wasm_bindgen(start)]
pub fn init() {
    wasm_logger::init(wasm_logger::Config::default());
    log::info!("Vision engine initialized");
}

/// Returns the engine version string.
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Return engine-default stitch params as JSON.
///
/// This is the canonical default used by Rust and should be consumed by the
/// bridge/UI to avoid default drift between layers.
#[wasm_bindgen]
pub fn engine_default_stitch_params() -> Result<String, JsError> {
    let defaults = crate::StitchParams::default();
    serde_json::to_string(&defaults).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
}

/// Return engine-default routing options as JSON.
///
/// This is the canonical routing default and should be consumed by the
/// bridge/UI to avoid default drift between layers.
#[wasm_bindgen]
pub fn engine_default_routing_options() -> Result<String, JsError> {
    let defaults = crate::export_pipeline::RoutingOptions::default();
    serde_json::to_string(&defaults).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
}

// =============================================================================
// Helpers
// =============================================================================

/// Parse a thread brand string into the enum. Used by palette and nearest-color
/// lookups to avoid duplicating the match block.
fn parse_brand(brand: &str) -> Result<thread::ThreadBrand, JsError> {
    match brand {
        "madeira" => Ok(thread::ThreadBrand::MadeiraRayon),
        "isacord" => Ok(thread::ThreadBrand::IsacordPolyester),
        "sulky" => Ok(thread::ThreadBrand::SulkyRayon),
        _ => Err(JsError::new(&format!("Unknown thread brand: {brand}"))),
    }
}

// =============================================================================
// Stitch Generation
// =============================================================================

/// Generate running stitches along a path.
///
/// # Arguments
/// * `path` - Flat array of coordinates [x0, y0, x1, y1, ...]
/// * `stitch_length` - Target length of each stitch in mm
///
/// # Returns
/// Flat array of stitch coordinates [x0, y0, x1, y1, ...]
#[wasm_bindgen]
pub fn generate_running_stitches(path: &[f64], stitch_length: f64) -> Vec<f64> {
    stitch::running::generate_running_stitches_flat(path, stitch_length)
}

/// Generate satin stitches between two guide rails.
///
/// # Returns
/// JSON string of satin stitch results.
#[wasm_bindgen]
pub fn generate_satin_stitches(
    rail1: &[f64],
    rail2: &[f64],
    density: f64,
    pull_compensation: f64,
    underlay_json: &str,
) -> Result<String, JsError> {
    let config: stitch::satin::UnderlayConfig = serde_json::from_str(underlay_json)
        .map_err(|e| JsError::new(&format!("Invalid underlay config: {e}")))?;

    let stitches = stitch::satin::generate_satin_stitches_flat(
        rail1,
        rail2,
        density,
        pull_compensation,
        &config,
    );

    serde_json::to_string(&stitches).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
}

// =============================================================================
// SVG Import
// =============================================================================

/// Import SVG path data from an SVG `d` attribute string.
///
/// Returns a JSON string containing the parsed path commands.
#[wasm_bindgen]
pub fn import_svg_path(d: &str) -> Result<String, JsError> {
    let path = svg::parse_svg_path(d).map_err(|e| JsError::new(&e))?;
    serde_json::to_string(&path).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
}

/// Import all paths from an SVG document string.
///
/// Returns a JSON string containing an array of parsed paths.
#[wasm_bindgen]
pub fn import_svg_document(svg_content: &str) -> Result<String, JsError> {
    let paths = svg::parse_svg_document(svg_content).map_err(|e| JsError::new(&e))?;
    serde_json::to_string(&paths).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
}

// =============================================================================
// Thread Palette
// =============================================================================

/// Get the thread palette for a given brand.
///
/// Returns a JSON string with the thread color entries.
#[wasm_bindgen]
pub fn get_thread_palette(brand: &str) -> Result<String, JsError> {
    let brand_enum = parse_brand(brand)?;
    let palette = thread::list_brand(brand_enum);
    serde_json::to_string(&palette).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
}

/// Find the nearest thread color in a brand's palette.
///
/// Returns a JSON string with the matching thread entry.
#[wasm_bindgen]
pub fn find_nearest_thread(brand: &str, r: u8, g: u8, b: u8) -> Result<String, JsError> {
    let brand_enum = parse_brand(brand)?;
    let entry = thread::find_nearest_color(brand_enum, r, g, b);
    serde_json::to_string(&entry).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
}

// =============================================================================
// Export
// =============================================================================

/// Export stitch data to DST (Tajima) format.
#[wasm_bindgen]
pub fn export_dst(design_json: &str) -> Result<Vec<u8>, JsError> {
    let design: format::ExportDesign = serde_json::from_str(design_json)
        .map_err(|e| JsError::new(&format!("Invalid design JSON: {e}")))?;
    format::dst::export_dst(&design).map_err(|e| JsError::new(&e))
}

/// Export stitch data to PES (Brother) format.
#[wasm_bindgen]
pub fn export_pes(design_json: &str) -> Result<Vec<u8>, JsError> {
    let design: format::ExportDesign = serde_json::from_str(design_json)
        .map_err(|e| JsError::new(&format!("Invalid design JSON: {e}")))?;
    format::pes::export_pes(&design).map_err(|e| JsError::new(&e))
}

/// Convert the current scene graph to an `ExportDesign` JSON string.
///
/// Walks visible shapes, generates configured stitch types, applies routing
/// optimization, and assembles jump/trim/color-change commands.
///
/// # Arguments
/// * `stitch_length` - Target stitch length in mm (0 uses the default 2.5mm).
#[wasm_bindgen]
pub fn scene_export_design(stitch_length: f64) -> Result<String, JsError> {
    let design = with_scene(|s| crate::export_pipeline::scene_to_export_design(s, stitch_length))
        .map_err(|e| JsError::new(&e))?;
    serde_json::to_string(&design).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
}

/// Convert the current scene graph to an `ExportDesign` JSON string with explicit routing options.
#[wasm_bindgen]
pub fn scene_export_design_with_options(
    stitch_length: f64,
    routing_options_json: &str,
) -> Result<String, JsError> {
    let routing = if routing_options_json.trim().is_empty() {
        crate::export_pipeline::RoutingOptions::default()
    } else {
        serde_json::from_str::<crate::export_pipeline::RoutingOptions>(routing_options_json)
            .map_err(|e| JsError::new(&format!("Invalid routing options: {e}")))?
    };

    let design = with_scene(|s| {
        crate::export_pipeline::scene_to_export_design_with_routing(s, stitch_length, routing)
    })
    .map_err(|e| JsError::new(&e))?;
    serde_json::to_string(&design).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
}

/// Compute route quality metrics for the current scene's export order.
///
/// Returns JSON with jump/trim/color-change counts and travel distance.
#[wasm_bindgen]
pub fn scene_route_metrics(stitch_length: f64) -> Result<String, JsError> {
    let design = with_scene(|s| crate::export_pipeline::scene_to_export_design(s, stitch_length))
        .map_err(|e| JsError::new(&e))?;
    let metrics = crate::export_pipeline::compute_route_metrics(&design);
    serde_json::to_string(&metrics).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
}

/// Compute route quality metrics for the current scene with explicit routing options.
#[wasm_bindgen]
pub fn scene_route_metrics_with_options(
    stitch_length: f64,
    routing_options_json: &str,
) -> Result<String, JsError> {
    let routing = if routing_options_json.trim().is_empty() {
        crate::export_pipeline::RoutingOptions::default()
    } else {
        serde_json::from_str::<crate::export_pipeline::RoutingOptions>(routing_options_json)
            .map_err(|e| JsError::new(&format!("Invalid routing options: {e}")))?
    };

    let design = with_scene(|s| {
        crate::export_pipeline::scene_to_export_design_with_routing(s, stitch_length, routing)
    })
    .map_err(|e| JsError::new(&e))?;
    let metrics = crate::export_pipeline::compute_route_metrics(&design);
    serde_json::to_string(&metrics).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
}

/// Compute extended quality metrics for the current scene export.
#[wasm_bindgen]
pub fn scene_quality_metrics(stitch_length: f64) -> Result<String, JsError> {
    let design = with_scene(|s| crate::export_pipeline::scene_to_export_design(s, stitch_length))
        .map_err(|e| JsError::new(&e))?;
    let metrics = crate::export_pipeline::compute_quality_metrics(&design, stitch_length);
    serde_json::to_string(&metrics).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
}

/// Compute extended quality metrics for the current scene with explicit routing options.
#[wasm_bindgen]
pub fn scene_quality_metrics_with_options(
    stitch_length: f64,
    routing_options_json: &str,
) -> Result<String, JsError> {
    let routing = if routing_options_json.trim().is_empty() {
        crate::export_pipeline::RoutingOptions::default()
    } else {
        serde_json::from_str::<crate::export_pipeline::RoutingOptions>(routing_options_json)
            .map_err(|e| JsError::new(&format!("Invalid routing options: {e}")))?
    };

    let design = with_scene(|s| {
        crate::export_pipeline::scene_to_export_design_with_routing(s, stitch_length, routing)
    })
    .map_err(|e| JsError::new(&e))?;
    let metrics = crate::export_pipeline::compute_quality_metrics(&design, stitch_length);
    serde_json::to_string(&metrics).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
}

// =============================================================================
// Scene Graph
// =============================================================================

/// Create/reset the global scene. Call this to start a fresh document.
#[wasm_bindgen]
pub fn scene_create() {
    reset_scene();
}

/// Add a node to the scene.
///
/// Returns the new node's ID (as i64), or throws on error.
#[wasm_bindgen]
pub fn scene_add_node(name: &str, kind_json: &str, parent_id: i64) -> Result<i64, JsError> {
    let kind: scene::NodeKind = serde_json::from_str(kind_json)
        .map_err(|e| JsError::new(&format!("Invalid kind JSON: {e}")))?;

    let parent = if parent_id < 0 {
        None
    } else {
        Some(NodeId(parent_id as u64))
    };

    let id = with_scene_mut(|s| s.alloc_next_id());

    let cmd = SceneCommand::AddNode {
        id,
        name: name.to_string(),
        kind,
        parent,
        transform: scene::Transform::identity(),
    };

    execute_command(cmd).map_err(|e| JsError::new(&e))?;
    Ok(id.0 as i64)
}

/// Add a node with an initial transform (single undo step).
///
/// Returns the new node's ID (as i64), or throws on error.
#[allow(clippy::too_many_arguments)]
#[wasm_bindgen]
pub fn scene_add_node_with_transform(
    name: &str,
    kind_json: &str,
    parent_id: i64,
    x: f64,
    y: f64,
    rotation: f64,
    scale_x: f64,
    scale_y: f64,
) -> Result<i64, JsError> {
    let kind: scene::NodeKind = serde_json::from_str(kind_json)
        .map_err(|e| JsError::new(&format!("Invalid kind JSON: {e}")))?;

    let parent = if parent_id < 0 {
        None
    } else {
        Some(NodeId(parent_id as u64))
    };

    let id = with_scene_mut(|s| s.alloc_next_id());

    let transform = scene::Transform {
        x,
        y,
        rotation,
        scale_x,
        scale_y,
    };

    let cmd = SceneCommand::AddNode {
        id,
        name: name.to_string(),
        kind,
        parent,
        transform,
    };

    execute_command(cmd).map_err(|e| JsError::new(&e))?;
    Ok(id.0 as i64)
}

/// Remove a node and its descendants from the scene.
#[wasm_bindgen]
pub fn scene_remove_node(node_id: i64) -> Result<(), JsError> {
    let id = NodeId(node_id as u64);
    let cmd = with_scene(|s| command::build_remove_command(s, id)).map_err(|e| JsError::new(&e))?;
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Get a single node as JSON. Returns `"null"` if the node does not exist.
#[wasm_bindgen]
pub fn scene_get_node(node_id: i64) -> Result<String, JsError> {
    let id = NodeId(node_id as u64);
    with_scene(|s| match s.get_node(id) {
        Some(node) => serde_json::to_string(node)
            .map_err(|e| JsError::new(&format!("Serialization error: {e}"))),
        None => Ok("null".to_string()),
    })
}

/// Update a node's transform.
#[wasm_bindgen]
pub fn scene_update_transform(
    node_id: i64,
    x: f64,
    y: f64,
    rotation: f64,
    scale_x: f64,
    scale_y: f64,
) -> Result<(), JsError> {
    let id = NodeId(node_id as u64);
    let old = with_scene(|s| {
        s.get_node(id)
            .map(|n| n.transform)
            .ok_or_else(|| format!("Node {id:?} not found"))
    })
    .map_err(|e| JsError::new(&e))?;

    let new = scene::Transform {
        x,
        y,
        rotation,
        scale_x,
        scale_y,
    };

    let cmd = SceneCommand::UpdateTransform { id, old, new };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Update a node's kind (shape, fill, stroke, visibility, etc).
#[wasm_bindgen]
pub fn scene_update_kind(node_id: i64, kind_json: &str) -> Result<(), JsError> {
    let id = NodeId(node_id as u64);
    let new: scene::NodeKind = serde_json::from_str(kind_json)
        .map_err(|e| JsError::new(&format!("Invalid kind JSON: {e}")))?;

    let old = with_scene(|s| {
        s.get_node(id)
            .map(|n| n.kind.clone())
            .ok_or_else(|| format!("Node {id:?} not found"))
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = SceneCommand::UpdateKind { id, old, new };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Move a node to a different parent.
#[wasm_bindgen]
pub fn scene_move_node(node_id: i64, new_parent_id: i64, index: i32) -> Result<(), JsError> {
    let id = NodeId(node_id as u64);
    let new_parent = if new_parent_id < 0 {
        None
    } else {
        Some(NodeId(new_parent_id as u64))
    };
    let new_index = if index < 0 {
        with_scene(|s| {
            if let Some(pid) = new_parent {
                s.get_node(pid).map(|n| n.children.len()).unwrap_or(0)
            } else {
                s.root_children().len()
            }
        })
    } else {
        index as usize
    };

    let (old_parent, old_index) = with_scene(|s| {
        let node = s
            .get_node(id)
            .ok_or_else(|| format!("Node {id:?} not found"))?;
        let old_parent = node.parent;
        let old_index = if let Some(pid) = old_parent {
            s.get_node(pid)
                .map(|p| p.children.iter().position(|c| *c == id).unwrap_or(0))
                .unwrap_or(0)
        } else {
            s.root_children().iter().position(|c| *c == id).unwrap_or(0)
        };
        Ok::<_, String>((old_parent, old_index))
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = SceneCommand::MoveNode {
        id,
        old_parent,
        old_index,
        new_parent,
        new_index,
    };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Reorder a node within its parent's children list.
#[wasm_bindgen]
pub fn scene_reorder_child(node_id: i64, new_index: u32) -> Result<(), JsError> {
    let id = NodeId(node_id as u64);

    let old_index = with_scene(|s| {
        let node = s
            .get_node(id)
            .ok_or_else(|| format!("Node {id:?} not found"))?;
        let siblings = if let Some(pid) = node.parent {
            s.get_node(pid).map(|p| &p.children[..]).unwrap_or(&[])
        } else {
            s.root_children()
        };
        siblings
            .iter()
            .position(|c| *c == id)
            .ok_or_else(|| format!("Node {id:?} not found in siblings"))
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = SceneCommand::ReorderChild {
        id,
        old_index,
        new_index: new_index as usize,
    };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Reorder a stitch block within sequencer execution order.
#[wasm_bindgen]
pub fn scene_reorder_stitch_block(block_id: i64, new_index: u32) -> Result<(), JsError> {
    let id = NodeId(block_id as u64);
    let old_index = with_scene(|s| {
        let ordered = if s.sequence_track().ordered_block_ids.is_empty() {
            s.sequencer_shape_ids()
        } else {
            s.sequence_track().ordered_block_ids.clone()
        };
        ordered
            .iter()
            .position(|candidate| *candidate == id)
            .ok_or_else(|| format!("Stitch block {id:?} not found"))
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = SceneCommand::ReorderSequencer {
        id,
        old_index,
        new_index: new_index as usize,
    };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Set object-level routing overrides for a stitch block.
#[wasm_bindgen]
pub fn scene_set_object_routing_overrides(
    block_id: i64,
    overrides_json: &str,
) -> Result<(), JsError> {
    let id = NodeId(block_id as u64);
    let new: scene::ObjectRoutingOverrides = if overrides_json.trim().is_empty() {
        scene::ObjectRoutingOverrides::default()
    } else {
        serde_json::from_str(overrides_json)
            .map_err(|e| JsError::new(&format!("Invalid routing overrides JSON: {e}")))?
    };

    let old = with_scene(|s| {
        let node = s
            .get_node(id)
            .ok_or_else(|| format!("Node {id:?} not found"))?;
        if !matches!(node.kind, scene::NodeKind::Shape { .. }) {
            return Err(format!("Node {id:?} is not a Shape"));
        }
        Ok(s.object_routing_overrides(id))
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = SceneCommand::SetObjectRoutingOverrides { id, old, new };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Get stitch-plan rows in sequencer order as JSON.
#[wasm_bindgen]
pub fn scene_get_stitch_plan() -> Result<String, JsError> {
    with_scene(|s| {
        let rows = s.get_stitch_plan_rows();
        serde_json::to_string(&rows).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
    })
}

/// Get first-class embroidery objects as JSON.
#[wasm_bindgen]
pub fn scene_get_embroidery_objects() -> Result<String, JsError> {
    with_scene(|s| {
        let objects = s.get_embroidery_objects();
        serde_json::to_string(&objects)
            .map_err(|e| JsError::new(&format!("Serialization error: {e}")))
    })
}

/// Get first-class stitch blocks in sequence-track order as JSON.
#[wasm_bindgen]
pub fn scene_get_stitch_blocks() -> Result<String, JsError> {
    with_scene(|s| {
        let blocks = s.get_stitch_blocks();
        serde_json::to_string(&blocks)
            .map_err(|e| JsError::new(&format!("Serialization error: {e}")))
    })
}

/// Get the sequence track as JSON.
#[wasm_bindgen]
pub fn scene_get_sequence_track() -> Result<String, JsError> {
    with_scene(|s| {
        let track = s.sequence_track().clone();
        serde_json::to_string(&track)
            .map_err(|e| JsError::new(&format!("Serialization error: {e}")))
    })
}

/// Get the full scene tree as JSON (for layers panel).
#[wasm_bindgen]
pub fn scene_get_tree() -> Result<String, JsError> {
    with_scene(|s| {
        let tree = s.get_tree();
        serde_json::to_string(&tree).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
    })
}

/// Get the render list as JSON (depth-first, visible shapes with world transforms).
#[wasm_bindgen]
pub fn scene_get_render_list() -> Result<String, JsError> {
    with_scene(|s| {
        let items = s.render_list();
        serde_json::to_string(&items)
            .map_err(|e| JsError::new(&format!("Serialization error: {e}")))
    })
}

/// Hit-test: find the topmost node at a given point.
/// Returns the node ID as i64, or -1 if nothing was hit.
#[wasm_bindgen]
pub fn scene_hit_test(x: f64, y: f64) -> i64 {
    with_scene(|s| s.hit_test(x, y).map(|id| id.0 as i64).unwrap_or(-1))
}

/// Undo the last scene command. Returns true if something was undone.
#[wasm_bindgen]
pub fn scene_undo() -> Result<bool, JsError> {
    undo().map_err(|e| JsError::new(&e))
}

/// Redo the last undone command. Returns true if something was redone.
#[wasm_bindgen]
pub fn scene_redo() -> Result<bool, JsError> {
    redo().map_err(|e| JsError::new(&e))
}

/// Rename a node.
#[wasm_bindgen]
pub fn scene_rename_node(node_id: i64, new_name: &str) -> Result<(), JsError> {
    let id = NodeId(node_id as u64);
    let old_name = with_scene(|s| {
        s.get_node(id)
            .map(|n| n.name.clone())
            .ok_or_else(|| format!("Node {id:?} not found"))
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = SceneCommand::Rename {
        id,
        old_name,
        new_name: new_name.to_string(),
    };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Set fill color on a shape node. Pass empty string for no fill.
#[wasm_bindgen]
pub fn scene_set_fill(node_id: i64, fill_json: &str) -> Result<(), JsError> {
    let id = NodeId(node_id as u64);
    let new: Option<crate::Color> = if fill_json.is_empty() || fill_json == "null" {
        None
    } else {
        Some(
            serde_json::from_str(fill_json)
                .map_err(|e| JsError::new(&format!("Invalid fill JSON: {e}")))?,
        )
    };

    let old = with_scene(|s| {
        let node = s
            .get_node(id)
            .ok_or_else(|| format!("Node {id:?} not found"))?;
        if let scene::NodeKind::Shape { fill, .. } = &node.kind {
            Ok(*fill)
        } else {
            Err(format!("Node {id:?} is not a Shape"))
        }
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = SceneCommand::SetFill { id, old, new };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Set stroke color on a shape node. Pass empty string for no stroke.
#[wasm_bindgen]
pub fn scene_set_stroke(node_id: i64, stroke_json: &str) -> Result<(), JsError> {
    let id = NodeId(node_id as u64);
    let new: Option<crate::Color> = if stroke_json.is_empty() || stroke_json == "null" {
        None
    } else {
        Some(
            serde_json::from_str(stroke_json)
                .map_err(|e| JsError::new(&format!("Invalid stroke JSON: {e}")))?,
        )
    };

    let old = with_scene(|s| {
        let node = s
            .get_node(id)
            .ok_or_else(|| format!("Node {id:?} not found"))?;
        if let scene::NodeKind::Shape { stroke, .. } = &node.kind {
            Ok(*stroke)
        } else {
            Err(format!("Node {id:?} is not a Shape"))
        }
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = SceneCommand::SetStroke { id, old, new };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Set stroke width on a shape node.
#[wasm_bindgen]
pub fn scene_set_stroke_width(node_id: i64, width: f64) -> Result<(), JsError> {
    let id = NodeId(node_id as u64);

    let old = with_scene(|s| {
        let node = s
            .get_node(id)
            .ok_or_else(|| format!("Node {id:?} not found"))?;
        if let scene::NodeKind::Shape { stroke_width, .. } = &node.kind {
            Ok(*stroke_width)
        } else {
            Err(format!("Node {id:?} is not a Shape"))
        }
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = SceneCommand::SetStrokeWidth {
        id,
        old,
        new: width,
    };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Get the path commands of a shape node as JSON.
#[wasm_bindgen]
pub fn scene_get_path_commands(node_id: i64) -> Result<String, JsError> {
    let id = NodeId(node_id as u64);
    with_scene(|s| {
        let node = s
            .get_node(id)
            .ok_or_else(|| JsError::new(&format!("Node {id:?} not found")))?;
        if let scene::NodeKind::Shape {
            shape: shapes::ShapeData::Path(ref path),
            ..
        } = node.kind
        {
            #[derive(serde::Serialize)]
            struct PathData {
                commands: Vec<crate::path::PathCommand>,
                closed: bool,
            }
            let data = PathData {
                commands: path.commands().to_vec(),
                closed: path.is_closed(),
            };
            serde_json::to_string(&data)
                .map_err(|e| JsError::new(&format!("Serialization error: {e}")))
        } else {
            Err(JsError::new(&format!("Node {id:?} is not a Path shape")))
        }
    })
}

/// Set the path commands of a shape node from JSON.
#[wasm_bindgen]
pub fn scene_set_path_commands(node_id: i64, commands_json: &str) -> Result<(), JsError> {
    let id = NodeId(node_id as u64);

    #[derive(serde::Deserialize)]
    struct PathData {
        commands: Vec<crate::path::PathCommand>,
        closed: bool,
    }

    let data: PathData = serde_json::from_str(commands_json)
        .map_err(|e| JsError::new(&format!("Invalid path JSON: {e}")))?;

    let (old_commands, old_closed) = with_scene(|s| {
        let node = s
            .get_node(id)
            .ok_or_else(|| format!("Node {id:?} not found"))?;
        if let scene::NodeKind::Shape {
            shape: shapes::ShapeData::Path(ref path),
            ..
        } = node.kind
        {
            Ok((path.commands().to_vec(), path.is_closed()))
        } else {
            Err(format!("Node {id:?} is not a Path shape"))
        }
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = SceneCommand::SetPathCommands {
        id,
        old_commands,
        old_closed,
        new_commands: data.commands,
        new_closed: data.closed,
    };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Get the number of nodes in the scene.
#[wasm_bindgen]
pub fn scene_node_count() -> usize {
    with_scene(|s| s.node_count())
}

/// Get the bounding box of a node as JSON `{min_x, min_y, max_x, max_y}`.
#[wasm_bindgen]
pub fn scene_node_bbox(node_id: i64) -> Result<String, JsError> {
    let id = NodeId(node_id as u64);
    with_scene(|s| {
        let bbox = s.node_bounding_box(id);
        serde_json::to_string(&bbox).map_err(|e| JsError::new(&format!("Serialization error: {e}")))
    })
}
