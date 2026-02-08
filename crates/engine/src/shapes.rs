//! Geometric shape primitives that convert to vector paths.
//!
//! Each shape variant provides a `to_path()` method that converts the shape
//! to a `VectorPath` for rendering, hit-testing, and stitch generation.

use crate::Point;
use crate::path::{BoundingBox, VectorPath};

/// Shape data variants for scene graph nodes.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum ShapeData {
    /// A freeform vector path.
    Path(VectorPath),
    /// A rectangle with optional corner radius.
    Rect(RectShape),
    /// An ellipse defined by x and y radii.
    Ellipse(EllipseShape),
    /// A regular polygon with N sides.
    Polygon(PolygonShape),
}

impl ShapeData {
    /// Convert this shape to a vector path.
    pub fn to_path(&self) -> VectorPath {
        match self {
            ShapeData::Path(p) => p.clone(),
            ShapeData::Rect(r) => r.to_path(),
            ShapeData::Ellipse(e) => e.to_path(),
            ShapeData::Polygon(p) => p.to_path(),
        }
    }

    /// Compute the bounding box of this shape.
    pub fn bounding_box(&self) -> BoundingBox {
        self.to_path().bounding_box()
    }

    /// Hit-test: check if a point is inside this shape (for closed shapes).
    pub fn contains_point(&self, p: Point) -> bool {
        self.to_path().contains_point(p)
    }
}

/// A rectangle shape.
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct RectShape {
    /// Width of the rectangle.
    pub width: f64,
    /// Height of the rectangle.
    pub height: f64,
    /// Corner radius (0.0 for sharp corners).
    pub corner_radius: f64,
}

impl RectShape {
    /// Create a new rectangle shape.
    pub fn new(width: f64, height: f64, corner_radius: f64) -> Self {
        Self {
            width,
            height,
            corner_radius,
        }
    }

    /// Convert to a vector path. Origin is at top-left (0, 0).
    pub fn to_path(&self) -> VectorPath {
        let w = self.width;
        let h = self.height;
        let r = self.corner_radius.min(w * 0.5).min(h * 0.5).max(0.0);

        let mut path = VectorPath::new();

        if r < f64::EPSILON {
            // Sharp corners
            path.move_to(Point::new(0.0, 0.0));
            path.line_to(Point::new(w, 0.0));
            path.line_to(Point::new(w, h));
            path.line_to(Point::new(0.0, h));
            path.close();
        } else {
            // Rounded corners using cubic bezier approximation of quarter circles.
            let k = r * crate::constants::KAPPA;

            path.move_to(Point::new(r, 0.0));
            // Top edge
            path.line_to(Point::new(w - r, 0.0));
            // Top-right corner
            path.cubic_to(
                Point::new(w - r + k, 0.0),
                Point::new(w, r - k),
                Point::new(w, r),
            );
            // Right edge
            path.line_to(Point::new(w, h - r));
            // Bottom-right corner
            path.cubic_to(
                Point::new(w, h - r + k),
                Point::new(w - r + k, h),
                Point::new(w - r, h),
            );
            // Bottom edge
            path.line_to(Point::new(r, h));
            // Bottom-left corner
            path.cubic_to(
                Point::new(r - k, h),
                Point::new(0.0, h - r + k),
                Point::new(0.0, h - r),
            );
            // Left edge
            path.line_to(Point::new(0.0, r));
            // Top-left corner
            path.cubic_to(
                Point::new(0.0, r - k),
                Point::new(r - k, 0.0),
                Point::new(r, 0.0),
            );
            path.close();
        }

        path
    }
}

/// An ellipse shape.
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct EllipseShape {
    /// Horizontal radius.
    pub rx: f64,
    /// Vertical radius.
    pub ry: f64,
}

impl EllipseShape {
    /// Create a new ellipse shape.
    pub fn new(rx: f64, ry: f64) -> Self {
        Self { rx, ry }
    }

    /// Convert to a vector path centered at origin (0, 0).
    ///
    /// Uses four cubic bezier segments to approximate the ellipse.
    pub fn to_path(&self) -> VectorPath {
        let rx = self.rx;
        let ry = self.ry;
        // Kappa for cubic bezier circle approximation
        let kx = rx * crate::constants::KAPPA;
        let ky = ry * crate::constants::KAPPA;

        let mut path = VectorPath::new();

        // Start at the rightmost point
        path.move_to(Point::new(rx, 0.0));
        // Top-right quadrant
        path.cubic_to(Point::new(rx, ky), Point::new(kx, ry), Point::new(0.0, ry));
        // Top-left quadrant
        path.cubic_to(
            Point::new(-kx, ry),
            Point::new(-rx, ky),
            Point::new(-rx, 0.0),
        );
        // Bottom-left quadrant
        path.cubic_to(
            Point::new(-rx, -ky),
            Point::new(-kx, -ry),
            Point::new(0.0, -ry),
        );
        // Bottom-right quadrant
        path.cubic_to(
            Point::new(kx, -ry),
            Point::new(rx, -ky),
            Point::new(rx, 0.0),
        );
        path.close();

        path
    }
}

/// A regular polygon shape.
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct PolygonShape {
    /// Number of sides (minimum 3).
    pub sides: u32,
    /// Radius of the circumscribed circle.
    pub radius: f64,
}

impl PolygonShape {
    /// Create a new polygon shape.
    ///
    /// # Arguments
    /// * `sides` - Number of sides. Clamped to minimum of 3.
    /// * `radius` - Radius of the circumscribed circle.
    pub fn new(sides: u32, radius: f64) -> Self {
        Self {
            sides: sides.max(3),
            radius,
        }
    }

    /// Convert to a vector path centered at origin (0, 0).
    /// First vertex points up (-Y direction).
    pub fn to_path(&self) -> VectorPath {
        let mut path = VectorPath::new();
        let n = self.sides as f64;
        let r = self.radius;

        for i in 0..self.sides {
            let angle = (i as f64 / n) * std::f64::consts::TAU - std::f64::consts::FRAC_PI_2;
            let x = r * angle.cos();
            let y = r * angle.sin();
            let p = Point::new(x, y);

            if i == 0 {
                path.move_to(p);
            } else {
                path.line_to(p);
            }
        }
        path.close();

        path
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rect_sharp_corners() {
        let rect = RectShape::new(10.0, 5.0, 0.0);
        let path = rect.to_path();

        assert!(path.is_closed());
        let bbox = path.bounding_box();
        assert!((bbox.min_x - 0.0).abs() < 1e-10);
        assert!((bbox.min_y - 0.0).abs() < 1e-10);
        assert!((bbox.max_x - 10.0).abs() < 1e-10);
        assert!((bbox.max_y - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_rect_rounded_corners() {
        let rect = RectShape::new(20.0, 10.0, 3.0);
        let path = rect.to_path();

        assert!(path.is_closed());
        let bbox = path.bounding_box();
        // Rounded corners should still fit within the rect bounds
        assert!(bbox.min_x >= -0.1);
        assert!(bbox.min_y >= -0.1);
        assert!(bbox.max_x <= 20.1);
        assert!(bbox.max_y <= 10.1);
    }

    #[test]
    fn test_rect_contains_point() {
        let shape = ShapeData::Rect(RectShape::new(10.0, 10.0, 0.0));
        assert!(shape.contains_point(Point::new(5.0, 5.0)));
        assert!(!shape.contains_point(Point::new(15.0, 5.0)));
        assert!(!shape.contains_point(Point::new(-1.0, 5.0)));
    }

    #[test]
    fn test_ellipse_bounds() {
        let ellipse = EllipseShape::new(10.0, 5.0);
        let path = ellipse.to_path();

        assert!(path.is_closed());
        let bbox = path.bounding_box();
        // Ellipse centered at origin, should be roughly [-10, 10] x [-5, 5]
        assert!((bbox.min_x - (-10.0)).abs() < 0.5);
        assert!((bbox.max_x - 10.0).abs() < 0.5);
        assert!((bbox.min_y - (-5.0)).abs() < 0.5);
        assert!((bbox.max_y - 5.0).abs() < 0.5);
    }

    #[test]
    fn test_ellipse_contains_center() {
        let shape = ShapeData::Ellipse(EllipseShape::new(10.0, 5.0));
        assert!(shape.contains_point(Point::new(0.0, 0.0)));
    }

    #[test]
    fn test_polygon_triangle() {
        let polygon = PolygonShape::new(3, 10.0);
        let path = polygon.to_path();

        assert!(path.is_closed());
        let flat = path.flatten(0.5);
        // Triangle: 3 vertices + closing point back to start = 4
        assert_eq!(flat.len(), 4);
    }

    #[test]
    fn test_polygon_hexagon() {
        let polygon = PolygonShape::new(6, 10.0);
        let path = polygon.to_path();

        assert!(path.is_closed());
        let flat = path.flatten(0.5);
        // 6 vertices + closing point = 7
        assert_eq!(flat.len(), 7);
    }

    #[test]
    fn test_polygon_min_sides() {
        let polygon = PolygonShape::new(1, 10.0);
        assert_eq!(polygon.sides, 3); // Clamped to 3
    }

    #[test]
    fn test_polygon_contains_center() {
        let shape = ShapeData::Polygon(PolygonShape::new(6, 10.0));
        assert!(shape.contains_point(Point::new(0.0, 0.0)));
    }

    #[test]
    fn test_shape_data_path_variant() {
        let mut vp = VectorPath::new();
        vp.move_to(Point::new(0.0, 0.0));
        vp.line_to(Point::new(10.0, 0.0));
        vp.line_to(Point::new(5.0, 10.0));
        vp.close();

        let shape = ShapeData::Path(vp);
        let bbox = shape.bounding_box();
        assert!((bbox.max_x - 10.0).abs() < 1e-10);
        assert!((bbox.max_y - 10.0).abs() < 1e-10);
    }

    #[test]
    fn test_rect_corner_radius_clamped() {
        // Corner radius larger than half the width — should be clamped
        let rect = RectShape::new(10.0, 10.0, 20.0);
        let path = rect.to_path();
        let bbox = path.bounding_box();
        // Should still produce a valid shape within bounds
        assert!(bbox.max_x <= 10.5);
        assert!(bbox.max_y <= 10.5);
    }
}
