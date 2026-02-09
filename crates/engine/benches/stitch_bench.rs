use criterion::{BenchmarkId, Criterion, Throughput, black_box, criterion_group, criterion_main};
use vision_engine::export_pipeline::{
    RoutingOptions, compute_route_metrics, scene_to_export_design_with_routing,
};
use vision_engine::path::VectorPath;
use vision_engine::scene::{NodeKind, Scene};
use vision_engine::shapes::{RectShape, ShapeData};
use vision_engine::{Color, Point, StitchParams, StitchType};

const STITCH_LENGTH_MM: f64 = 0.5;
const SEGMENT_LENGTH_MM: f64 = 100.0;

fn build_running_scene(target_stitches: usize) -> Scene {
    let mut scene = Scene::new();
    let path = make_long_polyline(target_stitches as f64 * STITCH_LENGTH_MM, SEGMENT_LENGTH_MM);
    let kind = NodeKind::Shape {
        shape: ShapeData::Path(path),
        fill: None,
        stroke: Some(Color::new(12, 146, 255, 255)),
        stroke_width: 0.4,
        stitch: StitchParams::default(),
    };

    scene
        .add_node("Bench Path", kind, None)
        .expect("valid bench node");
    scene
}

fn build_rect_scene(stitch_type: StitchType) -> Scene {
    let mut scene = Scene::new();
    let mut stitch = StitchParams::default();
    stitch.stitch_type = stitch_type;

    let kind = NodeKind::Shape {
        shape: ShapeData::Rect(RectShape::new(120.0, 70.0, 0.0)),
        fill: Some(Color::new(226, 56, 105, 255)),
        stroke: Some(Color::new(12, 146, 255, 255)),
        stroke_width: 0.4,
        stitch,
    };

    scene
        .add_node("Bench Rect", kind, None)
        .expect("valid bench node");
    scene
}

fn make_long_polyline(total_length_mm: f64, segment_length_mm: f64) -> VectorPath {
    let mut path = VectorPath::new();
    path.move_to(Point::new(0.0, 0.0));

    if total_length_mm <= 0.0 {
        path.line_to(Point::new(segment_length_mm, 0.0));
        return path;
    }

    let mut remaining = total_length_mm;
    let mut x = 0.0;
    let mut y = 0.0;
    let mut direction = 1.0;
    while remaining > 0.0 {
        let len = remaining.min(segment_length_mm);
        x += direction * len;
        path.line_to(Point::new(x, y));
        remaining -= len;
        if remaining > 0.0 {
            y += 1.0;
            path.line_to(Point::new(x, y));
            direction = -direction;
        }
    }

    path
}

fn bench_scene_export_generation(c: &mut Criterion) {
    let mut group = c.benchmark_group("scene_export_generation");

    for stitches in [10_000_usize, 50_000, 100_000] {
        let scene = build_running_scene(stitches);
        group.throughput(Throughput::Elements(stitches as u64));
        group.bench_with_input(BenchmarkId::from_parameter(stitches), &scene, |b, scene| {
            b.iter(|| {
                let design = scene_to_export_design_with_routing(
                    scene,
                    black_box(STITCH_LENGTH_MM),
                    black_box(RoutingOptions::default()),
                )
                .expect("scene export succeeds");
                black_box(design.stitches.len())
            });
        });
    }

    group.finish();
}

fn bench_route_metrics(c: &mut Criterion) {
    let mut group = c.benchmark_group("route_metrics");
    for stitches in [10_000_usize, 50_000, 100_000] {
        let scene = build_running_scene(stitches);
        let design = scene_to_export_design_with_routing(
            &scene,
            STITCH_LENGTH_MM,
            RoutingOptions::default(),
        )
        .expect("scene export succeeds");
        group.throughput(Throughput::Elements(design.stitches.len() as u64));
        group.bench_with_input(
            BenchmarkId::from_parameter(stitches),
            &design,
            |b, design| {
                b.iter(|| {
                    let metrics = compute_route_metrics(black_box(design));
                    black_box(metrics.route_score)
                });
            },
        );
    }
    group.finish();
}

fn bench_stitch_type_generation(c: &mut Criterion) {
    let mut group = c.benchmark_group("stitch_type_generation");
    let stitch_types = [
        StitchType::Running,
        StitchType::Satin,
        StitchType::Tatami,
        StitchType::Contour,
        StitchType::Spiral,
        StitchType::Motif,
    ];

    for stitch_type in stitch_types {
        let scene = build_rect_scene(stitch_type);
        group.bench_with_input(
            BenchmarkId::from_parameter(format!("{stitch_type:?}").to_lowercase()),
            &scene,
            |b, scene| {
                b.iter(|| {
                    let design = scene_to_export_design_with_routing(
                        scene,
                        black_box(STITCH_LENGTH_MM),
                        black_box(RoutingOptions::default()),
                    )
                    .expect("scene export succeeds");
                    black_box(design.stitches.len())
                });
            },
        );
    }

    group.finish();
}

criterion_group!(
    benches,
    bench_scene_export_generation,
    bench_route_metrics,
    bench_stitch_type_generation
);
criterion_main!(benches);
