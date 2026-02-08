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
use crate::stitch::fill::generate_tatami_fill;
use crate::stitch::running::generate_running_stitches;
use crate::stitch::satin::{UnderlayConfig, generate_satin_stitches};

/// Minimum number of points required to generate stitches from a path.
const MIN_POINTS_FOR_STITCHES: usize = 2;
/// Minimum satin width used when shape stroke width is tiny.
const MIN_SATIN_WIDTH_MM: f64 = 0.6;
/// Default zigzag spacing for satin underlay.
const DEFAULT_SATIN_ZIGZAG_SPACING_MM: f64 = 2.0;

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
    scene_to_export_design_with_options(scene, stitch_length, true)
}

fn scene_to_export_design_with_options(
    scene: &Scene,
    stitch_length: f64,
    optimize_route: bool,
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
                    stitch.density,
                    stitch.pull_compensation,
                    stitch.underlay_enabled,
                    stitch_length,
                    *stroke_width,
                );

                if satin.is_empty() {
                    (
                        generate_running_stitches(&world_points, stitch_length),
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
                        generate_running_stitches(&world_points, stitch_length),
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
                    generate_running_stitches(&world_points, stitch_length),
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

    let blocks = if optimize_route {
        optimize_blocks_for_travel(blocks)
    } else {
        blocks
    };

    // Assemble final export design.
    let mut stitches: Vec<ExportStitch> = Vec::new();
    let mut colors: Vec<Color> = Vec::new();
    let mut current_color: Option<Color> = None;

    for block in blocks {
        let color = block.color;
        let shape_stitches = block.stitches;

        // Insert color change if the color differs from the previous shape
        if current_color.is_some() && current_color != Some(color) {
            // Trim before color change
            if let Some(last) = stitches.last() {
                stitches.push(ExportStitch {
                    x: last.x,
                    y: last.y,
                    stitch_type: ExportStitchType::Trim,
                });
            }
            stitches.push(ExportStitch {
                x: shape_stitches[0].position.x,
                y: shape_stitches[0].position.y,
                stitch_type: ExportStitchType::ColorChange,
            });
        }

        // Track color
        if current_color != Some(color) {
            colors.push(color);
            current_color = Some(color);
        }

        // Jump to the start of this shape (if not the first shape)
        if stitches.len() > 1 {
            stitches.push(ExportStitch {
                x: shape_stitches[0].position.x,
                y: shape_stitches[0].position.y,
                stitch_type: ExportStitchType::Jump,
            });
        }

        for stitch in &shape_stitches {
            let stitch_type = if stitch.is_jump {
                ExportStitchType::Jump
            } else if stitch.is_trim {
                ExportStitchType::Trim
            } else {
                ExportStitchType::Normal
            };

            stitches.push(ExportStitch {
                x: stitch.position.x,
                y: stitch.position.y,
                stitch_type,
            });
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
            metrics.travel_distance_mm += distance_xy(prev.x, prev.y, s.x, s.y);
        }
    }

    metrics
}

/// Reorder shape stitch blocks to reduce travel distance while preserving color-group order.
fn optimize_blocks_for_travel(blocks: Vec<ShapeStitchBlock>) -> Vec<ShapeStitchBlock> {
    if blocks.len() <= 1 {
        return blocks;
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

    for (_, pending) in &mut color_buckets {
        while !pending.is_empty() {
            let next_index = select_next_block_index(pending, current_end);
            let next = pending.remove(next_index);
            current_end = Some(next.end_point());
            ordered.push(next);
        }
    }

    ordered
}

fn select_next_block_index(pending: &[ShapeStitchBlock], current_end: Option<Point>) -> usize {
    match current_end {
        None => pending
            .iter()
            .enumerate()
            .min_by_key(|(_, block)| block.source_order)
            .map(|(index, _)| index)
            .unwrap_or(0),
        Some(end) => pending
            .iter()
            .enumerate()
            .min_by(|(_, a), (_, b)| {
                let dist_a = distance(end, a.start_point());
                let dist_b = distance(end, b.start_point());
                dist_a
                    .partial_cmp(&dist_b)
                    .unwrap_or(std::cmp::Ordering::Equal)
                    .then_with(|| a.source_order.cmp(&b.source_order))
            })
            .map(|(index, _)| index)
            .unwrap_or(0),
    }
}

/// Generate satin stitches for a shape by offsetting a centerline into two rails.
fn generate_satin_shape_stitches(
    world_points: &[Point],
    density: f64,
    pull_compensation: f64,
    underlay_enabled: bool,
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

    let width = stroke_width.max(MIN_SATIN_WIDTH_MM);
    let Some((rail1, rail2)) = build_satin_rails(&centerline, width) else {
        return vec![];
    };

    let underlay = UnderlayConfig {
        center_walk: underlay_enabled,
        edge_walk: false,
        zigzag: false,
        zigzag_spacing: DEFAULT_SATIN_ZIGZAG_SPACING_MM,
        stitch_length,
    };

    generate_satin_stitches(&rail1, &rail2, density, pull_compensation, &underlay).stitches
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
        stitch.underlay_enabled = true;
        stitch.pull_compensation = 0.2;

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

        let unoptimized = scene_to_export_design_with_options(&scene, 2.0, false).unwrap();
        let optimized = scene_to_export_design_with_options(&scene, 2.0, true).unwrap();

        let metrics_unoptimized = compute_route_metrics(&unoptimized);
        let metrics_optimized = compute_route_metrics(&optimized);

        assert!(
            metrics_optimized.travel_distance_mm < metrics_unoptimized.travel_distance_mm,
            "optimized travel distance {} should be lower than unoptimized {}",
            metrics_optimized.travel_distance_mm,
            metrics_unoptimized.travel_distance_mm
        );
    }
}
