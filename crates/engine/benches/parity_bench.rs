use std::fs;
use std::path::{Path, PathBuf};

use criterion::{BenchmarkId, Criterion, black_box, criterion_group, criterion_main};
use vision_engine::export_pipeline::{QualityMetrics, compute_quality_metrics};
use vision_engine::format::ExportDesign;

const FIXTURE_ROOT: &str = "fixtures/parity";
const DEFAULT_STITCH_LENGTH_MM: f64 = 2.5;

fn load_design(path: &Path) -> Option<ExportDesign> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str::<ExportDesign>(&content).ok()
}

fn load_baseline_quality(path: &Path) -> Option<QualityMetrics> {
    let content = fs::read_to_string(path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    if let Some(quality) = json.get("quality") {
        return serde_json::from_value(quality.clone()).ok();
    }
    serde_json::from_value(json).ok()
}

fn collect_design_fixtures() -> Vec<PathBuf> {
    let mut fixtures = Vec::new();
    let root = Path::new(FIXTURE_ROOT).join("designs");
    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) == Some("json") {
                fixtures.push(path);
            }
        }
    }
    fixtures.sort();
    fixtures
}

fn bench_quality_metrics(c: &mut Criterion) {
    let fixtures = collect_design_fixtures();
    if fixtures.is_empty() {
        return;
    }

    let mut group = c.benchmark_group("parity_quality_metrics");
    for fixture_path in fixtures {
        let Some(design) = load_design(&fixture_path) else {
            continue;
        };
        let Some(name) = fixture_path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };

        group.bench_with_input(BenchmarkId::from_parameter(name), &design, |b, design| {
            b.iter(|| {
                let metrics = compute_quality_metrics(black_box(design), DEFAULT_STITCH_LENGTH_MM);
                black_box(metrics.route_score + metrics.density_error_mm + metrics.angle_error_deg)
            });
        });
    }
    group.finish();
}

fn bench_inkstitch_delta(c: &mut Criterion) {
    let fixtures = collect_design_fixtures();
    if fixtures.is_empty() {
        return;
    }

    let mut group = c.benchmark_group("parity_inkstitch_delta");
    for fixture_path in fixtures {
        let Some(design) = load_design(&fixture_path) else {
            continue;
        };
        let Some(file_name) = fixture_path.file_name().and_then(|s| s.to_str()) else {
            continue;
        };
        let baseline_name = file_name.replace(".export_design.json", ".metrics.json");
        let baseline_path = Path::new(FIXTURE_ROOT)
            .join("baselines")
            .join("inkstitch")
            .join(&baseline_name);
        let Some(inkstitch_quality) = load_baseline_quality(&baseline_path) else {
            continue;
        };

        let Some(name) = fixture_path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };

        group.bench_with_input(
            BenchmarkId::from_parameter(name),
            &(design, inkstitch_quality),
            |b, (design, inkstitch)| {
                b.iter(|| {
                    let vision =
                        compute_quality_metrics(black_box(design), DEFAULT_STITCH_LENGTH_MM);
                    let delta = (vision.stitch_count as f64 - inkstitch.stitch_count as f64).abs()
                        + (vision.jump_count as f64 - inkstitch.jump_count as f64).abs()
                        + (vision.trim_count as f64 - inkstitch.trim_count as f64).abs()
                        + (vision.travel_distance_mm - inkstitch.travel_distance_mm).abs()
                        + (vision.density_error_mm - inkstitch.density_error_mm).abs()
                        + (vision.angle_error_deg - inkstitch.angle_error_deg).abs();
                    black_box(delta)
                });
            },
        );
    }
    group.finish();
}

criterion_group!(benches, bench_quality_metrics, bench_inkstitch_delta);
criterion_main!(benches);
