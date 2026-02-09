#!/usr/bin/env bash
set -euo pipefail

stitch_length="${1:-2.5}"

scripts/gen-vision-parity-metrics.sh \
  "crates/engine/fixtures/parity/designs" \
  "crates/engine/fixtures/parity/metrics/vision" \
  "$stitch_length"

scripts/compare-parity.sh \
  "crates/engine/fixtures/parity/metrics/vision" \
  "crates/engine/fixtures/parity/baselines/inkstitch"
