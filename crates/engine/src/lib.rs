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
// Stitch Generation
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
    let point_count = path.len() / 2;
    if point_count < 2 {
        return vec![];
    }

    let mut stitches: Vec<f64> = Vec::new();

    // Add the first point
    stitches.push(path[0]);
    stitches.push(path[1]);

    let mut remaining = 0.0_f64;

    for i in 0..(point_count - 1) {
        let x0 = path[i * 2];
        let y0 = path[i * 2 + 1];
        let x1 = path[(i + 1) * 2];
        let y1 = path[(i + 1) * 2 + 1];

        let dx = x1 - x0;
        let dy = y1 - y0;
        let segment_length = (dx * dx + dy * dy).sqrt();

        if segment_length == 0.0 {
            continue;
        }

        let nx = dx / segment_length;
        let ny = dy / segment_length;

        let mut distance = stitch_length - remaining;

        while distance <= segment_length {
            let sx = x0 + nx * distance;
            let sy = y0 + ny * distance;
            stitches.push(sx);
            stitches.push(sy);
            distance += stitch_length;
        }

        remaining = segment_length - (distance - stitch_length);
    }

    // Add the last point
    let last_idx = (point_count - 1) * 2;
    stitches.push(path[last_idx]);
    stitches.push(path[last_idx + 1]);

    stitches
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_running_stitches_basic() {
        // Straight horizontal line from (0,0) to (10,0) with stitch length 3
        let path = vec![0.0, 0.0, 10.0, 0.0];
        let stitches = generate_running_stitches(&path, 3.0);

        // Should have first point, stitches at 3, 6, 9, and last point (10)
        assert!(stitches.len() >= 4); // At least 2 points (4 coords)

        // First point
        assert_eq!(stitches[0], 0.0);
        assert_eq!(stitches[1], 0.0);

        // Last point
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
