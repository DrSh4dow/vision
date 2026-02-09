#!/usr/bin/env bash
set -euo pipefail

vision_dir="${1:-crates/engine/fixtures/parity/metrics/vision}"
inkstitch_dir="${2:-crates/engine/fixtures/parity/baselines/inkstitch}"

python scripts/compare_parity.py \
  --vision-dir "$vision_dir" \
  --inkstitch-dir "$inkstitch_dir"
