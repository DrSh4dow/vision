#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <inkstitch_embroidery_dir> <output_metrics_dir> [stitch_length_mm]" >&2
  exit 1
fi

input_dir="$1"
output_dir="$2"
stitch_length="${3:-2.5}"

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

mkdir -p "$output_dir"

shopt -s nullglob
files=(
  "$input_dir"/*.dst
  "$input_dir"/*.pes
  "$input_dir"/*.jef
  "$input_dir"/*.exp
  "$input_dir"/*.vp3
  "$input_dir"/*.hus
  "$input_dir"/*.xxx
  "$input_dir"/*.pec
)
shopt -u nullglob

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No embroidery files found in $input_dir" >&2
  exit 1
fi

for file in "${files[@]}"; do
  stem="$(basename "$file")"
  stem="${stem%.*}"
  design_json="$tmp_dir/$stem.export_design.json"
  out_json="$output_dir/$stem.metrics.json"

  python scripts/inkstitch_to_export_design.py \
    --input "$file" \
    --output "$design_json"

  cargo run --manifest-path crates/Cargo.toml -p vision-engine --bin quality_metrics -- \
    --input "$design_json" \
    --stitch-length "$stitch_length" \
    > "$out_json"

  echo "inkstitch baseline -> $out_json"
done
