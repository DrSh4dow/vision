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
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum StitchType {
    Running,
    Satin,
}

/// A single stitch point with metadata.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Stitch {
    pub position: Point,
    pub is_jump: bool,
    pub is_trim: bool,
}
