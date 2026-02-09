//! Scene-to-export pipeline — converts the scene graph into stitch data.
//!
//! This module bridges the gap between the vector design (scene graph with
//! shapes, transforms, colors) and the embroidery export formats (DST, PES).
//!
//! Generates running stitches along outlines and tatami fills for closed shapes.
//! Spiral/contour fill variants will be added in Phase 2.

use crate::Color;
use crate::Point;
use crate::StitchType;
use crate::constants::{DEFAULT_FLATTEN_TOLERANCE, DEFAULT_STITCH_LENGTH};
use crate::format::{ExportDesign, ExportStitch, ExportStitchType};
use crate::scene::{NodeKind, Scene};
use crate::stitch::fill::{
    generate_contour_fill, generate_motif_fill, generate_spiral_fill, generate_tatami_fill,
};
use crate::stitch::running::generate_running_stitches;
use crate::stitch::satin::{UnderlayConfig, generate_satin_stitches};
use crate::{CompensationMode, FillStartMode, StitchParams, UnderlayMode};

/// Minimum number of points required to generate stitches from a path.
const MIN_POINTS_FOR_STITCHES: usize = 2;
/// Minimum satin width used when shape stroke width is tiny.
const MIN_SATIN_WIDTH_MM: f64 = 0.6;

#[derive(Debug, Clone)]
struct ShapeStitchBlock {
    color: Color,
    stitches: Vec<crate::Stitch>,
    source_order: usize,
}

impl ShapeStitchBlock {
    fn start_point(&self) -> Point {
        self.stitches[0].position
    }

    fn end_point(&self) -> Point {
        self.stitches[self.stitches.len() - 1].position
    }
}

/// Export route quality metrics.
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct RouteMetrics {
    pub jump_count: usize,
    pub trim_count: usize,
    pub color_change_count: usize,
    pub travel_distance_mm: f64,
    pub longest_travel_mm: f64,
    pub route_score: f64,
}

/// Extended stitch quality metrics for parity benchmarking.
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct QualityMetrics {
    pub stitch_count: usize,
    pub jump_count: usize,
    pub trim_count: usize,
    pub color_change_count: usize,
    pub travel_distance_mm: f64,
    pub longest_travel_mm: f64,
    pub route_score: f64,
    /// Mean length of normal stitch segments.
    pub mean_stitch_length_mm: f64,
    /// 95th percentile normal stitch length.
    pub stitch_length_p95_mm: f64,
    /// Median absolute deviation from target stitch length.
    pub density_error_mm: f64,
    /// Median absolute angular deviation from dominant segment orientation.
    pub angle_error_deg: f64,
    /// Proxy for fill coverage defects (% segments longer than 2x target).
    pub coverage_error_pct: f64,
}

/// Stitch routing policy for block ordering and travel handling.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RoutingPolicy {
    #[default]
    Balanced,
    MinTravel,
    MinTrims,
}

/// Entry/exit strategy for individual stitch blocks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntryExitMode {
    #[default]
    Auto,
    PreserveShapeStart,
    UserAnchor,
}

/// Tie stitch insertion mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TieMode {
    Off,
    #[default]
    ShapeStartEnd,
    ColorChange,
}

/// Block sequencing mode for export routing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SequenceMode {
    /// Preserve explicit scene/sequencer order and optimize only transitions.
    StrictSequencer,
    /// Allow global reorder optimization by routing policy.
    #[default]
    Optimizer,
}

/// Route optimization options used during scene export.
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct RoutingOptions {
    #[serde(default)]
    pub policy: RoutingPolicy,
    #[serde(default = "default_max_jump_mm")]
    pub max_jump_mm: f64,
    #[serde(default = "default_trim_threshold_mm")]
    pub trim_threshold_mm: f64,
    #[serde(default = "default_true")]
    pub preserve_color_order: bool,
    #[serde(default)]
    pub preserve_layer_order: bool,
    #[serde(default = "default_true")]
    pub allow_reverse: bool,
    #[serde(default)]
    pub allow_color_merge: bool,
    #[serde(default = "default_true")]
    pub allow_underpath: bool,
    #[serde(default)]
    pub entry_exit_mode: EntryExitMode,
    #[serde(default)]
    pub tie_mode: TieMode,
    #[serde(default = "default_min_stitch_run_before_trim_mm")]
    pub min_stitch_run_before_trim_mm: f64,
    #[serde(default)]
    pub sequence_mode: SequenceMode,
}

impl Default for RoutingOptions {
    fn default() -> Self {
        Self {
            policy: RoutingPolicy::Balanced,
            max_jump_mm: default_max_jump_mm(),
            trim_threshold_mm: default_trim_threshold_mm(),
            preserve_color_order: true,
            preserve_layer_order: false,
            allow_reverse: true,
            allow_color_merge: false,
            allow_underpath: true,
            entry_exit_mode: EntryExitMode::Auto,
            tie_mode: TieMode::ShapeStartEnd,
            min_stitch_run_before_trim_mm: default_min_stitch_run_before_trim_mm(),
            sequence_mode: SequenceMode::Optimizer,
        }
    }
}

fn default_max_jump_mm() -> f64 {
    25.0
}

fn default_trim_threshold_mm() -> f64 {
    12.0
}

fn default_true() -> bool {
    true
}

fn default_min_stitch_run_before_trim_mm() -> f64 {
    2.0
}

/// Convert the current scene graph into an `ExportDesign` ready for file export.
///
/// Walks all visible shapes in render order, generates running stitches along
/// their outlines, and assembles the result with proper jump/trim/color-change
/// commands between shapes.
///
/// # Arguments
/// * `scene` - The scene graph to export.
/// * `stitch_length` - Target stitch length in mm. If `<= 0`, uses the default (2.5mm).
///
/// # Returns
/// An `ExportDesign` with stitches, colors, and a design name, or an error
/// if the scene contains no exportable shapes.
pub fn scene_to_export_design(scene: &Scene, stitch_length: f64) -> Result<ExportDesign, String> {
    scene_to_export_design_with_routing(scene, stitch_length, RoutingOptions::default())
}

/// Convert the current scene graph into an `ExportDesign` with explicit routing options.
pub fn scene_to_export_design_with_routing(
    scene: &Scene,
    stitch_length: f64,
    routing: RoutingOptions,
) -> Result<ExportDesign, String> {
    let stitch_length = if stitch_length <= 0.0 {
        DEFAULT_STITCH_LENGTH
    } else {
        stitch_length
    };

    let render_items = scene.render_list();
    let mut blocks: Vec<ShapeStitchBlock> = Vec::new();

    // Build shape stitch blocks first; final command assembly is done after optional routing.
    for (source_order, item) in render_items.iter().enumerate() {
        let NodeKind::Shape {
            shape,
            stroke,
            fill,
            stroke_width,
            stitch,
            ..
        } = &item.kind
        else {
            continue;
        };

        // Convert shape to path and flatten to polyline
        let path = shape.to_path();
        let local_points = path.flatten(DEFAULT_FLATTEN_TOLERANCE);
        if local_points.len() < MIN_POINTS_FOR_STITCHES {
            continue;
        }

        // Apply world transform to each point
        let world = &item.world_transform;
        let world_points: Vec<Point> = local_points
            .iter()
            .map(|p| apply_transform(p, world))
            .collect();

        let (shape_stitches, color) = match stitch.stitch_type {
            StitchType::Satin => {
                let color = match (stroke, fill) {
                    (Some(c), _) => *c,
                    (None, Some(c)) => *c,
                    (None, None) => continue,
                };
                let satin = generate_satin_shape_stitches(
                    &world_points,
                    stitch,
                    stitch_length,
                    *stroke_width,
                );

                if satin.is_empty() {
                    (
                        apply_segment_controls(
                            generate_running_stitches(&world_points, stitch_length),
                            stitch,
                        ),
                        color,
                    )
                } else {
                    (satin, color)
                }
            }
            StitchType::Tatami => {
                let subpaths = path.flatten_subpaths(DEFAULT_FLATTEN_TOLERANCE);
                let world_subpaths: Vec<Vec<Point>> = subpaths
                    .iter()
                    .map(|points| points.iter().map(|p| apply_transform(p, world)).collect())
                    .collect();
                let fill_stitches = generate_tatami_fill(
                    &world_subpaths,
                    stitch.density,
                    stitch.angle,
                    stitch_length,
                );
                let fill_stitches =
                    apply_fill_controls(fill_stitches, &world_subpaths, stitch, stitch_length);

                if !fill_stitches.is_empty() {
                    let color = match (fill, stroke) {
                        (Some(c), _) => *c,
                        (None, Some(c)) => *c,
                        (None, None) => continue,
                    };
                    (fill_stitches, color)
                } else {
                    let outline_color = match (stroke, fill) {
                        (Some(c), _) => *c,
                        (None, Some(c)) => *c,
                        (None, None) => continue,
                    };
                    (
                        apply_segment_controls(
                            generate_running_stitches(&world_points, stitch_length),
                            stitch,
                        ),
                        outline_color,
                    )
                }
            }
            StitchType::Contour => {
                let subpaths = path.flatten_subpaths(DEFAULT_FLATTEN_TOLERANCE);
                let world_subpaths: Vec<Vec<Point>> = subpaths
                    .iter()
                    .map(|points| points.iter().map(|p| apply_transform(p, world)).collect())
                    .collect();
                let fill_stitches = generate_contour_fill(
                    &world_subpaths,
                    stitch.density,
                    stitch_length,
                    stitch.contour_step_mm,
                );
                let fill_stitches =
                    apply_fill_controls(fill_stitches, &world_subpaths, stitch, stitch_length);

                if !fill_stitches.is_empty() {
                    let color = match (fill, stroke) {
                        (Some(c), _) => *c,
                        (None, Some(c)) => *c,
                        (None, None) => continue,
                    };
                    (fill_stitches, color)
                } else {
                    let outline_color = match (stroke, fill) {
                        (Some(c), _) => *c,
                        (None, Some(c)) => *c,
                        (None, None) => continue,
                    };
                    (
                        apply_segment_controls(
                            generate_running_stitches(&world_points, stitch_length),
                            stitch,
                        ),
                        outline_color,
                    )
                }
            }
            StitchType::Spiral => {
                let subpaths = path.flatten_subpaths(DEFAULT_FLATTEN_TOLERANCE);
                let world_subpaths: Vec<Vec<Point>> = subpaths
                    .iter()
                    .map(|points| points.iter().map(|p| apply_transform(p, world)).collect())
                    .collect();
                let fill_stitches = generate_spiral_fill(
                    &world_subpaths,
                    stitch.density,
                    stitch_length,
                    stitch.fill_phase,
                );
                let fill_stitches =
                    apply_fill_controls(fill_stitches, &world_subpaths, stitch, stitch_length);

                if !fill_stitches.is_empty() {
                    let color = match (fill, stroke) {
                        (Some(c), _) => *c,
                        (None, Some(c)) => *c,
                        (None, None) => continue,
                    };
                    (fill_stitches, color)
                } else {
                    let outline_color = match (stroke, fill) {
                        (Some(c), _) => *c,
                        (None, Some(c)) => *c,
                        (None, None) => continue,
                    };
                    (
                        apply_segment_controls(
                            generate_running_stitches(&world_points, stitch_length),
                            stitch,
                        ),
                        outline_color,
                    )
                }
            }
            StitchType::Motif => {
                let subpaths = path.flatten_subpaths(DEFAULT_FLATTEN_TOLERANCE);
                let world_subpaths: Vec<Vec<Point>> = subpaths
                    .iter()
                    .map(|points| points.iter().map(|p| apply_transform(p, world)).collect())
                    .collect();
                let fill_stitches = generate_motif_fill(
                    &world_subpaths,
                    stitch.density,
                    stitch.angle,
                    stitch_length,
                    stitch.fill_phase,
                    stitch.motif_pattern,
                    stitch.motif_scale,
                );
                let fill_stitches =
                    apply_fill_controls(fill_stitches, &world_subpaths, stitch, stitch_length);

                if !fill_stitches.is_empty() {
                    let color = match (fill, stroke) {
                        (Some(c), _) => *c,
                        (None, Some(c)) => *c,
                        (None, None) => continue,
                    };
                    (fill_stitches, color)
                } else {
                    let outline_color = match (stroke, fill) {
                        (Some(c), _) => *c,
                        (None, Some(c)) => *c,
                        (None, None) => continue,
                    };
                    (
                        apply_segment_controls(
                            generate_running_stitches(&world_points, stitch_length),
                            stitch,
                        ),
                        outline_color,
                    )
                }
            }
            _ => {
                let color = match (stroke, fill) {
                    (Some(c), _) => *c,
                    (None, Some(c)) => *c,
                    (None, None) => continue,
                };
                (
                    apply_segment_controls(
                        generate_running_stitches(&world_points, stitch_length),
                        stitch,
                    ),
                    color,
                )
            }
        };

        if shape_stitches.is_empty() {
            continue;
        }

        blocks.push(ShapeStitchBlock {
            color,
            stitches: shape_stitches,
            source_order,
        });
    }

    if blocks.is_empty() {
        return Err("No visible shapes with stroke or fill to export".to_string());
    }

    let blocks = optimize_blocks_for_travel(blocks, routing);

    // Assemble final export design.
    let mut stitches: Vec<ExportStitch> = Vec::new();
    let mut colors: Vec<Color> = Vec::new();
    let mut current_color: Option<Color> = None;
    let mut current_position: Option<Point> = None;
    let mut run_since_trim_mm = 0.0;

    for block in blocks {
        let color = block.color;
        let shape_stitches = block.stitches;
        let start_point = shape_stitches[0].position;

        // Insert color change if the color differs from the previous shape
        if current_color.is_some() && current_color != Some(color) {
            if matches!(routing.tie_mode, TieMode::ColorChange)
                && let Some(anchor) = current_position
            {
                emit_tie_sequence(
                    &mut stitches,
                    anchor,
                    &mut current_position,
                    &mut run_since_trim_mm,
                );
            }

            // Trim before color change
            if let Some(last) = stitches.last() {
                stitches.push(ExportStitch {
                    x: last.x,
                    y: last.y,
                    stitch_type: ExportStitchType::Trim,
                });
                run_since_trim_mm = 0.0;
            }
            stitches.push(ExportStitch {
                x: start_point.x,
                y: start_point.y,
                stitch_type: ExportStitchType::ColorChange,
            });
            current_position = Some(start_point);
            if matches!(routing.tie_mode, TieMode::ColorChange) {
                emit_tie_sequence(
                    &mut stitches,
                    start_point,
                    &mut current_position,
                    &mut run_since_trim_mm,
                );
            }
        }

        // Track color
        if current_color != Some(color) {
            colors.push(color);
            current_color = Some(color);
        }

        // Move to the start of this shape (if not the first shape).
        if let Some(prev) = current_position {
            let travel = distance(prev, start_point);
            if travel > f64::EPSILON {
                if should_insert_trim(routing, travel, run_since_trim_mm)
                    && stitches
                        .last()
                        .is_some_and(|s| s.stitch_type != ExportStitchType::Trim)
                {
                    stitches.push(ExportStitch {
                        x: prev.x,
                        y: prev.y,
                        stitch_type: ExportStitchType::Trim,
                    });
                    run_since_trim_mm = 0.0;
                }

                stitches.push(ExportStitch {
                    x: start_point.x,
                    y: start_point.y,
                    stitch_type: ExportStitchType::Jump,
                });
                current_position = Some(start_point);
            }
        }

        if matches!(routing.tie_mode, TieMode::ShapeStartEnd) {
            emit_tie_sequence(
                &mut stitches,
                start_point,
                &mut current_position,
                &mut run_since_trim_mm,
            );
        }

        for stitch in &shape_stitches {
            let stitch_type = if stitch.is_jump {
                ExportStitchType::Jump
            } else if stitch.is_trim {
                ExportStitchType::Trim
            } else {
                ExportStitchType::Normal
            };

            let prev_position = current_position;
            stitches.push(ExportStitch {
                x: stitch.position.x,
                y: stitch.position.y,
                stitch_type,
            });
            if stitch_type == ExportStitchType::Normal
                && let Some(prev) = prev_position
            {
                run_since_trim_mm += distance(prev, stitch.position);
            } else if stitch_type == ExportStitchType::Trim {
                run_since_trim_mm = 0.0;
            }
            current_position = Some(stitch.position);
        }

        if matches!(routing.tie_mode, TieMode::ShapeStartEnd)
            && let Some(anchor) = current_position
        {
            emit_tie_sequence(
                &mut stitches,
                anchor,
                &mut current_position,
                &mut run_since_trim_mm,
            );
        }
    }

    // Append end marker
    if let Some(last) = stitches.last() {
        stitches.push(ExportStitch {
            x: last.x,
            y: last.y,
            stitch_type: ExportStitchType::End,
        });
    }

    // Ensure at least one color
    if colors.is_empty() {
        colors.push(Color::new(0, 0, 0, 255));
    }

    Ok(ExportDesign {
        name: "design".to_string(),
        stitches,
        colors,
    })
}

/// Compute route quality metrics from a fully assembled export design.
pub fn compute_route_metrics(design: &ExportDesign) -> RouteMetrics {
    let mut metrics = RouteMetrics {
        jump_count: 0,
        trim_count: 0,
        color_change_count: 0,
        travel_distance_mm: 0.0,
        longest_travel_mm: 0.0,
        route_score: 0.0,
    };

    for i in 0..design.stitches.len() {
        let s = &design.stitches[i];
        match s.stitch_type {
            ExportStitchType::Jump => metrics.jump_count += 1,
            ExportStitchType::Trim => metrics.trim_count += 1,
            ExportStitchType::ColorChange => metrics.color_change_count += 1,
            _ => {}
        }

        if i == 0 {
            continue;
        }

        if matches!(
            s.stitch_type,
            ExportStitchType::Jump | ExportStitchType::Trim | ExportStitchType::ColorChange
        ) {
            let prev = &design.stitches[i - 1];
            let travel = distance_xy(prev.x, prev.y, s.x, s.y);
            metrics.travel_distance_mm += travel;
            metrics.longest_travel_mm = metrics.longest_travel_mm.max(travel);
        }
    }

    metrics.route_score = metrics.travel_distance_mm
        + metrics.trim_count as f64 * 8.0
        + metrics.jump_count as f64 * 2.0
        + metrics.color_change_count as f64 * 25.0;

    metrics
}

/// Compute extended quality metrics from a fully assembled export design.
pub fn compute_quality_metrics(
    design: &ExportDesign,
    target_stitch_length_mm: f64,
) -> QualityMetrics {
    let route = compute_route_metrics(design);
    let target = target_stitch_length_mm.max(0.01);

    let mut normal_points: Vec<Point> = Vec::new();
    for stitch in &design.stitches {
        if matches!(stitch.stitch_type, ExportStitchType::Normal) {
            normal_points.push(Point::new(stitch.x, stitch.y));
        }
    }

    let mut segment_lengths: Vec<f64> = Vec::new();
    let mut orientations_rad: Vec<f64> = Vec::new();
    for pair in normal_points.windows(2) {
        let from = pair[0];
        let to = pair[1];
        let len = distance(from, to);
        if len <= f64::EPSILON {
            continue;
        }
        segment_lengths.push(len);
        orientations_rad.push((to.y - from.y).atan2(to.x - from.x));
    }

    let mean_stitch_length_mm = mean(&segment_lengths);
    let stitch_length_p95_mm = percentile(&segment_lengths, 95.0);

    let mut abs_density_errors: Vec<f64> = segment_lengths
        .iter()
        .map(|len| (len - target).abs())
        .collect();
    abs_density_errors.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let density_error_mm = percentile_sorted(&abs_density_errors, 50.0);

    let dominant = dominant_orientation_rad(&orientations_rad);
    let mut angle_errors: Vec<f64> = orientations_rad
        .iter()
        .map(|&angle| orientation_delta_deg(angle, dominant))
        .collect();
    angle_errors.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let angle_error_deg = percentile_sorted(&angle_errors, 50.0);

    let long_segments = segment_lengths
        .iter()
        .filter(|&&len| len > target * 2.0)
        .count();
    let coverage_error_pct = if segment_lengths.is_empty() {
        0.0
    } else {
        long_segments as f64 * 100.0 / segment_lengths.len() as f64
    };

    QualityMetrics {
        stitch_count: design.stitches.len(),
        jump_count: route.jump_count,
        trim_count: route.trim_count,
        color_change_count: route.color_change_count,
        travel_distance_mm: route.travel_distance_mm,
        longest_travel_mm: route.longest_travel_mm,
        route_score: route.route_score,
        mean_stitch_length_mm,
        stitch_length_p95_mm,
        density_error_mm,
        angle_error_deg,
        coverage_error_pct,
    }
}

fn mean(values: &[f64]) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    values.iter().sum::<f64>() / values.len() as f64
}

fn percentile(values: &[f64], pct: f64) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    percentile_sorted(&sorted, pct)
}

fn percentile_sorted(sorted: &[f64], pct: f64) -> f64 {
    if sorted.is_empty() {
        return 0.0;
    }
    let clamped = pct.clamp(0.0, 100.0);
    let pos = (clamped / 100.0) * (sorted.len() as f64 - 1.0);
    let idx = pos.floor() as usize;
    let frac = pos - idx as f64;
    if idx + 1 >= sorted.len() {
        sorted[idx]
    } else {
        sorted[idx] * (1.0 - frac) + sorted[idx + 1] * frac
    }
}

fn dominant_orientation_rad(angles: &[f64]) -> f64 {
    if angles.is_empty() {
        return 0.0;
    }
    // Orientation is pi-periodic, so average the doubled angle.
    let mut sum_sin = 0.0;
    let mut sum_cos = 0.0;
    for angle in angles {
        let doubled = angle * 2.0;
        sum_sin += doubled.sin();
        sum_cos += doubled.cos();
    }
    0.5 * sum_sin.atan2(sum_cos)
}

fn orientation_delta_deg(a: f64, b: f64) -> f64 {
    let mut delta = (a - b).abs();
    let period = std::f64::consts::PI;
    while delta > period {
        delta -= period;
    }
    let wrapped = delta.min(period - delta);
    wrapped.to_degrees()
}

fn emit_tie_sequence(
    stitches: &mut Vec<ExportStitch>,
    anchor: Point,
    current_position: &mut Option<Point>,
    run_since_trim_mm: &mut f64,
) {
    // Small lock stitch around the anchor point: center -> +x -> center -> -x -> center.
    const TIE_OFFSET_MM: f64 = 0.25;
    let points = [
        anchor,
        Point::new(anchor.x + TIE_OFFSET_MM, anchor.y),
        anchor,
        Point::new(anchor.x - TIE_OFFSET_MM, anchor.y),
        anchor,
    ];

    for p in points {
        if let Some(prev) = *current_position {
            *run_since_trim_mm += distance(prev, p);
        }
        stitches.push(ExportStitch {
            x: p.x,
            y: p.y,
            stitch_type: ExportStitchType::Normal,
        });
        *current_position = Some(p);
    }
}

fn should_insert_trim(routing: RoutingOptions, travel_mm: f64, run_since_trim_mm: f64) -> bool {
    if travel_mm < routing.trim_threshold_mm {
        return false;
    }

    if run_since_trim_mm < routing.min_stitch_run_before_trim_mm.max(0.0) {
        return false;
    }

    if routing.allow_underpath && travel_mm <= routing.max_jump_mm {
        return false;
    }

    matches!(
        routing.policy,
        RoutingPolicy::Balanced | RoutingPolicy::MinTrims
    )
}

/// Reorder shape stitch blocks to reduce travel distance based on routing options.
fn optimize_blocks_for_travel(
    blocks: Vec<ShapeStitchBlock>,
    routing: RoutingOptions,
) -> Vec<ShapeStitchBlock> {
    if blocks.len() <= 1 {
        return blocks;
    }

    if routing.sequence_mode == SequenceMode::StrictSequencer {
        return orient_blocks_for_strict_sequencer(blocks, routing);
    }

    if routing.preserve_layer_order {
        return blocks;
    }

    if !routing.preserve_color_order {
        return optimize_bucket(blocks, routing, None);
    }

    let mut color_buckets: Vec<(Color, Vec<ShapeStitchBlock>)> = Vec::new();
    for block in blocks {
        if let Some((_, bucket)) = color_buckets.iter_mut().find(|(c, _)| *c == block.color) {
            bucket.push(block);
        } else {
            color_buckets.push((block.color, vec![block]));
        }
    }

    let mut ordered: Vec<ShapeStitchBlock> = Vec::new();
    let mut current_end: Option<Point> = None;

    if !routing.allow_color_merge {
        for (_, pending) in &mut color_buckets {
            let bucket = std::mem::take(pending);
            let mut optimized = optimize_bucket(bucket, routing, current_end);
            if let Some(last) = optimized.last() {
                current_end = Some(last.end_point());
            } else {
                current_end =
                    current_end.or_else(|| ordered.last().map(ShapeStitchBlock::end_point));
            }
            ordered.append(&mut optimized);
        }
        return ordered;
    }

    while !color_buckets.is_empty() {
        let bucket_index = match current_end {
            None => 0,
            Some(end) => color_buckets
                .iter()
                .enumerate()
                .map(|(idx, (_, bucket))| {
                    let score = bucket
                        .iter()
                        .map(|b| {
                            let (cost, _) = best_route_score(end, b, routing);
                            cost
                        })
                        .fold(f64::INFINITY, f64::min);
                    (idx, score)
                })
                .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
                .map(|(idx, _)| idx)
                .unwrap_or(0),
        };

        let (_, bucket) = color_buckets.remove(bucket_index);
        let mut optimized = optimize_bucket(bucket, routing, current_end);
        if let Some(last) = optimized.last() {
            current_end = Some(last.end_point());
        }
        ordered.append(&mut optimized);
    }

    ordered
}

/// Preserve block order exactly, only allowing per-block direction optimization.
fn orient_blocks_for_strict_sequencer(
    blocks: Vec<ShapeStitchBlock>,
    routing: RoutingOptions,
) -> Vec<ShapeStitchBlock> {
    let mut ordered: Vec<ShapeStitchBlock> = Vec::with_capacity(blocks.len());
    let mut current_end: Option<Point> = None;

    for mut block in blocks {
        if let Some(end) = current_end {
            let (_, reverse) = best_route_score(end, &block, routing);
            if reverse {
                block.stitches.reverse();
            }
        }
        current_end = Some(block.end_point());
        ordered.push(block);
    }

    ordered
}

fn optimize_bucket(
    mut pending: Vec<ShapeStitchBlock>,
    routing: RoutingOptions,
    start_end: Option<Point>,
) -> Vec<ShapeStitchBlock> {
    let mut ordered: Vec<ShapeStitchBlock> = Vec::with_capacity(pending.len());
    let mut current_end: Option<Point> = start_end;

    while !pending.is_empty() {
        let (next_index, reverse) = select_next_block_index(&pending, current_end, routing);
        let mut next = pending.remove(next_index);
        if reverse {
            next.stitches.reverse();
        }
        current_end = Some(next.end_point());
        ordered.push(next);
    }

    ordered
}

fn select_next_block_index(
    pending: &[ShapeStitchBlock],
    current_end: Option<Point>,
    routing: RoutingOptions,
) -> (usize, bool) {
    match current_end {
        None => pending
            .iter()
            .enumerate()
            .min_by_key(|(_, block)| block.source_order)
            .map(|(index, _)| (index, false))
            .unwrap_or((0, false)),
        Some(end) => pending
            .iter()
            .enumerate()
            .min_by(|(_, a), (_, b)| {
                let (score_a, _) = best_route_score(end, a, routing);
                let (score_b, _) = best_route_score(end, b, routing);
                score_a
                    .partial_cmp(&score_b)
                    .unwrap_or(std::cmp::Ordering::Equal)
                    .then_with(|| a.source_order.cmp(&b.source_order))
            })
            .map(|(index, block)| {
                let (_, reverse) = best_route_score(end, block, routing);
                (index, reverse)
            })
            .unwrap_or((0, false)),
    }
}

fn best_route_score(from: Point, block: &ShapeStitchBlock, routing: RoutingOptions) -> (f64, bool) {
    let forward_cost = route_cost(from, block.start_point(), routing);
    if !routing.allow_reverse || routing.entry_exit_mode == EntryExitMode::PreserveShapeStart {
        return (forward_cost, false);
    }

    let reverse_cost = route_cost(from, block.end_point(), routing);
    if reverse_cost < forward_cost {
        (reverse_cost, true)
    } else {
        (forward_cost, false)
    }
}

fn route_cost(from: Point, to: Point, routing: RoutingOptions) -> f64 {
    let travel = distance(from, to);
    let trim = if travel >= routing.trim_threshold_mm
        && !(routing.allow_underpath && travel <= routing.max_jump_mm)
    {
        1.0
    } else {
        0.0
    };
    let jump_penalty = if travel > routing.max_jump_mm {
        travel - routing.max_jump_mm
    } else {
        0.0
    };

    match routing.policy {
        RoutingPolicy::MinTravel => travel + jump_penalty * 0.25,
        RoutingPolicy::MinTrims => trim * 1000.0 + travel * 0.1 + jump_penalty,
        RoutingPolicy::Balanced => travel + trim * routing.trim_threshold_mm + jump_penalty * 0.5,
    }
}

fn apply_fill_controls(
    mut stitches: Vec<crate::Stitch>,
    rings: &[Vec<Point>],
    stitch: &StitchParams,
    stitch_length: f64,
) -> Vec<crate::Stitch> {
    if stitches.is_empty() {
        return stitches;
    }

    match stitch.fill_start_mode {
        FillStartMode::Auto => {}
        FillStartMode::Center | FillStartMode::Edge => {
            if let Some(target) = dominant_ring_centroid(rings) {
                let selected = stitches
                    .iter()
                    .enumerate()
                    .min_by(|(_, a), (_, b)| {
                        let da = distance(a.position, target);
                        let db = distance(b.position, target);
                        match stitch.fill_start_mode {
                            FillStartMode::Center => {
                                da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
                            }
                            FillStartMode::Edge => {
                                db.partial_cmp(&da).unwrap_or(std::cmp::Ordering::Equal)
                            }
                            FillStartMode::Auto => std::cmp::Ordering::Equal,
                        }
                    })
                    .map(|(idx, _)| idx)
                    .unwrap_or(0);
                rotate_stitches(&mut stitches, selected);
            }
        }
    }

    stitches = apply_segment_controls(stitches, stitch);

    if stitch.edge_walk_on_fill
        && let Some(edge_ring) = dominant_ring(rings)
    {
        let edge = generate_running_stitches(&edge_ring, stitch_length.max(0.1));
        if !edge.is_empty() {
            if let Some(first) = stitches.first_mut() {
                first.is_jump = true;
            }
            let mut merged = edge;
            merged.extend(stitches);
            stitches = merged;
        }
    }

    stitches
}

fn apply_segment_controls(
    mut stitches: Vec<crate::Stitch>,
    stitch: &StitchParams,
) -> Vec<crate::Stitch> {
    if stitches.is_empty() {
        return stitches;
    }

    let min_segment = stitch.min_segment_mm.max(0.0);
    if min_segment > 0.0 {
        let mut filtered: Vec<crate::Stitch> = Vec::with_capacity(stitches.len());
        for current in stitches {
            if filtered.is_empty() {
                filtered.push(crate::Stitch {
                    position: current.position,
                    is_jump: false,
                    is_trim: current.is_trim,
                });
                continue;
            }

            let prev = &filtered[filtered.len() - 1];
            if current.is_jump || current.is_trim {
                filtered.push(current);
                continue;
            }

            if distance(prev.position, current.position) + f64::EPSILON < min_segment {
                continue;
            }
            filtered.push(current);
        }
        stitches = filtered;
    }

    let overlap = stitch.overlap_mm.max(0.0);
    if overlap > 0.0 && stitches.len() >= 2 {
        let last = &stitches[stitches.len() - 1];
        let prev = &stitches[stitches.len() - 2];
        let dx = last.position.x - prev.position.x;
        let dy = last.position.y - prev.position.y;
        let len = (dx * dx + dy * dy).sqrt();
        if len > f64::EPSILON {
            let ux = dx / len;
            let uy = dy / len;
            stitches.push(crate::Stitch {
                position: Point::new(
                    last.position.x + ux * overlap,
                    last.position.y + uy * overlap,
                ),
                is_jump: false,
                is_trim: false,
            });
        }
    }

    stitches
}

fn rotate_stitches(stitches: &mut Vec<crate::Stitch>, index: usize) {
    if stitches.is_empty() || index == 0 || index >= stitches.len() {
        return;
    }
    let tail = stitches.split_off(index);
    stitches.splice(0..0, tail);
    if let Some(first) = stitches.first_mut() {
        first.is_jump = false;
    }
}

fn dominant_ring_centroid(rings: &[Vec<Point>]) -> Option<Point> {
    dominant_ring(rings).map(|ring| {
        let mut sx = 0.0;
        let mut sy = 0.0;
        let mut count = 0usize;
        for p in &ring {
            sx += p.x;
            sy += p.y;
            count += 1;
        }
        Point::new(sx / count as f64, sy / count as f64)
    })
}

fn dominant_ring(rings: &[Vec<Point>]) -> Option<Vec<Point>> {
    rings
        .iter()
        .filter(|r| r.len() >= 3)
        .map(|r| {
            let mut ring = r.clone();
            if distance(ring[0], ring[ring.len() - 1]) > 1e-6 {
                ring.push(ring[0]);
            }
            let mut area = 0.0;
            for i in 0..(ring.len() - 1) {
                let p0 = ring[i];
                let p1 = ring[i + 1];
                area += p0.x * p1.y - p1.x * p0.y;
            }
            (ring, area.abs())
        })
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(ring, _)| ring)
}

/// Generate satin stitches for a shape by offsetting a centerline into two rails.
fn generate_satin_shape_stitches(
    world_points: &[Point],
    stitch: &StitchParams,
    stitch_length: f64,
    stroke_width: f64,
) -> Vec<crate::Stitch> {
    let mut centerline = world_points.to_vec();
    if centerline.len() >= 2 {
        let first = centerline[0];
        let last = centerline[centerline.len() - 1];
        if distance(first, last) <= f64::EPSILON {
            centerline.pop();
        }
    }

    if centerline.len() < MIN_POINTS_FOR_STITCHES {
        return vec![];
    }

    let density = stitch.density;
    let pull_compensation = effective_pull_compensation(stitch);
    let width = stroke_width.max(MIN_SATIN_WIDTH_MM);
    let Some((rail1, rail2)) = build_satin_rails(&centerline, width) else {
        return vec![];
    };

    let underlay = build_underlay_config(stitch, stitch_length);

    generate_satin_stitches(&rail1, &rail2, density, pull_compensation, &underlay).stitches
}

fn effective_pull_compensation(stitch: &StitchParams) -> f64 {
    match stitch.compensation_mode {
        CompensationMode::Off => 0.0,
        CompensationMode::Auto => stitch.pull_compensation.max(0.0),
        CompensationMode::Directional => {
            let angle_rad = stitch.angle.to_radians();
            let dir = angle_rad.cos().abs() * stitch.compensation_x_mm.max(0.0)
                + angle_rad.sin().abs() * stitch.compensation_y_mm.max(0.0);
            (stitch.pull_compensation + dir).max(0.0)
        }
    }
}

fn build_underlay_config(stitch: &StitchParams, stitch_length: f64) -> UnderlayConfig {
    let resolved_mode = if stitch.underlay_mode == UnderlayMode::None && stitch.underlay_enabled {
        UnderlayMode::CenterWalk
    } else {
        stitch.underlay_mode
    };

    let (center_walk, edge_walk, zigzag) = match resolved_mode {
        UnderlayMode::None => (false, false, false),
        UnderlayMode::CenterWalk => (true, false, false),
        UnderlayMode::EdgeWalk => (false, true, false),
        UnderlayMode::Zigzag => (false, false, true),
        UnderlayMode::CenterEdge => (true, true, false),
        UnderlayMode::CenterZigzag => (true, false, true),
        UnderlayMode::EdgeZigzag => (false, true, true),
        UnderlayMode::Full => (true, true, true),
    };

    UnderlayConfig {
        center_walk,
        edge_walk,
        zigzag,
        zigzag_spacing: stitch.underlay_spacing_mm.max(0.5),
        stitch_length,
    }
}

/// Build two offset rails around a centerline polyline for satin generation.
fn build_satin_rails(centerline: &[Point], width: f64) -> Option<(Vec<Point>, Vec<Point>)> {
    if centerline.len() < MIN_POINTS_FOR_STITCHES {
        return None;
    }

    let half_width = width * 0.5;
    let mut rail1: Vec<Point> = Vec::with_capacity(centerline.len());
    let mut rail2: Vec<Point> = Vec::with_capacity(centerline.len());
    let mut fallback_normal = (0.0_f64, 1.0_f64);

    for idx in 0..centerline.len() {
        let tangent = if idx == 0 {
            vector(centerline[0], centerline[1])
        } else if idx + 1 == centerline.len() {
            vector(centerline[idx - 1], centerline[idx])
        } else {
            vector(centerline[idx - 1], centerline[idx + 1])
        };

        let tangent_len = (tangent.0 * tangent.0 + tangent.1 * tangent.1).sqrt();
        let (nx, ny) = if tangent_len <= f64::EPSILON {
            fallback_normal
        } else {
            let tx = tangent.0 / tangent_len;
            let ty = tangent.1 / tangent_len;
            let normal = (-ty, tx);
            fallback_normal = normal;
            normal
        };

        let p = centerline[idx];
        rail1.push(Point::new(p.x + nx * half_width, p.y + ny * half_width));
        rail2.push(Point::new(p.x - nx * half_width, p.y - ny * half_width));
    }

    Some((rail1, rail2))
}

fn vector(a: Point, b: Point) -> (f64, f64) {
    (b.x - a.x, b.y - a.y)
}

fn distance(a: Point, b: Point) -> f64 {
    let dx = a.x - b.x;
    let dy = a.y - b.y;
    (dx * dx + dy * dy).sqrt()
}

fn distance_xy(ax: f64, ay: f64, bx: f64, by: f64) -> f64 {
    let dx = bx - ax;
    let dy = by - ay;
    (dx * dx + dy * dy).sqrt()
}

/// Apply a 2D affine transform matrix [a, b, c, d, tx, ty] to a point.
///
/// The matrix layout matches `Transform::to_matrix()`:
/// ```text
/// | a  c  tx |   | x |
/// | b  d  ty | × | y |
/// | 0  0   1 |   | 1 |
/// ```
fn apply_transform(p: &Point, m: &[f64; 6]) -> Point {
    let [a, b, c, d, tx, ty] = *m;
    Point::new(a * p.x + c * p.y + tx, b * p.x + d * p.y + ty)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::path::VectorPath;
    use crate::scene::{NodeKind, Scene};
    use crate::shapes::{EllipseShape, RectShape, ShapeData};

    #[test]
    fn test_export_pipeline_empty_scene() {
        let scene = Scene::new();
        let result = scene_to_export_design(&scene, 2.5);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No visible shapes"));
    }

    #[test]
    fn test_export_pipeline_single_rect() {
        let mut scene = Scene::new();
        scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(10.0, 10.0, 0.0)),
                    fill: None,
                    stroke: Some(Color::new(255, 0, 0, 255)),
                    stroke_width: 0.5,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        let design = scene_to_export_design(&scene, 2.0).unwrap();

        // Should have stitches
        assert!(
            design.stitches.len() >= 3,
            "Should generate stitches for a rect outline"
        );

        // Last stitch should be End
        assert_eq!(
            design.stitches.last().unwrap().stitch_type,
            ExportStitchType::End
        );

        // Should have one color
        assert_eq!(design.colors.len(), 1);
        assert_eq!(design.colors[0].r, 255);
    }

    #[test]
    fn test_export_pipeline_multiple_shapes_with_colors() {
        let mut scene = Scene::new();

        // Red rect
        scene
            .add_node(
                "Red",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
                    fill: None,
                    stroke: Some(Color::new(255, 0, 0, 255)),
                    stroke_width: 0.5,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        // Blue ellipse
        scene
            .add_node(
                "Blue",
                NodeKind::Shape {
                    shape: ShapeData::Ellipse(EllipseShape::new(4.0, 3.0)),
                    fill: None,
                    stroke: Some(Color::new(0, 0, 255, 255)),
                    stroke_width: 0.5,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        let design = scene_to_export_design(&scene, 2.0).unwrap();

        // Should have 2 colors (red, then blue with color change)
        assert_eq!(design.colors.len(), 2);
        assert_eq!(design.colors[0].r, 255); // Red
        assert_eq!(design.colors[1].b, 255); // Blue

        // Should contain a ColorChange stitch
        let has_color_change = design
            .stitches
            .iter()
            .any(|s| s.stitch_type == ExportStitchType::ColorChange);
        assert!(
            has_color_change,
            "Should have a color change between shapes"
        );

        // Should end with End
        assert_eq!(
            design.stitches.last().unwrap().stitch_type,
            ExportStitchType::End
        );
    }

    #[test]
    fn test_export_pipeline_hidden_layer_excluded() {
        let mut scene = Scene::new();
        let layer = scene
            .add_node(
                "Hidden",
                NodeKind::Layer {
                    name: "Hidden".to_string(),
                    visible: false,
                    locked: false,
                },
                None,
            )
            .unwrap();

        scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(10.0, 10.0, 0.0)),
                    fill: None,
                    stroke: Some(Color::new(0, 0, 0, 255)),
                    stroke_width: 0.5,
                    stitch: crate::StitchParams::default(),
                },
                Some(layer),
            )
            .unwrap();

        let result = scene_to_export_design(&scene, 2.0);
        assert!(result.is_err(), "Hidden shapes should not export");
    }

    #[test]
    fn test_export_pipeline_fill_only_shape() {
        let mut scene = Scene::new();
        scene
            .add_node(
                "Filled",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(10.0, 10.0, 0.0)),
                    fill: Some(Color::new(0, 128, 0, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        // Fill-only shapes should still export (using fill color for running stitches)
        let design = scene_to_export_design(&scene, 2.0).unwrap();
        assert_eq!(design.colors[0].g, 128);
    }

    #[test]
    fn test_export_pipeline_tatami_fill() {
        let mut scene = Scene::new();
        let mut stitch = crate::StitchParams::default();
        stitch.stitch_type = crate::StitchType::Tatami;
        stitch.density = 2.0;

        scene
            .add_node(
                "Tatami",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(12.0, 8.0, 0.0)),
                    fill: Some(Color::new(10, 200, 50, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch,
                },
                None,
            )
            .unwrap();

        let design = scene_to_export_design(&scene, 2.0).unwrap();
        assert!(!design.stitches.is_empty());
        assert_eq!(design.colors[0].g, 200);
    }

    #[test]
    fn test_export_pipeline_satin_fill() {
        let mut scene = Scene::new();
        let mut stitch = crate::StitchParams::default();
        stitch.stitch_type = crate::StitchType::Satin;
        stitch.density = 0.5;
        stitch.underlay_mode = crate::UnderlayMode::CenterEdge;
        stitch.underlay_spacing_mm = 1.4;
        stitch.pull_compensation = 0.2;
        stitch.compensation_mode = crate::CompensationMode::Directional;
        stitch.compensation_x_mm = 0.15;
        stitch.compensation_y_mm = 0.05;

        scene
            .add_node(
                "Satin",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(16.0, 4.0, 0.0)),
                    fill: Some(Color::new(200, 50, 20, 255)),
                    stroke: Some(Color::new(20, 20, 20, 255)),
                    stroke_width: 1.0,
                    stitch,
                },
                None,
            )
            .unwrap();

        let design = scene_to_export_design(&scene, 2.0).unwrap();
        assert!(!design.stitches.is_empty());
        assert_eq!(design.colors[0].r, 20);

        let has_jump_or_trim = design.stitches.iter().any(|s| {
            s.stitch_type == ExportStitchType::Jump || s.stitch_type == ExportStitchType::Trim
        });
        assert!(has_jump_or_trim);
    }

    #[test]
    fn test_export_pipeline_satin_underlay_modes() {
        let mut scene = Scene::new();
        let mut stitch = crate::StitchParams::default();
        stitch.stitch_type = crate::StitchType::Satin;
        stitch.underlay_mode = crate::UnderlayMode::Full;
        stitch.underlay_spacing_mm = 1.0;

        scene
            .add_node(
                "Satin Underlay",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(24.0, 4.0, 0.0)),
                    fill: Some(Color::new(200, 50, 20, 255)),
                    stroke: Some(Color::new(20, 20, 20, 255)),
                    stroke_width: 1.0,
                    stitch,
                },
                None,
            )
            .unwrap();

        let design = scene_to_export_design(&scene, 2.0).unwrap();
        let trim_count = design
            .stitches
            .iter()
            .filter(|s| s.stitch_type == ExportStitchType::Trim)
            .count();
        assert!(trim_count > 0, "full underlay should emit trim separators");
    }

    #[test]
    fn test_export_pipeline_fill_edge_walk_adds_stitches() {
        let mut scene_base = Scene::new();
        let mut scene_edge = Scene::new();
        let mut stitch = crate::StitchParams::default();
        stitch.stitch_type = crate::StitchType::Tatami;
        stitch.density = 1.8;

        let mut stitch_edge = stitch;
        stitch_edge.edge_walk_on_fill = true;

        scene_base
            .add_node(
                "Tatami Base",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(18.0, 10.0, 0.0)),
                    fill: Some(Color::new(30, 180, 30, 255)),
                    stroke: Some(Color::new(30, 180, 30, 255)),
                    stroke_width: 0.4,
                    stitch,
                },
                None,
            )
            .unwrap();
        scene_edge
            .add_node(
                "Tatami Edge",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(18.0, 10.0, 0.0)),
                    fill: Some(Color::new(30, 180, 30, 255)),
                    stroke: Some(Color::new(30, 180, 30, 255)),
                    stroke_width: 0.4,
                    stitch: stitch_edge,
                },
                None,
            )
            .unwrap();

        let base = scene_to_export_design(&scene_base, 2.0).unwrap();
        let with_edge = scene_to_export_design(&scene_edge, 2.0).unwrap();

        let base_normals = base
            .stitches
            .iter()
            .filter(|s| s.stitch_type == ExportStitchType::Normal)
            .count();
        let edge_normals = with_edge
            .stitches
            .iter()
            .filter(|s| s.stitch_type == ExportStitchType::Normal)
            .count();
        assert!(edge_normals > base_normals);
    }

    #[test]
    fn test_export_pipeline_fill_min_segment_reduces_density() {
        let mut scene_low = Scene::new();
        let mut scene_high = Scene::new();
        let mut low_filter = crate::StitchParams::default();
        low_filter.stitch_type = crate::StitchType::Motif;
        low_filter.density = 0.45;
        low_filter.motif_scale = 0.6;
        low_filter.min_segment_mm = 0.05;

        let mut high_filter = low_filter;
        high_filter.min_segment_mm = 2.0;

        scene_low
            .add_node(
                "Motif A",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(20.0, 16.0, 0.0)),
                    fill: Some(Color::new(200, 40, 90, 255)),
                    stroke: Some(Color::new(200, 40, 90, 255)),
                    stroke_width: 0.4,
                    stitch: low_filter,
                },
                None,
            )
            .unwrap();

        scene_high
            .add_node(
                "Motif B",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(20.0, 16.0, 0.0)),
                    fill: Some(Color::new(200, 40, 90, 255)),
                    stroke: Some(Color::new(200, 40, 90, 255)),
                    stroke_width: 0.4,
                    stitch: high_filter,
                },
                None,
            )
            .unwrap();

        let low_design = scene_to_export_design(&scene_low, 2.0).unwrap();
        let high_design = scene_to_export_design(&scene_high, 2.0).unwrap();

        let low_normals = low_design
            .stitches
            .iter()
            .filter(|s| s.stitch_type == ExportStitchType::Normal)
            .count();
        let high_normals = high_design
            .stitches
            .iter()
            .filter(|s| s.stitch_type == ExportStitchType::Normal)
            .count();

        assert!(high_normals < low_normals);
    }

    #[test]
    fn test_export_pipeline_fill_start_mode_center_targets_centroid() {
        let mut scene_center = Scene::new();
        let mut scene_edge = Scene::new();
        let mut center_mode = crate::StitchParams::default();
        center_mode.stitch_type = crate::StitchType::Tatami;
        center_mode.fill_start_mode = crate::FillStartMode::Center;
        center_mode.density = 1.6;

        let mut edge_mode = center_mode;
        edge_mode.fill_start_mode = crate::FillStartMode::Edge;

        scene_center
            .add_node(
                "Center",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(20.0, 10.0, 0.0)),
                    fill: Some(Color::new(60, 120, 200, 255)),
                    stroke: Some(Color::new(60, 120, 200, 255)),
                    stroke_width: 0.4,
                    stitch: center_mode,
                },
                None,
            )
            .unwrap();
        scene_edge
            .add_node(
                "Edge",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(20.0, 10.0, 0.0)),
                    fill: Some(Color::new(60, 120, 200, 255)),
                    stroke: Some(Color::new(60, 120, 200, 255)),
                    stroke_width: 0.4,
                    stitch: edge_mode,
                },
                None,
            )
            .unwrap();

        let center_design = scene_to_export_design(&scene_center, 2.0).unwrap();
        let edge_design = scene_to_export_design(&scene_edge, 2.0).unwrap();

        let center = Point::new(10.0, 5.0);
        let center_first = center_design
            .stitches
            .iter()
            .filter(|s| s.stitch_type == ExportStitchType::Normal)
            .map(|s| Point::new(s.x, s.y))
            .next()
            .unwrap();
        let edge_first = edge_design
            .stitches
            .iter()
            .filter(|s| s.stitch_type == ExportStitchType::Normal)
            .map(|s| Point::new(s.x, s.y))
            .next()
            .unwrap();

        assert!(distance(center, center_first) <= distance(center, edge_first));
    }

    #[test]
    fn test_export_pipeline_world_transform_applied() {
        let mut scene = Scene::new();
        let id = scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
                    fill: None,
                    stroke: Some(Color::new(0, 0, 0, 255)),
                    stroke_width: 0.5,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        // Move the rect to (100, 200)
        scene.get_node_mut(id).unwrap().transform = crate::scene::Transform {
            x: 100.0,
            y: 200.0,
            rotation: 0.0,
            scale_x: 1.0,
            scale_y: 1.0,
        };

        let design = scene_to_export_design(&scene, 2.0).unwrap();

        // All stitch coordinates should be offset by (100, 200)
        for stitch in &design.stitches {
            assert!(
                stitch.x >= 99.0, // Allow small floating point tolerance
                "Stitch x={} should be near 100+ (world transform applied)",
                stitch.x
            );
        }
    }

    #[test]
    fn test_export_pipeline_default_stitch_length() {
        let mut scene = Scene::new();
        scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(10.0, 10.0, 0.0)),
                    fill: None,
                    stroke: Some(Color::new(0, 0, 0, 255)),
                    stroke_width: 0.5,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        // Passing 0 should use the default stitch length
        let design = scene_to_export_design(&scene, 0.0).unwrap();
        assert!(!design.stitches.is_empty());
    }

    #[test]
    fn test_apply_transform_identity() {
        let p = Point::new(3.0, 4.0);
        let m = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]; // identity
        let result = apply_transform(&p, &m);
        assert!((result.x - 3.0).abs() < 1e-10);
        assert!((result.y - 4.0).abs() < 1e-10);
    }

    #[test]
    fn test_apply_transform_translate() {
        let p = Point::new(3.0, 4.0);
        let m = [1.0, 0.0, 0.0, 1.0, 10.0, 20.0]; // translate (10, 20)
        let result = apply_transform(&p, &m);
        assert!((result.x - 13.0).abs() < 1e-10);
        assert!((result.y - 24.0).abs() < 1e-10);
    }

    #[test]
    fn test_compute_route_metrics_counts() {
        let design = ExportDesign {
            name: "metrics".to_string(),
            stitches: vec![
                ExportStitch {
                    x: 0.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::Normal,
                },
                ExportStitch {
                    x: 10.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::Jump,
                },
                ExportStitch {
                    x: 10.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::Trim,
                },
                ExportStitch {
                    x: 20.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::ColorChange,
                },
                ExportStitch {
                    x: 20.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::End,
                },
            ],
            colors: vec![Color::new(0, 0, 0, 255)],
        };

        let metrics = compute_route_metrics(&design);
        assert_eq!(metrics.jump_count, 1);
        assert_eq!(metrics.trim_count, 1);
        assert_eq!(metrics.color_change_count, 1);
        assert!((metrics.travel_distance_mm - 20.0).abs() < 1e-10);
    }

    #[test]
    fn test_route_optimization_reduces_travel_distance() {
        let mut scene = Scene::new();

        let make_rect = || NodeKind::Shape {
            shape: ShapeData::Rect(RectShape::new(8.0, 8.0, 0.0)),
            fill: None,
            stroke: Some(Color::new(0, 0, 0, 255)),
            stroke_width: 0.5,
            stitch: crate::StitchParams::default(),
        };

        let a = scene.add_node("A", make_rect(), None).unwrap();
        let b = scene.add_node("B", make_rect(), None).unwrap();
        let c = scene.add_node("C", make_rect(), None).unwrap();

        scene.get_node_mut(a).unwrap().transform.x = 0.0;
        scene.get_node_mut(b).unwrap().transform.x = 100.0;
        scene.get_node_mut(c).unwrap().transform.x = 12.0;

        let unoptimized = scene_to_export_design_with_routing(
            &scene,
            2.0,
            RoutingOptions {
                preserve_layer_order: true,
                ..RoutingOptions::default()
            },
        )
        .unwrap();
        let optimized =
            scene_to_export_design_with_routing(&scene, 2.0, RoutingOptions::default()).unwrap();

        let metrics_unoptimized = compute_route_metrics(&unoptimized);
        let metrics_optimized = compute_route_metrics(&optimized);

        assert!(
            metrics_optimized.travel_distance_mm < metrics_unoptimized.travel_distance_mm,
            "optimized travel distance {} should be lower than unoptimized {}",
            metrics_optimized.travel_distance_mm,
            metrics_unoptimized.travel_distance_mm
        );
    }

    #[test]
    fn test_route_policy_min_trims_prefers_fewer_trims() {
        let mut scene = Scene::new();

        let mut stitch = crate::StitchParams::default();
        stitch.stitch_type = crate::StitchType::Running;

        let mut make_rect = |x: f64| {
            let kind = NodeKind::Shape {
                shape: ShapeData::Rect(RectShape::new(5.0, 5.0, 0.0)),
                fill: Some(Color::new(120, 40, 20, 255)),
                stroke: Some(Color::new(120, 40, 20, 255)),
                stroke_width: 0.4,
                stitch,
            };

            let id = scene.add_node("R", kind, None).unwrap();
            scene.get_node_mut(id).unwrap().transform.x = x;
        };

        make_rect(0.0);
        make_rect(9.0);
        make_rect(40.0);

        let balanced = scene_to_export_design_with_routing(
            &scene,
            2.0,
            RoutingOptions {
                policy: RoutingPolicy::Balanced,
                trim_threshold_mm: 10.0,
                ..RoutingOptions::default()
            },
        )
        .unwrap();

        let min_travel = scene_to_export_design_with_routing(
            &scene,
            2.0,
            RoutingOptions {
                policy: RoutingPolicy::MinTravel,
                trim_threshold_mm: 10.0,
                ..RoutingOptions::default()
            },
        )
        .unwrap();

        let balanced_metrics = compute_route_metrics(&balanced);
        let min_travel_metrics = compute_route_metrics(&min_travel);
        assert!(balanced_metrics.trim_count >= min_travel_metrics.trim_count);
    }

    #[test]
    fn test_route_sequence_mode_strict_preserves_explicit_order() {
        let mut scene = Scene::new();
        let make_rect = || NodeKind::Shape {
            shape: ShapeData::Rect(RectShape::new(8.0, 8.0, 0.0)),
            fill: None,
            stroke: Some(Color::new(0, 0, 0, 255)),
            stroke_width: 0.5,
            stitch: crate::StitchParams::default(),
        };

        let a = scene.add_node("A", make_rect(), None).unwrap();
        let b = scene.add_node("B", make_rect(), None).unwrap();
        let c = scene.add_node("C", make_rect(), None).unwrap();
        scene.get_node_mut(a).unwrap().transform.x = 0.0;
        scene.get_node_mut(b).unwrap().transform.x = 100.0;
        scene.get_node_mut(c).unwrap().transform.x = 10.0;

        let strict = scene_to_export_design_with_routing(
            &scene,
            2.0,
            RoutingOptions {
                sequence_mode: SequenceMode::StrictSequencer,
                allow_reverse: false,
                ..RoutingOptions::default()
            },
        )
        .unwrap();
        let optimizer = scene_to_export_design_with_routing(
            &scene,
            2.0,
            RoutingOptions {
                sequence_mode: SequenceMode::Optimizer,
                allow_reverse: false,
                ..RoutingOptions::default()
            },
        )
        .unwrap();

        let strict_metrics = compute_route_metrics(&strict);
        let optimizer_metrics = compute_route_metrics(&optimizer);
        assert!(
            strict_metrics.travel_distance_mm >= optimizer_metrics.travel_distance_mm,
            "strict order should not globally reorder to reduce travel"
        );
    }

    #[test]
    fn test_route_allow_reverse_reduces_travel_distance() {
        let mut scene = Scene::new();
        let mut path_a = VectorPath::new();
        path_a.move_to(Point::new(0.0, 0.0));
        path_a.line_to(Point::new(80.0, 0.0));

        let mut path_b = VectorPath::new();
        path_b.move_to(Point::new(20.0, 0.0));
        path_b.line_to(Point::new(100.0, 0.0));

        let kind_a = NodeKind::Shape {
            shape: ShapeData::Path(path_a),
            fill: None,
            stroke: Some(Color::new(40, 140, 240, 255)),
            stroke_width: 0.5,
            stitch: crate::StitchParams::default(),
        };
        let kind_b = NodeKind::Shape {
            shape: ShapeData::Path(path_b),
            fill: None,
            stroke: Some(Color::new(40, 140, 240, 255)),
            stroke_width: 0.5,
            stitch: crate::StitchParams::default(),
        };

        scene.add_node("A", kind_a, None).unwrap();
        scene.add_node("B", kind_b, None).unwrap();

        let no_reverse = scene_to_export_design_with_routing(
            &scene,
            2.0,
            RoutingOptions {
                allow_reverse: false,
                ..RoutingOptions::default()
            },
        )
        .unwrap();
        let with_reverse = scene_to_export_design_with_routing(
            &scene,
            2.0,
            RoutingOptions {
                allow_reverse: true,
                ..RoutingOptions::default()
            },
        )
        .unwrap();

        let no_reverse_metrics = compute_route_metrics(&no_reverse);
        let with_reverse_metrics = compute_route_metrics(&with_reverse);
        assert!(
            with_reverse_metrics.travel_distance_mm < no_reverse_metrics.travel_distance_mm,
            "reverse-enabled routing should reduce travel for opposite-direction path blocks"
        );
    }

    #[test]
    fn test_route_entry_exit_preserve_shape_start_disables_reverse_gain() {
        let mut scene = Scene::new();
        let mut path_a = VectorPath::new();
        path_a.move_to(Point::new(0.0, 0.0));
        path_a.line_to(Point::new(80.0, 0.0));

        let mut path_b = VectorPath::new();
        path_b.move_to(Point::new(20.0, 0.0));
        path_b.line_to(Point::new(100.0, 0.0));

        let kind_a = NodeKind::Shape {
            shape: ShapeData::Path(path_a),
            fill: None,
            stroke: Some(Color::new(40, 140, 240, 255)),
            stroke_width: 0.5,
            stitch: crate::StitchParams::default(),
        };
        let kind_b = NodeKind::Shape {
            shape: ShapeData::Path(path_b),
            fill: None,
            stroke: Some(Color::new(40, 140, 240, 255)),
            stroke_width: 0.5,
            stitch: crate::StitchParams::default(),
        };

        scene.add_node("A", kind_a, None).unwrap();
        scene.add_node("B", kind_b, None).unwrap();

        let preserve_start = scene_to_export_design_with_routing(
            &scene,
            2.0,
            RoutingOptions {
                allow_reverse: true,
                entry_exit_mode: EntryExitMode::PreserveShapeStart,
                ..RoutingOptions::default()
            },
        )
        .unwrap();
        let no_reverse = scene_to_export_design_with_routing(
            &scene,
            2.0,
            RoutingOptions {
                allow_reverse: false,
                ..RoutingOptions::default()
            },
        )
        .unwrap();

        let preserve_metrics = compute_route_metrics(&preserve_start);
        let no_reverse_metrics = compute_route_metrics(&no_reverse);
        assert!(
            (preserve_metrics.travel_distance_mm - no_reverse_metrics.travel_distance_mm).abs()
                < 1e-6
        );
    }

    #[test]
    fn test_route_allow_underpath_reduces_trim_count() {
        let mut scene = Scene::new();
        let make_rect = || NodeKind::Shape {
            shape: ShapeData::Rect(RectShape::new(6.0, 6.0, 0.0)),
            fill: None,
            stroke: Some(Color::new(0, 0, 0, 255)),
            stroke_width: 0.4,
            stitch: crate::StitchParams::default(),
        };

        let a = scene.add_node("A", make_rect(), None).unwrap();
        let b = scene.add_node("B", make_rect(), None).unwrap();
        scene.get_node_mut(a).unwrap().transform.x = 0.0;
        scene.get_node_mut(b).unwrap().transform.x = 14.0;

        let with_underpath = scene_to_export_design_with_routing(
            &scene,
            2.0,
            RoutingOptions {
                allow_underpath: true,
                trim_threshold_mm: 10.0,
                min_stitch_run_before_trim_mm: 0.0,
                ..RoutingOptions::default()
            },
        )
        .unwrap();
        let without_underpath = scene_to_export_design_with_routing(
            &scene,
            2.0,
            RoutingOptions {
                allow_underpath: false,
                trim_threshold_mm: 10.0,
                min_stitch_run_before_trim_mm: 0.0,
                ..RoutingOptions::default()
            },
        )
        .unwrap();

        let with_metrics = compute_route_metrics(&with_underpath);
        let without_metrics = compute_route_metrics(&without_underpath);
        assert!(with_metrics.trim_count <= without_metrics.trim_count);
    }

    #[test]
    fn test_route_tie_mode_shape_start_end_increases_stitch_count() {
        let mut scene = Scene::new();
        scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(8.0, 8.0, 0.0)),
                    fill: None,
                    stroke: Some(Color::new(0, 0, 0, 255)),
                    stroke_width: 0.4,
                    stitch: crate::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        let with_ties = scene_to_export_design_with_routing(
            &scene,
            2.0,
            RoutingOptions {
                tie_mode: TieMode::ShapeStartEnd,
                ..RoutingOptions::default()
            },
        )
        .unwrap();
        let without_ties = scene_to_export_design_with_routing(
            &scene,
            2.0,
            RoutingOptions {
                tie_mode: TieMode::Off,
                ..RoutingOptions::default()
            },
        )
        .unwrap();

        assert!(with_ties.stitches.len() > without_ties.stitches.len());
    }

    #[test]
    fn test_compute_route_metrics_extended_fields() {
        let design = ExportDesign {
            name: "metrics".to_string(),
            stitches: vec![
                ExportStitch {
                    x: 0.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::Normal,
                },
                ExportStitch {
                    x: 10.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::Jump,
                },
                ExportStitch {
                    x: 10.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::Trim,
                },
                ExportStitch {
                    x: 30.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::ColorChange,
                },
            ],
            colors: vec![Color::new(0, 0, 0, 255)],
        };

        let metrics = compute_route_metrics(&design);
        assert!(metrics.longest_travel_mm >= 20.0);
        assert!(metrics.route_score > metrics.travel_distance_mm);
    }

    #[test]
    fn test_routing_options_default_values() {
        let defaults = RoutingOptions::default();
        assert!(matches!(defaults.policy, RoutingPolicy::Balanced));
        assert_eq!(defaults.max_jump_mm, 25.0);
        assert_eq!(defaults.trim_threshold_mm, 12.0);
        assert!(defaults.preserve_color_order);
        assert!(!defaults.preserve_layer_order);
        assert!(defaults.allow_reverse);
        assert!(!defaults.allow_color_merge);
        assert!(defaults.allow_underpath);
        assert!(matches!(defaults.entry_exit_mode, EntryExitMode::Auto));
        assert!(matches!(defaults.tie_mode, TieMode::ShapeStartEnd));
        assert_eq!(defaults.min_stitch_run_before_trim_mm, 2.0);
        assert!(matches!(defaults.sequence_mode, SequenceMode::Optimizer));
    }

    #[test]
    fn test_compute_quality_metrics_smoke() {
        let design = ExportDesign {
            name: "quality-smoke".to_string(),
            colors: vec![Color::new(255, 255, 255, 255)],
            stitches: vec![
                ExportStitch {
                    x: 0.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::Normal,
                },
                ExportStitch {
                    x: 1.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::Normal,
                },
                ExportStitch {
                    x: 2.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::Jump,
                },
                ExportStitch {
                    x: 3.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::Normal,
                },
                ExportStitch {
                    x: 3.0,
                    y: 0.0,
                    stitch_type: ExportStitchType::End,
                },
            ],
        };

        let metrics = compute_quality_metrics(&design, 1.0);

        assert_eq!(metrics.stitch_count, 5);
        assert_eq!(metrics.jump_count, 1);
        assert!(metrics.mean_stitch_length_mm >= 0.0);
        assert!(metrics.stitch_length_p95_mm >= 0.0);
        assert!(metrics.density_error_mm >= 0.0);
        assert!(metrics.angle_error_deg >= 0.0);
        assert!(metrics.coverage_error_pct >= 0.0);
    }
}
