//! Core types shared across the engine.
//!
//! These types are used by the scene graph, stitch algorithms, file exporters,
//! and the WASM bridge. They are kept in a dedicated module to avoid circular
//! dependencies and provide a clear import surface.

use wasm_bindgen::prelude::*;

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
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
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
#[derive(Debug, Clone, Copy, PartialEq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StitchType {
    Running,
    Satin,
    Tatami,
    Spiral,
    Contour,
    Motif,
}

/// Motif pattern variant for motif fill stitches.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MotifPattern {
    #[default]
    Diamond,
    Wave,
    Triangle,
}

/// Underlay pattern mode for satin stitches.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UnderlayMode {
    #[default]
    None,
    CenterWalk,
    EdgeWalk,
    Zigzag,
    CenterEdge,
    CenterZigzag,
    EdgeZigzag,
    Full,
}

/// Pull compensation mode for satin stitches.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CompensationMode {
    Off,
    #[default]
    Auto,
    Directional,
}

/// Stitch parameters for an embroidery object.
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct StitchParams {
    #[serde(rename = "type")]
    pub stitch_type: StitchType,
    pub density: f64,
    pub angle: f64,
    #[serde(default)]
    pub underlay_mode: UnderlayMode,
    #[serde(default = "default_underlay_spacing_mm")]
    pub underlay_spacing_mm: f64,
    #[serde(default)]
    pub underlay_enabled: bool,
    #[serde(default)]
    pub pull_compensation: f64,
    #[serde(default)]
    pub compensation_mode: CompensationMode,
    #[serde(default)]
    pub compensation_x_mm: f64,
    #[serde(default)]
    pub compensation_y_mm: f64,
    #[serde(default)]
    pub fill_phase: f64,
    #[serde(default = "default_contour_step_mm")]
    pub contour_step_mm: f64,
    #[serde(default)]
    pub motif_pattern: MotifPattern,
    #[serde(default = "default_motif_scale")]
    pub motif_scale: f64,
}

impl Default for StitchParams {
    fn default() -> Self {
        Self {
            stitch_type: StitchType::Running,
            density: crate::constants::DEFAULT_STITCH_DENSITY,
            angle: 0.0,
            underlay_mode: UnderlayMode::None,
            underlay_spacing_mm: default_underlay_spacing_mm(),
            underlay_enabled: false,
            pull_compensation: 0.0,
            compensation_mode: CompensationMode::Auto,
            compensation_x_mm: 0.0,
            compensation_y_mm: 0.0,
            fill_phase: 0.0,
            contour_step_mm: default_contour_step_mm(),
            motif_pattern: MotifPattern::default(),
            motif_scale: default_motif_scale(),
        }
    }
}

fn default_contour_step_mm() -> f64 {
    1.2
}

fn default_underlay_spacing_mm() -> f64 {
    2.0
}

fn default_motif_scale() -> f64 {
    1.0
}

/// A single stitch point with metadata.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Stitch {
    pub position: Point,
    pub is_jump: bool,
    pub is_trim: bool,
}
