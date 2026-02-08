//! Vision Renderer - WebGPU/WebGL2 rendering engine
//!
//! This crate provides:
//! - GPU-accelerated 2D canvas rendering via wgpu
//! - 2D camera with pan/zoom for infinite canvas
//! - Mesh generation from scene graph shapes
//! - Grid overlay rendering
//! - Instanced stitch preview rendering (future)
//!
//! The `Renderer` struct is only available on WASM targets (it requires
//! a browser canvas). Camera, mesh, and vertex modules are platform-agnostic
//! and can be tested natively.

pub mod camera;
pub mod mesh;
pub mod vertex;

// The GPU renderer is only available on wasm32 targets.
// Camera, mesh, and vertex modules are testable on all targets.
#[cfg(target_arch = "wasm32")]
mod gpu;

#[cfg(target_arch = "wasm32")]
pub use gpu::Renderer;
