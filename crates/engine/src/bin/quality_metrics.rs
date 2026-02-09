use std::env;
use std::fs;
use std::process::ExitCode;

use vision_engine::export_pipeline::{compute_quality_metrics, compute_route_metrics};
use vision_engine::format::ExportDesign;

#[derive(serde::Serialize)]
struct QualityMetricsOutput {
    route: vision_engine::export_pipeline::RouteMetrics,
    quality: vision_engine::export_pipeline::QualityMetrics,
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("{message}");
            ExitCode::from(1)
        }
    }
}

fn run() -> Result<(), String> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        return Err(
            "Usage: quality_metrics --input <export_design.json> [--stitch-length <mm>]"
                .to_string(),
        );
    }

    let mut input_path: Option<String> = None;
    let mut stitch_length = 2.5_f64;
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--input" => {
                i += 1;
                let value = args
                    .get(i)
                    .ok_or_else(|| "--input requires a value".to_string())?;
                input_path = Some(value.clone());
            }
            "--stitch-length" => {
                i += 1;
                let value = args
                    .get(i)
                    .ok_or_else(|| "--stitch-length requires a value".to_string())?;
                stitch_length = value
                    .parse::<f64>()
                    .map_err(|e| format!("Invalid --stitch-length value '{value}': {e}"))?;
            }
            _ => {}
        }
        i += 1;
    }

    let input_path = input_path.ok_or_else(|| "Missing required --input argument".to_string())?;
    let content = fs::read_to_string(&input_path)
        .map_err(|e| format!("Failed reading '{input_path}': {e}"))?;
    let design: ExportDesign =
        serde_json::from_str(&content).map_err(|e| format!("Invalid ExportDesign JSON: {e}"))?;

    let output = QualityMetricsOutput {
        route: compute_route_metrics(&design),
        quality: compute_quality_metrics(&design, stitch_length),
    };
    let json = serde_json::to_string_pretty(&output)
        .map_err(|e| format!("Failed to serialize metrics output: {e}"))?;
    println!("{json}");
    Ok(())
}
