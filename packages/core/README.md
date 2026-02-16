# core

Document model and operations (DOM-free).

## Responsibilities

- Document schema (zod)
- Stable IDs, serialization, versioning/migrations
- Operations for edits (undo/redo)
- Constraints and validation

## Design rules

- No DOM, no Web APIs
- Deterministic outputs (important for sync/collab)
