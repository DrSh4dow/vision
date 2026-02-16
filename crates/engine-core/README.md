# engine-core (Rust)

Performance-critical algorithms.

## Responsibilities

- Geometry, pathing, fill generation
- Optimization (travel, trims/jumps suggestions, sequencing helpers)
- Deterministic results where feasible

## Notes

- Keep IO outside this crate
- Prefer reproducible behavior for testing and future collab
