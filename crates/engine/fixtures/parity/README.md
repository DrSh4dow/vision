# Parity Fixtures

This directory stores fixture inputs and metric baselines for quality parity benchmarking.

## Layout

- `designs/*.export_design.json`
  - Vision-compatible `ExportDesign` JSON fixture used to compute quality metrics.
- `running_paths/*.running_path.json`
  - Algorithm-driven running-stitch fixtures (`points` polyline) used to benchmark stitch generation behavior.
- `baselines/inkstitch/*.metrics.json`
  - Ink/Stitch reference quality metrics for the same fixture filename stem.

## Workflow

1. Generate/refresh Vision metrics:
   - `scripts/gen-vision-parity-metrics.sh`
2. Generate Ink/Stitch baselines from embroidery files:
   - `scripts/gen-inkstitch-baseline.sh <inkstitch-output-dir> crates/engine/fixtures/parity/baselines/inkstitch`
3. Compare:
   - `scripts/compare-parity.sh`

If Ink/Stitch runtime dependencies are unavailable offline, keep baselines committed and regenerate from local reference outputs once dependencies are restored.

Ink/Stitch reference location for algorithm inspiration: `../inkstitch`.
