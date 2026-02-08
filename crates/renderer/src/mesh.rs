//! Mesh generation from scene graph shapes.
//!
//! Converts shapes to triangle lists and line strips for GPU rendering.

use vision_engine::Color;
use vision_engine::scene::{NodeKind, Scene};

use crate::vertex::Vertex;

/// A batch of vertices ready for GPU upload.
#[derive(Debug, Clone)]
pub struct MeshBatch {
    /// Triangle vertices for filled shapes.
    pub fill_vertices: Vec<Vertex>,
    /// Triangle indices for filled shapes.
    pub fill_indices: Vec<u32>,
    /// Line vertices for stroked shapes.
    pub line_vertices: Vec<Vertex>,
}

impl MeshBatch {
    /// Create an empty mesh batch.
    pub fn new() -> Self {
        Self {
            fill_vertices: Vec::new(),
            fill_indices: Vec::new(),
            line_vertices: Vec::new(),
        }
    }

    /// Build mesh data from a scene graph.
    pub fn from_scene(scene: &Scene) -> Self {
        let mut batch = Self::new();

        for &node_id in scene.root_children() {
            batch.add_node_recursive(scene, node_id, 0.0, 0.0);
        }

        batch
    }

    /// Recursively add nodes to the mesh batch.
    fn add_node_recursive(
        &mut self,
        scene: &Scene,
        node_id: vision_engine::scene::NodeId,
        parent_x: f64,
        parent_y: f64,
    ) {
        let Some(node) = scene.get_node(node_id) else {
            return;
        };

        let world_x = parent_x + node.transform.x;
        let world_y = parent_y + node.transform.y;

        // Check layer visibility
        if let NodeKind::Layer { visible, .. } = &node.kind
            && !*visible
        {
            return;
        }

        if let NodeKind::Shape {
            shape,
            fill,
            stroke,
            stroke_width,
            ..
        } = &node.kind
        {
            let path = shape.to_path();
            let points = path.flatten(0.5);

            // Generate fill triangles
            if let Some(fill_color) = fill
                && points.len() >= 3
                && path.is_closed()
            {
                self.triangulate_polygon(&points, fill_color, world_x, world_y);
            }

            // Generate stroke lines
            if let Some(stroke_color) = stroke
                && *stroke_width > 0.0
                && points.len() >= 2
            {
                self.add_line_strip(&points, stroke_color, world_x, world_y);
            }
        }

        // Process children
        let children: Vec<_> = node.children.clone();
        for child_id in children {
            self.add_node_recursive(scene, child_id, world_x, world_y);
        }
    }

    /// Fan triangulation for convex and simple polygons.
    ///
    /// Uses a fan from vertex 0: (0,1,2), (0,2,3), (0,3,4), etc. This is
    /// correct for convex shapes (rect, ellipse, regular polygons) and
    /// acceptable for mildly concave shapes. A proper ear-clipping or
    /// constrained Delaunay triangulation should replace this for complex paths.
    fn triangulate_polygon(
        &mut self,
        points: &[vision_engine::Point],
        color: &Color,
        offset_x: f64,
        offset_y: f64,
    ) {
        let base_index = self.fill_vertices.len() as u32;
        let r = color.r as f32 / 255.0;
        let g = color.g as f32 / 255.0;
        let b = color.b as f32 / 255.0;
        let a = color.a as f32 / 255.0;

        // Add vertices
        for p in points {
            self.fill_vertices.push(Vertex::new(
                (p.x + offset_x) as f32,
                (p.y + offset_y) as f32,
                r,
                g,
                b,
                a,
            ));
        }

        // Fan triangulation from vertex 0
        let n = points.len() as u32;
        for i in 1..n.saturating_sub(1) {
            self.fill_indices.push(base_index);
            self.fill_indices.push(base_index + i);
            self.fill_indices.push(base_index + i + 1);
        }
    }

    /// Add a line strip as vertex pairs for `LineList` topology.
    ///
    /// Emits pairs (A,B), (B,C), (C,D) so that `PrimitiveTopology::LineList`
    /// renders all segments of the strip. N points produce 2*(N-1) vertices.
    fn add_line_strip(
        &mut self,
        points: &[vision_engine::Point],
        color: &Color,
        offset_x: f64,
        offset_y: f64,
    ) {
        if points.len() < 2 {
            return;
        }

        let r = color.r as f32 / 255.0;
        let g = color.g as f32 / 255.0;
        let b = color.b as f32 / 255.0;
        let a = color.a as f32 / 255.0;

        for pair in points.windows(2) {
            let p0 = &pair[0];
            let p1 = &pair[1];
            self.line_vertices.push(Vertex::new(
                (p0.x + offset_x) as f32,
                (p0.y + offset_y) as f32,
                r,
                g,
                b,
                a,
            ));
            self.line_vertices.push(Vertex::new(
                (p1.x + offset_x) as f32,
                (p1.y + offset_y) as f32,
                r,
                g,
                b,
                a,
            ));
        }
    }
}

impl Default for MeshBatch {
    fn default() -> Self {
        Self::new()
    }
}

/// Generate grid line vertices for the infinite canvas.
///
/// # Arguments
/// * `camera_x` - Camera center X in world space.
/// * `camera_y` - Camera center Y in world space.
/// * `viewport_w` - Viewport width in pixels.
/// * `viewport_h` - Viewport height in pixels.
/// * `zoom` - Current zoom level.
///
/// # Returns
/// Vertex data for grid lines.
pub fn generate_grid_vertices(
    camera_x: f32,
    camera_y: f32,
    viewport_w: f32,
    viewport_h: f32,
    zoom: f32,
) -> Vec<Vertex> {
    let mut vertices = Vec::new();

    // Determine grid spacing based on zoom level.
    // At higher zoom levels, show finer grids.
    let base_spacing = compute_grid_spacing(zoom);
    let half_w = viewport_w * 0.5 / zoom;
    let half_h = viewport_h * 0.5 / zoom;

    let left = camera_x - half_w;
    let right = camera_x + half_w;
    let top = camera_y - half_h;
    let bottom = camera_y + half_h;

    // Grid line color (subtle)
    let grid_color = [0.15, 0.18, 0.22, 0.6];
    // Major grid line color (every 5th or 10th line)
    let major_color = [0.18, 0.22, 0.28, 0.8];

    let major_spacing = base_spacing * 5.0;

    // Vertical lines
    let start_x = (left / base_spacing).floor() * base_spacing;
    let mut x = start_x;
    while x <= right {
        let is_major = (x / major_spacing).round() * major_spacing - x < 0.01;
        let color = if is_major { major_color } else { grid_color };
        vertices.push(Vertex {
            position: [x, top],
            color,
        });
        vertices.push(Vertex {
            position: [x, bottom],
            color,
        });
        x += base_spacing;
    }

    // Horizontal lines
    let start_y = (top / base_spacing).floor() * base_spacing;
    let mut y = start_y;
    while y <= bottom {
        let is_major = (y / major_spacing).round() * major_spacing - y < 0.01;
        let color = if is_major { major_color } else { grid_color };
        vertices.push(Vertex {
            position: [left, y],
            color,
        });
        vertices.push(Vertex {
            position: [right, y],
            color,
        });
        y += base_spacing;
    }

    // Origin axes (thicker, more visible)
    let axis_color = [0.25, 0.35, 0.5, 1.0];
    // X axis
    if top <= 0.0 && bottom >= 0.0 {
        vertices.push(Vertex {
            position: [left, 0.0],
            color: axis_color,
        });
        vertices.push(Vertex {
            position: [right, 0.0],
            color: axis_color,
        });
    }
    // Y axis
    if left <= 0.0 && right >= 0.0 {
        vertices.push(Vertex {
            position: [0.0, top],
            color: axis_color,
        });
        vertices.push(Vertex {
            position: [0.0, bottom],
            color: axis_color,
        });
    }

    vertices
}

/// Compute appropriate grid spacing for the current zoom level.
fn compute_grid_spacing(zoom: f32) -> f32 {
    // Target: grid lines roughly 20-40 pixels apart on screen
    let target_screen_spacing = 25.0;
    let raw_spacing = target_screen_spacing / zoom;

    // Snap to nearest "nice" number (powers of 10, halves)
    let log10 = raw_spacing.log10();
    let power = log10.floor();
    let base = 10.0_f32.powf(power);

    let normalized = raw_spacing / base;
    let nice = if normalized < 1.5 {
        1.0
    } else if normalized < 3.5 {
        2.5
    } else if normalized < 7.5 {
        5.0
    } else {
        10.0
    };

    nice * base
}

#[cfg(test)]
mod tests {
    use super::*;
    use vision_engine::scene::NodeKind;
    use vision_engine::shapes::{RectShape, ShapeData};

    #[test]
    fn test_mesh_batch_empty() {
        let scene = Scene::new();
        let batch = MeshBatch::from_scene(&scene);
        assert!(batch.fill_vertices.is_empty());
        assert!(batch.fill_indices.is_empty());
        assert!(batch.line_vertices.is_empty());
    }

    #[test]
    fn test_mesh_batch_filled_rect() {
        let mut scene = Scene::new();
        let _id = scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(10.0, 10.0, 0.0)),
                    fill: Some(Color::new(255, 0, 0, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: vision_engine::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        let batch = MeshBatch::from_scene(&scene);
        // A closed rect path flattened = 5 points (4 corners + close back to start)
        assert!(
            !batch.fill_vertices.is_empty(),
            "Should have fill vertices for a filled rect"
        );
        assert!(
            !batch.fill_indices.is_empty(),
            "Should have fill indices for triangulation"
        );
    }

    #[test]
    fn test_mesh_batch_stroked_rect() {
        let mut scene = Scene::new();
        let _id = scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(10.0, 10.0, 0.0)),
                    fill: None,
                    stroke: Some(Color::new(0, 0, 0, 255)),
                    stroke_width: 1.0,
                    stitch: vision_engine::StitchParams::default(),
                },
                None,
            )
            .unwrap();

        let batch = MeshBatch::from_scene(&scene);
        assert!(batch.fill_vertices.is_empty(), "No fill for stroke-only");
        assert!(
            !batch.line_vertices.is_empty(),
            "Should have line vertices for stroke"
        );
    }

    #[test]
    fn test_mesh_batch_hidden_layer() {
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

        let _rect = scene
            .add_node(
                "Rect",
                NodeKind::Shape {
                    shape: ShapeData::Rect(RectShape::new(10.0, 10.0, 0.0)),
                    fill: Some(Color::new(255, 0, 0, 255)),
                    stroke: None,
                    stroke_width: 0.0,
                    stitch: vision_engine::StitchParams::default(),
                },
                Some(layer),
            )
            .unwrap();

        let batch = MeshBatch::from_scene(&scene);
        assert!(
            batch.fill_vertices.is_empty(),
            "Hidden layer shapes should not be meshed"
        );
    }

    #[test]
    fn test_grid_spacing_zoom_1() {
        let spacing = compute_grid_spacing(1.0);
        assert!(spacing > 0.0);
        assert!(spacing >= 10.0 && spacing <= 50.0);
    }

    #[test]
    fn test_grid_spacing_zoom_high() {
        let spacing = compute_grid_spacing(10.0);
        assert!(spacing > 0.0);
        assert!(spacing < 10.0);
    }

    #[test]
    fn test_grid_spacing_zoom_low() {
        let spacing = compute_grid_spacing(0.1);
        assert!(spacing > 0.0);
        assert!(spacing >= 100.0);
    }

    #[test]
    fn test_generate_grid_vertices() {
        let verts = generate_grid_vertices(0.0, 0.0, 800.0, 600.0, 1.0);
        assert!(!verts.is_empty(), "Grid should have vertices");
        // Should be even number (pairs of line endpoints)
        assert_eq!(verts.len() % 2, 0);
    }

    #[test]
    fn test_triangulate_polygon_produces_correct_indices() {
        let mut batch = MeshBatch::new();
        let points = vec![
            vision_engine::Point::new(0.0, 0.0),
            vision_engine::Point::new(10.0, 0.0),
            vision_engine::Point::new(10.0, 10.0),
            vision_engine::Point::new(0.0, 10.0),
        ];
        let color = Color::new(255, 0, 0, 255);
        batch.triangulate_polygon(&points, &color, 0.0, 0.0);

        assert_eq!(batch.fill_vertices.len(), 4);
        // Fan triangulation of 4 points = 2 triangles = 6 indices
        assert_eq!(batch.fill_indices.len(), 6);
        assert_eq!(batch.fill_indices, vec![0, 1, 2, 0, 2, 3]);
    }

    #[test]
    fn test_line_strip_vertex_count() {
        let mut batch = MeshBatch::new();
        let points = vec![
            vision_engine::Point::new(0.0, 0.0),
            vision_engine::Point::new(5.0, 0.0),
            vision_engine::Point::new(10.0, 0.0),
            vision_engine::Point::new(10.0, 5.0),
        ];
        let color = Color::new(0, 0, 0, 255);
        batch.add_line_strip(&points, &color, 0.0, 0.0);

        // 4 points → 3 segments → 6 vertices (pairs for LineList topology)
        assert_eq!(
            batch.line_vertices.len(),
            6,
            "N points should produce 2*(N-1) vertices for LineList"
        );
    }

    #[test]
    fn test_line_strip_single_point() {
        let mut batch = MeshBatch::new();
        let points = vec![vision_engine::Point::new(0.0, 0.0)];
        let color = Color::new(0, 0, 0, 255);
        batch.add_line_strip(&points, &color, 0.0, 0.0);

        assert_eq!(
            batch.line_vertices.len(),
            0,
            "Single point should produce no line vertices"
        );
    }
}
