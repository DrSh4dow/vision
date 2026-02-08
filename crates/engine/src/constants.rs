//! Shared constants used across the engine.
//!
//! Centralizes magic numbers, tolerances, and format-specific values to ensure
//! consistency and make them easy to discover and tune.

// =============================================================================
// Geometry
// =============================================================================

/// Kappa constant for approximating circular arcs with cubic Bezier curves.
///
/// Four cubic Bezier segments with control point offset `radius * KAPPA`
/// produce an excellent approximation of a circle.
/// See: <https://pomax.github.io/bezierinfo/#circles_cubic>
pub const KAPPA: f64 = 0.552_284_749_8;

/// Default tolerance (in mm) for flattening Bezier curves to polylines.
///
/// Used by `VectorPath::flatten()`, bounding box, and hit-test calculations.
/// Smaller values produce more points (higher fidelity), larger values are
/// faster but less precise.
pub const DEFAULT_FLATTEN_TOLERANCE: f64 = 0.5;

/// Distance tolerance (in mm) for point-near-path hit testing.
pub const HIT_TEST_TOLERANCE: f64 = 3.0;

// =============================================================================
// Command History
// =============================================================================

/// Default maximum number of undo steps retained in the command history.
pub const DEFAULT_MAX_HISTORY: usize = 200;

// =============================================================================
// Stitch Generation
// =============================================================================

/// Default tatami/fill stitch density (row spacing) in mm.
pub const DEFAULT_STITCH_DENSITY: f64 = 0.45;

/// Default stitch length (in mm) for running and fill stitches.
pub const DEFAULT_STITCH_LENGTH: f64 = 2.5;

/// Minimum satin stitch density (mm). Values below this are clamped.
pub const MIN_SATIN_DENSITY: f64 = 0.1;

/// Minimum tatami stitch density (mm). Values below this are clamped.
pub const MIN_TATAMI_DENSITY: f64 = 0.1;

// =============================================================================
// DST Format
// =============================================================================

/// DST end-of-file marker: three bytes that signal the end of stitch data.
pub const DST_END_MARKER: [u8; 3] = [0x00, 0x00, 0xF3];

// =============================================================================
// PEC Format
// =============================================================================

/// PEC color list size in the PEC header block.
/// This is a fixed constant from the PEC specification.
pub const PEC_COLOR_LIST_SIZE: usize = 463;

/// Maximum delta for a single-byte PEC stitch coordinate.
pub const PEC_SMALL_DELTA_MAX: i32 = 63;

/// Maximum delta for a two-byte PEC stitch coordinate.
pub const PEC_LARGE_DELTA_MAX: i32 = 2047;
