//! Vision Engine - Core embroidery design engine
//!
//! This crate contains:
//! - Scene graph for managing design objects
//! - Vector path primitives and geometric shapes
//! - Stitch generation algorithms (running, satin, fill)
//! - File format I/O (DST, PES, JEF, etc.)
//! - Computational geometry primitives

use std::cell::RefCell;

use wasm_bindgen::prelude::*;

pub mod command;
pub mod format;
pub mod path;
pub mod scene;
pub mod shapes;
pub mod stitch;
pub mod svg;
pub mod thread;

// =============================================================================
// Singleton scene + command history (thread-local for WASM single-threaded env)
// =============================================================================

thread_local! {
    static SCENE: RefCell<scene::Scene> = RefCell::new(scene::Scene::new());
    static HISTORY: RefCell<command::CommandHistory> = RefCell::new(command::CommandHistory::default());
}

/// Helper: access the global scene.
fn with_scene<F, R>(f: F) -> R
where
    F: FnOnce(&scene::Scene) -> R,
{
    SCENE.with(|s| f(&s.borrow()))
}

/// Helper: mutably access the global scene.
fn with_scene_mut<F, R>(f: F) -> R
where
    F: FnOnce(&mut scene::Scene) -> R,
{
    SCENE.with(|s| f(&mut s.borrow_mut()))
}

/// Helper: execute a command on the scene with history tracking.
fn execute_command(cmd: command::SceneCommand) -> Result<(), String> {
    SCENE.with(|s| {
        HISTORY.with(|h| {
            let mut scene = s.borrow_mut();
            let mut history = h.borrow_mut();
            history.execute(&mut scene, cmd)
        })
    })
}

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

// =============================================================================
// Scene Graph (placeholder)
// =============================================================================

/// A 2D point in design space (millimeters).
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

#[wasm_bindgen]
impl Point {
    #[wasm_bindgen(constructor)]
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }
}

/// Represents an RGBA color.
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

#[wasm_bindgen]
impl Color {
    #[wasm_bindgen(constructor)]
    pub fn new(r: u8, g: u8, b: u8, a: u8) -> Self {
        Self { r, g, b, a }
    }
}

/// Stitch type enumeration.
#[wasm_bindgen]
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum StitchType {
    Running,
    Satin,
    TatamiFill,
    SpiralFill,
    ContourFill,
}

/// A single stitch point with metadata.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Stitch {
    pub position: Point,
    pub is_jump: bool,
    pub is_trim: bool,
}

// =============================================================================
// Stitch Generation (WASM bindings)
// =============================================================================

/// Generate running stitches along a path.
///
/// # Arguments
/// * `path` - Flat array of coordinates [x0, y0, x1, y1, ...] defining the path
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
/// # Arguments
/// * `rail1` - Flat array of coordinates [x0, y0, x1, y1, ...] for first rail
/// * `rail2` - Flat array of coordinates [x0, y0, x1, y1, ...] for second rail
/// * `density` - Stitch spacing along rails in mm (typically 0.3-0.5)
/// * `pull_compensation` - Extra width per side in mm (typically 0.1-0.3)
/// * `underlay_json` - JSON string for underlay config
///
/// # Returns
/// JSON string of stitch results with coordinates and stitch types
#[wasm_bindgen]
pub fn generate_satin_stitches(
    rail1: &[f64],
    rail2: &[f64],
    density: f64,
    pull_compensation: f64,
    underlay_json: &str,
) -> String {
    let config: stitch::satin::UnderlayConfig = match serde_json::from_str(underlay_json) {
        Ok(c) => c,
        Err(e) => return format!("{{\"error\":\"{e}\"}}"),
    };

    let stitches = stitch::satin::generate_satin_stitches_flat(
        rail1,
        rail2,
        density,
        pull_compensation,
        &config,
    );

    serde_json::to_string(&stitches).unwrap_or_else(|e| format!("{{\"error\":\"{e}\"}}"))
}

// =============================================================================
// SVG Import (WASM bindings)
// =============================================================================

/// Import SVG path data from an SVG `d` attribute string.
///
/// Returns a JSON string containing the parsed path commands.
#[wasm_bindgen]
pub fn import_svg_path(d: &str) -> String {
    match svg::parse_svg_path(d) {
        Ok(path) => {
            serde_json::to_string(&path).unwrap_or_else(|e| format!("{{\"error\":\"{e}\"}}"))
        }
        Err(e) => format!("{{\"error\":\"{e}\"}}"),
    }
}

/// Import all paths from an SVG document string.
///
/// Returns a JSON string containing an array of parsed path commands.
#[wasm_bindgen]
pub fn import_svg_document(svg_content: &str) -> String {
    match svg::parse_svg_document(svg_content) {
        Ok(paths) => {
            serde_json::to_string(&paths).unwrap_or_else(|e| format!("{{\"error\":\"{e}\"}}"))
        }
        Err(e) => format!("{{\"error\":\"{e}\"}}"),
    }
}

// =============================================================================
// Thread Palette (WASM bindings)
// =============================================================================

/// Get the thread palette for a given brand.
///
/// Returns a JSON string with the thread color entries.
#[wasm_bindgen]
pub fn get_thread_palette(brand: &str) -> String {
    let brand_enum = match brand {
        "madeira" => thread::ThreadBrand::MadeiraRayon,
        "isacord" => thread::ThreadBrand::IsacordPolyester,
        "sulky" => thread::ThreadBrand::SulkyRayon,
        _ => return format!("{{\"error\":\"Unknown brand: {brand}\"}}"),
    };

    let palette = thread::list_brand(brand_enum);
    serde_json::to_string(&palette).unwrap_or_else(|e| format!("{{\"error\":\"{e}\"}}"))
}

/// Find the nearest thread color in a brand's palette.
///
/// Returns a JSON string with the matching thread entry.
#[wasm_bindgen]
pub fn find_nearest_thread(brand: &str, r: u8, g: u8, b: u8) -> String {
    let brand_enum = match brand {
        "madeira" => thread::ThreadBrand::MadeiraRayon,
        "isacord" => thread::ThreadBrand::IsacordPolyester,
        "sulky" => thread::ThreadBrand::SulkyRayon,
        _ => return format!("{{\"error\":\"Unknown brand: {brand}\"}}"),
    };

    let entry = thread::find_nearest_color(brand_enum, r, g, b);
    serde_json::to_string(&entry).unwrap_or_else(|e| format!("{{\"error\":\"{e}\"}}"))
}

// =============================================================================
// Export (WASM bindings)
// =============================================================================

/// Export stitch data to DST (Tajima) format.
///
/// # Arguments
/// * `design_json` - JSON string containing the ExportDesign
///
/// # Returns
/// Binary DST file data as a byte array
#[wasm_bindgen]
pub fn export_dst(design_json: &str) -> Result<Vec<u8>, JsError> {
    let design: format::ExportDesign = serde_json::from_str(design_json)
        .map_err(|e| JsError::new(&format!("Invalid design JSON: {e}")))?;
    format::dst::export_dst(&design).map_err(|e| JsError::new(&e))
}

/// Export stitch data to PES (Brother) format.
///
/// # Arguments
/// * `design_json` - JSON string containing the ExportDesign
///
/// # Returns
/// Binary PES file data as a byte array
#[wasm_bindgen]
pub fn export_pes(design_json: &str) -> Result<Vec<u8>, JsError> {
    let design: format::ExportDesign = serde_json::from_str(design_json)
        .map_err(|e| JsError::new(&format!("Invalid design JSON: {e}")))?;
    format::pes::export_pes(&design).map_err(|e| JsError::new(&e))
}

// =============================================================================
// Scene Graph (WASM bindings)
// =============================================================================

/// Create/reset the global scene. Call this to start a fresh document.
#[wasm_bindgen]
pub fn scene_create() {
    SCENE.with(|s| {
        *s.borrow_mut() = scene::Scene::new();
    });
    HISTORY.with(|h| {
        h.borrow_mut().clear();
    });
}

/// Add a node to the scene.
///
/// # Arguments
/// * `name` - Display name
/// * `kind_json` - JSON string describing the NodeKind
/// * `parent_id` - Parent node ID, or -1 for root level
///
/// # Returns
/// The new node's ID (as i64), or throws on error.
#[wasm_bindgen]
pub fn scene_add_node(name: &str, kind_json: &str, parent_id: i64) -> Result<i64, JsError> {
    let kind: scene::NodeKind = serde_json::from_str(kind_json)
        .map_err(|e| JsError::new(&format!("Invalid kind JSON: {e}")))?;

    let parent = if parent_id < 0 {
        None
    } else {
        Some(scene::NodeId(parent_id as u64))
    };

    let id = with_scene_mut(|s| s.alloc_next_id());

    let cmd = command::SceneCommand::AddNode {
        id,
        name: name.to_string(),
        kind,
        parent,
    };

    execute_command(cmd).map_err(|e| JsError::new(&e))?;
    Ok(id.0 as i64)
}

/// Remove a node and its descendants from the scene.
#[wasm_bindgen]
pub fn scene_remove_node(node_id: i64) -> Result<(), JsError> {
    let id = scene::NodeId(node_id as u64);
    let cmd = with_scene(|s| command::build_remove_command(s, id)).map_err(|e| JsError::new(&e))?;
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Get a single node as JSON.
#[wasm_bindgen]
pub fn scene_get_node(node_id: i64) -> String {
    let id = scene::NodeId(node_id as u64);
    with_scene(|s| match s.get_node(id) {
        Some(node) => {
            serde_json::to_string(node).unwrap_or_else(|e| format!("{{\"error\":\"{e}\"}}"))
        }
        None => "null".to_string(),
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
    let id = scene::NodeId(node_id as u64);
    let old = with_scene(|s| {
        s.get_node(id)
            .map(|n| n.transform)
            .ok_or_else(|| format!("Node {:?} not found", id))
    })
    .map_err(|e| JsError::new(&e))?;

    let new = scene::Transform {
        x,
        y,
        rotation,
        scale_x,
        scale_y,
    };

    let cmd = command::SceneCommand::UpdateTransform { id, old, new };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Update a node's kind (shape, fill, stroke, visibility, etc).
#[wasm_bindgen]
pub fn scene_update_kind(node_id: i64, kind_json: &str) -> Result<(), JsError> {
    let id = scene::NodeId(node_id as u64);
    let new: scene::NodeKind = serde_json::from_str(kind_json)
        .map_err(|e| JsError::new(&format!("Invalid kind JSON: {e}")))?;

    let old = with_scene(|s| {
        s.get_node(id)
            .map(|n| n.kind.clone())
            .ok_or_else(|| format!("Node {:?} not found", id))
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = command::SceneCommand::UpdateKind { id, old, new };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Move a node to a different parent.
#[wasm_bindgen]
pub fn scene_move_node(node_id: i64, new_parent_id: i64, index: i32) -> Result<(), JsError> {
    let id = scene::NodeId(node_id as u64);
    let new_parent = if new_parent_id < 0 {
        None
    } else {
        Some(scene::NodeId(new_parent_id as u64))
    };
    let new_index = if index < 0 {
        // Append to end — get current children count
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

    // Capture old position
    let (old_parent, old_index) = with_scene(|s| {
        let node = s
            .get_node(id)
            .ok_or_else(|| format!("Node {:?} not found", id))?;
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

    let cmd = command::SceneCommand::MoveNode {
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
    let id = scene::NodeId(node_id as u64);

    let old_index = with_scene(|s| {
        let node = s
            .get_node(id)
            .ok_or_else(|| format!("Node {:?} not found", id))?;
        let siblings = if let Some(pid) = node.parent {
            s.get_node(pid).map(|p| &p.children[..]).unwrap_or(&[])
        } else {
            s.root_children()
        };
        siblings
            .iter()
            .position(|c| *c == id)
            .ok_or_else(|| format!("Node {:?} not found in siblings", id))
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = command::SceneCommand::ReorderChild {
        id,
        old_index,
        new_index: new_index as usize,
    };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Get the full scene tree as JSON (for layers panel).
#[wasm_bindgen]
pub fn scene_get_tree() -> String {
    with_scene(|s| {
        let tree = s.get_tree();
        serde_json::to_string(&tree).unwrap_or_else(|e| format!("{{\"error\":\"{e}\"}}"))
    })
}

/// Get the render list as JSON (depth-first, visible shapes with world transforms).
#[wasm_bindgen]
pub fn scene_get_render_list() -> String {
    with_scene(|s| {
        let items = s.render_list();
        serde_json::to_string(&items).unwrap_or_else(|e| format!("{{\"error\":\"{e}\"}}"))
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
    SCENE.with(|s| {
        HISTORY.with(|h| {
            let mut scene = s.borrow_mut();
            let mut history = h.borrow_mut();
            history.undo(&mut scene).map_err(|e| JsError::new(&e))
        })
    })
}

/// Redo the last undone command. Returns true if something was redone.
#[wasm_bindgen]
pub fn scene_redo() -> Result<bool, JsError> {
    SCENE.with(|s| {
        HISTORY.with(|h| {
            let mut scene = s.borrow_mut();
            let mut history = h.borrow_mut();
            history.redo(&mut scene).map_err(|e| JsError::new(&e))
        })
    })
}

/// Rename a node.
#[wasm_bindgen]
pub fn scene_rename_node(node_id: i64, new_name: &str) -> Result<(), JsError> {
    let id = scene::NodeId(node_id as u64);
    let old_name = with_scene(|s| {
        s.get_node(id)
            .map(|n| n.name.clone())
            .ok_or_else(|| format!("Node {:?} not found", id))
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = command::SceneCommand::Rename {
        id,
        old_name,
        new_name: new_name.to_string(),
    };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Set fill color on a shape node. Pass empty string for no fill.
#[wasm_bindgen]
pub fn scene_set_fill(node_id: i64, fill_json: &str) -> Result<(), JsError> {
    let id = scene::NodeId(node_id as u64);
    let new: Option<Color> = if fill_json.is_empty() || fill_json == "null" {
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
            .ok_or_else(|| format!("Node {:?} not found", id))?;
        if let scene::NodeKind::Shape { fill, .. } = &node.kind {
            Ok(*fill)
        } else {
            Err(format!("Node {:?} is not a Shape", id))
        }
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = command::SceneCommand::SetFill { id, old, new };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Set stroke color on a shape node. Pass empty string for no stroke.
#[wasm_bindgen]
pub fn scene_set_stroke(node_id: i64, stroke_json: &str) -> Result<(), JsError> {
    let id = scene::NodeId(node_id as u64);
    let new: Option<Color> = if stroke_json.is_empty() || stroke_json == "null" {
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
            .ok_or_else(|| format!("Node {:?} not found", id))?;
        if let scene::NodeKind::Shape { stroke, .. } = &node.kind {
            Ok(*stroke)
        } else {
            Err(format!("Node {:?} is not a Shape", id))
        }
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = command::SceneCommand::SetStroke { id, old, new };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Set stroke width on a shape node.
#[wasm_bindgen]
pub fn scene_set_stroke_width(node_id: i64, width: f64) -> Result<(), JsError> {
    let id = scene::NodeId(node_id as u64);

    let old = with_scene(|s| {
        let node = s
            .get_node(id)
            .ok_or_else(|| format!("Node {:?} not found", id))?;
        if let scene::NodeKind::Shape { stroke_width, .. } = &node.kind {
            Ok(*stroke_width)
        } else {
            Err(format!("Node {:?} is not a Shape", id))
        }
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = command::SceneCommand::SetStrokeWidth {
        id,
        old,
        new: width,
    };
    execute_command(cmd).map_err(|e| JsError::new(&e))
}

/// Get the path commands of a shape node as JSON.
#[wasm_bindgen]
pub fn scene_get_path_commands(node_id: i64) -> Result<String, JsError> {
    let id = scene::NodeId(node_id as u64);
    with_scene(|s| {
        let node = s
            .get_node(id)
            .ok_or_else(|| JsError::new(&format!("Node {:?} not found", id)))?;
        if let scene::NodeKind::Shape {
            shape: shapes::ShapeData::Path(ref path),
            ..
        } = node.kind
        {
            #[derive(serde::Serialize)]
            struct PathData {
                commands: Vec<path::PathCommand>,
                closed: bool,
            }
            let data = PathData {
                commands: path.commands().to_vec(),
                closed: path.is_closed(),
            };
            serde_json::to_string(&data).map_err(|e| JsError::new(&format!("{e}")))
        } else {
            Err(JsError::new(&format!("Node {:?} is not a Path shape", id)))
        }
    })
}

/// Set the path commands of a shape node from JSON.
#[wasm_bindgen]
pub fn scene_set_path_commands(node_id: i64, commands_json: &str) -> Result<(), JsError> {
    let id = scene::NodeId(node_id as u64);

    #[derive(serde::Deserialize)]
    struct PathData {
        commands: Vec<path::PathCommand>,
        closed: bool,
    }

    let data: PathData = serde_json::from_str(commands_json)
        .map_err(|e| JsError::new(&format!("Invalid path JSON: {e}")))?;

    // Get old commands
    let (old_commands, old_closed) = with_scene(|s| {
        let node = s
            .get_node(id)
            .ok_or_else(|| format!("Node {:?} not found", id))?;
        if let scene::NodeKind::Shape {
            shape: shapes::ShapeData::Path(ref path),
            ..
        } = node.kind
        {
            Ok((path.commands().to_vec(), path.is_closed()))
        } else {
            Err(format!("Node {:?} is not a Path shape", id))
        }
    })
    .map_err(|e| JsError::new(&e))?;

    let cmd = command::SceneCommand::SetPathCommands {
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
pub fn scene_node_bbox(node_id: i64) -> String {
    let id = scene::NodeId(node_id as u64);
    with_scene(|s| {
        let bbox = s.node_bounding_box(id);
        serde_json::to_string(&bbox).unwrap_or_else(|e| format!("{{\"error\":\"{e}\"}}"))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_running_stitches_basic() {
        let path = vec![0.0, 0.0, 10.0, 0.0];
        let stitches = generate_running_stitches(&path, 3.0);

        assert!(stitches.len() >= 4);
        assert_eq!(stitches[0], 0.0);
        assert_eq!(stitches[1], 0.0);

        let len = stitches.len();
        assert_eq!(stitches[len - 2], 10.0);
        assert_eq!(stitches[len - 1], 0.0);
    }

    #[test]
    fn test_running_stitches_too_few_points() {
        let path = vec![0.0, 0.0];
        let stitches = generate_running_stitches(&path, 3.0);
        assert!(stitches.is_empty());
    }

    #[test]
    fn test_running_stitches_empty() {
        let path: Vec<f64> = vec![];
        let stitches = generate_running_stitches(&path, 3.0);
        assert!(stitches.is_empty());
    }
}
