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
    if points.len() < 2 || stitch_length <= 0.0 {
        return vec![];
    }

    let clean = dedupe_consecutive(points);
    if clean.len() < 2 {
        return vec![];
    }

    // Split at sharp turns to avoid uneven corner artifacts.
    let tolerance = (stitch_length * 0.2).clamp(0.05, 1.0);
    let curves = split_path_to_curves(&clean, tolerance * 2.0);

    let mut out_points: Vec<Point> = vec![clean[0]];
    for curve in &curves {
        let mut stitched = stitch_curve_evenly(curve, stitch_length);
        if let Some(last) = out_points.last().copied() {
            stitched.retain(|p| !is_same_point(*p, last));
        }
        out_points.extend(stitched);
    }

    let final_point = clean[clean.len() - 1];
    if out_points
        .last()
        .copied()
        .is_none_or(|p| !is_same_point(p, final_point))
    {
        out_points.push(final_point);
    }

    out_points
        .into_iter()
        .map(|position| Stitch {
            position,
            is_jump: false,
            is_trim: false,
        })
        .collect()
}

fn dedupe_consecutive(points: &[Point]) -> Vec<Point> {
    let mut out: Vec<Point> = Vec::with_capacity(points.len());
    for &p in points {
        if out
            .last()
            .copied()
            .is_none_or(|last| !is_same_point(last, p))
        {
            out.push(p);
        }
    }
    out
}

fn split_path_to_curves(points: &[Point], min_curve_len: f64) -> Vec<Vec<Point>> {
    if points.len() < 3 {
        return vec![points.to_vec()];
    }

    let mut curves: Vec<Vec<Point>> = Vec::new();
    let mut start = 0usize;
    let mut seg_len = distance(points[0], points[1]);

    for i in 1..(points.len() - 1) {
        let a = vector(points[i - 1], points[i]);
        let b = vector(points[i], points[i + 1]);
        let a_norm2 = dot(a, a);
        let b_norm2 = dot(b, b);
        let dot_abs = dot(a, b).abs();
        // Split only on hard corners (about 70deg+ turn). Softer turns are
        // stitched continuously to avoid over-segmentation and short stitches.
        let sharp_turn = a_norm2 > f64::EPSILON
            && b_norm2 > f64::EPSILON
            && (dot_abs * dot_abs) <= 0.12 * a_norm2 * b_norm2;

        if sharp_turn && seg_len >= min_curve_len {
            curves.push(points[start..=i].to_vec());
            start = i;
            seg_len = 0.0;
        }

        seg_len += distance(points[i], points[i + 1]);
    }

    curves.push(points[start..].to_vec());
    curves
}

fn stitch_curve_evenly(points: &[Point], stitch_length: f64) -> Vec<Point> {
    if points.len() < 2 {
        return vec![];
    }

    let total = polyline_length(points);
    if total <= f64::EPSILON {
        return vec![];
    }

    let segment_count = (total / stitch_length).ceil().max(1.0) as usize;
    let effective_step = total / segment_count as f64;

    let mut stitched: Vec<Point> = Vec::with_capacity(segment_count);
    for k in 1..=segment_count {
        let target = (k as f64) * effective_step;
        stitched.push(sample_along_polyline(points, target));
    }
    stitched
}

fn polyline_length(points: &[Point]) -> f64 {
    points
        .windows(2)
        .map(|pair| distance(pair[0], pair[1]))
        .sum::<f64>()
}

fn sample_along_polyline(points: &[Point], target_distance: f64) -> Point {
    let mut traversed = 0.0;
    for pair in points.windows(2) {
        let p0 = pair[0];
        let p1 = pair[1];
        let seg_len = distance(p0, p1);
        if seg_len <= f64::EPSILON {
            continue;
        }

        let next = traversed + seg_len;
        if target_distance <= next + 1e-9 {
            let t = ((target_distance - traversed) / seg_len).clamp(0.0, 1.0);
            return Point::new(p0.x + (p1.x - p0.x) * t, p0.y + (p1.y - p0.y) * t);
        }
        traversed = next;
    }
    points[points.len() - 1]
}

fn distance(a: Point, b: Point) -> f64 {
    let dx = b.x - a.x;
    let dy = b.y - a.y;
    (dx * dx + dy * dy).sqrt()
}

fn vector(a: Point, b: Point) -> (f64, f64) {
    (b.x - a.x, b.y - a.y)
}

fn dot(a: (f64, f64), b: (f64, f64)) -> f64 {
    a.0 * b.0 + a.1 * b.1
}

fn is_same_point(a: Point, b: Point) -> bool {
    (a.x - b.x).abs() <= 1e-9 && (a.y - b.y).abs() <= 1e-9
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

    #[test]
    fn test_running_stitches_zero_length() {
        let points = vec![Point::new(0.0, 0.0), Point::new(10.0, 0.0)];
        let stitches = generate_running_stitches(&points, 0.0);
        assert!(
            stitches.is_empty(),
            "Zero stitch_length should return empty"
        );
    }

    #[test]
    fn test_running_stitches_negative_length() {
        let points = vec![Point::new(0.0, 0.0), Point::new(10.0, 0.0)];
        let stitches = generate_running_stitches(&points, -5.0);
        assert!(
            stitches.is_empty(),
            "Negative stitch_length should return empty"
        );
    }

    #[test]
    fn test_running_stitches_diagonal() {
        let points = vec![Point::new(0.0, 0.0), Point::new(3.0, 4.0)];
        let stitches = generate_running_stitches(&points, 2.5);

        // Path length is 5.0, stitch_length 2.5 → 2 interior + start + end
        assert!(stitches.len() >= 3);
        let last = &stitches[stitches.len() - 1];
        assert!((last.position.x - 3.0).abs() < 1e-10);
        assert!((last.position.y - 4.0).abs() < 1e-10);
    }

    #[test]
    fn test_running_stitches_zero_length_segment() {
        // Path with a duplicated point (zero-length segment)
        let points = vec![
            Point::new(0.0, 0.0),
            Point::new(5.0, 0.0),
            Point::new(5.0, 0.0), // duplicate
            Point::new(10.0, 0.0),
        ];
        let stitches = generate_running_stitches(&points, 3.0);

        assert!(stitches.len() >= 2);
        let last = &stitches[stitches.len() - 1];
        assert_eq!(last.position.x, 10.0);
    }

    #[test]
    fn test_running_stitches_even_distribution() {
        let points = vec![Point::new(0.0, 0.0), Point::new(10.0, 0.0)];
        let stitches = generate_running_stitches(&points, 3.0);

        let mut lengths: Vec<f64> = Vec::new();
        for pair in stitches.windows(2) {
            lengths.push(distance(pair[0].position, pair[1].position));
        }
        let min = lengths.iter().copied().fold(f64::INFINITY, f64::min);
        let max = lengths.iter().copied().fold(f64::NEG_INFINITY, f64::max);

        // Even stitching should avoid large tail segments.
        assert!(
            (max - min) < 0.2,
            "segment spread too wide: {min:.3}..{max:.3}"
        );
    }

    #[test]
    fn test_running_stitches_split_sharp_turns() {
        let points = vec![
            Point::new(0.0, 0.0),
            Point::new(6.0, 0.0),
            Point::new(6.0, 6.0),
            Point::new(12.0, 6.0),
        ];
        let stitches = generate_running_stitches(&points, 2.0);
        let has_corner = stitches
            .iter()
            .any(|s| (s.position.x - 6.0).abs() < 1e-6 && (s.position.y - 0.0).abs() < 1e-6)
            || stitches
                .iter()
                .any(|s| (s.position.x - 6.0).abs() < 1e-6 && (s.position.y - 6.0).abs() < 1e-6);

        assert!(
            has_corner,
            "sharp turn corners should be preserved in stitch stream"
        );
    }

    #[test]
    fn test_running_stitches_soft_turns_keep_density() {
        let points = vec![
            Point::new(0.0, 0.0),
            Point::new(8.0, 0.0),
            Point::new(12.0, 5.0),
            Point::new(20.0, 5.0),
            Point::new(24.0, 0.0),
            Point::new(32.0, 0.0),
        ];
        let stitches = generate_running_stitches(&points, 2.5);

        let mut lengths: Vec<f64> = Vec::new();
        for pair in stitches.windows(2) {
            lengths.push(distance(pair[0].position, pair[1].position));
        }
        let mean = lengths.iter().sum::<f64>() / lengths.len() as f64;
        assert!(
            (mean - 2.5).abs() < 0.25,
            "soft-turn mean stitch length drifted: {mean:.3}"
        );
    }
}
