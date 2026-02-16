# plugin-sdk

Public plugin API surface (what external plugins depend on).

## Responsibilities

- Stable types, interfaces, and helpers for plugin authors
- Manifest validation types (zod schemas)
- Capability definitions and host/plugin contracts

## Rules

- This package is the compatibility boundary
- Avoid importing app/runtime internals here
