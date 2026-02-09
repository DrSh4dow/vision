#!/usr/bin/env bash
set -euo pipefail

design_dir="${1:-crates/engine/fixtures/parity/designs}"
output_dir="${2:-crates/engine/fixtures/parity/metrics/vision}"
stitch_length="${3:-2.5}"
running_dir="${4:-crates/engine/fixtures/parity/running_paths}"

mkdir -p "$output_dir"

shopt -s nullglob
files=("$design_dir"/*.export_design.json)
running_files=("$running_dir"/*.running_path.json)
shopt -u nullglob

if [[ ${#files[@]} -eq 0 && ${#running_files[@]} -eq 0 ]]; then
  echo "No parity fixtures found in $design_dir or $running_dir" >&2
  exit 1
fi

for fixture in "${files[@]}"; do
  name="$(basename "$fixture" .export_design.json)"
  out="$output_dir/$name.metrics.json"
  cargo run --manifest-path crates/Cargo.toml -p vision-engine --bin quality_metrics -- \
    --input "$fixture" \
    --stitch-length "$stitch_length" \
    > "$out"
  echo "vision metrics -> $out"
done

for fixture in "${running_files[@]}"; do
  name="$(basename "$fixture" .running_path.json)"
  out="$output_dir/$name.metrics.json"
  cargo run --manifest-path crates/Cargo.toml -p vision-engine --bin running_quality_metrics -- \
    --input "$fixture" \
    --stitch-length "$stitch_length" \
    > "$out"
  echo "vision metrics -> $out"
done
