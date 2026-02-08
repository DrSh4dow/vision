//! Scene-to-export pipeline — converts the scene graph into stitch data.
//!
//! This module bridges the gap between the vector design (scene graph with
//! shapes, transforms, colors) and the embroidery export formats (DST, PES).
//!
//! Generates running stitches along outlines and tatami fills for closed shapes.
//! Spiral/contour fill variants will be added in Phase 2.

use crate::constants::{DEFAULT_FLATTEN_TOLERANCE, DEFAULT_STITCH_LENGTH};
use crate::format::{ExportDesign, ExportStitch, ExportStitchType};
use crate::scene::{NodeKind, Scene};
use crate::stitch::fill::generate_tatami_fill;
use crate::stitch::running::generate_running_stitches;
use crate::Color;
use crate::Point;
use crate::StitchType;

/// Minimum number of points required to generate stitches from a path.
const MIN_POINTS_FOR_STITCHES: usize = 2;

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
    let stitch_length = if stitch_length <= 0.0 {
        DEFAULT_STITCH_LENGTH
    } else {
        stitch_length
    };

    let render_items = scene.render_list();

    // Build the ExportDesign by stitching each shape
    let mut stitches: Vec<ExportStitch> = Vec::new();
    let mut colors: Vec<Color> = Vec::new();
    let mut current_color: Option<Color> = None;

    for item in &render_items {
        let NodeKind::Shape {
            shape,
            stroke,
            fill,
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

    if stitches.is_empty() {
        return Err("No visible shapes with stroke or fill to export".to_string());
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
}
