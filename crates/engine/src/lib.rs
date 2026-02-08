//! Vision Engine — Core embroidery design engine.
//!
//! Provides the scene graph, vector path primitives, geometric shapes,
//! stitch generation algorithms (running stitch, satin stitch), thread
//! palettes, and embroidery file format export (DST, PES).

pub mod command;
pub mod constants;
pub mod export_pipeline;
pub mod format;
pub mod path;
pub mod scene;
pub mod shapes;
mod state;
pub mod stitch;
pub mod svg;
pub mod thread;
mod types;
mod wasm;

// Re-export core types at crate root for ergonomic access.
pub use types::{
    Color, CompensationMode, FillStartMode, MotifPattern, Point, Stitch, StitchParams, StitchType,
    UnderlayMode,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_running_stitches_basic() {
        let path = vec![0.0, 0.0, 10.0, 0.0];
        let stitches = wasm::generate_running_stitches(&path, 3.0);

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
        let stitches = wasm::generate_running_stitches(&path, 3.0);
        assert!(stitches.is_empty());
    }

    #[test]
    fn test_running_stitches_empty() {
        let path: Vec<f64> = vec![];
        let stitches = wasm::generate_running_stitches(&path, 3.0);
        assert!(stitches.is_empty());
    }
}
