//! Vector path primitives for embroidery design.
//!
//! Provides path commands (move, line, cubic/quadratic bezier, close),
//! a `VectorPath` struct for building and manipulating paths, and utilities
//! for flattening curves, computing bounding boxes, and hit-testing.

use crate::Point;

/// A single command in a vector path.
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub enum PathCommand {
    /// Move the pen to a point without drawing.
    MoveTo(Point),
    /// Draw a straight line to a point.
    LineTo(Point),
    /// Draw a cubic bezier curve to `end` with control points `c1` and `c2`.
    CubicTo {
        /// First control point.
        c1: Point,
        /// Second control point.
        c2: Point,
        /// End point.
        end: Point,
    },
    /// Draw a quadratic bezier curve to `end` with control point `ctrl`.
    QuadTo {
        /// Control point.
        ctrl: Point,
        /// End point.
        end: Point,
    },
    /// Close the current sub-path by drawing a line back to the last MoveTo.
    Close,
}

/// An axis-aligned bounding box.
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct BoundingBox {
    /// Minimum x coordinate.
    pub min_x: f64,
    /// Minimum y coordinate.
    pub min_y: f64,
    /// Maximum x coordinate.
    pub max_x: f64,
    /// Maximum y coordinate.
    pub max_y: f64,
}

impl BoundingBox {
    /// Create a new bounding box from min/max coordinates.
    pub fn new(min_x: f64, min_y: f64, max_x: f64, max_y: f64) -> Self {
        Self {
            min_x,
            min_y,
            max_x,
            max_y,
        }
    }

    /// Create an empty (inverted) bounding box for incremental expansion.
    pub fn empty() -> Self {
        Self {
            min_x: f64::INFINITY,
            min_y: f64::INFINITY,
            max_x: f64::NEG_INFINITY,
            max_y: f64::NEG_INFINITY,
        }
    }

    /// Returns true if this bounding box has no area (was never expanded).
    pub fn is_empty(&self) -> bool {
        self.min_x > self.max_x || self.min_y > self.max_y
    }

    /// Expand the bounding box to include a point.
    pub fn expand_to(&mut self, p: Point) {
        self.min_x = self.min_x.min(p.x);
        self.min_y = self.min_y.min(p.y);
        self.max_x = self.max_x.max(p.x);
        self.max_y = self.max_y.max(p.y);
    }

    /// Merge another bounding box into this one.
    pub fn union(&mut self, other: &BoundingBox) {
        if other.is_empty() {
            return;
        }
        self.min_x = self.min_x.min(other.min_x);
        self.min_y = self.min_y.min(other.min_y);
        self.max_x = self.max_x.max(other.max_x);
        self.max_y = self.max_y.max(other.max_y);
    }

    /// Width of the bounding box.
    pub fn width(&self) -> f64 {
        if self.is_empty() {
            0.0
        } else {
            self.max_x - self.min_x
        }
    }

    /// Height of the bounding box.
    pub fn height(&self) -> f64 {
        if self.is_empty() {
            0.0
        } else {
            self.max_y - self.min_y
        }
    }

    /// Check if a point is inside this bounding box.
    pub fn contains(&self, p: Point) -> bool {
        p.x >= self.min_x && p.x <= self.max_x && p.y >= self.min_y && p.y <= self.max_y
    }
}

/// A vector path composed of path commands.
///
/// Paths are the fundamental building block for all shapes in the design.
/// They can be open (like a polyline) or closed (like a polygon).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VectorPath {
    /// The commands that define this path.
    commands: Vec<PathCommand>,
    /// Whether the path is closed (last command is Close or implied closure).
    closed: bool,
}

impl VectorPath {
    /// Create a new empty path.
    pub fn new() -> Self {
        Self {
            commands: Vec::new(),
            closed: false,
        }
    }

    /// Create a path from a list of commands.
    pub fn from_commands(commands: Vec<PathCommand>) -> Self {
        let closed = commands
            .last()
            .is_some_and(|c| matches!(c, PathCommand::Close));
        Self { commands, closed }
    }

    /// Create a path from commands with an explicit closed flag.
    pub fn from_commands_with_closed(commands: Vec<PathCommand>, closed: bool) -> Self {
        Self { commands, closed }
    }

    /// Replace all commands in this path.
    pub fn set_commands(&mut self, commands: Vec<PathCommand>, closed: bool) {
        self.commands = commands;
        self.closed = closed;
    }

    /// Get a mutable reference to the commands.
    pub fn commands_mut(&mut self) -> &mut Vec<PathCommand> {
        &mut self.commands
    }

    /// Returns the commands in this path.
    pub fn commands(&self) -> &[PathCommand] {
        &self.commands
    }

    /// Returns true if the path is closed.
    pub fn is_closed(&self) -> bool {
        self.closed
    }

    /// Returns the number of commands in the path.
    pub fn len(&self) -> usize {
        self.commands.len()
    }

    /// Returns true if the path has no commands.
    pub fn is_empty(&self) -> bool {
        self.commands.is_empty()
    }

    /// Add a MoveTo command.
    pub fn move_to(&mut self, p: Point) {
        self.commands.push(PathCommand::MoveTo(p));
    }

    /// Add a LineTo command.
    pub fn line_to(&mut self, p: Point) {
        self.commands.push(PathCommand::LineTo(p));
    }

    /// Add a CubicTo command.
    pub fn cubic_to(&mut self, c1: Point, c2: Point, end: Point) {
        self.commands.push(PathCommand::CubicTo { c1, c2, end });
    }

    /// Add a QuadTo command.
    pub fn quad_to(&mut self, ctrl: Point, end: Point) {
        self.commands.push(PathCommand::QuadTo { ctrl, end });
    }

    /// Close the path.
    pub fn close(&mut self) {
        if !self.closed {
            self.commands.push(PathCommand::Close);
            self.closed = true;
        }
    }

    /// Flatten all curves to line segments using adaptive subdivision.
    ///
    /// # Arguments
    /// * `tolerance` - Maximum distance between the curve and the approximation.
    ///   Smaller values produce more points but better accuracy.
    ///
    /// # Returns
    /// A list of points representing the flattened path. Each sub-path
    /// starts fresh (MoveTo creates a new sequence).
    pub fn flatten(&self, tolerance: f64) -> Vec<Point> {
        let mut points: Vec<Point> = Vec::new();
        let mut current = Point::new(0.0, 0.0);
        let mut subpath_start = current;

        for cmd in &self.commands {
            match *cmd {
                PathCommand::MoveTo(p) => {
                    current = p;
                    subpath_start = p;
                    points.push(p);
                }
                PathCommand::LineTo(p) => {
                    current = p;
                    points.push(p);
                }
                PathCommand::CubicTo { c1, c2, end } => {
                    flatten_cubic(current, c1, c2, end, tolerance, &mut points);
                    current = end;
                }
                PathCommand::QuadTo { ctrl, end } => {
                    flatten_quad(current, ctrl, end, tolerance, &mut points);
                    current = end;
                }
                PathCommand::Close => {
                    if distance(current, subpath_start) > f64::EPSILON {
                        points.push(subpath_start);
                    }
                    current = subpath_start;
                }
            }
        }

        points
    }

    /// Compute the axis-aligned bounding box of this path.
    ///
    /// For curves, this uses the flattened approximation with a default tolerance.
    pub fn bounding_box(&self) -> BoundingBox {
        let points = self.flatten(0.5);
        let mut bbox = BoundingBox::empty();
        for p in &points {
            bbox.expand_to(*p);
        }
        bbox
    }

    /// Test if a point is inside this path (for closed paths).
    ///
    /// Uses the ray-casting (even-odd) algorithm on the flattened path.
    /// Returns false for open paths.
    pub fn contains_point(&self, test: Point) -> bool {
        if !self.closed {
            return false;
        }

        let points = self.flatten(0.5);
        if points.len() < 3 {
            return false;
        }

        // Ray-casting algorithm
        let mut inside = false;
        let n = points.len();
        let mut j = n - 1;

        for i in 0..n {
            let pi = points[i];
            let pj = points[j];

            if ((pi.y > test.y) != (pj.y > test.y))
                && (test.x < (pj.x - pi.x) * (test.y - pi.y) / (pj.y - pi.y) + pi.x)
            {
                inside = !inside;
            }
            j = i;
        }

        inside
    }
}

impl Default for VectorPath {
    fn default() -> Self {
        Self::new()
    }
}

/// Euclidean distance between two points.
fn distance(a: Point, b: Point) -> f64 {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    (dx * dx + dy * dy).sqrt()
}

/// Adaptive subdivision of a cubic bezier curve.
fn flatten_cubic(p0: Point, c1: Point, c2: Point, p3: Point, tol: f64, out: &mut Vec<Point>) {
    // Use de Casteljau's algorithm for subdivision.
    // Check if the curve is flat enough by measuring control point deviation.
    let d1 = point_to_line_distance(c1, p0, p3);
    let d2 = point_to_line_distance(c2, p0, p3);

    if d1 + d2 <= tol {
        out.push(p3);
        return;
    }

    // Subdivide at t=0.5
    let mid01 = midpoint(p0, c1);
    let mid12 = midpoint(c1, c2);
    let mid23 = midpoint(c2, p3);
    let mid012 = midpoint(mid01, mid12);
    let mid123 = midpoint(mid12, mid23);
    let mid0123 = midpoint(mid012, mid123);

    flatten_cubic(p0, mid01, mid012, mid0123, tol, out);
    flatten_cubic(mid0123, mid123, mid23, p3, tol, out);
}

/// Adaptive subdivision of a quadratic bezier curve.
fn flatten_quad(p0: Point, ctrl: Point, p2: Point, tol: f64, out: &mut Vec<Point>) {
    let d = point_to_line_distance(ctrl, p0, p2);

    if d <= tol {
        out.push(p2);
        return;
    }

    // Subdivide at t=0.5
    let mid01 = midpoint(p0, ctrl);
    let mid12 = midpoint(ctrl, p2);
    let mid012 = midpoint(mid01, mid12);

    flatten_quad(p0, mid01, mid012, tol, out);
    flatten_quad(mid012, mid12, p2, tol, out);
}

/// Midpoint of two points.
fn midpoint(a: Point, b: Point) -> Point {
    Point::new((a.x + b.x) * 0.5, (a.y + b.y) * 0.5)
}

/// Perpendicular distance from a point to a line defined by two points.
fn point_to_line_distance(p: Point, line_start: Point, line_end: Point) -> f64 {
    let dx = line_end.x - line_start.x;
    let dy = line_end.y - line_start.y;
    let len_sq = dx * dx + dy * dy;

    if len_sq < f64::EPSILON {
        return distance(p, line_start);
    }

    let cross = (p.x - line_start.x) * dy - (p.y - line_start.y) * dx;
    cross.abs() / len_sq.sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_vector_path_new_is_empty() {
        let path = VectorPath::new();
        assert!(path.is_empty());
        assert_eq!(path.len(), 0);
        assert!(!path.is_closed());
    }

    #[test]
    fn test_vector_path_build_line() {
        let mut path = VectorPath::new();
        path.move_to(Point::new(0.0, 0.0));
        path.line_to(Point::new(10.0, 0.0));
        path.line_to(Point::new(10.0, 10.0));

        assert_eq!(path.len(), 3);
        assert!(!path.is_closed());
    }

    #[test]
    fn test_vector_path_close() {
        let mut path = VectorPath::new();
        path.move_to(Point::new(0.0, 0.0));
        path.line_to(Point::new(10.0, 0.0));
        path.line_to(Point::new(10.0, 10.0));
        path.close();

        assert!(path.is_closed());
        assert_eq!(path.len(), 4); // 3 commands + Close
    }

    #[test]
    fn test_vector_path_close_idempotent() {
        let mut path = VectorPath::new();
        path.move_to(Point::new(0.0, 0.0));
        path.line_to(Point::new(10.0, 0.0));
        path.close();
        path.close(); // Should not add another Close

        assert_eq!(path.len(), 3);
    }

    #[test]
    fn test_flatten_straight_line() {
        let mut path = VectorPath::new();
        path.move_to(Point::new(0.0, 0.0));
        path.line_to(Point::new(10.0, 0.0));
        path.line_to(Point::new(10.0, 10.0));

        let points = path.flatten(0.5);
        assert_eq!(points.len(), 3);
        assert_eq!(points[0].x, 0.0);
        assert_eq!(points[0].y, 0.0);
        assert_eq!(points[1].x, 10.0);
        assert_eq!(points[1].y, 0.0);
        assert_eq!(points[2].x, 10.0);
        assert_eq!(points[2].y, 10.0);
    }

    #[test]
    fn test_flatten_cubic_produces_points() {
        let mut path = VectorPath::new();
        path.move_to(Point::new(0.0, 0.0));
        path.cubic_to(
            Point::new(0.0, 10.0),
            Point::new(10.0, 10.0),
            Point::new(10.0, 0.0),
        );

        let points = path.flatten(0.5);
        assert!(points.len() >= 2, "Should have at least start and end");
        assert_eq!(points[0].x, 0.0);
        assert_eq!(points[0].y, 0.0);

        let last = points.last().unwrap();
        assert!((last.x - 10.0).abs() < 1e-10);
        assert!(last.y.abs() < 1e-10);
    }

    #[test]
    fn test_flatten_quad_produces_points() {
        let mut path = VectorPath::new();
        path.move_to(Point::new(0.0, 0.0));
        path.quad_to(Point::new(5.0, 10.0), Point::new(10.0, 0.0));

        let points = path.flatten(0.5);
        assert!(points.len() >= 2);
    }

    #[test]
    fn test_bounding_box_triangle() {
        let mut path = VectorPath::new();
        path.move_to(Point::new(0.0, 0.0));
        path.line_to(Point::new(10.0, 0.0));
        path.line_to(Point::new(5.0, 8.0));
        path.close();

        let bbox = path.bounding_box();
        assert!((bbox.min_x - 0.0).abs() < 1e-10);
        assert!((bbox.min_y - 0.0).abs() < 1e-10);
        assert!((bbox.max_x - 10.0).abs() < 1e-10);
        assert!((bbox.max_y - 8.0).abs() < 1e-10);
    }

    #[test]
    fn test_bounding_box_empty_path() {
        let path = VectorPath::new();
        let bbox = path.bounding_box();
        assert!(bbox.is_empty());
        assert_eq!(bbox.width(), 0.0);
        assert_eq!(bbox.height(), 0.0);
    }

    #[test]
    fn test_contains_point_triangle() {
        let mut path = VectorPath::new();
        path.move_to(Point::new(0.0, 0.0));
        path.line_to(Point::new(10.0, 0.0));
        path.line_to(Point::new(5.0, 10.0));
        path.close();

        // Center of triangle should be inside
        assert!(path.contains_point(Point::new(5.0, 3.0)));

        // Point well outside should not be inside
        assert!(!path.contains_point(Point::new(20.0, 20.0)));
        assert!(!path.contains_point(Point::new(-5.0, -5.0)));
    }

    #[test]
    fn test_contains_point_open_path_always_false() {
        let mut path = VectorPath::new();
        path.move_to(Point::new(0.0, 0.0));
        path.line_to(Point::new(10.0, 0.0));
        path.line_to(Point::new(5.0, 10.0));
        // Not closed

        assert!(!path.contains_point(Point::new(5.0, 3.0)));
    }

    #[test]
    fn test_contains_point_square() {
        let mut path = VectorPath::new();
        path.move_to(Point::new(0.0, 0.0));
        path.line_to(Point::new(10.0, 0.0));
        path.line_to(Point::new(10.0, 10.0));
        path.line_to(Point::new(0.0, 10.0));
        path.close();

        assert!(path.contains_point(Point::new(5.0, 5.0)));
        assert!(!path.contains_point(Point::new(15.0, 5.0)));
    }

    #[test]
    fn test_bbox_contains() {
        let bbox = BoundingBox::new(0.0, 0.0, 10.0, 10.0);
        assert!(bbox.contains(Point::new(5.0, 5.0)));
        assert!(bbox.contains(Point::new(0.0, 0.0)));
        assert!(bbox.contains(Point::new(10.0, 10.0)));
        assert!(!bbox.contains(Point::new(-1.0, 5.0)));
        assert!(!bbox.contains(Point::new(5.0, 11.0)));
    }

    #[test]
    fn test_bbox_union() {
        let mut a = BoundingBox::new(0.0, 0.0, 5.0, 5.0);
        let b = BoundingBox::new(3.0, 3.0, 10.0, 10.0);
        a.union(&b);

        assert!((a.min_x - 0.0).abs() < 1e-10);
        assert!((a.min_y - 0.0).abs() < 1e-10);
        assert!((a.max_x - 10.0).abs() < 1e-10);
        assert!((a.max_y - 10.0).abs() < 1e-10);
    }

    #[test]
    fn test_bbox_union_with_empty() {
        let mut a = BoundingBox::new(0.0, 0.0, 5.0, 5.0);
        let empty = BoundingBox::empty();
        a.union(&empty);

        assert!((a.min_x - 0.0).abs() < 1e-10);
        assert!((a.max_x - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_from_commands() {
        let commands = vec![
            PathCommand::MoveTo(Point::new(0.0, 0.0)),
            PathCommand::LineTo(Point::new(10.0, 0.0)),
            PathCommand::Close,
        ];
        let path = VectorPath::from_commands(commands);
        assert!(path.is_closed());
        assert_eq!(path.len(), 3);
    }
}
