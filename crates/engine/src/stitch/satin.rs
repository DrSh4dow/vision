//! Satin stitch generation — two-rail sweep with underlay and pull compensation.
//!
//! Produces zig-zag stitches between two guide rails, with optional underlay
//! stitches for stabilization and pull compensation for fabric distortion.

use crate::{Point, Stitch};

/// Configuration for underlay stitches beneath satin columns.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UnderlayConfig {
    /// Center-walk underlay: running stitch along the midpoint between rails.
    /// Best for narrow columns (< 3mm width).
    pub center_walk: bool,
    /// Edge-walk underlay: running stitch along each rail edge.
    /// Best for wide columns (> 3mm width).
    pub edge_walk: bool,
    /// Zigzag underlay: low-density zigzag perpendicular to stitch direction.
    /// Best for very wide columns (> 4mm).
    pub zigzag: bool,
    /// Spacing for zigzag underlay stitches in mm (default: 2.0).
    pub zigzag_spacing: f64,
    /// Underlay stitch length in mm (default: 2.5).
    pub stitch_length: f64,
}

impl Default for UnderlayConfig {
    fn default() -> Self {
        Self {
            center_walk: true,
            edge_walk: false,
            zigzag: false,
            zigzag_spacing: 2.0,
            stitch_length: 2.5,
        }
    }
}

/// Result of satin stitch generation, including underlay and top stitches.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SatinResult {
    /// All stitches in order (underlay first, then top stitches).
    pub stitches: Vec<Stitch>,
    /// Number of underlay stitches at the start of the stitches vec.
    pub underlay_count: usize,
}

/// Generate satin stitches between two guide rails.
///
/// # Arguments
/// * `rail1` - First guide rail as a list of points
/// * `rail2` - Second guide rail as a list of points
/// * `density` - Stitch spacing along rails in mm (typically 0.3-0.5)
/// * `pull_compensation` - Extra width per side in mm (typically 0.1-0.3)
/// * `underlay` - Underlay configuration
///
/// # Returns
/// A `SatinResult` containing all stitches in sewing order.
pub fn generate_satin_stitches(
    rail1: &[Point],
    rail2: &[Point],
    density: f64,
    pull_compensation: f64,
    underlay: &UnderlayConfig,
) -> SatinResult {
    if rail1.len() < 2 || rail2.len() < 2 {
        return SatinResult {
            stitches: vec![],
            underlay_count: 0,
        };
    }

    let density = density.max(crate::constants::MIN_SATIN_DENSITY);

    // Step 1: Parameterize both rails by arc length
    let params1 = parameterize_by_arc_length(rail1);
    let params2 = parameterize_by_arc_length(rail2);

    let total_len1 = params1[params1.len() - 1];
    let total_len2 = params2[params2.len() - 1];

    // Use the longer rail to determine sample count
    let max_len = total_len1.max(total_len2);
    let sample_count = (max_len / density).ceil() as usize;
    let sample_count = sample_count.max(2);

    // Step 2: Sample both rails at uniform intervals, creating matched pairs
    let mut pairs: Vec<(Point, Point)> = Vec::with_capacity(sample_count);

    for i in 0..sample_count {
        let t = i as f64 / (sample_count - 1) as f64;
        let p1 = sample_at_parameter(rail1, &params1, t * total_len1);
        let p2 = sample_at_parameter(rail2, &params2, t * total_len2);
        pairs.push((p1, p2));
    }

    // Step 3: Apply pull compensation — extend endpoints outward
    let compensated_pairs: Vec<(Point, Point)> = if pull_compensation > 0.0 {
        pairs
            .iter()
            .map(|(p1, p2)| {
                let dx = p2.x - p1.x;
                let dy = p2.y - p1.y;
                let len = (dx * dx + dy * dy).sqrt();
                if len < f64::EPSILON {
                    (*p1, *p2)
                } else {
                    let nx = dx / len;
                    let ny = dy / len;
                    let comp_p1 =
                        Point::new(p1.x - nx * pull_compensation, p1.y - ny * pull_compensation);
                    let comp_p2 =
                        Point::new(p2.x + nx * pull_compensation, p2.y + ny * pull_compensation);
                    (comp_p1, comp_p2)
                }
            })
            .collect()
    } else {
        pairs.clone()
    };

    let mut all_stitches: Vec<Stitch> = Vec::new();
    let mut underlay_count = 0;

    // Step 4: Generate underlay stitches (before top stitches)
    if underlay.center_walk {
        let center_points: Vec<Point> = pairs
            .iter()
            .map(|(p1, p2)| Point::new((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5))
            .collect();

        let center_stitches =
            super::running::generate_running_stitches(&center_points, underlay.stitch_length);
        underlay_count += center_stitches.len();
        all_stitches.extend(center_stitches);

        // Add trim between underlay sections
        if let Some(last) = all_stitches.last_mut() {
            last.is_trim = true;
        }
    }

    if underlay.edge_walk {
        // Edge-walk along rail1
        let rail1_points: Vec<Point> = pairs.iter().map(|(p1, _)| *p1).collect();
        let edge1_stitches =
            super::running::generate_running_stitches(&rail1_points, underlay.stitch_length);
        underlay_count += edge1_stitches.len();
        all_stitches.extend(edge1_stitches);

        if let Some(last) = all_stitches.last_mut() {
            last.is_trim = true;
        }

        // Edge-walk along rail2
        let rail2_points: Vec<Point> = pairs.iter().map(|(_, p2)| *p2).collect();
        let edge2_stitches =
            super::running::generate_running_stitches(&rail2_points, underlay.stitch_length);
        underlay_count += edge2_stitches.len();
        all_stitches.extend(edge2_stitches);

        if let Some(last) = all_stitches.last_mut() {
            last.is_trim = true;
        }
    }

    if underlay.zigzag {
        let zigzag_step = (underlay.zigzag_spacing / density).max(1.0).ceil() as usize;
        let mut side = false;

        let mut i = 0;
        while i < pairs.len() {
            let (p1, p2) = &pairs[i];
            let stitch_pos = if side { *p2 } else { *p1 };
            all_stitches.push(Stitch {
                position: stitch_pos,
                is_jump: false,
                is_trim: false,
            });
            underlay_count += 1;
            side = !side;
            i += zigzag_step;
        }

        if let Some(last) = all_stitches.last_mut() {
            last.is_trim = true;
        }
    }

    // Step 5: Generate top satin stitches (zig-zag between rails)
    // Add a jump stitch to get from underlay end to satin start if we have underlay
    if underlay_count > 0 && !compensated_pairs.is_empty() {
        all_stitches.push(Stitch {
            position: compensated_pairs[0].0,
            is_jump: true,
            is_trim: false,
        });
    }

    for (i, (p1, p2)) in compensated_pairs.iter().enumerate() {
        // Alternate between rail1 and rail2 for zig-zag pattern
        if i % 2 == 0 {
            all_stitches.push(Stitch {
                position: *p1,
                is_jump: false,
                is_trim: false,
            });
            all_stitches.push(Stitch {
                position: *p2,
                is_jump: false,
                is_trim: false,
            });
        } else {
            all_stitches.push(Stitch {
                position: *p2,
                is_jump: false,
                is_trim: false,
            });
            all_stitches.push(Stitch {
                position: *p1,
                is_jump: false,
                is_trim: false,
            });
        }
    }

    SatinResult {
        stitches: all_stitches,
        underlay_count,
    }
}

/// WASM-friendly wrapper: generate satin stitches from flat coordinate arrays.
pub fn generate_satin_stitches_flat(
    rail1_flat: &[f64],
    rail2_flat: &[f64],
    density: f64,
    pull_compensation: f64,
    underlay: &UnderlayConfig,
) -> SatinResult {
    let rail1 = flat_to_points(rail1_flat);
    let rail2 = flat_to_points(rail2_flat);
    generate_satin_stitches(&rail1, &rail2, density, pull_compensation, underlay)
}

/// Convert a flat coordinate array to a list of Points.
fn flat_to_points(flat: &[f64]) -> Vec<Point> {
    let count = flat.len() / 2;
    (0..count)
        .map(|i| Point::new(flat[i * 2], flat[i * 2 + 1]))
        .collect()
}

/// Compute cumulative arc length parameters for a polyline.
fn parameterize_by_arc_length(points: &[Point]) -> Vec<f64> {
    let mut params = Vec::with_capacity(points.len());
    params.push(0.0);

    for i in 1..points.len() {
        let dx = points[i].x - points[i - 1].x;
        let dy = points[i].y - points[i - 1].y;
        let seg_len = (dx * dx + dy * dy).sqrt();
        params.push(params[i - 1] + seg_len);
    }

    params
}

/// Sample a point along a polyline at a given arc-length parameter.
fn sample_at_parameter(points: &[Point], params: &[f64], target: f64) -> Point {
    let total = params[params.len() - 1];
    let target = target.clamp(0.0, total);

    // Find the segment containing this parameter value
    for i in 1..params.len() {
        if params[i] >= target {
            let seg_start = params[i - 1];
            let seg_len = params[i] - seg_start;

            if seg_len < f64::EPSILON {
                return points[i - 1];
            }

            let t = (target - seg_start) / seg_len;
            return Point::new(
                points[i - 1].x + (points[i].x - points[i - 1].x) * t,
                points[i - 1].y + (points[i].y - points[i - 1].y) * t,
            );
        }
    }

    points[points.len() - 1]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn straight_rails() -> (Vec<Point>, Vec<Point>) {
        // Two parallel horizontal lines, 10mm apart, 20mm long
        let rail1 = vec![Point::new(0.0, 0.0), Point::new(20.0, 0.0)];
        let rail2 = vec![Point::new(0.0, 10.0), Point::new(20.0, 10.0)];
        (rail1, rail2)
    }

    #[test]
    fn test_satin_basic_parallel_rails() {
        let (rail1, rail2) = straight_rails();
        let config = UnderlayConfig {
            center_walk: false,
            edge_walk: false,
            zigzag: false,
            ..Default::default()
        };

        let result = generate_satin_stitches(&rail1, &rail2, 0.5, 0.0, &config);

        assert!(!result.stitches.is_empty());
        assert_eq!(result.underlay_count, 0);

        // All stitches should alternate between y~0 and y~10
        for (i, s) in result.stitches.iter().enumerate() {
            if i % 2 == 0 {
                // Should be near one rail
                assert!(s.position.y < 1.0 || s.position.y > 9.0);
            }
        }
    }

    #[test]
    fn test_satin_with_pull_compensation() {
        let (rail1, rail2) = straight_rails();
        let config = UnderlayConfig {
            center_walk: false,
            edge_walk: false,
            zigzag: false,
            ..Default::default()
        };

        let result_no_comp = generate_satin_stitches(&rail1, &rail2, 1.0, 0.0, &config);
        let result_comp = generate_satin_stitches(&rail1, &rail2, 1.0, 0.5, &config);

        // With compensation, stitches should extend beyond the rails
        let has_beyond = result_comp.stitches.iter().any(|s| s.position.y < -0.1);
        let no_comp_beyond = result_no_comp.stitches.iter().any(|s| s.position.y < -0.1);

        assert!(has_beyond, "Pull compensation should extend beyond rail");
        assert!(
            !no_comp_beyond,
            "Without compensation, no stitch should go beyond rail"
        );
    }

    #[test]
    fn test_satin_center_walk_underlay() {
        let (rail1, rail2) = straight_rails();
        let config = UnderlayConfig {
            center_walk: true,
            edge_walk: false,
            zigzag: false,
            stitch_length: 2.5,
            ..Default::default()
        };

        let result = generate_satin_stitches(&rail1, &rail2, 0.5, 0.0, &config);

        assert!(result.underlay_count > 0);
        // Center-walk stitches should be near y=5 (midpoint)
        for s in &result.stitches[..result.underlay_count] {
            assert!(
                (s.position.y - 5.0).abs() < 1.5,
                "Center walk should be near midpoint, got y={}",
                s.position.y
            );
        }
    }

    #[test]
    fn test_satin_edge_walk_underlay() {
        let (rail1, rail2) = straight_rails();
        let config = UnderlayConfig {
            center_walk: false,
            edge_walk: true,
            zigzag: false,
            stitch_length: 2.5,
            ..Default::default()
        };

        let result = generate_satin_stitches(&rail1, &rail2, 0.5, 0.0, &config);

        assert!(result.underlay_count > 0);
        // Edge walk should have stitches near y=0 and y=10
        let has_top = result.stitches[..result.underlay_count]
            .iter()
            .any(|s| s.position.y < 1.0);
        let has_bottom = result.stitches[..result.underlay_count]
            .iter()
            .any(|s| s.position.y > 9.0);
        assert!(has_top, "Edge walk should include rail1 stitches");
        assert!(has_bottom, "Edge walk should include rail2 stitches");
    }

    #[test]
    fn test_satin_zigzag_underlay() {
        let (rail1, rail2) = straight_rails();
        let config = UnderlayConfig {
            center_walk: false,
            edge_walk: false,
            zigzag: true,
            zigzag_spacing: 2.0,
            stitch_length: 2.5,
        };

        let result = generate_satin_stitches(&rail1, &rail2, 0.5, 0.0, &config);

        assert!(result.underlay_count > 0);
    }

    #[test]
    fn test_satin_too_few_points() {
        let rail1 = vec![Point::new(0.0, 0.0)];
        let rail2 = vec![Point::new(0.0, 10.0), Point::new(20.0, 10.0)];
        let config = UnderlayConfig::default();

        let result = generate_satin_stitches(&rail1, &rail2, 0.5, 0.0, &config);
        assert!(result.stitches.is_empty());
    }

    #[test]
    fn test_satin_curved_rails() {
        // Two curved rails with varying width
        let rail1 = vec![
            Point::new(0.0, 0.0),
            Point::new(10.0, 2.0),
            Point::new(20.0, 0.0),
        ];
        let rail2 = vec![
            Point::new(0.0, 5.0),
            Point::new(10.0, 8.0),
            Point::new(20.0, 5.0),
        ];
        let config = UnderlayConfig {
            center_walk: false,
            edge_walk: false,
            zigzag: false,
            ..Default::default()
        };

        let result = generate_satin_stitches(&rail1, &rail2, 0.5, 0.0, &config);
        assert!(!result.stitches.is_empty());
    }

    #[test]
    fn test_satin_flat_wrapper() {
        let rail1 = [0.0, 0.0, 20.0, 0.0];
        let rail2 = [0.0, 10.0, 20.0, 10.0];
        let config = UnderlayConfig::default();

        let result = generate_satin_stitches_flat(&rail1, &rail2, 0.5, 0.0, &config);
        assert!(!result.stitches.is_empty());
    }

    #[test]
    fn test_parameterize_arc_length() {
        let points = vec![
            Point::new(0.0, 0.0),
            Point::new(3.0, 4.0),
            Point::new(6.0, 0.0),
        ];
        let params = parameterize_by_arc_length(&points);

        assert_eq!(params.len(), 3);
        assert_eq!(params[0], 0.0);
        assert!((params[1] - 5.0).abs() < 1e-10); // 3-4-5 triangle
        assert!((params[2] - 10.0).abs() < 1e-10);
    }

    #[test]
    fn test_sample_at_parameter() {
        let points = vec![Point::new(0.0, 0.0), Point::new(10.0, 0.0)];
        let params = parameterize_by_arc_length(&points);

        let mid = sample_at_parameter(&points, &params, 5.0);
        assert!((mid.x - 5.0).abs() < 1e-10);
        assert!((mid.y).abs() < 1e-10);
    }

    #[test]
    fn test_satin_all_underlay_types() {
        let (rail1, rail2) = straight_rails();
        let config = UnderlayConfig {
            center_walk: true,
            edge_walk: true,
            zigzag: true,
            zigzag_spacing: 2.0,
            stitch_length: 2.5,
        };

        let result = generate_satin_stitches(&rail1, &rail2, 0.5, 0.0, &config);

        assert!(result.underlay_count > 0);
        assert!(result.stitches.len() > result.underlay_count);
    }

    #[test]
    fn test_satin_density_affects_count() {
        let (rail1, rail2) = straight_rails();
        let config = UnderlayConfig {
            center_walk: false,
            edge_walk: false,
            zigzag: false,
            ..Default::default()
        };

        let result_fine = generate_satin_stitches(&rail1, &rail2, 0.3, 0.0, &config);
        let result_coarse = generate_satin_stitches(&rail1, &rail2, 1.0, 0.0, &config);

        assert!(
            result_fine.stitches.len() > result_coarse.stitches.len(),
            "Finer density should produce more stitches"
        );
    }
}
