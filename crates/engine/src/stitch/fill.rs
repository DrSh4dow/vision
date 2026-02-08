//! Fill stitch generation for closed shapes.
//!
//! Provides tatami, contour, spiral, and motif fill variants.

use crate::constants::{DEFAULT_STITCH_DENSITY, DEFAULT_STITCH_LENGTH, MIN_TATAMI_DENSITY};
use crate::{MotifPattern, Point, Stitch};

const MIN_FILL_SPACING_MM: f64 = 0.1;
const TWO_PI: f64 = std::f64::consts::PI * 2.0;

/// Generate tatami fill stitches for closed rings.
///
/// `rings` should contain one or more closed polylines (last point == first).
pub fn generate_tatami_fill(
    rings: &[Vec<Point>],
    density: f64,
    angle_degrees: f64,
    stitch_length: f64,
) -> Vec<Stitch> {
    let density = normalize_density(density);

    let stitch_length = if stitch_length <= 0.0 {
        DEFAULT_STITCH_LENGTH
    } else {
        stitch_length
    };

    let closed_rings = normalize_closed_rings(rings);
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

/// Generate contour fill stitches by shrinking rings toward their centroid.
pub fn generate_contour_fill(
    rings: &[Vec<Point>],
    density: f64,
    stitch_length: f64,
    contour_step_mm: f64,
) -> Vec<Stitch> {
    let step = if contour_step_mm > 0.0 {
        contour_step_mm.max(MIN_FILL_SPACING_MM)
    } else {
        normalize_density(density)
    };

    let stitch_length = if stitch_length <= 0.0 {
        DEFAULT_STITCH_LENGTH
    } else {
        stitch_length
    };

    let closed_rings = normalize_closed_rings(rings);
    if closed_rings.is_empty() {
        return vec![];
    }

    let mut all_stitches: Vec<Stitch> = Vec::new();

    let outer_ring = &closed_rings[0];
    for ring in std::iter::once(outer_ring) {
        let center = centroid(ring);
        let max_radius = ring
            .iter()
            .map(|p| distance(*p, center))
            .fold(0.0_f64, f64::max);

        if max_radius <= f64::EPSILON {
            continue;
        }

        let loop_count = (max_radius / step).ceil() as usize;
        for i in 0..=loop_count {
            let shrink = i as f64 * step;
            let factor = 1.0 - shrink / max_radius;
            if factor <= 0.05 {
                break;
            }

            let mut contour_loop: Vec<Point> = ring
                .iter()
                .map(|p| {
                    Point::new(
                        center.x + (p.x - center.x) * factor,
                        center.y + (p.y - center.y) * factor,
                    )
                })
                .collect();

            if contour_loop.len() >= 2
                && distance(contour_loop[0], contour_loop[contour_loop.len() - 1]) > 1e-6
            {
                contour_loop.push(contour_loop[0]);
            }

            let mut contour_stitches =
                generate_clipped_running_stitches(&contour_loop, &closed_rings, stitch_length);
            if contour_stitches.is_empty() {
                continue;
            }

            if let Some(first) = contour_stitches.first_mut() {
                first.is_jump = !all_stitches.is_empty();
            }

            all_stitches.extend(contour_stitches);
        }
    }

    all_stitches
}

/// Generate spiral fill stitches using an Archimedean spiral clipped by polygon inclusion.
pub fn generate_spiral_fill(
    rings: &[Vec<Point>],
    density: f64,
    stitch_length: f64,
    phase: f64,
) -> Vec<Stitch> {
    let spacing = normalize_density(density).max(0.2);
    let stitch_length = if stitch_length <= 0.0 {
        DEFAULT_STITCH_LENGTH
    } else {
        stitch_length
    };

    let closed_rings = normalize_closed_rings(rings);
    if closed_rings.is_empty() {
        return vec![];
    }

    let outer = &closed_rings[0];
    let center = centroid(outer);
    let max_radius = outer
        .iter()
        .map(|p| distance(*p, center))
        .fold(0.0_f64, f64::max);

    if max_radius <= f64::EPSILON {
        return vec![];
    }

    let phase_rad = phase.to_radians();
    let mut theta = phase_rad;
    let mut points: Vec<Point> = Vec::new();
    let mut guard = 0usize;

    while guard < 25_000 {
        let progress = (theta - phase_rad) / TWO_PI;
        let radius = progress * spacing;
        if radius > max_radius + spacing {
            break;
        }

        let p = Point::new(
            center.x + radius * theta.cos(),
            center.y + radius * theta.sin(),
        );

        if point_in_rings(p, &closed_rings) {
            points.push(p);
        }

        let step_theta = (stitch_length / radius.max(0.5)).clamp(0.1, 0.7);
        theta += step_theta;
        guard += 1;
    }

    if points.len() < 2 {
        return vec![];
    }

    super::running::generate_running_stitches(&points, stitch_length)
}

/// Generate motif fill stitches by tiling motifs and clipping by polygon inclusion.
pub fn generate_motif_fill(
    rings: &[Vec<Point>],
    density: f64,
    angle_degrees: f64,
    stitch_length: f64,
    phase: f64,
    pattern: MotifPattern,
    motif_scale: f64,
) -> Vec<Stitch> {
    let spacing = (normalize_density(density) * 3.0 * motif_scale.max(0.2)).max(0.6);
    let stitch_length = if stitch_length <= 0.0 {
        DEFAULT_STITCH_LENGTH
    } else {
        stitch_length
    };

    let closed_rings = normalize_closed_rings(rings);
    if closed_rings.is_empty() {
        return vec![];
    }

    let (min_x, min_y, max_x, max_y) = bounding_box(&closed_rings);
    if min_x > max_x || min_y > max_y {
        return vec![];
    }

    let angle = angle_degrees.to_radians();
    let phase_offset = phase.rem_euclid(1.0) * spacing;
    let mut all_stitches: Vec<Stitch> = Vec::new();

    let mut row = 0usize;
    let mut y = min_y + phase_offset;
    while y <= max_y + spacing {
        let mut x_values: Vec<f64> = Vec::new();
        let mut x = min_x + phase_offset;
        while x <= max_x + spacing {
            x_values.push(x);
            x += spacing;
        }

        if row % 2 == 1 {
            x_values.reverse();
        }

        for x in x_values {
            let center = Point::new(x, y);
            if !point_in_rings(center, &closed_rings) {
                continue;
            }

            let motif_points = build_motif(center, spacing * 0.45, angle, pattern);
            let mut motif_stitches =
                super::running::generate_running_stitches(&motif_points, stitch_length);
            if motif_stitches.is_empty() {
                continue;
            }

            if let Some(first) = motif_stitches.first_mut() {
                first.is_jump = !all_stitches.is_empty();
            }

            all_stitches.extend(motif_stitches);
        }

        row += 1;
        y += spacing;
    }

    all_stitches
}

fn build_motif(center: Point, size: f64, angle: f64, pattern: MotifPattern) -> Vec<Point> {
    let local_points: Vec<Point> = match pattern {
        MotifPattern::Diamond => vec![
            Point::new(0.0, -size),
            Point::new(size, 0.0),
            Point::new(0.0, size),
            Point::new(-size, 0.0),
            Point::new(0.0, -size),
        ],
        MotifPattern::Wave => vec![
            Point::new(-size, 0.0),
            Point::new(-size * 0.3, -size * 0.7),
            Point::new(size * 0.3, size * 0.7),
            Point::new(size, 0.0),
        ],
        MotifPattern::Triangle => vec![
            Point::new(0.0, -size),
            Point::new(size, size),
            Point::new(-size, size),
            Point::new(0.0, -size),
        ],
    };

    let cos = angle.cos();
    let sin = angle.sin();

    local_points
        .iter()
        .map(|p| {
            let rx = p.x * cos - p.y * sin;
            let ry = p.x * sin + p.y * cos;
            Point::new(center.x + rx, center.y + ry)
        })
        .collect()
}

fn normalize_density(density: f64) -> f64 {
    if density <= 0.0 {
        DEFAULT_STITCH_DENSITY
    } else {
        density.max(MIN_TATAMI_DENSITY)
    }
}

fn normalize_closed_rings(rings: &[Vec<Point>]) -> Vec<Vec<Point>> {
    let mut normalized: Vec<(Vec<Point>, f64)> = Vec::new();
    for ring in rings {
        if ring.len() < 3 {
            continue;
        }

        let mut r = ring.clone();
        if distance(r[0], r[r.len() - 1]) > 1e-6 {
            r.push(r[0]);
        }
        if r.len() < 4 {
            continue;
        }
        let area = signed_area(&r);
        if area.abs() <= 1e-6 {
            continue;
        }
        normalized.push((r, area));
    }

    if normalized.is_empty() {
        return vec![];
    }

    let outer_index = normalized
        .iter()
        .enumerate()
        .max_by(|(_, a), (_, b)| {
            a.1.abs()
                .partial_cmp(&b.1.abs())
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|(idx, _)| idx)
        .unwrap_or(0);

    let mut ordered: Vec<Vec<Point>> = Vec::with_capacity(normalized.len());
    let (mut outer, outer_area) = normalized.swap_remove(outer_index);
    if outer_area < 0.0 {
        outer.reverse();
    }
    ordered.push(outer);

    normalized.sort_by(|a, b| {
        b.1.abs()
            .partial_cmp(&a.1.abs())
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    for (ring, _) in normalized {
        ordered.push(ring);
    }

    ordered
}

fn centroid(points: &[Point]) -> Point {
    if points.is_empty() {
        return Point::new(0.0, 0.0);
    }

    let mut sx = 0.0;
    let mut sy = 0.0;
    let mut count = 0usize;

    for p in points {
        sx += p.x;
        sy += p.y;
        count += 1;
    }

    Point::new(sx / count as f64, sy / count as f64)
}

fn point_in_rings(p: Point, rings: &[Vec<Point>]) -> bool {
    let mut inside = false;
    for ring in rings {
        if point_in_ring(p, ring) {
            inside = !inside;
        }
    }
    inside
}

fn point_in_ring(p: Point, ring: &[Point]) -> bool {
    if ring.len() < 3 {
        return false;
    }

    let mut inside = false;
    for i in 0..(ring.len() - 1) {
        let a = ring[i];
        let b = ring[i + 1];

        let intersects = (a.y > p.y) != (b.y > p.y);
        if !intersects {
            continue;
        }

        let x_intersect = a.x + (p.y - a.y) * (b.x - a.x) / (b.y - a.y);
        if p.x < x_intersect {
            inside = !inside;
        }
    }

    inside
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

fn bounding_box(rings: &[Vec<Point>]) -> (f64, f64, f64, f64) {
    let mut min_x = f64::INFINITY;
    let mut min_y = f64::INFINITY;
    let mut max_x = f64::NEG_INFINITY;
    let mut max_y = f64::NEG_INFINITY;

    for ring in rings {
        for p in ring {
            min_x = min_x.min(p.x);
            min_y = min_y.min(p.y);
            max_x = max_x.max(p.x);
            max_y = max_y.max(p.y);
        }
    }

    (min_x, min_y, max_x, max_y)
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

fn generate_clipped_running_stitches(
    points: &[Point],
    rings: &[Vec<Point>],
    stitch_length: f64,
) -> Vec<Stitch> {
    if points.len() < 2 {
        return vec![];
    }

    let mut stitched: Vec<Stitch> = Vec::new();
    let mut segment: Vec<Point> = Vec::new();

    let flush_segment = |segment: &mut Vec<Point>, stitched: &mut Vec<Stitch>| {
        if segment.len() < 2 {
            segment.clear();
            return;
        }

        let mut closed_segment = std::mem::take(segment);
        if distance(closed_segment[0], closed_segment[closed_segment.len() - 1]) > 1e-6 {
            closed_segment.push(closed_segment[0]);
        }

        let mut part = super::running::generate_running_stitches(&closed_segment, stitch_length);
        if let Some(first) = part.first_mut() {
            first.is_jump = !stitched.is_empty();
        }
        stitched.extend(part);
    };

    for point in points {
        if point_in_rings(*point, rings) {
            segment.push(*point);
        } else {
            flush_segment(&mut segment, &mut stitched);
        }
    }
    flush_segment(&mut segment, &mut stitched);

    stitched
}

fn signed_area(ring: &[Point]) -> f64 {
    if ring.len() < 3 {
        return 0.0;
    }
    let mut area = 0.0;
    for i in 0..(ring.len() - 1) {
        let p0 = ring[i];
        let p1 = ring[i + 1];
        area += p0.x * p1.y - p1.x * p0.y;
    }
    area * 0.5
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

    #[test]
    fn test_contour_fill_rectangle() {
        let ring = vec![
            Point::new(0.0, 0.0),
            Point::new(12.0, 0.0),
            Point::new(12.0, 8.0),
            Point::new(0.0, 8.0),
            Point::new(0.0, 0.0),
        ];

        let stitches = generate_contour_fill(&[ring], 1.0, 2.0, 1.2);
        assert!(!stitches.is_empty());
    }

    #[test]
    fn test_spiral_fill_rectangle() {
        let ring = vec![
            Point::new(0.0, 0.0),
            Point::new(20.0, 0.0),
            Point::new(20.0, 10.0),
            Point::new(0.0, 10.0),
            Point::new(0.0, 0.0),
        ];

        let stitches = generate_spiral_fill(&[ring], 0.8, 2.5, 0.0);
        assert!(!stitches.is_empty());

        for stitch in &stitches {
            assert!(stitch.position.x >= -0.01 && stitch.position.x <= 20.01);
            assert!(stitch.position.y >= -0.01 && stitch.position.y <= 10.01);
        }
    }

    #[test]
    fn test_motif_fill_rectangle() {
        let ring = vec![
            Point::new(0.0, 0.0),
            Point::new(16.0, 0.0),
            Point::new(16.0, 12.0),
            Point::new(0.0, 12.0),
            Point::new(0.0, 0.0),
        ];

        let stitches =
            generate_motif_fill(&[ring], 0.6, 15.0, 2.0, 0.0, MotifPattern::Diamond, 1.0);
        assert!(!stitches.is_empty());
    }

    #[test]
    fn test_normalize_closed_rings_promotes_largest_outer() {
        let small = vec![
            Point::new(0.0, 0.0),
            Point::new(2.0, 0.0),
            Point::new(2.0, 2.0),
            Point::new(0.0, 2.0),
            Point::new(0.0, 0.0),
        ];
        let large = vec![
            Point::new(-10.0, -10.0),
            Point::new(10.0, -10.0),
            Point::new(10.0, 10.0),
            Point::new(-10.0, 10.0),
            Point::new(-10.0, -10.0),
        ];

        let normalized = normalize_closed_rings(&[small, large]);
        assert_eq!(normalized.len(), 2);

        let a0 = signed_area(&normalized[0]).abs();
        let a1 = signed_area(&normalized[1]).abs();
        assert!(a0 > a1, "largest ring should be treated as outer boundary");
    }
}
