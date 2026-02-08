//! SVG path import — parse SVG `d` attribute strings and SVG documents
//! into internal `VectorPath` representation.

use crate::Point;
use crate::path::{PathCommand, VectorPath};

/// Parse an SVG path `d` attribute string into a `VectorPath`.
///
/// Supports all standard SVG path commands: M/m, L/l, H/h, V/v, C/c, S/s,
/// Q/q, T/t, A/a, Z/z. Arc segments are approximated with cubic beziers.
pub fn parse_svg_path(d: &str) -> Result<VectorPath, String> {
    let mut commands: Vec<PathCommand> = Vec::new();

    // SimplifyingPathParser converts all commands to absolute coordinates
    // and simplifies to: MoveTo, LineTo, CurveTo, Quadratic, ClosePath
    for segment in svgtypes::SimplifyingPathParser::from(d) {
        let segment = segment.map_err(|e| format!("SVG path parse error: {e}"))?;

        match segment {
            svgtypes::SimplePathSegment::MoveTo { x, y } => {
                commands.push(PathCommand::MoveTo(Point::new(x, y)));
            }
            svgtypes::SimplePathSegment::LineTo { x, y } => {
                commands.push(PathCommand::LineTo(Point::new(x, y)));
            }
            svgtypes::SimplePathSegment::CurveTo {
                x1,
                y1,
                x2,
                y2,
                x,
                y,
            } => {
                commands.push(PathCommand::CubicTo {
                    c1: Point::new(x1, y1),
                    c2: Point::new(x2, y2),
                    end: Point::new(x, y),
                });
            }
            svgtypes::SimplePathSegment::Quadratic { x1, y1, x, y } => {
                commands.push(PathCommand::QuadTo {
                    ctrl: Point::new(x1, y1),
                    end: Point::new(x, y),
                });
            }
            svgtypes::SimplePathSegment::ClosePath => {
                commands.push(PathCommand::Close);
            }
        }
    }

    Ok(VectorPath::from_commands(commands))
}

/// Parse an SVG document and extract all `<path>` elements as `VectorPath`s.
///
/// Also extracts basic shapes (`<rect>`, `<circle>`, `<ellipse>`, `<line>`,
/// `<polyline>`, `<polygon>`) by converting them to path equivalents.
pub fn parse_svg_document(svg_content: &str) -> Result<Vec<VectorPath>, String> {
    let doc =
        roxmltree::Document::parse(svg_content).map_err(|e| format!("SVG parse error: {e}"))?;

    let mut paths = Vec::new();

    for node in doc.descendants() {
        match node.tag_name().name() {
            "path" => {
                if let Some(d) = node.attribute("d") {
                    match parse_svg_path(d) {
                        Ok(path) => paths.push(path),
                        Err(e) => log::warn!("Skipping invalid path: {e}"),
                    }
                }
            }
            "rect" => {
                if let Some(path) = parse_svg_rect(&node) {
                    paths.push(path);
                }
            }
            "circle" => {
                if let Some(path) = parse_svg_circle(&node) {
                    paths.push(path);
                }
            }
            "ellipse" => {
                if let Some(path) = parse_svg_ellipse(&node) {
                    paths.push(path);
                }
            }
            "line" => {
                if let Some(path) = parse_svg_line(&node) {
                    paths.push(path);
                }
            }
            "polyline" | "polygon" => {
                let is_polygon = node.tag_name().name() == "polygon";
                if let Some(path) = parse_svg_poly(&node, is_polygon) {
                    paths.push(path);
                }
            }
            _ => {}
        }
    }

    Ok(paths)
}

/// Parse a `<rect>` element into a `VectorPath`.
fn parse_svg_rect(node: &roxmltree::Node) -> Option<VectorPath> {
    let x = parse_attr(node, "x").unwrap_or(0.0);
    let y = parse_attr(node, "y").unwrap_or(0.0);
    let w = parse_attr(node, "width")?;
    let h = parse_attr(node, "height")?;
    let rx = parse_attr(node, "rx").unwrap_or(0.0).min(w / 2.0);
    let ry = parse_attr(node, "ry").unwrap_or(rx).min(h / 2.0);

    let mut path = VectorPath::new();

    if rx > 0.0 && ry > 0.0 {
        // Rounded rectangle
        let kx = rx * crate::constants::KAPPA;
        let ky = ry * crate::constants::KAPPA;

        path.move_to(Point::new(x + rx, y));
        path.line_to(Point::new(x + w - rx, y));
        path.cubic_to(
            Point::new(x + w - rx + kx, y),
            Point::new(x + w, y + ry - ky),
            Point::new(x + w, y + ry),
        );
        path.line_to(Point::new(x + w, y + h - ry));
        path.cubic_to(
            Point::new(x + w, y + h - ry + ky),
            Point::new(x + w - rx + kx, y + h),
            Point::new(x + w - rx, y + h),
        );
        path.line_to(Point::new(x + rx, y + h));
        path.cubic_to(
            Point::new(x + rx - kx, y + h),
            Point::new(x, y + h - ry + ky),
            Point::new(x, y + h - ry),
        );
        path.line_to(Point::new(x, y + ry));
        path.cubic_to(
            Point::new(x, y + ry - ky),
            Point::new(x + rx - kx, y),
            Point::new(x + rx, y),
        );
        path.close();
    } else {
        // Sharp rectangle
        path.move_to(Point::new(x, y));
        path.line_to(Point::new(x + w, y));
        path.line_to(Point::new(x + w, y + h));
        path.line_to(Point::new(x, y + h));
        path.close();
    }

    Some(path)
}

/// Parse a `<circle>` element into a `VectorPath`.
fn parse_svg_circle(node: &roxmltree::Node) -> Option<VectorPath> {
    let cx = parse_attr(node, "cx").unwrap_or(0.0);
    let cy = parse_attr(node, "cy").unwrap_or(0.0);
    let r = parse_attr(node, "r")?;

    Some(ellipse_to_path(cx, cy, r, r))
}

/// Parse an `<ellipse>` element into a `VectorPath`.
fn parse_svg_ellipse(node: &roxmltree::Node) -> Option<VectorPath> {
    let cx = parse_attr(node, "cx").unwrap_or(0.0);
    let cy = parse_attr(node, "cy").unwrap_or(0.0);
    let rx = parse_attr(node, "rx")?;
    let ry = parse_attr(node, "ry")?;

    Some(ellipse_to_path(cx, cy, rx, ry))
}

/// Convert an ellipse to a cubic bezier path (4-arc approximation).
fn ellipse_to_path(cx: f64, cy: f64, rx: f64, ry: f64) -> VectorPath {
    let kx = rx * crate::constants::KAPPA;
    let ky = ry * crate::constants::KAPPA;

    let mut path = VectorPath::new();
    // Start at top
    path.move_to(Point::new(cx, cy - ry));
    // Top-right quarter
    path.cubic_to(
        Point::new(cx + kx, cy - ry),
        Point::new(cx + rx, cy - ky),
        Point::new(cx + rx, cy),
    );
    // Bottom-right quarter
    path.cubic_to(
        Point::new(cx + rx, cy + ky),
        Point::new(cx + kx, cy + ry),
        Point::new(cx, cy + ry),
    );
    // Bottom-left quarter
    path.cubic_to(
        Point::new(cx - kx, cy + ry),
        Point::new(cx - rx, cy + ky),
        Point::new(cx - rx, cy),
    );
    // Top-left quarter
    path.cubic_to(
        Point::new(cx - rx, cy - ky),
        Point::new(cx - kx, cy - ry),
        Point::new(cx, cy - ry),
    );
    path.close();

    path
}

/// Parse a `<line>` element into a `VectorPath`.
fn parse_svg_line(node: &roxmltree::Node) -> Option<VectorPath> {
    let x1 = parse_attr(node, "x1").unwrap_or(0.0);
    let y1 = parse_attr(node, "y1").unwrap_or(0.0);
    let x2 = parse_attr(node, "x2").unwrap_or(0.0);
    let y2 = parse_attr(node, "y2").unwrap_or(0.0);

    let mut path = VectorPath::new();
    path.move_to(Point::new(x1, y1));
    path.line_to(Point::new(x2, y2));

    Some(path)
}

/// Parse a `<polyline>` or `<polygon>` element into a `VectorPath`.
fn parse_svg_poly(node: &roxmltree::Node, close: bool) -> Option<VectorPath> {
    let points_str = node.attribute("points")?;
    let numbers: Vec<f64> = points_str
        .split([',', ' ', '\t', '\n', '\r'])
        .filter(|s| !s.is_empty())
        .filter_map(|s| s.parse::<f64>().ok())
        .collect();

    if numbers.len() < 4 {
        return None;
    }

    let mut path = VectorPath::new();
    path.move_to(Point::new(numbers[0], numbers[1]));

    let mut i = 2;
    while i + 1 < numbers.len() {
        path.line_to(Point::new(numbers[i], numbers[i + 1]));
        i += 2;
    }

    if close {
        path.close();
    }

    Some(path)
}

/// Parse a numeric attribute from an SVG node.
fn parse_attr(node: &roxmltree::Node, name: &str) -> Option<f64> {
    node.attribute(name)?.parse::<f64>().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_svg_path_move_line() {
        let path = parse_svg_path("M 10 20 L 30 40 L 50 60").unwrap();
        assert_eq!(path.len(), 3);
        assert!(!path.is_closed());
    }

    #[test]
    fn test_parse_svg_path_closed() {
        let path = parse_svg_path("M 0 0 L 10 0 L 10 10 Z").unwrap();
        assert_eq!(path.len(), 4);
        assert!(path.is_closed());
    }

    #[test]
    fn test_parse_svg_path_cubic() {
        let path = parse_svg_path("M 0 0 C 5 10 15 10 20 0").unwrap();
        assert_eq!(path.len(), 2);

        let points = path.flatten(0.5);
        assert!(points.len() >= 2);
        assert!((points[0].x).abs() < 1e-10);
        let last = points.last().unwrap();
        assert!((last.x - 20.0).abs() < 1e-10);
    }

    #[test]
    fn test_parse_svg_path_quadratic() {
        let path = parse_svg_path("M 0 0 Q 5 10 10 0").unwrap();
        assert_eq!(path.len(), 2);
    }

    #[test]
    fn test_parse_svg_path_relative() {
        let path = parse_svg_path("m 10 20 l 5 5 l 5 -5").unwrap();
        assert_eq!(path.len(), 3);

        let points = path.flatten(0.5);
        // m 10 20 -> (10,20), l 5 5 -> (15,25), l 5 -5 -> (20,20)
        assert!((points[0].x - 10.0).abs() < 1e-10);
        assert!((points[0].y - 20.0).abs() < 1e-10);
        assert!((points[2].x - 20.0).abs() < 1e-10);
        assert!((points[2].y - 20.0).abs() < 1e-10);
    }

    #[test]
    fn test_parse_svg_path_horizontal_vertical() {
        let path = parse_svg_path("M 0 0 H 10 V 10 H 0 Z").unwrap();
        assert!(path.is_closed());

        let bbox = path.bounding_box();
        assert!((bbox.min_x).abs() < 1e-10);
        assert!((bbox.min_y).abs() < 1e-10);
        assert!((bbox.max_x - 10.0).abs() < 1e-10);
        assert!((bbox.max_y - 10.0).abs() < 1e-10);
    }

    #[test]
    fn test_parse_svg_path_empty() {
        let path = parse_svg_path("").unwrap();
        assert!(path.is_empty());
    }

    #[test]
    fn test_parse_svg_path_complex() {
        // Real-world SVG path fragment
        let path = parse_svg_path("M10-20A5.5.3-4 1 1 0-.1").unwrap();
        assert!(!path.is_empty());
    }

    #[test]
    fn test_parse_svg_document_paths() {
        let svg = r#"<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M 10 10 L 90 10 L 90 90 Z"/>
  <path d="M 20 20 L 80 20"/>
</svg>"#;

        let paths = parse_svg_document(svg).unwrap();
        assert_eq!(paths.len(), 2);
        assert!(paths[0].is_closed());
        assert!(!paths[1].is_closed());
    }

    #[test]
    fn test_parse_svg_document_rect() {
        let svg = r#"<svg xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="20" width="50" height="30"/>
</svg>"#;

        let paths = parse_svg_document(svg).unwrap();
        assert_eq!(paths.len(), 1);
        assert!(paths[0].is_closed());

        let bbox = paths[0].bounding_box();
        assert!((bbox.min_x - 10.0).abs() < 1e-10);
        assert!((bbox.min_y - 20.0).abs() < 1e-10);
        assert!((bbox.max_x - 60.0).abs() < 1e-10);
        assert!((bbox.max_y - 50.0).abs() < 1e-10);
    }

    #[test]
    fn test_parse_svg_document_circle() {
        let svg = r#"<svg xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="25"/>
</svg>"#;

        let paths = parse_svg_document(svg).unwrap();
        assert_eq!(paths.len(), 1);
        assert!(paths[0].is_closed());

        let bbox = paths[0].bounding_box();
        assert!((bbox.min_x - 25.0).abs() < 1.0);
        assert!((bbox.max_x - 75.0).abs() < 1.0);
    }

    #[test]
    fn test_parse_svg_document_polygon() {
        let svg = r#"<svg xmlns="http://www.w3.org/2000/svg">
  <polygon points="50,0 100,100 0,100"/>
</svg>"#;

        let paths = parse_svg_document(svg).unwrap();
        assert_eq!(paths.len(), 1);
        assert!(paths[0].is_closed());
    }

    #[test]
    fn test_parse_svg_document_mixed() {
        let svg = r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect width="100" height="100"/>
  <circle cx="150" cy="50" r="40"/>
  <ellipse cx="50" cy="150" rx="30" ry="20"/>
  <line x1="0" y1="0" x2="200" y2="200"/>
  <polyline points="10,10 50,50 90,10"/>
</svg>"#;

        let paths = parse_svg_document(svg).unwrap();
        assert_eq!(paths.len(), 5);
    }

    #[test]
    fn test_parse_svg_path_error() {
        // Invalid path data should return error
        let result = parse_svg_path("X invalid");
        assert!(result.is_err());
    }
}
