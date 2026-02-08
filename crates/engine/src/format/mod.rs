//! Embroidery file format exporters.
//!
//! Provides DST (Tajima) and PES (Brother) export functionality.

pub mod dst;
pub mod pec;
pub mod pes;

use crate::Color;

/// A stitch command for export.
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum ExportStitchType {
    /// Normal stitch — needle penetration.
    Normal,
    /// Jump stitch — move without sewing.
    Jump,
    /// Trim — cut the thread.
    Trim,
    /// Color change — switch to next thread.
    ColorChange,
    /// End of design.
    End,
}

/// A single stitch for file export.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExportStitch {
    /// Position in design coordinates (mm).
    pub x: f64,
    pub y: f64,
    /// Type of stitch command.
    pub stitch_type: ExportStitchType,
}

/// A complete design ready for export to any format.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ExportDesign {
    /// Design name (max 8 chars for DST compatibility).
    pub name: String,
    /// Ordered list of stitch commands.
    pub stitches: Vec<ExportStitch>,
    /// Thread colors used, in order of color changes.
    pub colors: Vec<Color>,
}

impl ExportDesign {
    /// Calculate the bounding box extents of the design in mm.
    pub fn extents(&self) -> (f64, f64, f64, f64) {
        let mut min_x = f64::INFINITY;
        let mut min_y = f64::INFINITY;
        let mut max_x = f64::NEG_INFINITY;
        let mut max_y = f64::NEG_INFINITY;

        for s in &self.stitches {
            min_x = min_x.min(s.x);
            min_y = min_y.min(s.y);
            max_x = max_x.max(s.x);
            max_y = max_y.max(s.y);
        }

        if min_x > max_x {
            (0.0, 0.0, 0.0, 0.0)
        } else {
            (min_x, min_y, max_x, max_y)
        }
    }

    /// Count the number of color changes in the design.
    pub fn color_change_count(&self) -> usize {
        self.stitches
            .iter()
            .filter(|s| s.stitch_type == ExportStitchType::ColorChange)
            .count()
    }

    /// Convert stitches from mm to 0.1mm units (the standard embroidery unit).
    pub fn stitches_in_units(&self) -> Vec<(i32, i32, ExportStitchType)> {
        self.stitches
            .iter()
            .map(|s| {
                let x = (s.x * 10.0).round() as i32;
                let y = (s.y * 10.0).round() as i32;
                (x, y, s.stitch_type)
            })
            .collect()
    }
}
