//! Tatami fill stitch generation for closed shapes.
//!
//! Generates parallel rows clipped to polygon boundaries with serpentine
//! ordering to minimize jumps.

use crate::constants::{DEFAULT_STITCH_DENSITY, DEFAULT_STITCH_LENGTH, MIN_TATAMI_DENSITY};
use crate::{Point, Stitch};

/// Generate tatami fill stitches for closed rings.
///
/// `rings` should contain one or more closed polylines (last point == first).
pub fn generate_tatami_fill(
    rings: &[Vec<Point>],
    density: f64,
    angle_degrees: f64,
    stitch_length: f64,
) -> Vec<Stitch> {
    let density = if density <= 0.0 {
        DEFAULT_STITCH_DENSITY
    } else {
        density.max(MIN_TATAMI_DENSITY)
    };

    let stitch_length = if stitch_length <= 0.0 {
        DEFAULT_STITCH_LENGTH
    } else {
        stitch_length
    };

    let mut closed_rings: Vec<Vec<Point>> = Vec::new();
    for ring in rings {
        if ring.len() < 3 || !is_ring_closed(ring) {
            continue;
        }
        closed_rings.push(ring.clone());
    }

    if closed_rings.is_empty() {
        return vec![];
    }

    let angle = angle_degrees.to_radians();
    let cos = angle.cos();
    let sin = angle.sin();

    let rotated_rings: Vec<Vec<Point>> = closed_rings
        .iter()
        .map(|ring| ring.iter().map(|p| rotate(*p, cos, -sin)).collect())
        .collect();

    let (min_y, max_y) = bounding_y(&rotated_rings);
    if min_y > max_y {
        return vec![];
    }

    let row_count = ((max_y - min_y) / density).ceil() as i32;
    let mut stitches: Vec<Stitch> = Vec::new();
    let mut prev_end: Option<Point> = None;
    let mut prev_row_single = false;

    for row in 0..=row_count {
        let y = min_y + row as f64 * density;
        let mut intersections = collect_intersections(&rotated_rings, y);
        if intersections.len() < 2 {
            continue;
        }
        intersections.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        let mut segments: Vec<(f64, f64)> = Vec::new();
        let mut i = 0;
        while i + 1 < intersections.len() {
            let x0 = intersections[i];
            let x1 = intersections[i + 1];
            if (x1 - x0).abs() > f64::EPSILON {
                segments.push((x0, x1));
            }
            i += 2;
        }

        if segments.is_empty() {
            prev_row_single = false;
            continue;
        }

        let left_to_right = row % 2 == 0;
        let row_single = segments.len() == 1;
        let mut emit_segment = |idx: usize, x0: f64, x1: f64| {
            let (mut start_x, end_x) = if left_to_right { (x0, x1) } else { (x1, x0) };
            if row % 2 == 1 {
                let stagger = density * 0.5;
                if left_to_right {
                    start_x += stagger;
                } else {
                    start_x -= stagger;
                }
            }

            if left_to_right && start_x > end_x {
                return;
            }
            if !left_to_right && start_x < end_x {
                return;
            }

            let start = rotate(Point::new(start_x, y), cos, sin);
            let end = rotate(Point::new(end_x, y), cos, sin);

            let allow_continuous = idx == 0 && prev_end.is_some() && prev_row_single && row_single;
            let mut seg_stitches =
                super::running::generate_running_stitches(&[start, end], stitch_length);
            if let Some(first) = seg_stitches.first_mut() {
                if stitches.is_empty() {
                    first.is_jump = false;
                } else {
                    first.is_jump = !allow_continuous;
                }
            }

            if let Some(last) = seg_stitches.last() {
                prev_end = Some(last.position);
            }

            stitches.extend(seg_stitches);
        };

        if left_to_right {
            for (idx, (x0, x1)) in segments.iter().cloned().enumerate() {
                emit_segment(idx, x0, x1);
            }
        } else {
            for (idx, (x0, x1)) in segments.iter().cloned().rev().enumerate() {
                emit_segment(idx, x0, x1);
            }
        }

        prev_row_single = row_single;
    }

    stitches
}

fn is_ring_closed(ring: &[Point]) -> bool {
    if ring.len() < 2 {
        return false;
    }
    let first = ring[0];
    let last = ring[ring.len() - 1];
    distance(first, last) < f64::EPSILON
}

fn bounding_y(rings: &[Vec<Point>]) -> (f64, f64) {
    let mut min_y = f64::INFINITY;
    let mut max_y = f64::NEG_INFINITY;
    for ring in rings {
        for p in ring {
            min_y = min_y.min(p.y);
            max_y = max_y.max(p.y);
        }
    }
    (min_y, max_y)
}

fn collect_intersections(rings: &[Vec<Point>], y: f64) -> Vec<f64> {
    let mut intersections = Vec::new();
    for ring in rings {
        if ring.len() < 2 {
            continue;
        }
        for i in 0..(ring.len() - 1) {
            let p1 = ring[i];
            let p2 = ring[i + 1];
            if (p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y) {
                let t = (y - p1.y) / (p2.y - p1.y);
                intersections.push(p1.x + t * (p2.x - p1.x));
            }
        }
    }
    intersections
}

fn rotate(p: Point, cos: f64, sin: f64) -> Point {
    Point::new(p.x * cos - p.y * sin, p.x * sin + p.y * cos)
}

fn distance(a: Point, b: Point) -> f64 {
    let dx = a.x - b.x;
    let dy = a.y - b.y;
    (dx * dx + dy * dy).sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tatami_fill_rectangle() {
        let ring = vec![
            Point::new(0.0, 0.0),
            Point::new(10.0, 0.0),
            Point::new(10.0, 5.0),
            Point::new(0.0, 5.0),
            Point::new(0.0, 0.0),
        ];

        let stitches = generate_tatami_fill(&[ring], 2.0, 0.0, 2.5);
        assert!(!stitches.is_empty());

        for s in stitches {
            assert!(s.position.x >= -0.01 && s.position.x <= 10.01);
            assert!(s.position.y >= -0.01 && s.position.y <= 5.01);
        }
    }
}
