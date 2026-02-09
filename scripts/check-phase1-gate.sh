#!/usr/bin/env bash
set -euo pipefail

stitch_length="${1:-2.5}"

scripts/check-phase1-parity.sh "$stitch_length"

(
  cd apps/web
  bunx playwright test e2e/visual.spec.ts
)

echo "Phase 1 dual gate passed (metrics + visuals)."
