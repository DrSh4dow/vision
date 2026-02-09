#!/usr/bin/env bash
set -euo pipefail

echo "[gate] rust fmt/clippy/tests"
cargo fmt --all --check --manifest-path crates/Cargo.toml
cargo clippy --workspace --manifest-path crates/Cargo.toml -- -D warnings
cargo test --workspace --manifest-path crates/Cargo.toml

echo "[gate] wasm parity + metric thresholds + visual snapshots"
scripts/check-phase1-gate.sh

echo "[gate] web static checks + build + e2e"
bunx biome check
bunx tsc --noEmit --project apps/web
(
  cd apps/web
  bunx vite build
  bunx playwright test e2e/app.spec.ts
  bunx playwright test e2e/visual.spec.ts
)

echo "Production gate passed."
