#!/usr/bin/env bash
set -euo pipefail

cargo test --manifest-path crates/Cargo.toml --workspace
cargo bench --manifest-path crates/Cargo.toml -p vision-engine --bench stitch_bench -- --sample-size 10
