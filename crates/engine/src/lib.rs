//! Vision Engine - Core embroidery design engine
//!
//! This crate contains:
//! - Scene graph for managing design objects
//! - Vector path primitives and geometric shapes
//! - Stitch generation algorithms (running, satin, fill)
//! - File format I/O (DST, PES, JEF, etc.)
//! - Computational geometry primitives

use wasm_bindgen::prelude::*;

pub mod format;
pub mod path;
pub mod scene;
pub mod shapes;
pub mod stitch;
pub mod svg;
pub mod thread;

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
