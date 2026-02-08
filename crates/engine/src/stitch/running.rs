//! Running stitch generation — the simplest stitch type.
//!
//! Produces evenly-spaced needle penetrations along a polyline path.

use crate::{Point, Stitch};

/// Generate running stitches along a polyline path.
///
/// # Arguments
/// * `points` - Ordered list of path points
/// * `stitch_length` - Target length between stitch points in mm
///
/// # Returns
/// A list of `Stitch` structs with positions and metadata.
pub fn generate_running_stitches(points: &[Point], stitch_length: f64) -> Vec<Stitch> {
    if points.len() < 2 {
        return vec![];
    }

    let mut stitches = Vec::new();

    // First point
    stitches.push(Stitch {
        position: points[0],
        is_jump: false,
        is_trim: false,
    });

    let mut remaining = 0.0_f64;

    for i in 0..(points.len() - 1) {
        let p0 = points[i];
        let p1 = points[i + 1];

        let dx = p1.x - p0.x;
        let dy = p1.y - p0.y;
        let seg_len = (dx * dx + dy * dy).sqrt();

        if seg_len == 0.0 {
            continue;
        }

        let nx = dx / seg_len;
        let ny = dy / seg_len;

        let mut dist = stitch_length - remaining;

        while dist <= seg_len {
            stitches.push(Stitch {
                position: Point::new(p0.x + nx * dist, p0.y + ny * dist),
                is_jump: false,
                is_trim: false,
            });
            dist += stitch_length;
        }

        remaining = seg_len - (dist - stitch_length);
    }

    // Last point
    let last = points[points.len() - 1];
    stitches.push(Stitch {
        position: last,
        is_jump: false,
        is_trim: false,
    });

    stitches
}

/// Generate running stitches from a flat coordinate array.
/// This is the WASM-friendly wrapper that preserves backward compatibility.
pub fn generate_running_stitches_flat(path: &[f64], stitch_length: f64) -> Vec<f64> {
    let point_count = path.len() / 2;
    if point_count < 2 {
        return vec![];
    }

    let points: Vec<Point> = (0..point_count)
        .map(|i| Point::new(path[i * 2], path[i * 2 + 1]))
        .collect();

    let stitches = generate_running_stitches(&points, stitch_length);

    let mut flat = Vec::with_capacity(stitches.len() * 2);
    for s in &stitches {
        flat.push(s.position.x);
        flat.push(s.position.y);
    }
    flat
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_running_stitches_straight_line() {
        let points = vec![Point::new(0.0, 0.0), Point::new(10.0, 0.0)];
        let stitches = generate_running_stitches(&points, 3.0);

        assert!(stitches.len() >= 2);
        assert_eq!(stitches[0].position.x, 0.0);
        assert_eq!(stitches[0].position.y, 0.0);

        let last = &stitches[stitches.len() - 1];
        assert_eq!(last.position.x, 10.0);
        assert_eq!(last.position.y, 0.0);

        // All stitches should be normal (not jump or trim)
        for s in &stitches {
            assert!(!s.is_jump);
            assert!(!s.is_trim);
        }
    }

    #[test]
    fn test_running_stitches_too_few() {
        let points = vec![Point::new(0.0, 0.0)];
        assert!(generate_running_stitches(&points, 3.0).is_empty());
    }

    #[test]
    fn test_running_stitches_multi_segment() {
        let points = vec![
            Point::new(0.0, 0.0),
            Point::new(5.0, 0.0),
            Point::new(10.0, 0.0),
        ];
        let stitches = generate_running_stitches(&points, 3.0);

        // Should carry remainder across segments
        assert!(stitches.len() >= 3);
        let last = &stitches[stitches.len() - 1];
        assert_eq!(last.position.x, 10.0);
    }

    #[test]
    fn test_running_stitches_flat_compat() {
        let flat = generate_running_stitches_flat(&[0.0, 0.0, 10.0, 0.0], 3.0);
        assert!(flat.len() >= 4);
        assert_eq!(flat[0], 0.0);
        assert_eq!(flat[1], 0.0);
    }
}
